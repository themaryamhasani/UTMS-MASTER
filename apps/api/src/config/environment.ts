export interface ApiEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  apiConsolePort: number;
  apiConsoleCorsOrigin: string;
  apiConsoleDataDir: string;
}

type EnvironmentSource = Record<string, string | undefined>;

function requiredString(env: EnvironmentSource, key: string, fallback?: string): string {
  const value = env[key] ?? fallback;
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function positiveInteger(env: EnvironmentSource, key: string, fallback: number): number {
  const raw = env[key] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid environment variable: ${key} must be a positive integer`);
  }
  return value;
}

function nodeEnv(env: EnvironmentSource): ApiEnvironment['nodeEnv'] {
  const value = env.NODE_ENV ?? 'development';
  if (value === 'development' || value === 'test' || value === 'production') return value;
  throw new Error('Invalid environment variable: NODE_ENV must be development, test, or production');
}

export function loadApiEnvironment(env: EnvironmentSource = process.env): ApiEnvironment {
  return {
    nodeEnv: nodeEnv(env),
    apiConsolePort: positiveInteger(env, 'API_CONSOLE_PORT', 4174),
    apiConsoleCorsOrigin: requiredString(env, 'API_CONSOLE_CORS_ORIGIN', 'http://localhost:5173'),
    apiConsoleDataDir: requiredString(env, 'API_CONSOLE_DATA_DIR', 'runtime/api-console'),
  };
}
