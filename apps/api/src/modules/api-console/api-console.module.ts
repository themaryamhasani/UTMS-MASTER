export const apiConsoleModule = {
  name: 'api-console',
  adapter: 'commonjs-transitional-adapter',
  routes: ['/api/api-console', '/api/reports'],
} as const;

export type ApiConsoleModule = typeof apiConsoleModule;
