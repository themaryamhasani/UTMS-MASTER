export class SeededRandom {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }

  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new Error('Cannot pick from an empty array');
    return values[Math.floor(this.next() * values.length)] as T;
  }

  text(length: number): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => this.pick([...alphabet])).join('');
  }
}
