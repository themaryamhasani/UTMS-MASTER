const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { createHash } = require('crypto');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/UTMS?schema=public';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const createdAt = new Date('2024-01-01T00:00:00Z');

function passwordHash(password) {
  return createHash('sha256').update(password).digest('hex');
}

async function seedWorkflowPolicies() {
  const standardCapabilityRoles = {
    'versionHistory:create': ['QA_LEAD', 'TECH_LEAD'],
    'versionHistory:qaReview': ['QA_LEAD'],
    'versionHistory:decide': ['TECH_LEAD'],
    'versionHistory:riskAccept': ['TECH_LEAD', 'PRODUCT_OWNER'],
    'versionHistory:comment': ['QA_LEAD', 'TECH_LEAD', 'PRODUCT_OWNER', 'SECURITY_REVIEWER'],
    'versionHistory:view': ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'TECH_LEAD', 'PRODUCT_OWNER', 'SECURITY_REVIEWER'],
  };

  const qaOwnedCapabilityRoles = {
    ...standardCapabilityRoles,
    'versionHistory:decide': ['QA_LEAD'],
    'versionHistory:riskAccept': ['QA_LEAD', 'PRODUCT_OWNER'],
  };

  await prisma.workflowPolicy.upsert({
    where: { id: 'standard-tech-lead' },
    update: {
      name: 'Standard Tech Lead Decision',
      description: 'QA reviews release quality and Tech Lead owns the final VersionHistory decision.',
      versionHistoryMode: 'TECH_LEAD_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'Tech Lead',
      requireIndependentDecisionRole: true,
      capabilityRoles: standardCapabilityRoles,
    },
    create: {
      id: 'standard-tech-lead',
      name: 'Standard Tech Lead Decision',
      description: 'QA reviews release quality and Tech Lead owns the final VersionHistory decision.',
      versionHistoryMode: 'TECH_LEAD_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'Tech Lead',
      requireIndependentDecisionRole: true,
      capabilityRoles: standardCapabilityRoles,
    },
  });

  await prisma.workflowPolicy.upsert({
    where: { id: 'qa-owned-release' },
    update: {
      name: 'QA Owned Release Decision',
      description: 'QA Lead owns both quality review and final VersionHistory decision.',
      versionHistoryMode: 'QA_OWNED_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'QA Lead',
      requireIndependentDecisionRole: false,
      capabilityRoles: qaOwnedCapabilityRoles,
    },
    create: {
      id: 'qa-owned-release',
      name: 'QA Owned Release Decision',
      description: 'QA Lead owns both quality review and final VersionHistory decision.',
      versionHistoryMode: 'QA_OWNED_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'QA Lead',
      requireIndependentDecisionRole: false,
      capabilityRoles: qaOwnedCapabilityRoles,
    },
  });
}

async function seedDemoIdentityAndApplications() {
  const applications = [
    {
      id: 'app-1',
      name: 'سامانه بانکداری آنلاین',
      code: 'ONLINE_BANKING',
      description: 'سیستم بانکداری اینترنتی برای مشتریان',
      cdeFrontUrl: 'https://cde.edus.ir/front/directory/medu-community%3EApp',
      cdeDataServiceUrl: 'https://cde.edus.ir/dservice/directory/medu-community%3EApp',
      cdeGatewayUrl: 'https://cde.edus.ir/back/medu-ai/medu-community%3E?return=/workspace/medu-ai',
      workflowPolicyId: 'standard-tech-lead',
    },
    {
      id: 'app-2',
      name: 'سامانه مدیریت منابع انسانی',
      code: 'HRM',
      description: 'سیستم مدیریت کارکنان و منابع انسانی',
      cdeFrontUrl: 'https://cde.edus.ir/front/directory/hrm%3EApp',
      cdeDataServiceUrl: 'https://cde.edus.ir/dservice/directory/hrm%3EApp',
      cdeGatewayUrl: 'https://cde.edus.ir/back/hrm/hrm%3E?return=/workspace/hrm',
      workflowPolicyId: 'qa-owned-release',
    },
    {
      id: 'app-3',
      name: 'پورتال کارمندان',
      code: 'EMPLOYEE_PORTAL',
      description: 'پورتال خدمات کارمندان',
      cdeFrontUrl: 'https://cde.edus.ir/front/directory/employee-portal%3EApp',
      cdeDataServiceUrl: 'https://cde.edus.ir/dservice/directory/employee-portal%3EApp',
      cdeGatewayUrl: 'https://cde.edus.ir/back/employee-portal/employee-portal%3E?return=/workspace/employee-portal',
      workflowPolicyId: 'standard-tech-lead',
    },
  ];

  for (const application of applications) {
    await prisma.application.upsert({
      where: { id: application.id },
      update: {
        name: application.name,
        code: application.code,
        description: application.description,
        cdeFrontUrl: application.cdeFrontUrl,
        cdeDataServiceUrl: application.cdeDataServiceUrl,
        cdeGatewayUrl: application.cdeGatewayUrl,
        workflowPolicyId: application.workflowPolicyId,
        isActive: true,
      },
      create: {
        ...application,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  const users = [
    ['user-1', '0012345678', '09121234567', 'Ahmad Mohammadi', 'ahmad@example.com'],
    ['user-2', '0023456789', '09122345678', 'Sara Ahmadi', 'sara@example.com'],
    ['user-3', '0034567890', '09123456789', 'Ali Rezaei', 'ali@example.com'],
    ['user-4', '0045678901', '09124567890', 'Maryam Karimi', 'maryam@example.com'],
    ['user-5', '0056789012', '09125678901', 'Hossein Nouri', 'hossein@example.com'],
    ['user-6', '0067890123', '09126789012', 'Zahra Fathi', 'zahra@example.com'],
    ['user-7', '0078901234', '09127890123', 'Mohammad Hosseini', 'mohammad@example.com'],
    ['user-8', '0089012345', '09128901234', 'Fatemeh Sadeghi', 'fatemeh@example.com'],
    ['user-10', '1012345678', '09131234567', 'Reza Ghasemi (QA Lead)', 'reza.qa@example.com'],
    ['user-11', '1023456789', '09132345678', 'Nasrin Taheri (Tech Lead)', 'nasrin.tl@example.com'],
    ['user-12', '1034567890', '09133456789', 'Amir Jafari (Product Owner)', 'amir.po@example.com'],
    ['user-13', '1045678901', '09134567890', 'Leila Mousavi (QA Specialist)', 'leila.qs@example.com'],
    ['user-14', '1056789012', '09135678901', 'Kamran Nikou (BA)', 'kamran.ba@example.com'],
    ['user-15', '1067890123', '09136789012', 'Shima Rahimi (Developer)', 'shima.dev@example.com'],
    ['user-admin', '0010000000', '09120000000', 'System Admin', 'admin@example.com'],
  ];

  for (const [id, nationalCode, phoneNumber, fullName, email] of users) {
    await prisma.user.upsert({
      where: { id },
      update: {
        nationalCode,
        phoneNumber,
        fullName,
        email,
        isActive: true,
      },
      create: {
        id,
        nationalCode,
        phoneNumber,
        fullName,
        email,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.userCredential.upsert({
      where: { userId: id },
      update: {
        passwordHash: passwordHash('123456'),
      },
      create: {
        userId: id,
        passwordHash: passwordHash('123456'),
        updatedAt: createdAt,
      },
    });
  }

  const assignments = [
    ['ura-1', 'user-1', 'app-1', ['app-1'], 'DEVELOPER', 'SYSTEMS', false],
    ['ura-2', 'user-2', 'app-1', ['app-1'], 'QA_LEAD', 'SYSTEMS', false],
    ['ura-3', 'user-3', 'app-1', ['app-1'], 'QA_SPECIALIST', 'SYSTEMS', true],
    ['ura-4', 'user-4', 'app-1', ['app-1'], 'BA', 'SYSTEMS', false],
    ['ura-5', 'user-5', 'app-1', ['app-1', 'app-2', 'app-3'], 'SECURITY_REVIEWER', 'APP', false],
    ['ura-6', 'user-6', 'app-1', ['app-1'], 'TECH_LEAD', 'SYSTEMS', false],
    ['ura-7', 'user-7', 'app-1', ['app-1'], 'PRODUCT_OWNER', 'SYSTEMS', false],
    ['ura-8', 'user-8', 'app-1', ['app-1'], 'DEVELOPER', 'SYSTEMS', false],
    ['ura-9', 'user-2', 'app-2', ['app-1', 'app-2'], 'QA_LEAD', 'SYSTEMS', false],
    ['ura-10', 'user-1', 'app-2', ['app-2'], 'DEVELOPER', 'SYSTEMS', false],
    ['ura-11', 'user-1', 'app-2', ['app-2'], 'BA', 'SYSTEMS', false],
    ['ura-app-qa', 'user-10', 'app-1', ['app-1', 'app-2', 'app-3'], 'QA_LEAD', 'APP', false],
    ['ura-app-tl', 'user-11', 'app-1', ['app-1', 'app-2', 'app-3'], 'TECH_LEAD', 'APP', false],
    ['ura-app-po', 'user-12', 'app-1', ['app-1', 'app-2', 'app-3'], 'PRODUCT_OWNER', 'APP', false],
    ['ura-app-qs', 'user-13', 'app-1', ['app-1', 'app-2', 'app-3'], 'QA_SPECIALIST', 'APP', true],
    ['ura-app-ba', 'user-14', 'app-1', ['app-1', 'app-2', 'app-3'], 'BA', 'APP', false],
    ['ura-app-dev', 'user-15', 'app-1', ['app-1', 'app-2', 'app-3'], 'DEVELOPER', 'APP', false],
    ['ura-admin', 'user-admin', 'app-1', ['app-1', 'app-2', 'app-3'], 'SYSTEM_ADMIN', 'APP', true],
  ];

  for (const [id, userId, applicationId, applicationIds, role, scope, automatedTestsEnabled] of assignments) {
    await prisma.userRoleAssignment.upsert({
      where: { id },
      update: {
        userId,
        applicationId,
        role,
        scope,
        automatedTestsEnabled,
        isActive: true,
      },
      create: {
        id,
        userId,
        applicationId,
        role,
        scope,
        automatedTestsEnabled,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.userRoleAssignmentApplication.deleteMany({
      where: { assignmentId: id },
    });
    await prisma.userRoleAssignmentApplication.createMany({
      data: applicationIds.map(appId => ({
        assignmentId: id,
        applicationId: appId,
        createdAt,
      })),
      skipDuplicates: true,
    });
  }
}

async function seedSystemSettings() {
  await prisma.playwrightRunnerSetting.upsert({
    where: { id: 'default' },
    update: {
      enabled: true,
      autoDiscovery: true,
      runnerId: 'runner-default',
      commandTemplate: 'npx playwright test {testFilePath}',
      defaultWorkingDirectory: '/repo',
      defaultTimeoutSeconds: 120,
      artifactRoot: '/object-storage/playwright',
      secretReference: 'secret/playwright/default',
    },
    create: {
      id: 'default',
      enabled: true,
      autoDiscovery: true,
      runnerId: 'runner-default',
      commandTemplate: 'npx playwright test {testFilePath}',
      defaultWorkingDirectory: '/repo',
      defaultTimeoutSeconds: 120,
      artifactRoot: '/object-storage/playwright',
      secretReference: 'secret/playwright/default',
    },
  });

  await prisma.integrationAdapterSetting.upsert({
    where: { provider: 'CDE' },
    update: {
      enabled: false,
      baseUrl: 'https://cde.example.local/api',
      credentialReference: 'secret/integrations/cde',
      syncDirection: 'PULL',
      lastHealthStatus: 'DISABLED',
    },
    create: {
      provider: 'CDE',
      enabled: false,
      baseUrl: 'https://cde.example.local/api',
      credentialReference: 'secret/integrations/cde',
      syncDirection: 'PULL',
      lastHealthStatus: 'DISABLED',
    },
  });

  await prisma.integrationAdapterSetting.upsert({
    where: { provider: 'FAVA' },
    update: {
      enabled: false,
      baseUrl: 'https://fava.example.local/api',
      credentialReference: 'secret/integrations/fava',
      syncDirection: 'BIDIRECTIONAL',
      lastHealthStatus: 'DISABLED',
    },
    create: {
      provider: 'FAVA',
      enabled: false,
      baseUrl: 'https://fava.example.local/api',
      credentialReference: 'secret/integrations/fava',
      syncDirection: 'BIDIRECTIONAL',
      lastHealthStatus: 'DISABLED',
    },
  });
}

async function seedApiConsoleInfrastructure() {
  const environments = [
    ['env-development', 'Development', 'DEVELOPMENT', 'https://dev.example.com', false],
    ['env-test', 'Test', 'TEST', 'https://test.example.com', false],
    ['env-preprod', 'Pre-production', 'PRE_PRODUCTION', 'https://preprod.example.com', true],
    ['env-production', 'Production', 'PRODUCTION', 'https://api.example.com', true],
  ];

  for (const [id, name, kind, baseUrl, productionProtected] of environments) {
    await prisma.apiEnvironmentProfile.upsert({
      where: { id },
      update: {
        name,
        kind,
        baseUrl,
        productionProtected,
      },
      create: {
        id,
        name,
        kind,
        baseUrl,
        productionProtected,
      },
    });
  }

  const runners = [
    ['runner-public', 'Public Network Runner', 'PUBLIC'],
    ['runner-internal', 'Internal Network Runner', 'INTERNAL'],
    ['runner-restricted', 'Restricted Network Runner', 'RESTRICTED'],
    ['runner-test', 'Test Network Runner', 'TEST'],
  ];

  for (const [id, name, networkZone] of runners) {
    await prisma.apiExecutionRunner.upsert({
      where: { id },
      update: {
        name,
        networkZone,
        enabled: true,
      },
      create: {
        id,
        name,
        networkZone,
        enabled: true,
      },
    });
  }
}

async function main() {
  await seedWorkflowPolicies();
  await seedDemoIdentityAndApplications();
  await seedSystemSettings();
  await seedApiConsoleInfrastructure();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log('UTMS database seed completed.');
  })
  .catch(async error => {
    await prisma.$disconnect();
    await pool.end();
    console.error(error);
    process.exit(1);
  });
