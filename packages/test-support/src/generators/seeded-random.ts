export class DeterministicGenerator {
  private state: number;

  constructor(public readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1103515245 * this.state + 12345) & 0x7fffffff;
    return this.state / 0x80000000;
  }

  integer(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}
