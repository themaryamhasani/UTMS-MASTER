export interface ApplicationScopedItem {
  applicationId: string;
}

export interface RequirementLinkedItem extends ApplicationScopedItem {
  requirementId: string;
}

export interface TestRequestRequirementLinks extends ApplicationScopedItem {
  id: string;
  requirementId?: string | undefined;
  selectedRequirementIds?: string[] | undefined;
}

export interface RequirementRequestLink extends ApplicationScopedItem {
  id: string;
  testRequestId?: string | undefined;
}

export interface RequestLinkedTestCase extends RequirementLinkedItem {
  testRequestId?: string | undefined;
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

export function getLinkedRequirementIdsForRequests(
  testRequests: TestRequestRequirementLinks[],
  requirements: RequirementRequestLink[]
): string[] {
  const requestIds = new Set(testRequests.map(testRequest => testRequest.id));
  return Array.from(new Set([
    ...testRequests.flatMap(testRequest => testRequest.selectedRequirementIds || []),
    ...testRequests.flatMap(testRequest => testRequest.requirementId ? [testRequest.requirementId] : []),
    ...requirements
      .filter(requirement => requirement.testRequestId && requestIds.has(requirement.testRequestId))
      .map(requirement => requirement.id),
  ]));
}

export function filterTestCasesLinkedToRequests<T extends RequestLinkedTestCase>(
  testCases: T[],
  testRequests: TestRequestRequirementLinks[],
  requirements: RequirementRequestLink[]
): T[] {
  const requestIds = new Set(testRequests.map(testRequest => testRequest.id));
  const requirementIds = new Set(getLinkedRequirementIdsForRequests(testRequests, requirements));
  return testCases.filter(testCase =>
    (!!testCase.testRequestId && requestIds.has(testCase.testRequestId)) ||
    requirementIds.has(testCase.requirementId)
  );
}

export function haveSameApplication(
  left?: ApplicationScopedItem,
  right?: ApplicationScopedItem
): boolean {
  return !!left?.applicationId && left.applicationId === right?.applicationId;
}
