import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium } from 'playwright';
import { ClanLogoRenderer } from '../../src/renderers/clan-logo.renderer.js';
import { LogoService } from '../../src/services/logo.service.js';
import { RequestGate } from '../../src/utils/rate-limit.js';
import { parseClanHtml } from '../../src/parsers/clan.parser.js';
import { clan, loginHtml } from '../helpers.js';
import { safeError } from '../../src/utils/errors.js';

const css = '.logo{position:relative;width:64px;height:64px}.logo img{position:absolute;inset:0;width:64px;height:64px}.cf08 .c_bg{opacity:.8}.cm10 .c_img{opacity:.9}';
const layer = (shape: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${shape}</svg>`;
const layers = [
  layer('<circle cx="32" cy="32" r="29" fill="#2266bb"/>'),
  layer('<circle cx="32" cy="32" r="29" fill="none" stroke="#f3cb42" stroke-width="3"/>'),
  layer('<path d="M32 12 48 45 16 45Z" fill="#f3cb42"/>'),
  layer('<path d="M32 12 48 45 16 45Z" fill="none" stroke="white" stroke-width="2"/>'),
];
const html = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body>
<header><div class="logo">Unrelated header logo</div></header><section class="profile">
<div class="logo cf08 cm10 bp11 tl48"><img class="c_bg" src="/layer0.svg"><img class="c_bg_line" src="/layer1.svg"><img class="c_img" src="/layer2.svg"><img class="c_img_line" src="/layer3.svg"></div>
<div class="info"><div class="name">Local fixture clan</div></div></section></body></html>`;

describe('real Chromium logo rendering against a local fixture server', () => {
  let server: Server;
  let origin: string;
  const requests: string[] = [];
  const renderer = new ClanLogoRenderer(1500, new RequestGate(0, 0));

  beforeAll(async () => {
    server = createServer((request, response) => {
      const path = new URL(request.url!, 'http://localhost').pathname;
      requests.push(path);
      if (path === '/style.css' || path === '/style-font.css') {
        response.setHeader('Content-Type', 'text/css');
        response.end((path === '/style-font.css' ? '@import url("https://fonts.example.invalid/blocked.css");' : '') + css);
      }
      else if (/^\/layer[0-3]\.svg$/.test(path)) { response.setHeader('Content-Type', 'image/svg+xml'); response.end(layers[Number(path[6])]); }
      else if (path === '/unrelated-stalled.svg') {
        // Deliberately keep an unrelated image loading until the browser context closes.
        response.setHeader('Content-Type', 'image/svg+xml');
        response.write('<svg xmlns="http://www.w3.org/2000/svg">');
      }
      else if (path === '/clan/myclan') { response.setHeader('Content-Type', 'text/html'); response.end(html); }
      else { response.statusCode = 404; response.end('Not found'); }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await renderer.close();
    server.close();
    await once(server, 'close');
  });

  it('captures only the correct layered mark and deduplicates cached renders', async () => {
    const service = new LogoService(renderer, 30_000);
    const snapshot = { info: parseClanHtml(html, clan, origin), sourceUrl: `${origin}/clan/myclan?env=fixture`, html };
    const results = await Promise.all([service.getLogo(snapshot), service.getLogo(snapshot)]);
    expect(results[0]).toBe(results[1]);
    const png = results[0]!;
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(128);
    expect(png.readUInt32BE(20)).toBe(128);
    expect(requests).not.toContain('/clan/myclan');
    expect(requests).toContain('/style.css');
    expect(requests).toContain('/layer3.svg');
    const before = requests.length;
    await service.getLogo(snapshot);
    expect(requests).toHaveLength(before);
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/logo-local-fixture.png', png);
  });

  it('rejects ambiguous logos and broken layers, then recovers for another render', async () => {
    const ambiguous = html.replace('</section>', '<div class="logo">Another profile logo</div></section>');
    await expect(renderer.render(`${origin}/clan/myclan`, ambiguous)).rejects.toMatchObject({ stage: 'profile', reason: 'ELEMENT_NOT_FOUND' });
    await expect(renderer.render(`${origin}/clan/myclan`, html.replace('/layer3.svg', '/missing.svg'))).rejects.toMatchObject({ stage: 'layers', reason: 'IMAGE_FAILED' });
    await expect(renderer.render(`${origin}/clan/myclan`, html.replace('/style.css', '/missing.css'))).rejects.toMatchObject({ stage: 'styles', reason: 'STYLES_FAILED' });
    expect((await renderer.render(`${origin}/clan/myclan`, html)).readUInt32BE(16)).toBe(128);
  });

  it('renders the mark when optional external font imports are blocked', async () => {
    const png = await renderer.render(`${origin}/clan/myclan`, html.replace('/style.css', '/style-font.css'));
    expect(png.readUInt32BE(16)).toBe(128);
    expect(png.readUInt32BE(20)).toBe(128);
  });

  it('captures the fully loaded logo while unrelated page images are still loading', async () => {
    const stalled = html.replace('</body>', '<img src="/unrelated-stalled.svg"></body>');
    const png = await renderer.render(`${origin}/clan/myclan`, stalled);
    expect(png.readUInt32BE(16)).toBe(128);
    expect(requests).toContain('/unrelated-stalled.svg');
  });

  it('reports a missing browser without exposing raw messages or paths', async () => {
    const launch = vi.spyOn(chromium, 'launch').mockRejectedValueOnce(new Error("Executable doesn't exist at private-path?env=private-identifier"));
    const separate = new ClanLogoRenderer(1500, new RequestGate(0, 0));
    try {
      const failure = await separate.render(`${origin}/clan/myclan`, html).catch(error => error);
      expect(failure).toMatchObject({ code: 'LOGO_FAILED', stage: 'browser', reason: 'BROWSER_NOT_INSTALLED' });
      expect(JSON.stringify(safeError(failure))).not.toContain('private');
      expect(failure.message).toContain('npm run install:browser');
    } finally { launch.mockRestore(); await separate.close(); }
  });

  it('uses the request budget for navigation when no cached HTML exists', async () => {
    const gate = new RequestGate(0, 0);
    const acquired = vi.spyOn(gate, 'acquire');
    const separate = new ClanLogoRenderer(5000, gate);
    try {
      expect((await separate.render(`${origin}/clan/myclan`)).readUInt32BE(16)).toBe(128);
      expect(acquired).toHaveBeenCalledTimes(1);
    } finally { await separate.close(); }
    await expect(separate.render(`${origin}/clan/myclan`, html)).rejects.toThrow('shutting down');
  });

  it('rejects the observed login gate before requesting assets', async () => {
    const before = requests.length;
    await expect(renderer.render(`${origin}/clan/myclan`, loginHtml)).rejects.toThrow('requires login');
    expect(requests).toHaveLength(before);
  });
});
