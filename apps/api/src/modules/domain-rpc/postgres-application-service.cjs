const { randomUUID } = require('crypto');
const { getPrismaClient } = require('../../database/prisma-client.cjs');

const DEFAULT_WORKFLOW_POLICY_ID = 'standard-tech-lead';
const APPLICATION_CDE_ROOT_PREFIXES = {
  cdeFrontUrl: 'https://cde.edus.ir/front/',
  cdeDataServiceUrl: 'https://cde.edus.ir/dservice/',
  cdeGatewayUrl: 'https://cde.edus.ir/back/',
};

function assertApplicationCdeRoots(data) {
  for (const [field, prefix] of Object.entries(APPLICATION_CDE_ROOT_PREFIXES)) {
    const value = typeof data?.[field] === 'string' ? data[field].trim() : '';
    if (!value) continue;
    if (!value.startsWith('https://cde.edus.ir/') || !value.startsWith(prefix)) {
      throw new Error('APPLICATION_CDE_ROOT_INVALID');
    }
    try {
      new URL(value);
    } catch {
      throw new Error('APPLICATION_CDE_ROOT_INVALID');
    }
  }
}

function nullableText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function toApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || undefined,
    cdeFrontUrl: row.cdeFrontUrl || undefined,
    cdeDataServiceUrl: row.cdeDataServiceUrl || undefined,
    cdeGatewayUrl: row.cdeGatewayUrl || undefined,
    workflowPolicyId: row.workflowPolicyId || undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveWorkflowPolicyId(prisma, requestedPolicyId) {
  const id = requestedPolicyId || DEFAULT_WORKFLOW_POLICY_ID;
  const policy = await prisma.workflowPolicy.findUnique({ where: { id } });
  if (policy) return policy.id;

  const fallback = await prisma.workflowPolicy.findFirst({ orderBy: { id: 'asc' } });
  return fallback?.id || null;
}

async function getAll() {
  const prisma = getPrismaClient();
  const rows = await prisma.application.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toApplication);
}

async function getById(id) {
  const prisma = getPrismaClient();
  const row = await prisma.application.findUnique({ where: { id: String(id) } });
  return toApplication(row);
}

async function create(data = {}) {
  assertApplicationCdeRoots(data);
  const prisma = getPrismaClient();
  const workflowPolicyId = await resolveWorkflowPolicyId(prisma, data.workflowPolicyId);

  const row = await prisma.application.create({
    data: {
      id: data.id || randomUUID(),
      name: String(data.name || '').trim(),
      code: String(data.code || '').trim(),
      description: nullableText(data.description),
      cdeFrontUrl: nullableText(data.cdeFrontUrl),
      cdeDataServiceUrl: nullableText(data.cdeDataServiceUrl),
      cdeGatewayUrl: nullableText(data.cdeGatewayUrl),
      workflowPolicyId,
      isActive: data.isActive ?? true,
    },
  });
  return toApplication(row);
}

async function update(id, data = {}) {
  assertApplicationCdeRoots(data);
  const prisma = getPrismaClient();
  const existing = await prisma.application.findUnique({ where: { id: String(id) } });
  if (!existing) return null;

  const patch = {};
  if ('name' in data) patch.name = String(data.name || '').trim();
  if ('code' in data) patch.code = String(data.code || '').trim();
  if ('description' in data) patch.description = nullableText(data.description);
  if ('cdeFrontUrl' in data) patch.cdeFrontUrl = nullableText(data.cdeFrontUrl);
  if ('cdeDataServiceUrl' in data) patch.cdeDataServiceUrl = nullableText(data.cdeDataServiceUrl);
  if ('cdeGatewayUrl' in data) patch.cdeGatewayUrl = nullableText(data.cdeGatewayUrl);
  if ('isActive' in data) patch.isActive = Boolean(data.isActive);
  if ('workflowPolicyId' in data) {
    patch.workflowPolicyId = await resolveWorkflowPolicyId(prisma, data.workflowPolicyId);
  }

  const row = await prisma.application.update({
    where: { id: String(id) },
    data: patch,
  });
  return toApplication(row);
}

async function deactivate(id) {
  return update(id, { isActive: false });
}

const service = {
  getAll,
  getById,
  create,
  update,
  deactivate,
};

function canHandleApplicationRpc(serviceName, methodName) {
  return serviceName === 'applicationApi' && typeof service[methodName] === 'function';
}

async function handleApplicationRpc(methodName, args) {
  return service[methodName](...(Array.isArray(args) ? args : []));
}

module.exports = {
  canHandleApplicationRpc,
  handleApplicationRpc,
  service,
};
