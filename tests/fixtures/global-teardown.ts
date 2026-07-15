import fs from 'node:fs';
import path from 'node:path';

export default async function globalTeardown(): Promise<void> {
  const output = path.join(process.cwd(), 'artifacts/tests/execution-manifest.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        seed: process.env.UTMS_TEST_SEED || '20260715',
        webBaseURL: process.env.UTMS_WEB_BASE_URL || 'http://127.0.0.1:5173',
        apiBaseURL: process.env.UTMS_API_BASE_URL || 'http://127.0.0.1:4174',
      },
      null,
      2
    )
  );
}
