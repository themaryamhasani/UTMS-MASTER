import { createRunnerRuntime } from './execution/runner-runtime';

export const runnerRuntime = createRunnerRuntime({
  isolationMode: 'per-run-working-directory',
  artifactPolicy: 'object-storage',
});
