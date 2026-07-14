const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = process.argv[2] ? path.resolve(root, process.argv[2]) : root;
const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'coverage', 'artifacts', 'runtime']);
const checkedExtensions = new Set(['.cjs', '.js', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml']);
const failures = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(path.join(directory, entry.name));
      continue;
    }

    const filePath = path.join(directory, entry.name);
    const extension = path.extname(entry.name);
    if (!checkedExtensions.has(extension)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) {
      failures.push(`${path.relative(root, filePath)} contains merge conflict markers`);
    }
    if (entry.name.endsWith('.bak') || entry.name.endsWith('.tmp')) {
      failures.push(`${path.relative(root, filePath)} is a temporary file`);
    }
  }
}

walk(target);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Workspace lint passed for ${path.relative(root, target) || '.'}.`);
