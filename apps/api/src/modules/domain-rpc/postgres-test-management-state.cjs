const { getPrismaClient } = require('../../database/prisma-client.cjs');

const TEST_MANAGEMENT_SERVICES = new Set([
  'testRequestApi',
  'requirementApi',
  'flowApi',
  'testCaseApi',
]);

function isTestManagementPersistenceEnabled() {
  return process.env.NODE_ENV !== 'test' || Boolean(process.env.DATABASE_URL);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nullableText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function nullableId(value, validIds) {
  const normalized = nullableText(value);
  return normalized && (!validIds || validIds.has(normalized)) ? normalized : null;
}

function asDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toTestRequest(row) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    title: row.title,
    description: row.description,
    version: row.version,
    buildNumber: row.buildNumber || undefined,
    environment: row.environment,
    priority: row.priority,
    riskLevel: row.riskLevel,
    status: row.status,
    systemUrl: row.systemUrl || undefined,
    selectedRequirementIds: row.selectedRequirements.map(link => link.requirementId),
    testTypes: row.testTypes,
    requesterId: row.requesterId,
    assigneeId: row.assigneeId || undefined,
    requirementId: row.requirementId || undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    reviewedById: row.reviewedById || undefined,
    reviewNotes: row.reviewNotes || undefined,
    submittedAt: row.submittedAt?.toISOString(),
    versionHistoryId: row.versionHistoryId || undefined,
    qaQualityStatus: row.qaQualityStatus || undefined,
    qaQualityNotes: row.qaQualityNotes || undefined,
    securityTestRequired: row.securityTestRequired,
    securityTestConfiguration: row.securityTestConfiguration || undefined,
    securityRequestedById: row.securityRequestedById || undefined,
    securityRequestedAt: row.securityRequestedAt?.toISOString(),
    releaseDecision: row.releaseDecision || undefined,
    releaseDecisionReason: row.releaseDecisionReason || undefined,
    releaseDecisionById: row.releaseDecisionById || undefined,
    releaseDecisionAt: row.releaseDecisionAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRequirement(row) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria || undefined,
    riskNotes: row.riskNotes || undefined,
    status: row.status,
    isActive: row.isActive,
    createdById: row.createdById,
    testRequestId: row.testRequestId || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFlow(row) {
  return {
    id: row.id,
    requirementId: row.requirementId,
    title: row.title,
    description: row.description,
    steps: row.steps || undefined,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTestCase(row) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    testRequestId: row.testRequestId || '',
    requirementId: row.requirementId,
    flowId: row.flowId || undefined,
    title: row.title,
    scenario: row.scenario,
    preconditions: row.preconditions,
    testData: row.testData,
    steps: row.steps,
    expectedResult: row.expectedResult,
    testType: row.testType,
    testDesignTechnique: row.testDesignTechnique,
    testDesignTechniques: row.testDesignTechniques,
    priority: row.priority,
    riskLevel: row.riskLevel,
    qualityAttribute: row.qualityAttribute,
    automationCandidate: row.automationCandidate,
    regressionCandidate: row.regressionCandidate,
    isActive: row.isActive,
    isComplete: row.isComplete,
    readinessErrors: row.readinessErrors,
    status: row.status,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readTestManagementState() {
  if (!isTestManagementPersistenceEnabled()) return null;
  const prisma = getPrismaClient();
  const [testRequests, requirements, flows, testCases] = await Promise.all([
    prisma.testRequest.findMany({
      include: { selectedRequirements: { select: { requirementId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.requirement.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.flow.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.testCase.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    testRequests: testRequests.map(toTestRequest),
    requirements: requirements.map(toRequirement),
    flows: flows.map(toFlow),
    testCases: testCases.map(toTestCase),
  };
}

function hasTestManagementData(state) {
  return Boolean(
    state &&
    (
      asArray(state.testRequests).length ||
      asArray(state.requirements).length ||
      asArray(state.flows).length ||
      asArray(state.testCases).length
    )
  );
}

async function persistTestManagementState(snapshot) {
  if (!isTestManagementPersistenceEnabled()) return;

  const testRequests = asArray(snapshot?.testRequests);
  const requirements = asArray(snapshot?.requirements);
  const flows = asArray(snapshot?.flows);
  const testCases = asArray(snapshot?.testCases);
  const testRequestIds = new Set(testRequests.map(item => String(item.id)));
  const requirementIds = new Set(requirements.map(item => String(item.id)));
  const flowIds = new Set(flows.map(item => String(item.id)));
  const testCaseIds = new Set(testCases.map(item => String(item.id)));
  const prisma = getPrismaClient();

  await prisma.$transaction(async transaction => {
    await transaction.testRequest.updateMany({ data: { requirementId: null } });

    for (const item of testRequests) {
      const data = {
        applicationId: String(item.applicationId),
        title: String(item.title || ''),
        description: String(item.description || ''),
        version: String(item.version || ''),
        buildNumber: nullableText(item.buildNumber),
        environment: String(item.environment || 'development'),
        priority: item.priority || 'MEDIUM',
        riskLevel: item.riskLevel || 'MEDIUM',
        status: item.status || 'DRAFT',
        systemUrl: nullableText(item.systemUrl),
        testTypes: asArray(item.testTypes),
        requesterId: String(item.requesterId),
        assigneeId: nullableId(item.assigneeId),
        requirementId: null,
        reviewedAt: item.reviewedAt ? asDate(item.reviewedAt) : null,
        reviewedById: nullableId(item.reviewedById),
        reviewNotes: nullableText(item.reviewNotes),
        submittedAt: item.submittedAt ? asDate(item.submittedAt) : null,
        versionHistoryId: null,
        qaQualityStatus: item.qaQualityStatus || null,
        qaQualityNotes: nullableText(item.qaQualityNotes),
        securityTestRequired: Boolean(item.securityTestRequired),
        securityTestConfiguration: item.securityTestConfiguration || null,
        securityRequestedById: nullableId(item.securityRequestedById),
        securityRequestedAt: item.securityRequestedAt ? asDate(item.securityRequestedAt) : null,
        releaseDecision: item.releaseDecision || null,
        releaseDecisionReason: nullableText(item.releaseDecisionReason),
        releaseDecisionById: nullableId(item.releaseDecisionById),
        releaseDecisionAt: item.releaseDecisionAt ? asDate(item.releaseDecisionAt) : null,
        createdAt: asDate(item.createdAt),
        updatedAt: asDate(item.updatedAt),
      };
      await transaction.testRequest.upsert({
        where: { id: String(item.id) },
        update: data,
        create: { id: String(item.id), ...data },
      });
    }

    for (const item of requirements) {
      const data = {
        applicationId: String(item.applicationId),
        title: String(item.title || ''),
        description: String(item.description || ''),
        acceptanceCriteria: nullableText(item.acceptanceCriteria),
        riskNotes: nullableText(item.riskNotes),
        status: item.status || 'DRAFT',
        isActive: item.isActive ?? true,
        createdById: String(item.createdById),
        testRequestId: nullableId(item.testRequestId, testRequestIds),
        createdAt: asDate(item.createdAt),
        updatedAt: asDate(item.updatedAt),
      };
      await transaction.requirement.upsert({
        where: { id: String(item.id) },
        update: data,
        create: { id: String(item.id), ...data },
      });
    }

    for (const item of testRequests) {
      await transaction.testRequest.update({
        where: { id: String(item.id) },
        data: { requirementId: nullableId(item.requirementId, requirementIds) },
      });
    }

    await transaction.testRequestRequirement.deleteMany({});
    const requirementLinks = testRequests.flatMap(item =>
      asArray(item.selectedRequirementIds)
        .map(String)
        .filter(requirementId => requirementIds.has(requirementId))
        .map(requirementId => ({
          testRequestId: String(item.id),
          requirementId,
        }))
    );
    if (requirementLinks.length) {
      await transaction.testRequestRequirement.createMany({
        data: requirementLinks,
        skipDuplicates: true,
      });
    }

    for (const item of flows) {
      const data = {
        requirementId: String(item.requirementId),
        title: String(item.title || ''),
        description: String(item.description || ''),
        steps: nullableText(item.steps),
        createdById: String(item.createdById),
        createdAt: asDate(item.createdAt),
        updatedAt: asDate(item.updatedAt),
      };
      await transaction.flow.upsert({
        where: { id: String(item.id) },
        update: data,
        create: { id: String(item.id), ...data },
      });
    }

    for (const item of testCases) {
      const techniques = asArray(item.testDesignTechniques);
      const primaryTechnique = item.testDesignTechnique || techniques[0] || 'REQUIREMENTS_BASED';
      const data = {
        applicationId: String(item.applicationId),
        testRequestId: nullableId(item.testRequestId, testRequestIds),
        requirementId: String(item.requirementId),
        flowId: nullableId(item.flowId, flowIds),
        title: String(item.title || ''),
        scenario: String(item.scenario || ''),
        preconditions: String(item.preconditions || ''),
        testData: String(item.testData || ''),
        steps: String(item.steps || ''),
        expectedResult: String(item.expectedResult || ''),
        testType: item.testType || 'FUNCTIONAL',
        testDesignTechnique: primaryTechnique,
        testDesignTechniques: techniques.length ? techniques : [primaryTechnique],
        priority: item.priority || 'MEDIUM',
        riskLevel: item.riskLevel || 'MEDIUM',
        qualityAttribute: item.qualityAttribute || 'FUNCTIONALITY',
        automationCandidate: Boolean(item.automationCandidate),
        regressionCandidate: Boolean(item.regressionCandidate),
        isActive: item.isActive ?? true,
        isComplete: item.isComplete ?? true,
        readinessErrors: asArray(item.readinessErrors).map(String),
        status: item.status || 'READY',
        createdById: String(item.createdById),
        createdAt: asDate(item.createdAt),
        updatedAt: asDate(item.updatedAt),
      };
      await transaction.testCase.upsert({
        where: { id: String(item.id) },
        update: data,
        create: { id: String(item.id), ...data },
      });
    }

    await transaction.testCase.deleteMany({
      where: testCaseIds.size ? { id: { notIn: [...testCaseIds] } } : {},
    });
    await transaction.flow.deleteMany({
      where: flowIds.size ? { id: { notIn: [...flowIds] } } : {},
    });
    await transaction.requirement.deleteMany({
      where: requirementIds.size ? { id: { notIn: [...requirementIds] } } : {},
    });
    await transaction.testRequest.deleteMany({
      where: testRequestIds.size ? { id: { notIn: [...testRequestIds] } } : {},
    });
  }, { timeout: 30_000 });
}

function isTestManagementService(serviceName) {
  return TEST_MANAGEMENT_SERVICES.has(serviceName);
}

module.exports = {
  hasTestManagementData,
  isTestManagementPersistenceEnabled,
  isTestManagementService,
  persistTestManagementState,
  readTestManagementState,
};
