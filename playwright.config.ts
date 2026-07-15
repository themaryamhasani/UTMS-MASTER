import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const root = __dirname;
const baseURL = process.env.UTMS_WEB_BASE_URL || 'http://127.0.0.1:5173';
const apiBaseURL = process.env.UTMS_API_BASE_URL || 'http://127.0.0.1:4174';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const detectedChromePath = process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined;
const systemChromePath = process.env.UTMS_CHROME_EXECUTABLE_PATH ||
  (detectedChromePath && fs.existsSync(detectedChromePath) ? detectedChromePath : undefined);
const chromiumLaunchOptions = systemChromePath ? { executablePath: systemChromePath } : undefined;
const commonUse = {
  baseURL,
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  colorScheme: 'light' as const,
  trace: 'on-first-retry' as const,
  screenshot: 'only-on-failure' as const,
  video: 'retain-on-failure' as const,
  actionTimeout: 10_000,
  navigationTimeout: 20_000,
};

export default defineConfig({
  testDir: root,
  outputDir: path.join(root, 'test-results'),
  globalSetup: path.join(root, 'tests/fixtures/global-setup.ts'),
  globalTeardown: path.join(root, 'tests/fixtures/global-teardown.ts'),
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'artifacts/tests/junit/results.xml' }],
    ['json', { outputFile: 'artifacts/tests/json/results.json' }],
  ],
  metadata: {
    system: 'UTMS',
    apiBaseURL,
    deterministicSeed: process.env.UTMS_TEST_SEED || '20260715',
  },
  use: commonUse,
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'node scripts/testing/start-test-api.cjs',
          url: `${apiBaseURL}/api/health`,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'node scripts/testing/start-test-web.cjs',
          url: baseURL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
  projects: [
    { name: 'structural', testMatch: ['tests/structural/**/*.spec.ts'] },
    { name: 'api-integration', testMatch: ['apps/api/test/integration/**/*.spec.ts'] },
    {
      name: 'security-chromium',
      testMatch: ['apps/api/test/security/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-chromium',
      testMatch: ['tests/smoke/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'e2e-chromium',
      testMatch: ['tests/e2e/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'system-chromium',
      testMatch: ['tests/system/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'accessibility-chromium',
      testMatch: ['tests/accessibility/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'regression-chromium',
      testMatch: ['tests/regression/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'uat-chromium',
      testMatch: ['tests/uat/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'compatibility-chromium',
      testMatch: ['tests/compatibility/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'compatibility-mobile',
      testMatch: ['tests/compatibility/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Pixel 5'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'compatibility-firefox',
      testMatch: ['tests/compatibility/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Firefox'] },
    },
    {
      name: 'compatibility-webkit',
      testMatch: ['tests/compatibility/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Safari'] },
    },
    {
      name: 'performance',
      testMatch: ['tests/performance/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions },
    },
    {
      name: 'reliability',
      testMatch: ['tests/reliability/**/*.spec.ts'],
      use: { ...commonUse, ...devices['Desktop Chrome'] },
    },
  ],
});
