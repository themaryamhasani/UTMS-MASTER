import { browser } from 'k6/browser';
import { check } from 'k6';
import { dashboard_duration } from '../helpers/metrics.js';

export const options = {
  scenarios: {
    frontend: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    dashboard_duration: ['p(95)<5000'],
  },
};

export default async function () {
  const page = browser.newPage();
  const started = Date.now();
  try {
    await page.goto(`${__ENV.PERF_WEB_URL || 'http://localhost:5173'}/login`);
    dashboard_duration.add(Date.now() - started, { operation: 'frontend_login_navigation', endpoint_group: 'frontend' });
    check(page, { 'login page title/body rendered': async p => (await p.locator('body').textContent()).length > 0 });
  } finally {
    page.close();
  }
}
