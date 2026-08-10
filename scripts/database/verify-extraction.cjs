const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');

const adminUrl = process.env.ADMIN_DATABASE_URL;
if (!adminUrl) throw new Error('ADMIN_DATABASE_URL is required and must point to a disposable PostgreSQL server.');

const databaseName = `utms_extract_verify_${process.pid}`;
if (!/^utms_extract_verify_\d+$/.test(databaseName)) throw new Error('Unsafe verification database name.');
const target = new URL(adminUrl);
target.pathname = `/${databaseName}`;
const databaseUrl = target.toString();
const admin = new Client({ connectionString: adminUrl });

function runPrismaTask(task) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'prisma-task.cjs'), task], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Prisma task ${task} failed with exit code ${result.status}.`);
}

(async () => {
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    runPrismaTask('migrate');
    runPrismaTask('seed');

    const targetClient = new Client({ connectionString: databaseUrl });
    await targetClient.connect();
    try {
      const forbiddenTables = await targetClient.query(`SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND (table_name ILIKE '%playwright%' OR table_name ILIKE '%cde%') ORDER BY table_name`);
      const forbiddenColumns = await targetClient.query(`SELECT table_name,column_name FROM information_schema.columns
        WHERE table_schema='public' AND (column_name ILIKE '%cde%' OR column_name='automated_tests_enabled') ORDER BY table_name,column_name`);
      const migrations = await targetClient.query('SELECT count(*)::int count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
      if (forbiddenTables.rowCount || forbiddenColumns.rowCount) throw new Error('Extracted product schema remains in the final UTMS database.');
      console.log(JSON.stringify({ appliedMigrations: migrations.rows[0].count, forbiddenTables: [], forbiddenColumns: [] }, null, 2));
    } finally {
      await targetClient.end();
    }
  } finally {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.end();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
