import { webstoreUrl, type PointBlankClient } from '../clients/pointblank.client.js';
import type { WebstoreCategory, WebstorePage } from '../models/webstore.model.js';
import { parseWebstoreHtml } from '../parsers/webstore.parser.js';
import { AsyncCache } from '../utils/cache.js';

export class WebstoreService {
  private readonly pages: AsyncCache<WebstorePage>;

  constructor(private readonly client: PointBlankClient, private readonly baseUrl: string, ttlMs: number) {
    this.pages = new AsyncCache(ttlMs);
  }

  getPage(category: WebstoreCategory, page = 1): Promise<WebstorePage> {
    const url = webstoreUrl(this.baseUrl, category, page);
    return this.pages.get(url.href, async () => {
      const html = await this.client.getWebstoreHtml(category, page);
      return parseWebstoreHtml(html, category, page, url.href);
    });
  }
}
