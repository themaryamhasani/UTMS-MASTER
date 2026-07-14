const fs = require('fs');
const path = require('path');

const root = process.cwd();
const args = process.argv.slice(2);
const write = args.includes('--write');
const targetArg = args.find(arg => arg !== '--write') || '.';
const target = path.resolve(root, targetArg);
const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'coverage', 'artifacts', 'runtime']);
const formattedExtensions = new Set(['.cjs', '.js', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml']);
const failures = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(filePath);
      continue;
    }

    if (!formattedExtensions.has(path.extname(entry.name))) continue;
    let content = fs.readFileSync(filePath, 'utf8');
    const normalized = content.replace(/\r\n/g, '\n');
    const withFinalNewline = normalized.endsWith('\n') ? normalized : `${normalized}\n`;

    if (write && withFinalNewline !== content) {
      fs.writeFileSync(filePath, withFinalNewline);
      content = withFinalNewline;
    }

    if (!write && withFinalNewline !== content) {
      failures.push(`${path.relative(root, filePath)} should use LF line endings and end with a newline`);
    }
  }
}

walk(target);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(write ? 'Formatting normalization complete.' : 'Formatting check passed.');
