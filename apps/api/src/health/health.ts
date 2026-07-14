export interface HealthSnapshot {
  status: 'ok';
  service: 'utms-api';
  checkedAt: string;
  modules: string[];
}

export function getHealthSnapshot(modules: string[]): HealthSnapshot {
  return {
    status: 'ok',
    service: 'utms-api',
    checkedAt: new Date().toISOString(),
    modules,
  };
}
