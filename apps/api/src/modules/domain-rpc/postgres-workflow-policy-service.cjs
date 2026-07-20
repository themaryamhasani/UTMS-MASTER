const { getPrismaClient } = require('../../database/prisma-client.cjs');
const { service: applicationService } = require('./postgres-application-service.cjs');

const DEFAULT_WORKFLOW_POLICY_ID = 'standard-tech-lead';

function toWorkflowPolicy(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    versionHistory: {
      mode: row.versionHistoryMode,
      qaReviewOwnerLabel: row.qaReviewOwnerLabel,
      decisionOwnerLabel: row.decisionOwnerLabel,
      requireIndependentDecisionRole: row.requireIndependentDecisionRole,
      capabilityRoles: row.capabilityRoles || {},
    },
  };
}

async function getAll() {
  const prisma = getPrismaClient();
  const rows = await prisma.workflowPolicy.findMany({
    orderBy: { id: 'asc' },
  });
  return rows.map(toWorkflowPolicy);
}

async function getForApplication(applicationId) {
  const prisma = getPrismaClient();
  if (!applicationId || applicationId === 'ALL') {
    return toWorkflowPolicy(await prisma.workflowPolicy.findUnique({
      where: { id: DEFAULT_WORKFLOW_POLICY_ID },
    }));
  }

  const application = await prisma.application.findUnique({
    where: { id: String(applicationId) },
    include: { workflowPolicy: true },
  });
  if (application?.workflowPolicy) return toWorkflowPolicy(application.workflowPolicy);

  const fallback = await prisma.workflowPolicy.findUnique({
    where: { id: DEFAULT_WORKFLOW_POLICY_ID },
  }) || await prisma.workflowPolicy.findFirst({ orderBy: { id: 'asc' } });
  return toWorkflowPolicy(fallback);
}

async function updateApplicationPolicy(applicationId, policyId) {
  const prisma = getPrismaClient();
  const policy = await prisma.workflowPolicy.findUnique({
    where: { id: String(policyId) },
  });
  if (!policy) throw new Error('WORKFLOW_POLICY_NOT_CONFIGURED');

  const application = await prisma.application.findUnique({
    where: { id: String(applicationId) },
  });
  if (!application) return null;

  await prisma.application.update({
    where: { id: String(applicationId) },
    data: { workflowPolicyId: policy.id },
  });
  return applicationService.getById(applicationId);
}

const service = {
  getAll,
  getForApplication,
  updateApplicationPolicy,
};

function canHandleWorkflowPolicyRpc(serviceName, methodName) {
  return serviceName === 'workflowPolicyApi' && typeof service[methodName] === 'function';
}

async function handleWorkflowPolicyRpc(methodName, args) {
  return service[methodName](...(Array.isArray(args) ? args : []));
}

module.exports = {
  canHandleWorkflowPolicyRpc,
  handleWorkflowPolicyRpc,
  service,
};
