import axios, { type AxiosInstance } from 'axios';
import type { Logger } from 'pino';
import type { IntegrationEnvironment } from '../config/env.js';
import { AsyncCache } from '../utils/cache.js';
import { AppError } from '../utils/errors.js';
import { RequestGate } from '../utils/rate-limit.js';
import { isWebstoreCategory, webstoreCategories, type WebstoreCategory } from '../models/webstore.model.js';

export function clanUrl(baseUrl: string, uniqueId: string): URL {
  const url = new URL('/clan/myclan', baseUrl);
  url.searchParams.set('env', uniqueId);
  return url;
}

export function memberUrl(baseUrl: string, encodedEnv: string): URL {
  let env: string;
  try { env = decodeURIComponent(encodedEnv); }
  catch { throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an invalid member identifier.'); }
  if (!env) throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an empty member identifier.');
  const url = new URL('/clan/detail', baseUrl);
  url.searchParams.set('div', '1');
  url.searchParams.set('env', env);
  return url;
}

export function playerSearchUrl(baseUrl: string, nickname: string): URL {
  const url = new URL('/ranking/individual', baseUrl);
  url.searchParams.set('termtype', '3');
  url.searchParams.set('keyword', nickname);
  return url;
}

export function webstoreUrl(baseUrl: string, category: WebstoreCategory, page = 1): URL {
  if (!isWebstoreCategory(category) || !Number.isSafeInteger(page) || page < 1) {
    throw new AppError('CONFIG_INVALID', 'Choose a valid webstore category and a positive page number.');
  }
  const url = new URL(`/webstore/more/${webstoreCategories[category].endpoint}`, baseUrl);
  if (page > 1) url.searchParams.set('page', String(page));
  return url;
}

export function assertAccessibleHtml(html: string): void {
  if (/Login dibutuhkan|(?:document|window)\.location[^;]*["']\/login\b|<form[^>]+(?:action=["'][^"']*login)/i.test(html)) {
    throw new AppError('ACCESS_REQUIRED', 'Point Blank requires login for this page. Public data is currently unavailable.');
  }
  if (/g-recaptcha|h-captcha|cf-chl-|challenge-platform/i.test(html)) {
    throw new AppError('ACCESS_REQUIRED', 'Point Blank is requiring an access verification. Please try again later.');
  }
}

/** The public catalogue defines these login-only actions without invoking them. */
export function assertAccessibleWebstoreHtml(html: string): void {
  const actions = 'goPayletter|goWishList|goCart|goHistory|goLogin';
  const declarations = new RegExp(`function\\s+(?:${actions})\\s*\\(\\s*\\)\\s*\\{\\s*alert\\(\\s*["'](?:Login dibutuhkan\\.|Login is required\\.)["']\\s*\\);\\s*document\\.location\\.href\\s*=\\s*["']/login/form["'];\\s*\\}`, 'g');
  const call = new RegExp(`\\b(?:${actions})\\s*\\(`);
  const inspected = html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_match: string, opening: string, script: string, closing: string) => {
    const remaining = script.replace(declarations, '');
    // An invoked action could redirect the document; declarations alone cannot.
    if (call.test(remaining)) throw new AppError('ACCESS_REQUIRED', 'Point Blank requires login for this page. Public data is currently unavailable.');
    return `${opening}${remaining}${closing}`;
  });
  if (new RegExp(`on(?:load|error|pageshow)\\s*=\\s*["'][^"']*\\b(?:${actions})\\s*\\(`, 'i').test(inspected)) {
    throw new AppError('ACCESS_REQUIRED', 'Point Blank requires login for this page. Public data is currently unavailable.');
  }
  assertAccessibleHtml(inspected);
}

export class PointBlankClient {
  private readonly details: AsyncCache<unknown>;
  private readonly searches: AsyncCache<string>;
  private readonly http: AxiosInstance;
  private blockedUntil = 0;

  constructor(
    private readonly env: IntegrationEnvironment,
    private readonly gate: RequestGate,
    private readonly logger: Logger,
    http?: AxiosInstance,
  ) {
    this.details = new AsyncCache(env.MEMBER_CACHE_TTL_SECONDS * 1000);
    this.searches = new AsyncCache(env.MEMBER_CACHE_TTL_SECONDS * 1000);
    this.http = http ?? axios.create({
      timeout: env.REQUEST_TIMEOUT_MS,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
      transformResponse: [],
      validateStatus: () => true,
      headers: { 'User-Agent': 'PointBlankClanDiscordBot/1.0', Accept: 'text/html, application/json' },
      beforeRedirect: options => {
        const base = new URL(env.POINTBLANK_BASE_URL);
        const path = new URL(options.path ?? '/', base).pathname;
        if (options.hostname !== base.hostname || options.protocol !== 'https:'
          || (options.port && String(options.port) !== '443')
          || (!path.startsWith('/clan/') && path !== '/ranking/individual'
            && !Object.values(webstoreCategories).some(category => path === `/webstore/more/${category.endpoint}`))) {
          throw new AppError('ACCESS_REQUIRED', 'Point Blank redirected away from the public data endpoints.');
        }
      },
    });
  }

  getPlayerSearchHtml(nickname: string): Promise<string> {
    const url = playerSearchUrl(this.env.POINTBLANK_BASE_URL, nickname);
    return this.searches.get(url.href, async () => {
      const html = await this.request(url, 'player-search');
      assertAccessibleHtml(html);
      if (!/<[a-z][\s\S]*>/i.test(html)) throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an unexpected player search response.');
      return html;
    });
  }

  async getClanHtml(uniqueId: string): Promise<string> {
    const html = await this.request(clanUrl(this.env.POINTBLANK_BASE_URL, uniqueId), 'clan');
    assertAccessibleHtml(html);
    if (!/<[a-z][\s\S]*>/i.test(html)) throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an unexpected clan response.');
    return html;
  }

  async getWebstoreHtml(category: WebstoreCategory, page = 1): Promise<string> {
    const html = await this.request(webstoreUrl(this.env.POINTBLANK_BASE_URL, category, page), 'webstore');
    assertAccessibleWebstoreHtml(html);
    if (!/<[a-z][\s\S]*>/i.test(html)) throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an unexpected webstore response.');
    return html;
  }

  getMemberDetail(env: string): Promise<unknown> {
    const url = memberUrl(this.env.POINTBLANK_BASE_URL, env);
    return this.details.get(url.href, async () => {
      const text = await this.request(url, 'member');
      assertAccessibleHtml(text);
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not an object');
        return parsed;
      } catch {
        throw new AppError('UNEXPECTED_JSON', 'Point Blank returned an unexpected player response. Please try again later.');
      }
    });
  }

  private async request(url: URL, endpoint: 'clan' | 'member' | 'player-search' | 'webstore'): Promise<string> {
    // Cache only a circuit-breaker flag for 401/403; never cache raw errors or credentials.
    if (this.blockedUntil > Date.now()) throw new AppError('ACCESS_REQUIRED', 'Point Blank requires access verification. Public data is currently unavailable.');
    for (let attempt = 0; attempt <= this.env.REQUEST_MAX_RETRIES; attempt++) {
      await this.gate.acquire();
      try {
        const response = await this.http.get<string>(url.href);
        if (response.status === 401 || response.status === 403) {
          this.blockedUntil = Date.now() + this.env.CLAN_CACHE_TTL_SECONDS * 1000;
          throw new AppError('ACCESS_REQUIRED', 'Point Blank requires access verification. Public data is currently unavailable.');
        }
        if (response.status === 429) {
          const retryAfter = response.headers['retry-after'] as string | undefined;
          const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
          const until = retryAfter ? Date.parse(retryAfter) : NaN;
          this.gate.defer(seconds !== null ? seconds * 1000 : Number.isFinite(until) ? Math.max(0, until - Date.now()) : 60_000);
        }
        if (response.status < 200 || response.status >= 300) {
          this.logger.warn({ endpoint, status: response.status, attempt }, 'Point Blank HTTP failure');
          if ((response.status === 429 || response.status >= 500) && attempt < this.env.REQUEST_MAX_RETRIES) continue;
          throw new AppError('UPSTREAM_UNAVAILABLE', 'Point Blank is unavailable or rejected the request. Please try again later.');
        }
        if (typeof response.data !== 'string') throw new AppError('UNEXPECTED_JSON', 'Point Blank returned an unsupported response format.');
        return response.data;
      } catch (error) {
        if (error instanceof AppError) throw error;
        const redirectedAccessError = error instanceof Error && error.cause instanceof AppError ? error.cause : null;
        if (redirectedAccessError) throw redirectedAccessError;
        const isAxios = axios.isAxiosError(error);
        const code = isAxios ? error.code : undefined;
        this.logger.warn({ endpoint, attempt, code }, 'Point Blank request failed');
        const transient = isAxios && ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code ?? '');
        if (transient && attempt < this.env.REQUEST_MAX_RETRIES) continue;
        throw new AppError(code === 'ECONNABORTED' || code === 'ETIMEDOUT' ? 'REQUEST_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
          code === 'ECONNABORTED' || code === 'ETIMEDOUT' ? 'Point Blank took too long to respond. Please try again later.' : 'Could not reach Point Blank. Please try again later.');
      }
    }
    throw new AppError('UPSTREAM_UNAVAILABLE', 'Point Blank is temporarily unavailable.');
  }
}
