import { setTimeout as sleep } from 'node:timers/promises';
import { AppError } from './errors.js';

export class RequestGate {
  private nextStart = 0;
  constructor(private readonly intervalMs: number, private readonly maxWaitMs: number, private readonly now = Date.now) {}

  async acquire(): Promise<void> {
    const current = this.now();
    const start = Math.max(current, this.nextStart);
    const delay = start - current;
    if (delay > this.maxWaitMs) {
      throw new AppError('RATE_LIMIT', `Point Blank's request limit is active. Please try again in ${Math.ceil(delay / 60_000)} minute(s).`);
    }
    this.nextStart = start + this.intervalMs;
    if (delay > 0) await sleep(delay);
  }

  defer(ms: number): void { this.nextStart = Math.max(this.nextStart, this.now() + ms); }
}
