import fs from 'node:fs';
import path from 'node:path';
import { test as base, request, type APIRequestContext } from '@playwright/test';
import { redact } from '../helpers/redaction';

type Fixtures = { api: APIRequestContext };

export const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const context = await request.newContext({
      baseURL: process.env.UTMS_API_BASE_URL || 'http://127.0.0.1:4174',
      extraHTTPHeaders: { accept: 'application/json' },
    });
    await context.post('/api/api-console/__test/reset');
    await use(context);
    await context.dispose();
  },
  page: async ({ page }, use, testInfo) => {
    const consoleMessages: Array<Record<string, unknown>> = [];
    const failedRequests: Array<Record<string, unknown>> = [];
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleMessages.push({ type: message.type(), text: message.text() });
      }
    });
    page.on('requestfailed', failed => {
      failedRequests.push({ url: failed.url(), method: failed.method(), failure: failed.failure()?.errorText });
    });
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus && (consoleMessages.length || failedRequests.length)) {
      const output = testInfo.outputPath('browser-diagnostics.json');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(redact({ consoleMessages, failedRequests }), null, 2));
      await testInfo.attach('browser-diagnostics', { path: output, contentType: 'application/json' });
    }
  },
});

export { expect } from '@playwright/test';
