export interface ApplicationScopedItem {
  applicationId: string;
}

export interface RequirementLinkedItem extends ApplicationScopedItem {
  requirementId: string;
}

export function filterByRequestApplication<T extends ApplicationScopedItem>(
  items: T[],
  testRequest?: ApplicationScopedItem
): T[] {
  if (!testRequest?.applicationId) return [];
  return items.filter(item => item.applicationId === testRequest.applicationId);
}

export function filterTestCasesForExecution<T extends RequirementLinkedItem>(
  testCases: T[],
  testRequest?: ApplicationScopedItem,
  requirementId?: string
): T[] {
  const scopedTestCases = filterByRequestApplication(testCases, testRequest);
  if (!requirementId) return [];
  return scopedTestCases.filter(testCase => testCase.requirementId === requirementId);
}

export function haveSameApplication(
  left?: ApplicationScopedItem,
  right?: ApplicationScopedItem
): boolean {
  return !!left?.applicationId && left.applicationId === right?.applicationId;
}
