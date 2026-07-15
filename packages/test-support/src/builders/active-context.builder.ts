export interface TestActiveContext {
  userId: string;
  role: string;
  applicationId: string;
  scopeApplicationIds: string[];
}

export function buildActiveContext(overrides: Partial<TestActiveContext> = {}): TestActiveContext {
  return {
    userId: 'test-user',
    role: 'QA_LEAD',
    applicationId: 'app-1',
    scopeApplicationIds: ['app-1'],
    ...overrides,
  };
}
