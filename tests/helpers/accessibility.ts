import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { redact } from './redaction';

/** Run a WCAG scan and persist the raw, redacted result as a test artifact. */
export async function scanAccessibility(page: Page, testInfo: TestInfo, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  const result = await (include ? builder.include(include) : builder).analyze();
  const output = testInfo.outputPath('accessibility.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(redact(result), null, 2));
  await testInfo.attach('accessibility', { path: output, contentType: 'application/json' });
  return result;
}

