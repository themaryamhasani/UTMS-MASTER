import { createWorkerRuntime } from './bootstrap/worker-runtime';

export const workerRuntime = createWorkerRuntime({
  processors: ['notification-outbox'],
  schedulers: ['scheduled-reports'],
});
