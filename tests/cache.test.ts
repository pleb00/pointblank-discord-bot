import { describe, expect, it, vi } from 'vitest';
import { AsyncCache } from '../src/utils/cache.js';
import { RequestGate } from '../src/utils/rate-limit.js';

describe('cache', () => {
  it('deduplicates concurrent requests and expires entries', async () => {
    let now = 0;
    const cache = new AsyncCache<number>(100, 2, () => now);
    const loader = vi.fn().mockResolvedValue(42);
    expect(await Promise.all([cache.get('a', loader), cache.get('a', loader)])).toEqual([42, 42]);
    now = 99;
    await cache.get('a', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 100;
    await cache.get('a', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('never caches failures and bounds stored entries', async () => {
    const cache = new AsyncCache<number>(100, 1, () => 0);
    await expect(cache.get('a', async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(await cache.get('a', async () => 1)).toBe(1);
    await cache.get('b', async () => 2);
    expect(await cache.get('a', async () => 3)).toBe(3);
  });
});

describe('request budget', () => {
  it('permits consecutive and concurrent requests with no configured cooldown', async () => {
    const gate = new RequestGate(0, 0, () => 0);
    await expect(Promise.all([gate.acquire(), gate.acquire(), gate.acquire()])).resolves.toEqual([undefined, undefined, undefined]);
    await expect(gate.acquire()).resolves.toBeUndefined();
  });
  it('reserves starts atomically and rejected calls do not extend the budget', async () => {
    let now = 0;
    const gate = new RequestGate(1000, 0, () => now);
    await gate.acquire();
    await expect(gate.acquire()).rejects.toThrow('request limit');
    now = 1000;
    await expect(gate.acquire()).resolves.toBeUndefined();
  });
});
