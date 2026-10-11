import axios, { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { clanUrl, memberUrl, PointBlankClient } from '../../src/clients/pointblank.client.js';
import { RequestGate } from '../../src/utils/rate-limit.js';
import { createLogger } from '../../src/utils/logger.js';
import { baseUrl, detailJson, fixtureHtml, loginHtml, testEnvironment } from '../helpers.js';

describe('URL construction', () => {
  it('preserves raw clan identifiers and encodes plus, slash, and padding', () => {
    const url = clanUrl(baseUrl, 'abc+/==');
    expect(url.searchParams.get('env')).toBe('abc+/==');
    expect(url.href).toContain('abc%2B%2F%3D%3D');
  });
  it('decodes a member attribute once without changing plus signs', () => {
    expect(memberUrl(baseUrl, 'abc%2B%2F%3D%3D').searchParams.get('env')).toBe('abc+/==');
    expect(memberUrl(baseUrl, 'abc+/==').searchParams.get('env')).toBe('abc+/==');
    expect(memberUrl(baseUrl, 'abc%253D').searchParams.get('env')).toBe('abc%3D');
    expect(memberUrl(baseUrl, 'abc%3D').searchParams.get('div')).toBe('1');
    expect(() => memberUrl(baseUrl, 'abc%ZZ')).toThrow('invalid');
  });
});

describe('HTTP integration with mocked Axios transport', () => {
  function setup(body: string, status = 200, retries = 2, intervalMs = testEnvironment.POINTBLANK_MIN_REQUEST_INTERVAL_MS) {
    const http = axios.create();
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: body, status, headers: {} });
    const client = new PointBlankClient({ ...testEnvironment, REQUEST_MAX_RETRIES: retries }, new RequestGate(intervalMs, 0), createLogger('silent'), http);
    return { get, client };
  }
  it('retrieves HTML and deduplicates/caches detail requests', async () => {
    const { client, get } = setup(fixtureHtml);
    expect(await client.getClanHtml('fixture')).toBe(fixtureHtml);
    get.mockResolvedValue({ data: JSON.stringify(detailJson), status: 200, headers: {} });
    const results = await Promise.all([client.getMemberDetail('encoded%3D'), client.getMemberDetail('encoded%3D')]);
    expect(results[0]).toEqual(detailJson);
    await client.getMemberDetail('encoded%3D');
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('rejects login responses, HTML in place of JSON, and error JSON', async () => {
    await expect(setup(loginHtml).client.getClanHtml('fixture')).rejects.toThrow('requires login');
    await expect(setup('<html>error</html>').client.getMemberDetail('fixture')).rejects.toThrow('unexpected player');
    await expect(setup('[]').client.getMemberDetail('fixture')).rejects.toThrow('unexpected player');
  });
  it('uses bounded retries for transient server and network failures', async () => {
    const { client, get } = setup('error', 503);
    await expect(client.getClanHtml('fixture')).rejects.toThrow('unavailable');
    expect(get).toHaveBeenCalledTimes(3);
    const network = setup('');
    network.get.mockRejectedValue(new AxiosError('private-url-and-token', 'ECONNRESET'));
    await expect(network.client.getClanHtml('fixture')).rejects.toThrow('Could not reach');
    expect(network.get).toHaveBeenCalledTimes(3);
  });
  it('returns a readable timeout after its retry budget', async () => {
    const { client, get } = setup('', 200, 0);
    get.mockRejectedValue(new AxiosError('private data', 'ECONNABORTED'));
    await expect(client.getClanHtml('fixture')).rejects.toThrow('too long');
  });
  it('does not retry forbidden or missing resources', async () => {
    for (const status of [403, 404]) {
      const { client, get } = setup('', status);
      await expect(client.getClanHtml('fixture')).rejects.toThrow();
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
  it('respects optional request spacing when retrying', async () => {
    const { client, get } = setup('error', 503, 2, 1000);
    await expect(client.getClanHtml('fixture')).rejects.toThrow('request limit');
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('honors Retry-After and rejects immediately rather than hanging a Discord reply', async () => {
    const { client, get } = setup('', 429);
    get.mockResolvedValue({ data: '', status: 429, headers: { 'retry-after': '3600' } });
    await expect(client.getClanHtml('fixture')).rejects.toThrow('request limit');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
