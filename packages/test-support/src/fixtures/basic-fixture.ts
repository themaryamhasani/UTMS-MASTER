export interface BasicFixture {
  id: string;
  name: string;
}

export function createBasicFixture(overrides: Partial<BasicFixture> = {}): BasicFixture {
  return {
    id: overrides.id ?? 'fixture-1',
    name: overrides.name ?? 'Fixture',
  };
}
