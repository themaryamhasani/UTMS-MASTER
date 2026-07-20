const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/UTMS?schema=public';
const REQUIRED_TABLES = [
  'users',
  'applications',
  'user_role_assignments',
  'workflow_policies',
  'test_requests',
  'requirements',
  'flows',
  'test_cases',
  'test_runs',
  'bugs',
  'retest_tasks',
  'run_issues',
  'checklists',
  'security_reviews',
  'playwright_runs',
  'playwright_test_files',
  'version_histories',
  'attachments',
  'audit_logs',
  'comments',
  'notifications',
  'notification_outbox_items',
  'command_traces',
  'domain_event_outbox',
  'api_console_collections',
  'api_console_requests',
  'api_request_executions',
  'api_share_requests',
  'scheduled_reports',
  'report_alerts',
];

function runPrismaValidate() {
  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'validate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function verifyConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  });

  await client.connect();
  const result = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1)
      order by table_name
    `,
    [REQUIRED_TABLES],
  );
  await client.end();

  const found = new Set(result.rows.map(row => row.table_name));
  const missing = REQUIRED_TABLES.filter(table => !found.has(table));
  if (missing.length > 0) {
    console.error(`Database is reachable, but required tables are missing: ${missing.join(', ')}`);
    console.error('Run npm run db:migrate to apply database/prisma/migrations.');
    process.exit(1);
  }

  console.log(`Database connection verified. Found ${found.size} required UTMS tables.`);
}

const schemaPath = path.join(process.cwd(), 'database', 'prisma', 'schema.prisma');
const migrationsPath = path.join(process.cwd(), 'database', 'prisma', 'migrations');

if (!fs.existsSync(schemaPath)) {
  console.error('Missing database/prisma/schema.prisma');
  process.exit(1);
}

if (!fs.existsSync(migrationsPath)) {
  console.error('Missing database/prisma/migrations');
  process.exit(1);
}

runPrismaValidate();
verifyConnection().catch(error => {
  console.error('Database verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
