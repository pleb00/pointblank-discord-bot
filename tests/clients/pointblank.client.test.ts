import axios, { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { clanUrl, memberUrl, playerSearchUrl, PointBlankClient } from '../../src/clients/pointblank.client.js';
import { RequestGate } from '../../src/utils/rate-limit.js';
import { createLogger } from '../../src/utils/logger.js';
import { MemberService } from '../../src/services/member.service.js';
import { baseUrl, detailJson, fixtureHtml, loginHtml, playerDetailJson, playerSearchHtml, testEnvironment } from '../helpers.js';

describe('URL construction', () => {
  it.each(['pLebb', 'He`Cans13+TNG', '玩家 ♥ + space', 'A&B#?%20='])('searches a complete nickname with fixed termtype=3: %s', nickname => {
    const url = playerSearchUrl(baseUrl, nickname);
    expect(url.pathname).toBe('/ranking/individual');
    expect([...url.searchParams]).toEqual([['termtype', '3'], ['keyword', nickname]]);
  });
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
  it('deduplicates nickname searches without changing their case or spelling', async () => {
    const { client, get } = setup(playerSearchHtml);
    expect(await Promise.all([client.getPlayerSearchHtml('pLebb'), client.getPlayerSearchHtml('pLebb')])).toEqual([playerSearchHtml, playerSearchHtml]);
    await client.getPlayerSearchHtml('pLebb');
    expect(get).toHaveBeenCalledExactlyOnceWith(playerSearchUrl(baseUrl, 'pLebb').href);
    await client.getPlayerSearchHtml('pLeb');
    await client.getPlayerSearchHtml('plebb');
    expect(get).toHaveBeenCalledTimes(3);
  });
  it('allows search then detail retrieval with default zero local spacing', async () => {
    const { client, get } = setup(playerSearchHtml);
    await client.getPlayerSearchHtml('pLebb');
    get.mockResolvedValue({ data: JSON.stringify(detailJson), status: 200, headers: {} });
    expect(await client.getMemberDetail('search%2Bid%2F%3D%3D')).toEqual(detailJson);
    expect(new URL(get.mock.calls[1]![0]).searchParams.get('env')).toBe('search+id/==');
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('deduplicates the full search/detail workflow and requests GET div=1 with the decoded identifier', async () => {
    const { client, get } = setup(playerSearchHtml);
    get.mockResolvedValueOnce({ data: playerSearchHtml, status: 200, headers: {} })
      .mockResolvedValue({ data: JSON.stringify(playerDetailJson), status: 200, headers: {} });
    const members = new MemberService(client, baseUrl, createLogger('silent'));
    const profiles = await Promise.all([members.getPlayer('pLebb'), members.getPlayer('pLebb')]);
    await members.getPlayer('pLebb');
    expect(profiles[0]).toMatchObject({ ranking: 71209, exp: 3789431, kills: 21053, clanMemberCount: 28, clanRanking: 1391886 });
    expect(profiles[0]).toEqual(profiles[1]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(new URL(get.mock.calls[0]![0]).searchParams.get('termtype')).toBe('3');
    const detailUrl = new URL(get.mock.calls[1]![0]);
    expect(detailUrl.pathname).toBe('/clan/detail');
    expect([...detailUrl.searchParams]).toEqual([['div', '1'], ['env', 'search+id/==']]);
  });
  it.each([loginHtml, '<div class="h-captcha"></div>', 'not HTML'])('rejects unusable player search responses and leaves failures retryable %#', async body => {
    const { client, get } = setup(body);
    await expect(client.getPlayerSearchHtml('pLebb')).rejects.toThrow();
    get.mockResolvedValue({ data: playerSearchHtml, status: 200, headers: {} });
    expect(await client.getPlayerSearchHtml('pLebb')).toBe(playerSearchHtml);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('shares search Retry-After pauses with detail requests', async () => {
    const { client, get } = setup('', 429, 0);
    get.mockResolvedValue({ data: '', status: 429, headers: { 'retry-after': '3600' } });
    await expect(client.getPlayerSearchHtml('pLebb')).rejects.toThrow('unavailable');
    await expect(client.getMemberDetail('synthetic')).rejects.toThrow('request limit');
    expect(get).toHaveBeenCalledTimes(1);
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
