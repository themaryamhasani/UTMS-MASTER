import type { Application, UserRole, WorkflowCapability, WorkflowPolicy } from '../types';
import { mockApplications } from './seedData';

export const workflowPolicies: WorkflowPolicy[] = [
  {
    id: 'standard-tech-lead',
    name: 'مدل استاندارد: تصمیم با سرپرست فنی',
    description: 'QA Lead نظر کیفیت را ثبت می‌کند و Tech Lead تصمیم نهایی انتشار را می‌گیرد.',
    versionHistory: {
      mode: 'TECH_LEAD_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'Tech Lead',
      requireIndependentDecisionRole: true,
      capabilityRoles: {
        'versionHistory:create': ['QA_LEAD'],
        'versionHistory:qaReview': ['QA_LEAD'],
        'versionHistory:decide': ['TECH_LEAD'],
        'versionHistory:riskAccept': ['TECH_LEAD'],
        'versionHistory:comment': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
        'versionHistory:view': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
      },
    },
  },
  {
    id: 'qa-owned-release',
    name: 'مدل QA-owned: تصمیم با سرپرست QA',
    description: 'QA Lead هم نظر کیفیت را ثبت می‌کند و هم تصمیم نهایی انتشار/نسخه‌گذاری را می‌گیرد.',
    versionHistory: {
      mode: 'QA_OWNED_DECISION',
      qaReviewOwnerLabel: 'QA Lead',
      decisionOwnerLabel: 'QA Lead',
      requireIndependentDecisionRole: false,
      capabilityRoles: {
        'versionHistory:create': ['QA_LEAD'],
        'versionHistory:qaReview': ['QA_LEAD'],
        'versionHistory:decide': ['QA_LEAD'],
        'versionHistory:riskAccept': ['QA_LEAD'],
        'versionHistory:comment': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
        'versionHistory:view': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
      },
    },
  },
];

const defaultPolicyId = 'standard-tech-lead';

const applicationPolicyIds = new Map<string, string>(
  mockApplications.map(app => [app.id, app.workflowPolicyId || defaultPolicyId])
);

export function listWorkflowPolicies(): WorkflowPolicy[] {
  return workflowPolicies.map(policy => ({
    ...policy,
    versionHistory: {
      ...policy.versionHistory,
      capabilityRoles: { ...policy.versionHistory.capabilityRoles },
    },
  }));
}

export function getWorkflowPolicyById(policyId?: string): WorkflowPolicy {
  const policy = workflowPolicies.find(item => item.id === policyId) ?? workflowPolicies[0];
  if (!policy) throw new Error('WORKFLOW_POLICY_NOT_CONFIGURED');
  return policy;
}

export function getApplicationWorkflowPolicyId(applicationId?: string): string {
  if (!applicationId || applicationId === 'ALL') return defaultPolicyId;
  return applicationPolicyIds.get(applicationId) || defaultPolicyId;
}

export function getWorkflowPolicy(applicationId?: string): WorkflowPolicy {
  return getWorkflowPolicyById(getApplicationWorkflowPolicyId(applicationId));
}

export function setApplicationWorkflowPolicy(applicationId: string, policyId: string): string {
  const policy = getWorkflowPolicyById(policyId);
  applicationPolicyIds.set(applicationId, policy.id);
  return policy.id;
}

export function applyWorkflowPolicyToApplication(application: Application): Application {
  return {
    ...application,
    workflowPolicyId: getApplicationWorkflowPolicyId(application.id),
  };
}

export function canRolePerformWorkflowCapability(
  role: UserRole,
  capability: WorkflowCapability,
  applicationId?: string
): boolean {
  if (role === 'SYSTEM_ADMIN') return true;
  const policy = getWorkflowPolicy(applicationId);
  return policy.versionHistory.capabilityRoles[capability]?.includes(role) ?? false;
}
