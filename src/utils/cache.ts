/** TTL cache with bounded storage and one loader per key. Failures are never cached. */
export class AsyncCache<T> {
  private readonly values = new Map<string, { value: T; expiresAt: number }>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500, private readonly now = Date.now) {}

  get(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached.value);
    this.values.delete(key);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const promise = Promise.resolve().then(loader).then(value => {
      for (const [entryKey, entry] of this.values) {
        if (entry.expiresAt <= this.now()) this.values.delete(entryKey);
      }
      if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
      this.values.set(key, { value, expiresAt: this.now() + this.ttlMs });
      return value;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  clear(): void { this.values.clear(); }
}
