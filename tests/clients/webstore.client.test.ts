import axios from 'axios';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointBlankClient, webstoreUrl } from '../../src/clients/pointblank.client.js';
import type { WebstoreCategory } from '../../src/models/webstore.model.js';
import { RequestGate } from '../../src/utils/rate-limit.js';
import { createLogger } from '../../src/utils/logger.js';
import { baseUrl, loginHtml, testEnvironment } from '../helpers.js';

const html = readFileSync(new URL('../fixtures/webstore-trending.html', import.meta.url), 'utf8');
const publicActions = readFileSync(new URL('../fixtures/webstore-public-actions.html', import.meta.url), 'utf8');
afterEach(() => { vi.restoreAllMocks(); });

describe('webstore HTTP integration', () => {
  function setup() {
    const http = axios.create();
    const get = vi.spyOn(http, 'get').mockResolvedValue({ status: 200, data: html, headers: {} });
    const gate = new RequestGate(0, 0);
    const client = new PointBlankClient({ ...testEnvironment, REQUEST_MAX_RETRIES: 0 }, gate, createLogger('silent'), http);
    return { client, get, gate };
  }
  it.each<[WebstoreCategory, string]>([['trending', 'best'], ['new', 'new'], ['sale', 'sale'], ['star', 'star']])(
    'maps %s to its official category endpoint with URLSearchParams', async (category, endpoint) => {
      const { client, get } = setup();
      expect(webstoreUrl(baseUrl, category).href).toBe(`${baseUrl}/webstore/more/${endpoint}`);
      expect(await client.getWebstoreHtml(category, 2)).toBe(html);
      expect(get).toHaveBeenCalledExactlyOnceWith(`${baseUrl}/webstore/more/${endpoint}?page=2`);
    },
  );
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid page %s before requesting it', page => {
    expect(() => webstoreUrl(baseUrl, 'sale', page)).toThrow('positive page');
  });
  it('rejects invalid categories rather than constructing arbitrary paths', () => {
    expect(() => webstoreUrl(baseUrl, '../login' as WebstoreCategory)).toThrow('valid webstore category');
    expect(() => webstoreUrl(baseUrl, 'toString' as WebstoreCategory)).toThrow('valid webstore category');
  });
  it.each([loginHtml, '<div class="h-captcha"></div>', 'not html'])('rejects unusable public responses %#', async body => {
    const { client, get } = setup();
    get.mockResolvedValue({ status: 200, data: body, headers: {} });
    await expect(client.getWebstoreHtml('trending')).rejects.toThrow();
  });
  it('accepts public catalogue HTML containing uninvoked login-only shopping actions', async () => {
    const { client, get } = setup();
    get.mockResolvedValue({ status: 200, data: html + publicActions, headers: {} });
    expect(await client.getWebstoreHtml('trending')).toBe(html + publicActions);
  });
  it.each(['<script>goCart();</script>', '<body onload="goLogin();">', '<script>document.location.href="/login/form";</script>', '<div class="h-captcha"></div>'])(
    'still rejects invoked redirects/challenges alongside public markup %#', async access => {
      const { client, get } = setup();
      get.mockResolvedValue({ status: 200, data: html + publicActions + access, headers: {} });
      await expect(client.getWebstoreHtml('trending')).rejects.toThrow(/requires login|access verification/);
    },
  );
  it('shares upstream Retry-After pauses with member requests and logo navigation', async () => {
    const { client, get, gate } = setup();
    get.mockResolvedValue({ status: 429, data: '', headers: { 'retry-after': '3600' } });
    await expect(client.getWebstoreHtml('sale')).rejects.toThrow('unavailable');
    await expect(client.getMemberDetail('synthetic')).rejects.toThrow('request limit');
    await expect(gate.acquire()).rejects.toThrow('request limit');
    expect(get).toHaveBeenCalledOnce();
  });
  it('also honors rate limits already encountered by other endpoints', async () => {
    const { client, get } = setup();
    get.mockResolvedValue({ status: 429, data: '', headers: { 'retry-after': '3600' } });
    await expect(client.getClanHtml('synthetic')).rejects.toThrow('unavailable');
    await expect(client.getWebstoreHtml('trending')).rejects.toThrow('request limit');
    expect(get).toHaveBeenCalledOnce();
  });
  it('permits only verified public paths on same-origin HTTPS redirects', () => {
    const create = vi.spyOn(axios, 'create');
    new PointBlankClient(testEnvironment, new RequestGate(0, 0), createLogger('silent'));
    const beforeRedirect = create.mock.calls[0]![0]!.beforeRedirect!;
    const redirect = (path: string, hostname = 'www.pointblank.id', protocol = 'https:', port?: string) => beforeRedirect(
      { path, hostname, protocol, ...(port ? { port } : {}) } as Parameters<typeof beforeRedirect>[0],
      { headers: {}, statusCode: 302 },
      { url: `${baseUrl}/webstore/more/best`, method: 'GET', headers: {} },
    );
    expect(() => redirect('/webstore/more/best?page=2')).not.toThrow();
    expect(() => redirect('/webstore/more/star')).not.toThrow();
    expect(() => redirect('/login')).toThrow('redirected away');
    expect(() => redirect('/webstore/goods/view')).toThrow('redirected away');
    expect(() => redirect('/webstore/more/unknown')).toThrow('redirected away');
    expect(() => redirect('/webstore/more/best', 'evil.example')).toThrow('redirected away');
    expect(() => redirect('/webstore/more/best', 'www.pointblank.id', 'http:')).toThrow('redirected away');
    expect(() => redirect('/webstore/more/best', 'www.pointblank.id', 'https:', '444')).toThrow('redirected away');
  });
});
