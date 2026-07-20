const { createHash, randomInt, randomUUID } = require('crypto');
const { getPrismaClient } = require('../../database/prisma-client.cjs');

const MIN_USER_PASSWORD_LENGTH = 6;
const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;

function passwordHash(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

function assertPasswordIsUsable(password) {
  if (!password || String(password).length < MIN_USER_PASSWORD_LENGTH) {
    throw new Error('PASSWORD_TOO_SHORT');
  }
}

function nullableText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nationalCode: row.nationalCode || undefined,
    phoneNumber: row.phoneNumber,
    fullName: row.fullName,
    email: row.email || undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRoleAssignment(row) {
  const applicationIds = row.applications?.length
    ? row.applications.map(item => item.applicationId)
    : [row.applicationId].filter(Boolean);

  return {
    id: row.id,
    userId: row.userId,
    applicationId: row.applicationId,
    applicationIds,
    role: row.role,
    scope: row.scope,
    automatedTestsEnabled: row.role === 'QA_SPECIALIST' ? row.automatedTestsEnabled : undefined,
    isActive: row.isActive,
  };
}

function normalizeApplicationScope(scope) {
  if (!scope || scope === 'ALL') return undefined;
  if (Array.isArray(scope)) return scope.length ? scope.map(String) : undefined;
  const value = String(scope);
  if (value.includes(',')) {
    const values = value.split(',').map(item => item.trim()).filter(Boolean);
    return values.length ? values : undefined;
  }
  return [value];
}

function assignmentMatchesApplicationScope(assignment, scope) {
  const ids = normalizeApplicationScope(scope);
  if (!ids) return true;
  if (assignment.scope === 'APP') return true;
  const scopedIds = assignment.applications?.length
    ? assignment.applications.map(item => item.applicationId)
    : [assignment.applicationId].filter(Boolean);
  return scopedIds.some(applicationId => ids.includes(applicationId));
}

function maskEmailAddress(email) {
  const [local = '', domain = ''] = String(email).split('@');
  if (!domain) return email;
  const visibleLocal = local.length <= 2 ? local[0] || '*' : `${local.slice(0, 2)}***`;
  return `${visibleLocal}@${domain}`;
}

function resolveUserEmail(user) {
  return user.email || `${user.phoneNumber}@utms.local`;
}

function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

async function getAll() {
  const prisma = getPrismaClient();
  const rows = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });
  return rows.map(toUser);
}

async function getById(id) {
  const prisma = getPrismaClient();
  const row = await prisma.user.findUnique({ where: { id: String(id) } });
  return toUser(row);
}

async function getRoleAssignments(userId) {
  const prisma = getPrismaClient();
  const rows = await prisma.userRoleAssignment.findMany({
    where: userId ? { userId: String(userId) } : undefined,
    include: { applications: true },
    orderBy: [{ userId: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toRoleAssignment);
}

async function authenticate(phoneNumber, password) {
  const prisma = getPrismaClient();
  const row = await prisma.user.findUnique({
    where: { phoneNumber: String(phoneNumber || '').trim() },
    include: { credential: true },
  });
  if (!row?.isActive || !row.credential) return null;
  return row.credential.passwordHash === passwordHash(password) ? toUser(row) : null;
}

async function requestPasswordResetOtp(phoneNumber) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { phoneNumber: String(phoneNumber || '').trim() },
  });
  if (!user?.isActive) return null;

  const code = generateOtpCode();
  await prisma.passwordResetOtp.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      codeHash: passwordHash(code),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS),
    },
  });

  return {
    maskedEmail: maskEmailAddress(resolveUserEmail(user)),
    otpCode: code,
  };
}

async function resetPasswordWithOtp(phoneNumber, code, newPassword) {
  assertPasswordIsUsable(newPassword);
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { phoneNumber: String(phoneNumber || '').trim() },
  });
  if (!user?.isActive) return false;

  const otp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      codeHash: passwordHash(String(code || '').trim()),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { requestedAt: 'desc' },
  });
  if (!otp) return false;

  await prisma.$transaction([
    prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.userCredential.upsert({
      where: { userId: user.id },
      update: { passwordHash: passwordHash(newPassword) },
      create: { userId: user.id, passwordHash: passwordHash(newPassword) },
    }),
  ]);
  return true;
}

async function assertUniqueUserFields(prisma, data, existingUserId) {
  const checks = [];
  const nationalCode = nullableText(data.nationalCode);
  const phoneNumber = nullableText(data.phoneNumber);
  const email = nullableText(data.email);

  if (nationalCode) checks.push({ nationalCode });
  if (phoneNumber) checks.push({ phoneNumber });
  if (email) checks.push({ email });
  if (!checks.length) return;

  const duplicate = await prisma.user.findFirst({
    where: {
      OR: checks,
      ...(existingUserId ? { NOT: { id: existingUserId } } : {}),
    },
  });
  if (duplicate) throw new Error('DUPLICATE_USER');
}

async function create(data = {}) {
  const prisma = getPrismaClient();
  assertPasswordIsUsable(data.password || '123456');
  await assertUniqueUserFields(prisma, data);

  const row = await prisma.$transaction(async transaction => {
    const user = await transaction.user.create({
      data: {
        id: data.id || randomUUID(),
        nationalCode: nullableText(data.nationalCode),
        phoneNumber: String(data.phoneNumber || '').trim(),
        fullName: String(data.fullName || '').trim(),
        email: nullableText(data.email),
        isActive: data.isActive ?? true,
      },
    });
    await transaction.userCredential.create({
      data: {
        userId: user.id,
        passwordHash: passwordHash(data.password || '123456'),
      },
    });
    return user;
  });

  return toUser(row);
}

async function update(id, data = {}) {
  const prisma = getPrismaClient();
  const userId = String(id);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  await assertUniqueUserFields(prisma, data, userId);

  const patch = {};
  if ('nationalCode' in data) patch.nationalCode = nullableText(data.nationalCode);
  if ('phoneNumber' in data) patch.phoneNumber = String(data.phoneNumber || '').trim();
  if ('fullName' in data) patch.fullName = String(data.fullName || '').trim();
  if ('email' in data) patch.email = nullableText(data.email);
  if ('isActive' in data) patch.isActive = Boolean(data.isActive);

  const row = await prisma.user.update({
    where: { id: userId },
    data: patch,
  });
  return toUser(row);
}

async function deactivate(id) {
  return update(id, { isActive: false });
}

async function deleteUser(id) {
  const prisma = getPrismaClient();
  const userId = String(id);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return false;
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

async function setPassword(id, password) {
  assertPasswordIsUsable(password);
  const prisma = getPrismaClient();
  const userId = String(id);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  await prisma.userCredential.upsert({
    where: { userId },
    update: { passwordHash: passwordHash(password) },
    create: { userId, passwordHash: passwordHash(password) },
  });
  return toUser(await prisma.user.findUnique({ where: { id: userId } }));
}

async function resolveAssignmentApplicationIds(prisma, scope, applicationIds) {
  const activeApplications = await prisma.application.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const activeApplicationIds = activeApplications.map(application => application.id);
  const requestedIds = Array.from(new Set((applicationIds || []).map(String).filter(Boolean)));
  const resolvedIds = requestedIds.length ? requestedIds : activeApplicationIds;

  if (scope === 'SYSTEMS' && resolvedIds.length === 0) {
    throw new Error('ASSIGNMENT_APPLICATION_REQUIRED');
  }

  const activeIdSet = new Set(activeApplicationIds);
  resolvedIds.forEach(applicationId => {
    if (!activeIdSet.has(applicationId)) {
      throw new Error('ASSIGNMENT_APPLICATION_NOT_FOUND');
    }
  });
  return resolvedIds;
}

async function replaceRoleAssignments(userId, data = {}) {
  const prisma = getPrismaClient();
  const role = String(data.role || '');
  const scope = data.scope === 'APP' ? 'APP' : 'SYSTEMS';
  const applicationIds = await resolveAssignmentApplicationIds(prisma, scope, data.applicationIds);
  const primaryApplicationId = applicationIds[0];
  if (!primaryApplicationId) {
    throw new Error('ASSIGNMENT_APPLICATION_REQUIRED');
  }

  const row = await prisma.$transaction(async transaction => {
    const assignments = await transaction.userRoleAssignment.findMany({
      where: { userId: String(userId), role },
      orderBy: { createdAt: 'asc' },
    });
    const [existingAssignment, ...duplicateAssignments] = assignments;
    const assignmentId = existingAssignment?.id || randomUUID();
    const assignmentData = {
      userId: String(userId),
      applicationId: primaryApplicationId,
      role,
      scope,
      automatedTestsEnabled: role === 'QA_SPECIALIST' ? data.automatedTestsEnabled !== false : false,
      isActive: true,
    };

    const assignment = existingAssignment
      ? await transaction.userRoleAssignment.update({
          where: { id: existingAssignment.id },
          data: assignmentData,
        })
      : await transaction.userRoleAssignment.create({
          data: { id: assignmentId, ...assignmentData },
        });

    if (duplicateAssignments.length) {
      await transaction.userRoleAssignment.updateMany({
        where: { id: { in: duplicateAssignments.map(item => item.id) } },
        data: { isActive: false },
      });
    }

    await transaction.userRoleAssignmentApplication.deleteMany({
      where: { assignmentId: assignment.id },
    });
    await transaction.userRoleAssignmentApplication.createMany({
      data: applicationIds.map(applicationId => ({
        assignmentId: assignment.id,
        applicationId,
      })),
      skipDuplicates: true,
    });

    return transaction.userRoleAssignment.findUnique({
      where: { id: assignment.id },
      include: { applications: true },
    });
  });

  return row ? [toRoleAssignment(row)] : [];
}

async function setRoleActive(userId, role, isActive) {
  const prisma = getPrismaClient();
  await prisma.userRoleAssignment.updateMany({
    where: { userId: String(userId), role: String(role) },
    data: { isActive: Boolean(isActive) },
  });
  const rows = await prisma.userRoleAssignment.findMany({
    where: { userId: String(userId), role: String(role) },
    include: { applications: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toRoleAssignment);
}

async function lookupByNationalCode(nationalCode) {
  const prisma = getPrismaClient();
  const value = String(nationalCode || '').trim();
  if (!value) return null;
  return toUser(await prisma.user.findUnique({ where: { nationalCode: value } }));
}

async function usersForRoles(applicationScope, roles) {
  const prisma = getPrismaClient();
  const assignments = await prisma.userRoleAssignment.findMany({
    where: {
      isActive: true,
      role: { in: roles },
      user: { isActive: true },
    },
    include: {
      applications: true,
      user: true,
    },
  });
  const usersById = new Map();
  assignments
    .filter(assignment => assignmentMatchesApplicationScope(assignment, applicationScope))
    .forEach(assignment => {
      usersById.set(assignment.user.id, toUser(assignment.user));
    });
  return Array.from(usersById.values());
}

async function getDevelopers(applicationId) {
  return usersForRoles(applicationId, ['DEVELOPER']);
}

async function getQASpecialists(applicationId) {
  return usersForRoles(applicationId, ['QA_SPECIALIST', 'QA_LEAD']);
}

const service = {
  authenticate,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getAll,
  getById,
  getRoleAssignments,
  create,
  replaceRoleAssignments,
  update,
  deactivate,
  deleteUser,
  setPassword,
  setRoleActive,
  lookupByNationalCode,
  getDevelopers,
  getQASpecialists,
};

function canHandleUserRpc(serviceName, methodName) {
  return serviceName === 'userApi' && typeof service[methodName] === 'function';
}

async function handleUserRpc(methodName, args) {
  return service[methodName](...(Array.isArray(args) ? args : []));
}

module.exports = {
  canHandleUserRpc,
  handleUserRpc,
  service,
};
