import type { TestInfo } from '@playwright/test';

export interface TestMetadata {
  id: `UTMS-${string}`;
  requirement: string;
  feature: string;
  level: 'structural' | 'integration' | 'system' | 'e2e' | 'uat';
  type: string;
  technique: string;
  role: string;
  scope: 'APP' | 'SYSTEMS' | 'N/A';
  preconditions: string;
  data: string;
  expected: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

export function metadata(id: TestMetadata['id'], overrides: Partial<Omit<TestMetadata, 'id'>> = {}): TestMetadata {
  return {
    id,
    requirement: 'Source implementation',
    feature: 'UTMS',
    level: 'system',
    type: 'functional',
    technique: 'Requirements-based Testing',
    role: 'N/A',
    scope: 'N/A',
    preconditions: 'Isolated test environment is healthy',
    data: `Deterministic seed ${process.env.UTMS_TEST_SEED || '20260715'}`,
    expected: 'Documented behavior is enforced',
    risk: 'medium',
    ...overrides,
  };
}

export function annotateTest(testInfo: TestInfo, metadata: TestMetadata): void {
  for (const [type, description] of Object.entries(metadata)) {
    testInfo.annotations.push({ type, description });
  }
}
