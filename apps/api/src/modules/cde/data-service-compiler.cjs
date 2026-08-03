const babel = require('@babel/core');
const presetEnv = require('@babel/preset-env');
const presetReact = require('@babel/preset-react');
const presetTypeScript = require('@babel/preset-typescript');

class CdeCompileError extends Error {
  constructor(message, fileName) {
    super(message);
    this.category = 'CDE_COMPILE_FAILED';
    this.statusCode = 422;
    this.fileName = fileName;
  }
}

function normalizeSourcePath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || path.includes('\0') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    throw new CdeCompileError('Source path is invalid.', path);
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new CdeCompileError('Source path contains an unsafe segment.', path);
  }
  return parts.join('/');
}

function readTsConfig(files) {
  const configFile = files.find(file => normalizeSourcePath(file.name) === 'tsconfig.json');
  if (!configFile) return {};
  try {
    return JSON.parse(String(configFile.code || '{}'));
  } catch {
    throw new CdeCompileError('tsconfig.json is not valid JSON.', 'tsconfig.json');
  }
}

function globPatternToRegex(pattern) {
  const normalized = String(pattern || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}(?:/.*)?$`);
}

function filterFilesByTsconfig(files, config) {
  const sourceFiles = files.filter(file => normalizeSourcePath(file.name) !== 'tsconfig.json');
  const include = Array.isArray(config.include) && config.include.length
    ? config.include.map(globPatternToRegex)
    : [/.*/];
  const exclude = Array.isArray(config.exclude)
    ? config.exclude.map(globPatternToRegex)
    : [/^node_modules(?:\/|$)/, /^dist(?:\/|$)/];
  return sourceFiles.filter(file => {
    const path = normalizeSourcePath(file.name);
    return include.some(pattern => pattern.test(path)) && !exclude.some(pattern => pattern.test(path));
  });
}

function compileJavaScript(code, fileName) {
  try {
    return babel.transformSync(String(code || ''), {
      filename: fileName,
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      presets: [
        [presetEnv, { targets: { node: '18' }, modules: 'commonjs' }],
        [presetReact, { runtime: 'classic' }],
      ],
    })?.code || '';
  } catch (error) {
    throw new CdeCompileError(`JavaScript compilation failed: ${error.message}`, fileName);
  }
}

function compileTypeScript(code, fileName) {
  try {
    return babel.transformSync(String(code || ''), {
      filename: fileName,
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      presets: [
        [presetEnv, { targets: { node: '18' }, modules: 'commonjs' }],
        [presetReact, { runtime: 'classic' }],
        [presetTypeScript, { allowNamespaces: true }],
      ],
    })?.code || '';
  } catch (error) {
    throw new CdeCompileError(`TypeScript compilation failed: ${error.message}`, fileName);
  }
}

function compileDataServicePackage(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new CdeCompileError('A Data Service branch must contain at least one source file.');
  }
  const normalized = files.map(file => ({
    name: normalizeSourcePath(file.name),
    code: String(file.code ?? ''),
    oppend: Boolean(file.oppend),
  }));
  const seen = new Set();
  for (const file of normalized) {
    const key = file.name.toLocaleLowerCase('en-US');
    if (seen.has(key)) throw new CdeCompileError('Source paths collide by case.', file.name);
    seen.add(key);
  }
  const config = readTsConfig(normalized);
  const rootDir = String(config?.compilerOptions?.rootDir || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  return filterFilesByTsconfig(normalized, config).flatMap(file => {
    let outputPath = file.name;
    if (rootDir && outputPath.startsWith(`${rootDir}/`)) outputPath = outputPath.slice(rootDir.length + 1);
    if (/\.jsx?$/i.test(outputPath)) {
      return [{ name: outputPath, build: compileJavaScript(file.code, outputPath) }];
    }
    if (/\.tsx?$/i.test(outputPath)) {
      const builtName = outputPath.replace(/\.ts$/i, '.js').replace(/\.tsx$/i, '.jsx');
      return [{ name: builtName, build: compileTypeScript(file.code, outputPath) }];
    }
    if (/\.json$/i.test(outputPath)) {
      try {
        JSON.parse(file.code);
      } catch {
        throw new CdeCompileError('JSON source is invalid.', outputPath);
      }
      return [{ name: outputPath, build: file.code }];
    }
    return [];
  });
}

function compileDataServiceBranchContent(content) {
  if (!content || content.type !== 'JS' || !Array.isArray(content.content)) {
    throw new CdeCompileError('The configured test branch is not a JS Data Service package.');
  }
  return {
    ...content,
    build: compileDataServicePackage(content.content),
  };
}

module.exports = {
  CdeCompileError,
  compileDataServiceBranchContent,
  compileDataServicePackage,
  normalizeSourcePath,
};
