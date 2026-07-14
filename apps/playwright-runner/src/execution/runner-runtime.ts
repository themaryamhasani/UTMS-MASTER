export interface RunnerRuntimeOptions {
  isolationMode: 'per-run-working-directory';
  artifactPolicy: 'object-storage';
}

export interface RunnerRuntime {
  service: 'utms-playwright-runner';
  isolationMode: RunnerRuntimeOptions['isolationMode'];
  artifactPolicy: RunnerRuntimeOptions['artifactPolicy'];
}

export function createRunnerRuntime(options: RunnerRuntimeOptions): RunnerRuntime {
  return {
    service: 'utms-playwright-runner',
    isolationMode: options.isolationMode,
    artifactPolicy: options.artifactPolicy,
  };
}
