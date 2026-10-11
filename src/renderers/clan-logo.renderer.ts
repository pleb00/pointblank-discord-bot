import { chromium, type Browser, type BrowserContext } from 'playwright';
import { assertAccessibleHtml } from '../clients/pointblank.client.js';
import { AppError, LogoRenderError, type LogoStage, type LogoFailure } from '../utils/errors.js';
import { RequestGate } from '../utils/rate-limit.js';

function classifyFailure(error: unknown): LogoFailure {
  if (!(error instanceof Error)) return 'RENDER_FAILED';
  if (/Executable doesn't exist|playwright install/i.test(error.message)) return 'BROWSER_NOT_INSTALLED';
  if (error.name === 'TimeoutError') return 'TIMEOUT';
  if (/Target.*closed|browser.*closed|browser.*disconnected/i.test(error.message)) return 'BROWSER_CLOSED';
  if (/net::ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND/i.test(error.message)) return 'NETWORK_FAILED';
  return 'RENDER_FAILED';
}

export class ClanLogoRenderer {
  private browserPromise: Promise<Browser> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private closing = false;

  constructor(private readonly timeoutMs: number, private readonly gate: RequestGate) {}

  render(sourceUrl: string, cachedHtml?: string): Promise<Buffer> {
    if (this.closing) return Promise.reject(new AppError('LOGO_FAILED', 'Clan logo rendering is shutting down.'));
    const work = this.queue.then(() => this.capture(sourceUrl, cachedHtml));
    this.queue = work.then(() => undefined, () => undefined);
    return work;
  }

  private async browser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true }).then(browser => {
        browser.once('disconnected', () => { this.browserPromise = null; });
        return browser;
      }).catch(error => { this.browserPromise = null; throw error; });
    }
    return this.browserPromise;
  }

  private async capture(sourceUrl: string, cachedHtml?: string): Promise<Buffer> {
    if (cachedHtml !== undefined) assertAccessibleHtml(cachedHtml);
    else await this.gate.acquire();
    let context: BrowserContext | undefined;
    let stage: LogoStage = 'browser';
    const origin = new URL(sourceUrl).origin;
    let stylesheetFailed = false;
    try {
      const browser = await this.browser();
      stage = 'context';
      context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
      context.setDefaultTimeout(this.timeoutMs);
      const page = await context.newPage();
      page.on('dialog', dialog => { void dialog.dismiss().catch(() => undefined); });
      page.on('requestfailed', request => {
        if (request.resourceType() === 'stylesheet' && new URL(request.url()).origin === origin) stylesheetFailed = true;
      });
      page.on('response', response => {
        if (response.request().resourceType() === 'stylesheet' && new URL(response.url()).origin === origin && !response.ok()) stylesheetFailed = true;
      });
      // CSS and original layered images are sufficient. Scripts are not needed for static marks.
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          if (url.href !== sourceUrl) return route.abort();
          if (cachedHtml !== undefined) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: cachedHtml });
          return route.continue();
        }
        if (url.origin !== origin || !['stylesheet', 'image', 'font'].includes(request.resourceType())) return route.abort();
        return route.continue();
      });
      stage = 'navigation';
      const response = await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
      if (!response?.ok()) throw new LogoRenderError(stage, 'NETWORK_FAILED');
      assertAccessibleHtml(await page.content());
      stage = 'profile';
      await page.locator('.info .name').waitFor({ state: 'visible' });
      const found = await page.locator('.info .name').evaluateAll(names => {
        if (names.length !== 1) return false;
        let ancestor: Element | null = names[0]!.closest('.info');
        while (ancestor) {
          const logos = ancestor.querySelectorAll('.logo');
          if (logos.length > 1) return false;
          if (logos.length === 1) {
            logos[0]!.setAttribute('data-pb-logo-target', 'true');
            return true;
          }
          ancestor = ancestor.parentElement;
        }
        return false;
      });
      if (!found) throw new LogoRenderError(stage, 'ELEMENT_NOT_FOUND');
      stage = 'styles';
      if (stylesheetFailed) throw new LogoRenderError(stage, 'STYLES_FAILED');
      try {
        await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
          .filter(link => new URL(link.href).origin === location.origin).every(link => link.sheet !== null),
        undefined, { timeout: this.timeoutMs });
      } catch (error) {
        if (stylesheetFailed) throw new LogoRenderError(stage, 'STYLES_FAILED');
        throw error;
      }
      if (stylesheetFailed) throw new LogoRenderError(stage, 'STYLES_FAILED');
      const logo = page.locator('[data-pb-logo-target="true"]');
      await logo.waitFor({ state: 'visible' });
      stage = 'layers';
      await page.waitForFunction(() => {
        const images = document.querySelector('[data-pb-logo-target="true"]')?.querySelectorAll('img');
        return !!images?.length && Array.from(images).every(image => image.complete);
      }, undefined, { timeout: this.timeoutMs });
      const layersReady = await logo.evaluate(element => Array.from(element.querySelectorAll('img')).every(image => image.naturalWidth > 0));
      if (!layersReady) throw new LogoRenderError(stage, 'IMAGE_FAILED');
      stage = 'screenshot';
      return await logo.screenshot({ type: 'png', omitBackground: true, animations: 'disabled', timeout: this.timeoutMs });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new LogoRenderError(stage, classifyFailure(error));
    } finally {
      await context?.close().catch(error => { throw new LogoRenderError('context', classifyFailure(error)); });
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.queue;
    if (this.browserPromise) await (await this.browserPromise).close();
    this.browserPromise = null;
  }
}
