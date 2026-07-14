// ============================================
// UTMS Reports API Service
// Computes all report metrics from in-memory data
// ============================================

import {
  mockTestRequests, mockRequirements, mockFlows, mockTestCases,
  mockTestRuns, mockBugs, mockRunIssues, mockChecklists,
  mockPlaywrightRuns, mockReleasePublishes, mockAuditLogs,
  mockAttachments, mockUsers, mockApplications, mockUserRoleAssignments,
  getUserById, mockComments,
} from '../services/seedData';
import type { ApplicationScopeFilter } from '../types';
import { ensureDataPersistenceReady, flushCurrentDataState } from './api';

const wait = (ms: number = 200) => new Promise<void>(resolve => setTimeout(resolve, ms));
const delay = async (ms: number = 200): Promise<void> => {
  await ensureDataPersistenceReady();
  flushCurrentDataState();
  await wait(ms);
};
const CLOSED_BUG_STATUSES = ['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'];
const isOpenBug = (status: string) => !CLOSED_BUG_STATUSES.includes(status);

function normalizeApplicationScope(scope: ApplicationScopeFilter): string[] | undefined {
  if (!scope || scope === 'ALL') return undefined;
  if (Array.isArray(scope)) return scope.length ? scope : undefined;
  if (scope.includes(',')) return scope.split(',').map(s => s.trim()).filter(Boolean);
  return [scope];
}

function filterByApplicationScope<T extends { applicationId?: string | undefined }>(
  data: T[],
  scope: ApplicationScopeFilter
): T[] {
  const ids = normalizeApplicationScope(scope);
  if (!ids) return data;
  return data.filter(item => !!item.applicationId && ids.includes(item.applicationId));
}

// ========== 1.1 System Overview Dashboard ==========
export async function getSystemOverview(applicationId?: ApplicationScopeFilter) {
  await delay();
  const trs = filterByApplicationScope(mockTestRequests, applicationId);
  const tcs = filterByApplicationScope(mockTestCases, applicationId);
  const runs = filterByApplicationScope(mockTestRuns, applicationId);
  const bgs = filterByApplicationScope(mockBugs, applicationId);
  const ris = filterByApplicationScope(mockRunIssues, applicationId);
  const pws = filterByApplicationScope(mockPlaywrightRuns, applicationId);
  const rps = filterByApplicationScope(mockReleasePublishes, applicationId);
  const atts = mockAttachments;

  return {
    testRequests: {
      total: trs.length,
      draft: trs.filter(t => t.status === 'DRAFT').length,
      submitted: trs.filter(t => t.status === 'SUBMITTED').length,
      accepted: trs.filter(t => t.status === 'ACCEPTED').length,
      inProgress: trs.filter(t => t.status === 'IN_PROGRESS').length,
      completed: trs.filter(t => t.status === 'COMPLETED').length,
      rejected: trs.filter(t => t.status === 'REJECTED').length,
      cancelled: trs.filter(t => t.status === 'CANCELLED').length,
      open: trs.filter(t => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status)).length,
    },
    testCases: { total: tcs.length, ready: tcs.filter(t => t.status === 'READY').length, draft: tcs.filter(t => t.status === 'DRAFT').length },
    testRuns: {
      total: runs.length,
      passed: runs.filter(r => r.status === 'PASSED').length,
      failed: runs.filter(r => r.status === 'FAILED').length,
      blocked: runs.filter(r => r.status === 'BLOCKED').length,
      pending: runs.filter(r => r.status === 'PENDING').length,
      passRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'PASSED').length / runs.length) * 100) : 0,
    },
    bugs: {
      total: bgs.length,
      open: bgs.filter(b => isOpenBug(b.status)).length,
      critical: bgs.filter(b => b.severity === 'CRITICAL' && isOpenBug(b.status)).length,
      major: bgs.filter(b => b.severity === 'MAJOR' && isOpenBug(b.status)).length,
      fixed: bgs.filter(b => b.status === 'FIXED').length,
      retestReady: bgs.filter(b => b.status === 'RETEST_READY').length,
      reopened: bgs.filter(b => b.status === 'REOPENED').length,
    },
    runIssues: {
      total: ris.length,
      open: ris.filter(r => r.status === 'OPEN').length,
      environment: ris.filter(r => r.issueType === 'ENVIRONMENT').length,
      access: ris.filter(r => r.issueType === 'ACCESS').length,
      data: ris.filter(r => r.issueType === 'DATA').length,
      dependency: ris.filter(r => r.issueType === 'DEPENDENCY').length,
    },
    releases: {
      total: rps.length,
      approved: rps.filter(r => r.status === 'APPROVED' || r.status === 'PUBLISHED').length,
      conditional: rps.filter(r => r.status === 'CONDITIONAL').length,
      rejected: rps.filter(r => r.status === 'REJECTED').length,
      blocked: rps.filter(r => r.status === 'BLOCKED').length,
      emergency: rps.filter(r => r.isEmergency).length,
      pending: rps.filter(r => ['DRAFT', 'QA_REVIEW', 'PENDING_DECISION'].includes(r.status)).length,
    },
    playwright: {
      total: pws.length,
      passed: pws.filter(p => p.status === 'PASSED').length,
      failed: pws.filter(p => p.status === 'FAILED').length,
      error: pws.filter(p => p.status === 'ERROR').length,
      running: pws.filter(p => p.status === 'RUNNING').length,
    },
    attachments: { total: atts.length, valid: atts.filter(a => a.status === 'VALID').length, deleted: atts.filter(a => a.status === 'DELETED').length },
    auditEvents: mockAuditLogs.length,
    openRequestsList: trs.filter(t => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status)).map(t => ({
      id: t.id, title: t.title, requester: t.requester?.fullName || '-', assignee: t.assignee?.fullName || '-',
      status: t.status, priority: t.priority, version: t.version, createdAt: t.createdAt,
    })),
  };
}

// ========== 1.3 Test Request Operational Report ==========
export async function getTestRequestReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const trs = filterByApplicationScope(mockTestRequests, applicationId);
  const now = Date.now();
  const openRequests = trs.filter(t => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status));

  const details = trs.map(t => {
    const linkedTestCases = mockTestCases.filter(tc => tc.testRequestId === t.id);
    const linkedRuns = mockTestRuns.filter(run => run.testRequestId === t.id);
    const linkedRunIds = linkedRuns.map(run => run.id);
    const linkedBugs = mockBugs.filter(bug => bug.testRunId && linkedRunIds.includes(bug.testRunId));
    const linkedVersionHistory = mockReleasePublishes.find(release =>
      [release.primaryTestRequestId, ...(release.relatedRequestIds || []), ...(release.testRequestIds || [])].includes(t.id)
    );
    const ageDays = Math.max(0, Math.ceil((now - new Date(t.createdAt).getTime()) / 86400000));

    return {
      id: t.id,
      title: t.title,
      application: mockApplications.find(app => app.id === t.applicationId)?.name || '-',
      status: t.status,
      priority: t.priority,
      riskLevel: t.riskLevel,
      requester: t.requester?.fullName || getUserById(t.requesterId)?.fullName || '-',
      assignee: t.assignee?.fullName || (t.assigneeId ? getUserById(t.assigneeId)?.fullName : '-') || '-',
      version: t.version,
      buildNumber: t.buildNumber || '-',
      environment: t.environment,
      createdAt: t.createdAt,
      ageDays,
      testCaseCount: linkedTestCases.length,
      runCount: linkedRuns.length,
      bugCount: linkedBugs.length,
      openBugCount: linkedBugs.filter(bug => isOpenBug(bug.status)).length,
      versionHistory: linkedVersionHistory ? linkedVersionHistory.version : '-',
      qaQualityStatus: linkedVersionHistory?.qaQualityStatus || t.qaQualityStatus || '-',
    };
  });

  const averageOpenAgeDays = openRequests.length
    ? Math.round(openRequests.reduce((sum, item) => sum + Math.max(0, Math.ceil((now - new Date(item.createdAt).getTime()) / 86400000)), 0) / openRequests.length)
    : 0;

  return {
    total: trs.length,
    open: openRequests.length,
    draft: trs.filter(t => t.status === 'DRAFT').length,
    submitted: trs.filter(t => t.status === 'SUBMITTED').length,
    accepted: trs.filter(t => t.status === 'ACCEPTED').length,
    inProgress: trs.filter(t => t.status === 'IN_PROGRESS').length,
    completed: trs.filter(t => t.status === 'COMPLETED').length,
    rejected: trs.filter(t => t.status === 'REJECTED').length,
    cancelled: trs.filter(t => t.status === 'CANCELLED').length,
    highPriority: trs.filter(t => ['HIGH', 'CRITICAL'].includes(t.priority)).length,
    averageOpenAgeDays,
    details,
  };
}

// ========== 1.2 Quality Health per Application ==========
export async function getQualityHealth(applicationId?: ApplicationScopeFilter) {
  await delay();
  const runs = filterByApplicationScope(mockTestRuns, applicationId);
  const bgs = filterByApplicationScope(mockBugs, applicationId);
  const reqs = filterByApplicationScope(mockRequirements, applicationId);
  const tcs = filterByApplicationScope(mockTestCases, applicationId);
  const pws = filterByApplicationScope(mockPlaywrightRuns, applicationId);
  const reqsWithTC = reqs.filter(r => tcs.some(tc => tc.requirementId === r.id));

  return {
    passRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'PASSED').length / runs.length) * 100) : 0,
    failRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'FAILED').length / runs.length) * 100) : 0,
    blockedRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'BLOCKED').length / runs.length) * 100) : 0,
    criticalMajorOpen: bgs.filter(b => ['CRITICAL', 'MAJOR'].includes(b.severity) && isOpenBug(b.status)).length,
    reopenedBugs: bgs.filter(b => b.status === 'REOPENED').length,
    closedBugs: bgs.filter(b => b.status === 'CLOSED').length,
    reopenRate: bgs.filter(b => b.status === 'CLOSED').length > 0 ? Math.round((bgs.filter(b => b.status === 'REOPENED').length / Math.max(1, bgs.filter(b => b.status === 'CLOSED').length)) * 100) : 0,
    requirementCoverage: reqs.length > 0 ? Math.round((reqsWithTC.length / reqs.length) * 100) : 0,
    playwrightPassRate: pws.length > 0 ? Math.round((pws.filter(p => p.status === 'PASSED').length / pws.length) * 100) : 0,
    totalRuns: runs.length, totalBugs: bgs.length, totalRequirements: reqs.length,
  };
}

// ========== 2.1 Developer Test Request Performance ==========
export async function getDeveloperPerformance(applicationId?: ApplicationScopeFilter) {
  await delay();
  const trs = filterByApplicationScope(mockTestRequests, applicationId);
  const devIds = [...new Set(trs.map(t => t.requesterId))];
  return devIds.map(devId => {
    const devTrs = trs.filter(t => t.requesterId === devId);
    const devBugs = mockBugs.filter(b => b.assigneeId === devId);
    return {
      developerId: devId,
      developerName: getUserById(devId)?.fullName || '-',
      totalRequests: devTrs.length,
      rejected: devTrs.filter(t => t.status === 'REJECTED').length,
      completed: devTrs.filter(t => t.status === 'COMPLETED').length,
      bugsAssigned: devBugs.length,
      bugsFixed: devBugs.filter(b => ['FIXED', 'RETEST_READY', 'RETEST_PASSED', 'CLOSED'].includes(b.status)).length,
      bugsReopened: devBugs.filter(b => b.status === 'REOPENED').length,
      criticalBugs: devBugs.filter(b => b.severity === 'CRITICAL').length,
    };
  });
}

// ========== 2.2 Developer Bug Fix Performance ==========
export async function getDeveloperBugFixReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const bgs = filterByApplicationScope(mockBugs, applicationId);
  const devIds = [...new Set(bgs.filter(b => b.assigneeId).map(b => b.assigneeId!))];
  return devIds.map(devId => {
    const devBugs = bgs.filter(b => b.assigneeId === devId);
    return {
      developerId: devId,
      developerName: getUserById(devId)?.fullName || '-',
      assigned: devBugs.length,
      fixed: devBugs.filter(b => ['FIXED', 'RETEST_READY', 'RETEST_PASSED', 'CLOSED'].includes(b.status)).length,
      reopened: devBugs.filter(b => b.status === 'REOPENED').length,
      reopenRate: devBugs.length > 0 ? Math.round((devBugs.filter(b => b.status === 'REOPENED').length / Math.max(1, devBugs.length)) * 100) : 0,
      critical: devBugs.filter(b => b.severity === 'CRITICAL').length,
      major: devBugs.filter(b => b.severity === 'MAJOR').length,
      open: devBugs.filter(b => isOpenBug(b.status)).length,
      withFixVersion: devBugs.filter(b => b.fixedVersion).length,
      withoutFixVersion: devBugs.filter(b => !b.fixedVersion && ['FIXED', 'RETEST_READY'].includes(b.status)).length,
      bugs: devBugs.map(b => ({
        id: b.id, title: b.title, severity: b.severity, priority: b.priority, status: b.status,
        fixedVersion: b.fixedVersion || '-', createdAt: b.createdAt,
      })),
    };
  });
}

// ========== 3.1 Requirement Completion ==========
export async function getRequirementReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const reqs = filterByApplicationScope(mockRequirements, applicationId);
  const tcs = filterByApplicationScope(mockTestCases, applicationId);
  const flws = mockFlows;
  return {
    total: reqs.length,
    draft: reqs.filter(r => r.status === 'DRAFT').length,
    inProgress: reqs.filter(r => r.status === 'IN_PROGRESS').length,
    completed: reqs.filter(r => r.status === 'COMPLETED').length,
    approved: reqs.filter(r => r.status === 'APPROVED').length,
    withoutFlow: reqs.filter(r => !flws.some(f => f.requirementId === r.id)).length,
    withoutTestCase: reqs.filter(r => !tcs.some(tc => tc.requirementId === r.id)).length,
    incomplete: reqs.filter(r => !r.acceptanceCriteria || r.status === 'DRAFT').length,
    details: reqs.map(r => ({
      id: r.id, title: r.title, status: r.status, ba: r.createdBy?.fullName || '-',
      hasFlow: flws.some(f => f.requirementId === r.id), hasTestCase: tcs.some(tc => tc.requirementId === r.id),
      hasAcceptanceCriteria: !!r.acceptanceCriteria, createdAt: r.createdAt,
    })),
  };
}

// ========== 3.2 Flow Coverage ==========
export async function getFlowCoverage(applicationId?: ApplicationScopeFilter) {
  await delay();
  const flws = mockFlows;
  const tcs = filterByApplicationScope(mockTestCases, applicationId);
  const reqs = filterByApplicationScope(mockRequirements, applicationId);
  return {
    totalFlows: flws.length,
    withTestCase: flws.filter(f => tcs.some(tc => tc.flowId === f.id)).length,
    withoutTestCase: flws.filter(f => !tcs.some(tc => tc.flowId === f.id)).length,
    details: flws.map(f => ({
      id: f.id, title: f.title, requirementTitle: reqs.find(r => r.id === f.requirementId)?.title || '-',
      hasTestCase: tcs.some(tc => tc.flowId === f.id),
      testCaseCount: tcs.filter(tc => tc.flowId === f.id).length,
      createdAt: f.createdAt,
    })),
  };
}

// ========== 5.1 Test Case Design Report ==========
export async function getTestCaseReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const tcs = filterByApplicationScope(mockTestCases, applicationId);
  const qaIds = [...new Set(tcs.map(t => t.createdById))];
  return {
    total: tcs.length,
    ready: tcs.filter(t => t.status === 'READY').length,
    draft: tcs.filter(t => t.status === 'DRAFT').length,
    automationCandidates: tcs.filter(t => t.automationCandidate).length,
    regressionCandidates: tcs.filter(t => t.regressionCandidate).length,
    highRisk: tcs.filter(t => ['CRITICAL', 'HIGH'].includes(t.riskLevel)).length,
    byQA: qaIds.map(qaId => ({
      qaId, qaName: getUserById(qaId)?.fullName || '-',
      count: tcs.filter(t => t.createdById === qaId).length,
      ready: tcs.filter(t => t.createdById === qaId && t.status === 'READY').length,
    })),
  };
}

// ========== 5.2 Test Run Execution Report ==========
export async function getTestRunReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const runs = filterByApplicationScope(mockTestRuns, applicationId);
  return {
    total: runs.length,
    passed: runs.filter(r => r.status === 'PASSED').length,
    failed: runs.filter(r => r.status === 'FAILED').length,
    blocked: runs.filter(r => r.status === 'BLOCKED').length,
    pending: runs.filter(r => r.status === 'PENDING').length,
    passRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'PASSED').length / runs.length) * 100) : 0,
    failRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'FAILED').length / runs.length) * 100) : 0,
    details: runs.map(r => ({
      id: r.id, testCase: r.testCase?.title || '-', status: r.status, version: r.version,
      executor: r.executedBy?.fullName || '-', executedAt: r.executedAt || '-', actualResult: r.actualResult || '-',
    })),
  };
}

// ========== 6.1 Security Checklist Report ==========
export async function getChecklistReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const cls = filterByApplicationScope(mockChecklists, applicationId);
  return {
    total: cls.length,
    completed: cls.filter(c => c.status === 'COMPLETED').length,
    pending: cls.filter(c => c.status === 'PENDING').length,
    inProgress: cls.filter(c => c.status === 'IN_PROGRESS').length,
    details: cls.map(c => ({
      id: c.id, type: c.type, status: c.status, result: c.result || '-',
      reviewer: c.reviewedBy?.fullName || '-', itemsTotal: c.items.length,
      itemsDone: c.items.filter(i => i.result).length, createdAt: c.createdAt,
    })),
  };
}

// ========== 7.1 Release Publish Report ==========
export async function getReleaseReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const rps = filterByApplicationScope(mockReleasePublishes, applicationId);
  const changeHistory = rps.flatMap(r => {
    const revisions = r.revisions?.length
      ? r.revisions
      : r.snapshot
        ? [{
            id: `${r.id}-snapshot`,
            versionHistoryId: r.id,
            qaQualityStatus: r.qaQualityStatus || 'NOT_STARTED',
            qaQualityNotes: r.qaQualityNotes || '-',
            snapshot: r.snapshot,
            createdById: r.qaReviewedById || r.createdById,
            createdAt: r.qaReviewedAt || r.createdAt,
          }]
        : [];

    return revisions.map((revision, index) => ({
      id: revision.id,
      versionHistoryId: r.id,
      version: r.version,
      buildNumber: r.buildNumber || '-',
      revisionNo: index + 1,
      qaStatus: revision.qaQualityStatus,
      qaNotes: revision.qaQualityNotes || '-',
      decision: r.decision || '-',
      totalTestCases: revision.snapshot.totalTestCases,
      executedTestRuns: revision.snapshot.executedTestRuns || 0,
      passedTestRuns: revision.snapshot.passedTestRuns,
      failedTestRuns: revision.snapshot.failedTestRuns,
      blockedTestRuns: revision.snapshot.blockedTestRuns,
      openBugs: revision.snapshot.openBugs,
      criticalBugs: revision.snapshot.criticalBugs,
      majorBugs: revision.snapshot.majorBugs,
      capturedAt: revision.snapshot.capturedAt,
      createdAt: revision.createdAt,
    }));
  });
  return {
    total: rps.length,
    approved: rps.filter(r => r.decision === 'APPROVED').length,
    conditional: rps.filter(r => r.decision === 'CONDITIONAL').length,
    rejected: rps.filter(r => r.decision === 'REJECTED').length,
    blocked: rps.filter(r => r.decision === 'BLOCKED').length,
    emergency: rps.filter(r => r.isEmergency).length,
    published: rps.filter(r => r.status === 'PUBLISHED').length,
    pendingDecision: rps.filter(r => r.status === 'PENDING_DECISION').length,
    details: rps.map(r => ({
      id: r.id, version: r.version, status: r.status, isEmergency: r.isEmergency,
      qaStatus: r.qaQualityStatus || '-', decision: r.decision || '-',
      techLead: r.decisionBy?.fullName || '-', createdAt: r.createdAt, publishedAt: r.publishedAt || '-',
    })),
    changeHistory,
  };
}

// ========== 7.2 Emergency Publish Report ==========
export async function getEmergencyPublishReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const rps = filterByApplicationScope(mockReleasePublishes, applicationId)
    .filter(r => r.isEmergency);
  return {
    total: rps.length,
    totalReleases: mockReleasePublishes.length,
    emergencyRate: mockReleasePublishes.length > 0 ? Math.round((rps.length / mockReleasePublishes.length) * 100) : 0,
    details: rps.map(r => ({
      id: r.id, version: r.version, reason: r.emergencyReason || '-', risk: r.riskDescription || '-',
      qaStatus: r.qaQualityStatus || '-', techLead: r.decisionBy?.fullName || '-', publishedAt: r.publishedAt || '-',
    })),
  };
}

// ========== 8.1 Users & Roles Report ==========
export async function getUsersRolesReport() {
  await delay();
  const activeUsers = mockUsers.filter(u => u.isActive).length;
  const inactiveUsers = mockUsers.filter(u => !u.isActive).length;
  const assignments = mockUserRoleAssignments.filter(a => a.isActive);
  const multiRole = mockUsers.filter(u => assignments.filter(a => a.userId === u.id).length > 1);
  return {
    totalUsers: mockUsers.length, activeUsers, inactiveUsers,
    totalAssignments: assignments.length,
    multiRoleUsers: multiRole.length,
    details: mockUsers.map(u => ({
      id: u.id, fullName: u.fullName, nationalCode: u.nationalCode || '-', phoneNumber: u.phoneNumber,
      isActive: u.isActive, roles: assignments.filter(a => a.userId === u.id).map(a => ({
        role: a.role, applicationId: a.applicationId, scope: a.scope,
        appName: mockApplications.find(app => app.id === a.applicationId)?.name || '-',
      })),
    })),
  };
}

// ========== 8.2 Audit Trail Report ==========
export async function getAuditReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const logs = filterByApplicationScope(mockAuditLogs, applicationId);
  return {
    total: logs.length,
    byAction: {
      create: logs.filter(l => l.action === 'CREATE').length,
      update: logs.filter(l => l.action === 'UPDATE').length,
      statusChange: logs.filter(l => l.action === 'STATUS_CHANGE').length,
      assign: logs.filter(l => l.action === 'ASSIGN').length,
      publish: logs.filter(l => ['PUBLISH', 'EMERGENCY_PUBLISH'].includes(l.action)).length,
    },
    details: logs.map(l => ({
      id: l.id, userId: l.userId, userName: l.user?.fullName || '-', action: l.action,
      entityType: l.entityType, entityId: l.entityId, createdAt: l.createdAt,
    })),
  };
}

// ========== 8.3 Attachment Report ==========
export async function getAttachmentReport() {
  await delay();
  const atts = mockAttachments;
  return {
    total: atts.length,
    totalSize: atts.reduce((sum, a) => sum + a.fileSize, 0),
    byType: {
      screenshot: atts.filter(a => a.type === 'SCREENSHOT').length,
      log: atts.filter(a => a.type === 'LOG').length,
      video: atts.filter(a => a.type === 'VIDEO').length,
      report: atts.filter(a => a.type === 'REPORT').length,
      trace: atts.filter(a => a.type === 'TRACE').length,
      document: atts.filter(a => a.type === 'DOCUMENT').length,
      other: atts.filter(a => a.type === 'OTHER').length,
    },
    valid: atts.filter(a => a.status === 'VALID').length,
    invalid: atts.filter(a => a.status === 'INVALID').length,
    deleted: atts.filter(a => a.status === 'DELETED').length,
    details: atts.map(a => ({
      id: a.id, fileName: a.fileName, type: a.type, status: a.status,
      fileSize: a.fileSize, entityType: a.entityType, uploader: a.uploadedBy?.fullName || '-', createdAt: a.createdAt,
    })),
  };
}

// ========== 10.1 Playwright Report ==========
export async function getPlaywrightReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const pws = filterByApplicationScope(mockPlaywrightRuns, applicationId);
  return {
    total: pws.length,
    passed: pws.filter(p => p.status === 'PASSED').length,
    failed: pws.filter(p => p.status === 'FAILED').length,
    error: pws.filter(p => p.status === 'ERROR').length,
    running: pws.filter(p => p.status === 'RUNNING').length,
    passRate: pws.length > 0 ? Math.round((pws.filter(p => p.status === 'PASSED').length / pws.length) * 100) : 0,
    avgDuration: pws.filter(p => p.duration).length > 0 ? Math.round(pws.filter(p => p.duration).reduce((s, p) => s + (p.duration || 0), 0) / pws.filter(p => p.duration).length) : 0,
    details: pws.map(p => ({
      id: p.id, testFile: p.testFilePath, status: p.status, environment: p.environment,
      duration: p.duration || 0, totalTests: p.totalTests || 0, passedTests: p.passedTests || 0,
      failedTests: p.failedTests || 0, triggeredBy: p.triggeredBy?.fullName || '-', startedAt: p.startedAt || '-',
    })),
  };
}

// ========== 9.1 Product Quality Overview ==========
export async function getProductQualityOverview() {
  await delay();
  const trs = mockTestRequests;
  const runs = mockTestRuns;
  const bgs = mockBugs;
  const rps = mockReleasePublishes;
  return {
    activeRequests: trs.filter(t => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status)).length,
    readyForRelease: trs.filter(t => t.status === 'COMPLETED').length,
    testPassRate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'PASSED').length / runs.length) * 100) : 0,
    criticalMajorOpen: bgs.filter(b => ['CRITICAL', 'MAJOR'].includes(b.severity) && isOpenBug(b.status)).length,
    totalReleases: rps.length,
    emergencyPublishes: rps.filter(r => r.isEmergency).length,
    riskApps: mockApplications.map(app => ({
      appName: app.name,
      openBugs: bgs.filter(b => b.applicationId === app.id && isOpenBug(b.status)).length,
      failedRuns: runs.filter(r => r.applicationId === app.id && r.status === 'FAILED').length,
    })).sort((a, b) => (b.openBugs + b.failedRuns) - (a.openBugs + a.failedRuns)),
  };
}

// ========== Bug Open List (nominal) ==========
export async function getOpenBugsList(applicationId?: ApplicationScopeFilter) {
  await delay();
  const bgs = filterByApplicationScope(mockBugs, applicationId)
    .filter(b => isOpenBug(b.status));
  return bgs.map(b => ({
    id: b.id, title: b.title, severity: b.severity, priority: b.priority, status: b.status,
    developer: b.assignee?.fullName || '-', reporter: b.reportedBy?.fullName || '-',
    fixedVersion: b.fixedVersion || '-', createdAt: b.createdAt,
  }));
}

// ========== Comment/Feedback Report ==========
export async function getCommentReport() {
  await delay();
  const rpComments = mockComments.filter(c => c.entityType === 'RELEASE_PUBLISH');
  return {
    total: rpComments.length,
    details: rpComments.map(c => ({
      id: c.id, entityId: c.entityId, content: c.content, author: c.author?.fullName || '-', createdAt: c.createdAt,
    })),
  };
}

// ========== Traceability Report ==========
export async function getTraceabilityReport(applicationId?: ApplicationScopeFilter) {
  await delay();
  const reqs = filterByApplicationScope(mockRequirements, applicationId);
  const scopedRequirementIds = reqs.map(req => req.id);
  const flows = mockFlows.filter(flow => scopedRequirementIds.includes(flow.requirementId));
  const testCases = filterByApplicationScope(mockTestCases, applicationId);
  const runs = filterByApplicationScope(mockTestRuns, applicationId);
  const bugs = filterByApplicationScope(mockBugs, applicationId);
  const requests = filterByApplicationScope(mockTestRequests, applicationId);
  const releases = filterByApplicationScope(mockReleasePublishes, applicationId);

  const details = reqs.map(req => {
    const reqFlows = flows.filter(flow => flow.requirementId === req.id);
    const reqTestCases = testCases.filter(tc => tc.requirementId === req.id);
    const reqTestCaseIds = reqTestCases.map(tc => tc.id);
    const reqRuns = runs.filter(run => reqTestCaseIds.includes(run.testCaseId));
    const reqRunIds = reqRuns.map(run => run.id);
    const reqBugs = bugs.filter(bug => reqRunIds.includes(bug.testRunId));
    const linkedRequests = requests.filter(tr =>
      tr.requirementId === req.id ||
      tr.selectedRequirementIds?.includes(req.id) ||
      reqTestCases.some(tc => tc.testRequestId && tc.testRequestId === tr.id)
    );
    const linkedRequestIds = linkedRequests.map(tr => tr.id);
    const linkedReleases = releases.filter(release =>
      [release.primaryTestRequestId, ...(release.relatedRequestIds || []), ...(release.testRequestIds || [])]
        .some(id => linkedRequestIds.includes(id))
    );
    const openBugs = reqBugs.filter(bug => isOpenBug(bug.status));

    return {
      id: req.id,
      requirementTitle: req.title,
      requirementStatus: req.status,
      flows: reqFlows.length,
      testCases: reqTestCases.length,
      readyTestCases: reqTestCases.filter(tc => tc.status === 'READY').length,
      runs: reqRuns.length,
      passedRuns: reqRuns.filter(run => run.status === 'PASSED').length,
      failedRuns: reqRuns.filter(run => run.status === 'FAILED').length,
      openBugs: openBugs.length,
      criticalOpenBugs: openBugs.filter(bug => bug.severity === 'CRITICAL').length,
      testRequests: linkedRequests.map(tr => tr.title).join('، ') || '-',
      releases: linkedReleases.map(release => `${release.version}${release.buildNumber ? `/${release.buildNumber}` : ''}`).join('، ') || '-',
      coverageStatus: reqFlows.length > 0 && reqTestCases.length > 0 && reqRuns.length > 0 ? 'کامل' : 'ناقص',
    };
  });

  return {
    totalRequirements: reqs.length,
    withFlow: details.filter(item => item.flows > 0).length,
    withTestCase: details.filter(item => item.testCases > 0).length,
    withRun: details.filter(item => item.runs > 0).length,
    withOpenBug: details.filter(item => item.openBugs > 0).length,
    fullCoverage: details.filter(item => item.coverageStatus === 'کامل').length,
    details,
  };
}

// Export all report functions
export const reportsApi = {
  getSystemOverview,
  getTestRequestReport,
  getQualityHealth,
  getDeveloperPerformance,
  getDeveloperBugFixReport,
  getRequirementReport,
  getFlowCoverage,
  getTestCaseReport,
  getTestRunReport,
  getChecklistReport,
  getReleaseReport,
  getEmergencyPublishReport,
  getUsersRolesReport,
  getAuditReport,
  getAttachmentReport,
  getPlaywrightReport,
  getProductQualityOverview,
  getOpenBugsList,
  getCommentReport,
  getTraceabilityReport,
};
