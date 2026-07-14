const task = process.argv[2];
const supportedTasks = new Set(['generate', 'migrate', 'migrate:status', 'seed']);

if (!supportedTasks.has(task)) {
  console.error(`Unsupported database task: ${task || '(missing)'}`);
  process.exit(1);
}

console.log(`Database task "${task}" is wired. Install Prisma and DATABASE_URL before running real database changes.`);
