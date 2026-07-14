const fs = require('fs');
const path = require('path');

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'coverage', 'artifacts', 'runtime']);
const sourceExtensions = new Set(['.cjs', '.js', '.ts', '.tsx']);
const failures = [];
const sourceFiles = [];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relative(filePath) {
  return toPosix(path.relative(root, filePath));
}

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(filePath);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) sourceFiles.push(filePath);
  }
}

function addFailure(filePath, message) {
  failures.push(`${relative(filePath)}: ${message}`);
}

function readImports(content) {
  const imports = [];
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = importPattern.exec(content))) imports.push(match[1]);
  while ((match = requirePattern.exec(content))) imports.push(match[1]);
  return imports;
}

function isProductionSource(file) {
  const rel = relative(file);
  return (
    rel.startsWith('apps/') &&
    rel.includes('/src/') &&
    !rel.includes('/test/') &&
    !rel.endsWith('.spec.ts') &&
    !rel.endsWith('.test.ts')
  ) || (
    rel.startsWith('packages/') &&
    rel.includes('/src/') &&
    !rel.includes('packages/test-support/')
  );
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.cjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.cjs'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function moduleNameFromApiModulePath(rel) {
  const parts = rel.split('/');
  const modulesIndex = parts.indexOf('modules');
  return modulesIndex >= 0 ? parts[modulesIndex + 1] : undefined;
}

for (const topLevel of ['apps', 'packages', 'scripts', 'tests']) {
  walk(path.join(root, topLevel));
}

for (const forbiddenRoot of ['src', 'server', 'migration-work']) {
  if (fs.existsSync(path.join(root, forbiddenRoot))) {
    failures.push(`Root directory "${forbiddenRoot}" must not exist in the final structure`);
  }
}

for (const generatedRoot of ['dist', 'logs']) {
  if (fs.existsSync(path.join(root, generatedRoot))) {
    failures.push(`Generated/runtime root directory "${generatedRoot}" must be removed or moved under ignored output`);
  }
}

const graph = new Map();

for (const filePath of sourceFiles) {
  const rel = relative(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = readImports(content);
  graph.set(filePath, imports.map(specifier => resolveImport(filePath, specifier)).filter(Boolean));

  if (rel.startsWith('apps/web/src/')) {
    for (const specifier of imports) {
      if (
        specifier.includes('@utms/api') ||
        specifier.includes('apps/api') ||
        specifier.includes('server/') ||
        specifier.includes('api-console-server')
      ) {
        addFailure(filePath, `frontend source cannot import API implementation (${specifier})`);
      }
    }
  }

  if (rel.startsWith('apps/api/src/modules/') && rel.includes('/domain/')) {
    for (const specifier of imports) {
      if (
        specifier.includes('infrastructure') ||
        specifier.includes('@nestjs') ||
        specifier.includes('prisma') ||
        specifier.includes('@prisma/client')
      ) {
        addFailure(filePath, `domain source cannot import infrastructure/framework/persistence (${specifier})`);
      }
    }
  }

  if (rel.startsWith('apps/api/src/modules/')) {
    const ownerModule = moduleNameFromApiModulePath(rel);
    for (const specifier of imports) {
      if (specifier.includes('/modules/')) {
        const importedModule = moduleNameFromApiModulePath(specifier);
        if (importedModule && ownerModule && importedModule !== ownerModule) {
          addFailure(filePath, `module cannot import another module private file (${specifier})`);
        }
      }
    }
  }

  if (isProductionSource(filePath)) {
    for (const specifier of imports) {
      if (specifier.includes('@utms/test-support') || specifier.includes('packages/test-support')) {
        addFailure(filePath, `production source cannot import test-support (${specifier})`);
      }
      if (specifier.toLowerCase().includes('mockdata') || specifier.toLowerCase().includes('/mock/')) {
        addFailure(filePath, `production source cannot import mock data (${specifier})`);
      }
      if (specifier.includes('migration-work')) {
        addFailure(filePath, `source cannot import temporary migration folders (${specifier})`);
      }
    }
  }

  if (rel.startsWith('apps/api/src/')) {
    for (const specifier of imports) {
      if (specifier.includes('@utms/playwright-runner') || specifier.includes('apps/playwright-runner')) {
        addFailure(filePath, `API cannot import Playwright runner implementation (${specifier})`);
      }
    }
  }

  if (rel.startsWith('apps/worker/src/')) {
    for (const specifier of imports) {
      if (specifier.includes('@utms/web') || specifier.includes('apps/web')) {
        addFailure(filePath, `worker cannot import frontend code (${specifier})`);
      }
    }
  }

  if ((rel.startsWith('packages/shared/src/') || rel.startsWith('packages/contracts/src/')) && content.includes('process.env')) {
    addFailure(filePath, 'shared contracts/utilities cannot access environment variables');
  }
}

const visiting = new Set();
const visited = new Set();

function detectCycle(filePath, stack) {
  if (visiting.has(filePath)) {
    const cycle = stack.slice(stack.indexOf(filePath)).concat(filePath).map(relative).join(' -> ');
    failures.push(`Circular dependency detected: ${cycle}`);
    return;
  }
  if (visited.has(filePath)) return;

  visiting.add(filePath);
  for (const dependency of graph.get(filePath) || []) {
    if (graph.has(dependency)) detectCycle(dependency, stack.concat(dependency));
  }
  visiting.delete(filePath);
  visited.add(filePath);
}

for (const filePath of graph.keys()) detectCycle(filePath, [filePath]);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Architecture boundary check passed.');
