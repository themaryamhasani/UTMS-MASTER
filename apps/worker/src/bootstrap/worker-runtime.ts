export interface WorkerRuntimeOptions {
  processors: string[];
  schedulers: string[];
}

export interface WorkerRuntime {
  service: 'utms-worker';
  processors: string[];
  schedulers: string[];
}

export function createWorkerRuntime(options: WorkerRuntimeOptions): WorkerRuntime {
  return {
    service: 'utms-worker',
    processors: options.processors,
    schedulers: options.schedulers,
  };
}
