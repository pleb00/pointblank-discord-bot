import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointBlankClient } from '../../src/clients/pointblank.client.js';
import { WebstoreService } from '../../src/services/webstore.service.js';
import { baseUrl } from '../helpers.js';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/webstore-${name}.html`, import.meta.url), 'utf8');

afterEach(() => { vi.useRealTimers(); });

describe('webstore service page cache', () => {
  function setup(ttl = 120_000) {
    const client = { getWebstoreHtml: vi.fn().mockResolvedValue(fixture('trending')) };
    const service = new WebstoreService(client as unknown as PointBlankClient, baseUrl, ttl);
    return { client, service };
  }
  it('deduplicates concurrent parsing and caches each category/page independently', async () => {
    const { client, service } = setup();
    const pages = await Promise.all([service.getPage('trending'), service.getPage('trending')]);
    expect(pages[0]).toBe(pages[1]);
    await service.getPage('trending');
    expect(client.getWebstoreHtml).toHaveBeenCalledExactlyOnceWith('trending', 1);
    client.getWebstoreHtml.mockResolvedValue(fixture('trending-2'));
    expect(await service.getPage('trending', 2)).toMatchObject({ page: 2 });
    client.getWebstoreHtml.mockResolvedValue(fixture('sale'));
    expect(await service.getPage('sale')).toMatchObject({ category: 'sale' });
    expect(client.getWebstoreHtml).toHaveBeenCalledTimes(3);
  });
  it('evicts failures, including parsing failures, so a corrected page is retryable', async () => {
    const { client, service } = setup();
    client.getWebstoreHtml.mockRejectedValueOnce(new Error('synthetic network failure'));
    await expect(service.getPage('trending')).rejects.toThrow();
    client.getWebstoreHtml.mockResolvedValueOnce('<html>changed</html>');
    await expect(service.getPage('trending')).rejects.toThrow('layout changed');
    await expect(service.getPage('trending')).resolves.toMatchObject({ page: 1 });
    expect(client.getWebstoreHtml).toHaveBeenCalledTimes(3);
  });
  it('refreshes data after its TTL', async () => {
    vi.useFakeTimers();
    const { client, service } = setup(1000);
    const first = await service.getPage('trending');
    vi.advanceTimersByTime(1001);
    const refreshed = await service.getPage('trending');
    expect(refreshed).not.toBe(first);
    expect(client.getWebstoreHtml).toHaveBeenCalledTimes(2);
  });
  it('validates page numbers before issuing HTTP requests', async () => {
    const { client, service } = setup();
    expect(() => service.getPage('trending', 0)).toThrow('positive page');
    expect(client.getWebstoreHtml).not.toHaveBeenCalled();
  });
});
