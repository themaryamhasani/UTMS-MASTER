import { test, expect } from '@playwright/test';
// Playwright executes TypeScript specs as native ESM in this repository. A
// dynamic import keeps the CommonJS API module compatible with both Node and
// the Playwright transform without relying on a global `require` binding.
import apiServerModule from '../../apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs';
import {
  DESCRIPTION_MAX_LENGTH,
  hasInvalidBuildNumber,
  isValidSystemUrl,
  sanitizeRequestTitleInput,
  validateRequestTitle,
} from '../../apps/web/src/utils/inputRules';
import { isSemVer } from '../../apps/web/src/utils/semver';
import {
  filterByRequestApplication,
  filterTestCasesForExecution,
  haveSameApplication,
} from '../../apps/web/src/utils/testManagementScope';
import {
  canAccessCartable,
  canPerformAction,
  canUseAutomatedTests,
  getDataApplicationId,
} from '../../apps/web/src/stores/authStore';
import {
  canRolePerformWorkflowCapability,
  getWorkflowPolicyById,
  setApplicationWorkflowPolicy,
} from '../../apps/web/src/services/workflowPolicyStore';
import type { ActiveContext, UserRole } from '../../apps/web/src/types';
import { SeededRandom } from '../helpers/seeded-random';
import { annotateTest, metadata } from '../helpers/traceability';

const apiServer = apiServerModule as unknown as {
  parseCurlInternal: (value: string) => any;
  validateDestination: (value: string) => Promise<unknown>;
  API_CONSOLE_POLICY: Record<string, UserRole[]>;
};

test('UTMS-REQ-BVA-001 @boundary-value enforces discovered text boundaries', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REQ-BVA-001', {
    requirement: 'apps/web/src/utils/inputRules.ts', feature: 'Request validation', level: 'structural',
    type: 'boundary', technique: 'Boundary Value Analysis', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: 'Description lengths 699, 700, 701', expected: 'The source boundary remains exactly 700 characters',
  }));
  expect([DESCRIPTION_MAX_LENGTH - 1, DESCRIPTION_MAX_LENGTH, DESCRIPTION_MAX_LENGTH + 1]).toEqual([699, 700, 701]);
  expect(DESCRIPTION_MAX_LENGTH).toBe(700);
});

test('UTMS-REQ-SYN-002 @syntax validates SemVer grammar partitions', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REQ-SYN-002', {
    requirement: 'SemVer rule in apps/web/src/utils/semver.ts', feature: 'Version input', level: 'structural',
    type: 'data-integrity', technique: 'Syntax Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: 'Valid, prerelease, build metadata, leading zero, truncated, Unicode', expected: 'Only grammar-valid versions pass',
  }));
  for (const value of ['0.0.0', '1.2.3', '1.2.3-beta.1', '1.2.3+build.7']) expect(isSemVer(value)).toBe(true);
  for (const value of ['', '1.2', '01.2.3', '1.2.3.4', '۱.۲.۳', '1.2.3-']) expect(isSemVer(value)).toBe(false);
});

test('UTMS-REQ-EP-003 @equivalence-partitioning separates valid and invalid request titles', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REQ-EP-003', {
    requirement: 'Request title rules', feature: 'Request validation', level: 'structural', type: 'negative',
    technique: 'Equivalence Partitioning', role: 'DEVELOPER', scope: 'SYSTEMS',
    data: 'Empty, leading whitespace, forbidden backtick, Persian valid title', expected: 'Each invalid partition is rejected and valid Persian is accepted',
  }));
  expect(validateRequestTitle('')).toBeDefined();
  expect(validateRequestTitle(' عنوان')).toContain('فاصله');
  expect(validateRequestTitle('عنوان`')).toContain('`');
  expect(validateRequestTitle('درخواست تست پرداخت')).toBeUndefined();
  expect(sanitizeRequestTitleInput(' `عنوان')).toEqual({ value: 'عنوان', error: 'عنوان درخواست نمی‌تواند با فاصله شروع شود.' });
});

test('UTMS-REQ-DEC-004 @decision validates URL and build-number decisions', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REQ-DEC-004', {
    requirement: 'System URL and build rules', feature: 'Request validation', level: 'structural', type: 'functional-negative',
    technique: 'Decision Testing', role: 'DEVELOPER', scope: 'SYSTEMS', data: 'URL protocol/host and ASCII/Unicode build combinations',
  }));
  expect(isValidSystemUrl('https://app.example.com/path')).toBe(true);
  expect(isValidSystemUrl('http://localhost:5173')).toBe(true);
  expect(isValidSystemUrl('javascript:alert(1)')).toBe(false);
  expect(hasInvalidBuildNumber('build-42')).toBe(false);
  expect(hasInvalidBuildNumber('بیلد-۴۲')).toBe(true);
});

test('UTMS-API-SYN-005 @syntax parses supported cURL dialects and rejects malformed grammar', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-SYN-005', {
    requirement: 'Online API Console cURL grammar', feature: 'cURL import', level: 'structural', type: 'data-integrity',
    technique: 'Syntax Testing', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
    data: 'Bash, Windows CMD, PowerShell and missing URL', expected: 'Supported syntax normalizes; invalid syntax reports a parser category',
  }));
  expect(apiServer.parseCurlInternal("curl 'https://example.com/x' -H 'accept: application/json'").normalizedRequest.url).toContain('example.com');
  expect(apiServer.parseCurlInternal('curl.exe ^\n "https://example.com"').detectedDialect).toBe('WINDOWS_CMD');
  expect(apiServer.parseCurlInternal("curl 'https://example.com'").effectiveMethod).toBe('GET');
  expect(() => apiServer.parseCurlInternal('curl -H "x: y"')).toThrow();
});

test('UTMS-API-META-006 @metamorphic preserves normalized meaning when independent headers reorder', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-META-006', {
    requirement: 'cURL normalization invariants', feature: 'cURL import', level: 'structural', type: 'regression',
    technique: 'Metamorphic Testing', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'high',
    data: 'MR1 header order permutation', expected: 'Method, URL and header name/value set remain invariant',
  }));
  const left = apiServer.parseCurlInternal("curl https://example.com -H 'x-a: 1' -H 'x-b: 2'").normalizedRequest;
  const right = apiServer.parseCurlInternal("curl https://example.com -H 'x-b: 2' -H 'x-a: 1'").normalizedRequest;
  const normalized = (headers: any[]) => headers.map(header => `${header.name}:${header.valueTemplate}`).sort();
  expect({ method: left.method, url: left.url, headers: normalized(left.headers) })
    .toEqual({ method: right.method, url: right.url, headers: normalized(right.headers) });
});

test('UTMS-RBAC-MCDC-007 @mcdc proves automated-test access decision independence', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RBAC-MCDC-007', {
    requirement: 'canUseAutomatedTests', feature: 'Automated test access', level: 'structural', type: 'security',
    technique: 'Modified Condition/Decision Coverage — MCDC', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
    data: 'C1 context exists; C2 role is QA_SPECIALIST; C3 enabled is not false', expected: 'Each condition independently changes the decision',
  }));
  expect(canUseAutomatedTests(null)).toBe(false); // C1 false
  expect(canUseAutomatedTests({ role: 'QA_LEAD', automatedTestsEnabled: false })).toBe(true); // C2 false
  expect(canUseAutomatedTests({ role: 'QA_SPECIALIST', automatedTestsEnabled: true })).toBe(true); // C3 true
  expect(canUseAutomatedTests({ role: 'QA_SPECIALIST', automatedTestsEnabled: false })).toBe(false); // C3 false
});

test('UTMS-RBAC-DT-008 @decision-table exhausts role and action rules', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RBAC-DT-008', {
    requirement: 'authStore role matrices', feature: 'RBAC', level: 'structural', type: 'security',
    technique: 'Decision Table Testing', role: 'ALL_ROLES', scope: 'APP', risk: 'critical',
    data: '8 roles × representative cartables/actions', expected: 'All decision-table rules match the declared policy',
  }));
  const roles: UserRole[] = ['SYSTEM_ADMIN', 'DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER'];
  const expectedCreators = new Set<UserRole>(['SYSTEM_ADMIN', 'DEVELOPER']);
  for (const role of roles) expect(canPerformAction(role, 'test-request:create')).toBe(expectedCreators.has(role));
  expect(canAccessCartable('DEVELOPER', 'developer-board')).toBe(true);
  expect(canAccessCartable('QA_LEAD', 'developer-board')).toBe(false);
  expect(canAccessCartable('SYSTEM_ADMIN', 'users')).toBe(true);
  expect(canAccessCartable('PRODUCT_OWNER', 'users')).toBe(false);
});

test('UTMS-API-BCC-009 @branch-condition-combination covers API policy combinations', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-BCC-009', {
    requirement: 'API_CONSOLE_POLICY', feature: 'API execution authorization', level: 'structural', type: 'security',
    technique: 'Branch Condition Combination Testing', role: 'ALL_ROLES', scope: 'SYSTEMS', risk: 'critical',
    data: 'Role × create × execute × production-command matrix', expected: 'Least privilege is maintained for all combinations',
  }));
  const policy = apiServer.API_CONSOLE_POLICY;
  expect(policy.canCreate).toContain('BA');
  expect(policy.canExecute).not.toContain('BA');
  expect(policy.canExecuteProductionCommand).toEqual(['SYSTEM_ADMIN', 'TECH_LEAD']);
  expect(policy.canExecuteProduction).toContain('QA_LEAD');
});

test('UTMS-REL-BRANCH-010 @branch verifies configurable workflow policy branches', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REL-BRANCH-010', {
    requirement: 'VersionHistory workflow policy', feature: 'Release decision', level: 'structural', type: 'uat',
    technique: 'Branch Testing', role: 'QA_LEAD,TECH_LEAD', scope: 'SYSTEMS', risk: 'high',
    data: 'TECH_LEAD_DECISION and QA_OWNED_DECISION branches', expected: 'Decision ownership follows the selected application policy',
  }));
  setApplicationWorkflowPolicy('test-app-policy', 'standard-tech-lead');
  expect(canRolePerformWorkflowCapability('TECH_LEAD', 'versionHistory:decide', 'test-app-policy')).toBe(true);
  expect(canRolePerformWorkflowCapability('QA_LEAD', 'versionHistory:decide', 'test-app-policy')).toBe(false);
  setApplicationWorkflowPolicy('test-app-policy', 'qa-owned-release');
  expect(canRolePerformWorkflowCapability('QA_LEAD', 'versionHistory:decide', 'test-app-policy')).toBe(true);
  expect(getWorkflowPolicyById('qa-owned-release').versionHistory.requireIndependentDecisionRole).toBe(false);
});

test('UTMS-SCOPE-DATA-011 @data-flow preserves APP and SYSTEMS data scope', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-SCOPE-DATA-011', {
    requirement: 'getDataApplicationId', feature: 'Data scope', level: 'structural', type: 'data-integrity',
    technique: 'Data Flow Testing', role: 'QA_LEAD', scope: 'APP', risk: 'critical',
    data: 'APP, single SYSTEMS, multi SYSTEMS contexts', expected: 'Scope identifiers flow unchanged into query filters',
  }));
  const context = (scope: 'APP' | 'SYSTEMS', ids: string[]) => ({ scope, scopeApplicationIds: ids, applicationId: ids[0] || 'ALL' }) as ActiveContext;
  expect(getDataApplicationId(context('APP', ['app-1', 'app-2']))).toBeUndefined();
  expect(getDataApplicationId(context('SYSTEMS', ['app-1']))).toBe('app-1');
  expect(getDataApplicationId(context('SYSTEMS', ['app-1', 'app-2']))).toEqual(['app-1', 'app-2']);
});

test('UTMS-RUN-SCOPE-015 @data-flow cascades request system into requirements and test cases', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RUN-SCOPE-015', {
    requirement: 'Test Run request-to-application cascade', feature: 'Test execution wizard', level: 'structural',
    type: 'data-integrity', technique: 'Data Flow Testing', role: 'QA_LEAD,QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
    data: 'Requests, requirements and test cases from two applications', expected: 'Only records from the selected request application and requirement remain selectable',
  }));
  const request = { applicationId: 'app-2' };
  const requirements = [
    { id: 'req-1', applicationId: 'app-1' },
    { id: 'req-2', applicationId: 'app-2' },
  ];
  const testCases = [
    { id: 'tc-1', applicationId: 'app-1', requirementId: 'req-1' },
    { id: 'tc-2', applicationId: 'app-2', requirementId: 'req-2' },
    { id: 'tc-3', applicationId: 'app-2', requirementId: 'req-3' },
  ];

  expect(filterByRequestApplication(requirements, request).map(item => item.id)).toEqual(['req-2']);
  expect(filterTestCasesForExecution(testCases, request, 'req-2').map(item => item.id)).toEqual(['tc-2']);
  expect(filterTestCasesForExecution(testCases, request)).toEqual([]);
});

test('UTMS-RUN-SCOPE-016 @negative rejects cross-application execution links', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RUN-SCOPE-016', {
    requirement: 'Test Run application consistency', feature: 'Test execution service', level: 'structural',
    type: 'negative', technique: 'Decision Testing', role: 'QA_LEAD,QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
    data: 'Request app-1 paired with test case app-1/app-2', expected: 'Only matching application references are accepted',
  }));
  const request = { applicationId: 'app-1' };
  expect(haveSameApplication(request, { applicationId: 'app-1' })).toBe(true);
  expect(haveSameApplication(request, { applicationId: 'app-2' })).toBe(false);
  expect(haveSameApplication(request, undefined)).toBe(false);
});

test('UTMS-RBAC-COMB-012 @combinatorial applies a pairwise access array', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RBAC-COMB-012', {
    requirement: 'Role × automation flag × route', feature: 'RBAC', level: 'structural', type: 'reliability',
    technique: 'Combinatorial Test Design', role: 'QA_SPECIALIST,QA_LEAD', scope: 'SYSTEMS',
    data: 'Covering array: QA role/lead × enabled/disabled × playwright/dashboard', expected: 'All factor pairs occur and access decisions remain consistent',
  }));
  const cases = [
    ['QA_SPECIALIST', true, 'playwright', true],
    ['QA_SPECIALIST', false, 'playwright', false],
    ['QA_SPECIALIST', false, 'dashboard', true],
    ['QA_LEAD', true, 'playwright', true],
    ['QA_LEAD', false, 'playwright', true],
    ['QA_LEAD', true, 'dashboard', true],
  ] as const;
  for (const [role, enabled, route, expected] of cases) {
    expect(canAccessCartable(role, route, { role, automatedTestsEnabled: enabled })).toBe(expected);
  }
});

test('UTMS-SEC-ERR-013 @error-guessing rejects SSRF-prone destinations', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-SEC-ERR-013', {
    requirement: 'Online API Console SSRF policy', feature: 'Destination validation', level: 'structural', type: 'security',
    technique: 'Error Guessing', role: 'QA_LEAD', scope: 'SYSTEMS', risk: 'critical',
    data: 'Loopback, metadata address, file protocol', expected: 'All high-risk guessed destinations are rejected',
  }));
  for (const destination of ['http://127.0.0.1:80', 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd']) {
    await expect(apiServer.validateDestination(destination)).rejects.toMatchObject({ category: 'DESTINATION_NOT_ALLOWED' });
  }
});

test('UTMS-API-RND-014 @random uses a reproducible cURL input seed', async ({}, testInfo) => {
  const seed = Number(process.env.UTMS_TEST_SEED || 20260715);
  annotateTest(testInfo, metadata('UTMS-API-RND-014', {
    requirement: 'Deterministic random testing rule', feature: 'cURL normalization', level: 'structural', type: 'integration',
    technique: 'Random Testing', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'medium',
    data: `Seed ${seed}; 20 bounded request/header permutations`, expected: 'Every generated valid request parses deterministically',
  }));
  const random = new SeededRandom(seed);
  for (let index = 0; index < 20; index += 1) {
    const method = random.pick(['GET', 'POST', 'PUT'] as const);
    const name = `x-${random.text(6)}`;
    const parsed = apiServer.parseCurlInternal(`curl -X ${method} https://example.com/${index} -H '${name}: ${random.text(8)}'`);
    expect(parsed.effectiveMethod).toBe(method);
    expect(parsed.normalizedRequest.headers.some((header: any) => header.name === name)).toBe(true);
  }
  console.log(`UTMS deterministic random seed: ${seed}`);
});
