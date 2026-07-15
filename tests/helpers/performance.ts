export interface PerformanceSample {
  name: string;
  durationMs: number;
  status: number;
}

export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export function summarize(samples: readonly PerformanceSample[]) {
  const durations = samples.map(sample => sample.durationMs);
  return {
    count: samples.length,
    failures: samples.filter(sample => sample.status >= 400).length,
    medianMs: percentile(durations, 50),
    p90Ms: percentile(durations, 90),
    p95Ms: percentile(durations, 95),
    maxMs: Math.max(0, ...durations),
  };
}

