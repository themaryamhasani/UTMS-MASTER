export const apiConsoleModule = {
  name: 'api-console',
  adapter: 'commonjs-transitional-adapter',
  routes: ['/api/api-console', '/api/reports', '/api/domain'],
} as const;

export type ApiConsoleModule = typeof apiConsoleModule;
