const { createHash, createHmac, randomBytes, timingSafeEqual } = require('crypto');
const argon2 = require('argon2');
const { getPrismaClient } = require('../../database/prisma-client.cjs');

const SESSION_COOKIE = process.env.UTMS_SESSION_COOKIE || 'utms_session';
const SESSION_TTL_MS = Number(process.env.UTMS_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const CSRF_SECRET = process.env.UTMS_CSRF_SECRET || 'utms-development-csrf-secret-change-me';
const LEGACY_CONTEXT_ENABLED = ['test', 'development'].includes(process.env.NODE_ENV || 'development') &&
  process.env.UTMS_ALLOW_LEGACY_CONTEXT !== 'false';

class AuthSessionError extends Error {
  constructor(category, message, statusCode = 401) {
    super(message);
    this.category = category;
    this.statusCode = statusCode;
  }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function parseCookies(headerValue) {
  return String(headerValue || '').split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
    return cookies;
  }, {});
}

function requestSessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

function csrfForToken(token) {
  return createHmac('sha256', CSRF_SECRET).update(String(token)).digest('base64url');
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function setSessionCookie(res, token, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.setHeader('set-cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function toUser(row) {
  return row ? {
    id: row.id,
    nationalCode: row.nationalCode || undefined,
    phoneNumber: row.phoneNumber,
    fullName: row.fullName,
    email: row.email || undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } : null;
}

function assignmentApplicationIds(assignment, activeApplicationIds) {
  if (!assignment) return [];
  if (assignment.scope === 'APP') return [...activeApplicationIds];
  const selected = assignment.applications?.length
    ? assignment.applications.map(item => item.applicationId)
    : [assignment.applicationId];
  const active = new Set(activeApplicationIds);
  return Array.from(new Set(selected.filter(id => active.has(id))));
}

async function sessionContext(prisma, session) {
  const applicationIds = session.scopeApplicationIds?.length
    ? session.scopeApplicationIds
    : [session.applicationId].filter(Boolean);
  const applications = await prisma.application.findMany({
    where: session.scope === 'APP'
      ? { isActive: true }
      : { id: { in: applicationIds }, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const application = applications.find(item => item.id === session.applicationId) || applications[0] || null;
  return {
    contextId: session.contextId,
    userId: session.userId,
    user: toUser(session.user),
    assignmentId: session.assignmentId || undefined,
    assignmentIds: session.assignmentId ? [session.assignmentId] : [],
    applicationId: session.scope === 'APP' ? 'ALL' : application?.id,
    scopeApplicationIds: applications.map(item => item.id),
    application: application ? serializeApplication(application) : undefined,
    applications: applications.map(serializeApplication),
    role: session.role,
    scope: session.scope,
  };
}

function serializeApplication(application) {
  return {
    id: application.id,
    name: application.name,
    code: application.code,
    description: application.description || undefined,
    workflowPolicyId: application.workflowPolicyId || undefined,
    isActive: application.isActive,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

async function resolveUtmsSession(req) {
  const token = requestSessionToken(req);
  if (!token) return null;
  const prisma = getPrismaClient();
  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    include: { user: true, assignment: true },
  });
  if (!session) return null;
  const context = await sessionContext(prisma, session);
  return { session, context, token, csrfToken: csrfForToken(token) };
}

async function attachUtmsSession(req) {
  const resolved = await resolveUtmsSession(req);
  req.utmsSession = resolved?.session || null;
  req.utmsContext = resolved?.context || null;
  req.utmsCsrfToken = resolved?.csrfToken || null;
  return resolved;
}

function requireUtmsSession(req) {
  if (!req.utmsSession || !req.utmsContext) {
    throw new AuthSessionError('AUTHENTICATION_REQUIRED', 'A valid UTMS session is required.', 401);
  }
  return { session: req.utmsSession, context: req.utmsContext };
}

function assertCsrf(req) {
  requireUtmsSession(req);
  const supplied = req.headers['x-csrf-token'];
  if (!constantTimeEqual(supplied, req.utmsCsrfToken)) {
    throw new AuthSessionError('CSRF_VALIDATION_FAILED', 'The CSRF token is missing or invalid.', 403);
  }
}

async function verifyPassword(credential, password, prisma) {
  const hash = String(credential.passwordHash || '');
  if (hash.startsWith('$argon2')) {
    return argon2.verify(hash, String(password || ''));
  }
  const valid = constantTimeEqual(hash, sha256(password));
  if (valid) {
    const upgraded = await argon2.hash(String(password), { type: argon2.argon2id });
    await prisma.userCredential.update({ where: { userId: credential.userId }, data: { passwordHash: upgraded } });
  }
  return valid;
}

async function activeAssignmentsForUser(prisma, userId) {
  return prisma.userRoleAssignment.findMany({
    where: { userId, isActive: true },
    include: { applications: true },
    orderBy: [{ createdAt: 'asc' }],
  });
}

async function createSession(req, res, user, assignment) {
  const prisma = getPrismaClient();
  const activeApplications = await prisma.application.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const applicationIds = assignmentApplicationIds(assignment, activeApplications.map(item => item.id));
  if (!applicationIds.length) {
    throw new AuthSessionError('NO_ACTIVE_CONTEXT', 'No active application context is assigned to this user.', 403);
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const contextId = `context:${user.id}:${assignment.role}:${assignment.id}`;
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      assignmentId: assignment.id,
      contextId,
      role: assignment.role,
      scope: assignment.scope,
      applicationId: applicationIds[0],
      scopeApplicationIds: applicationIds,
      tokenHash: sha256(token),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 2000) || null,
      expiresAt,
    },
    include: { user: true, assignment: true },
  });
  setSessionCookie(res, token, expiresAt);
  const context = await sessionContext(prisma, session);
  req.utmsSession = session;
  req.utmsContext = context;
  req.utmsCsrfToken = csrfForToken(token);
  return { session, context, csrfToken: req.utmsCsrfToken };
}

async function login(req, res, body) {
  const phoneNumber = String(body.phoneNumber || '').trim();
  const password = String(body.password || '');
  if (!phoneNumber || !password) {
    throw new AuthSessionError('INVALID_CREDENTIALS', 'Phone number and password are required.', 400);
  }
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { phoneNumber }, include: { credential: true } });
  if (!user?.isActive || !user.credential || !(await verifyPassword(user.credential, password, prisma))) {
    throw new AuthSessionError('INVALID_CREDENTIALS', 'Phone number or password is incorrect.', 401);
  }
  const assignments = await activeAssignmentsForUser(prisma, user.id);
  if (!assignments.length) {
    throw new AuthSessionError('NO_ACTIVE_CONTEXT', 'No active role assignment exists for this user.', 403);
  }
  const created = await createSession(req, res, user, assignments[0]);
  return {
    user: toUser(user),
    activeContext: created.context,
    csrfToken: created.csrfToken,
    expiresAt: created.session.expiresAt.toISOString(),
  };
}

async function selectContext(req, body) {
  assertCsrf(req);
  const { session } = requireUtmsSession(req);
  const assignmentId = String(body.assignmentId || '').trim();
  const prisma = getPrismaClient();
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { id: assignmentId, userId: session.userId, isActive: true },
    include: { applications: true },
  });
  if (!assignment) throw new AuthSessionError('CONTEXT_NOT_ALLOWED', 'The requested context is not assigned to this user.', 403);
  const applications = await prisma.application.findMany({ where: { isActive: true }, select: { id: true } });
  const applicationIds = assignmentApplicationIds(assignment, applications.map(item => item.id));
  if (!applicationIds.length) throw new AuthSessionError('NO_ACTIVE_CONTEXT', 'The selected context has no active applications.', 403);
  const updated = await prisma.userSession.update({
    where: { id: session.id },
    data: {
      assignmentId: assignment.id,
      contextId: `context:${session.userId}:${assignment.role}:${assignment.id}`,
      role: assignment.role,
      scope: assignment.scope,
      applicationId: applicationIds[0],
      scopeApplicationIds: applicationIds,
    },
    include: { user: true, assignment: true },
  });
  req.utmsSession = updated;
  req.utmsContext = await sessionContext(prisma, updated);
  return { activeContext: req.utmsContext };
}

async function logout(req, res) {
  const token = requestSessionToken(req);
  if (token) {
    await getPrismaClient().userSession.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookie(res);
  req.utmsSession = null;
  req.utmsContext = null;
  return { authenticated: false };
}

function canHandleAuth(pathname) {
  return pathname === '/api/auth/login' || pathname === '/api/auth/session' ||
    pathname === '/api/auth/context' || pathname === '/api/auth/logout';
}

async function handleAuth(req, parsedUrl, body, res) {
  const pathname = parsedUrl.pathname;
  if (pathname === '/api/auth/login' && req.method === 'POST') return login(req, res, body);
  if (pathname === '/api/auth/session' && req.method === 'GET') {
    const resolved = requireUtmsSession(req);
    return {
      authenticated: true,
      activeContext: resolved.context,
      csrfToken: req.utmsCsrfToken,
      expiresAt: resolved.session.expiresAt.toISOString(),
    };
  }
  if (pathname === '/api/auth/context' && req.method === 'POST') return selectContext(req, body);
  if (pathname === '/api/auth/logout' && ['POST', 'DELETE'].includes(req.method)) {
    if (req.utmsSession) assertCsrf(req);
    return logout(req, res);
  }
  throw new AuthSessionError('AUTH_ENDPOINT_NOT_FOUND', 'Authentication endpoint not found.', 404);
}

module.exports = {
  AuthSessionError,
  LEGACY_CONTEXT_ENABLED,
  assertCsrf,
  attachUtmsSession,
  canHandleAuth,
  handleAuth,
  requireUtmsSession,
  resolveUtmsSession,
  sessionContext,
  sha256,
};
