import { load, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { assertAccessibleWebstoreHtml } from '../clients/pointblank.client.js';
import { webstoreCategories, type WebstoreCategory, type WebstoreCurrency, type WebstorePage, type WebstoreProduct } from '../models/webstore.model.js';
import { AppError } from '../utils/errors.js';
import { parseInteger } from '../utils/formatter.js';

function changedLayout(): never {
  throw new AppError('UNEXPECTED_HTML', 'Point Blank webstore layout changed or this catalogue page is unavailable. Please try again later.');
}

function officialUrl(value: string | undefined, baseUrl: string, product: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    const base = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (product) {
      if (url.origin !== base.origin || url.pathname !== '/webstore/goods/view'
        || !/^\d+$/.test(url.searchParams.get('productIdx') ?? '')) return null;
    } else if (![base.hostname, 'cdn2.pointblank.id'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

function decimal(text: string, max: number): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(text.trim())) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function currency(value: string | undefined, baseUrl: string): WebstoreCurrency | null {
  const url = officialUrl(value, baseUrl, false);
  if (!url || new URL(url).origin !== new URL(baseUrl).origin) return null;
  switch (new URL(url).pathname) {
    case '/images/common/webshop/coin_pb.png':
    case '/images/common/webshop/coin_pb02.png': return 'PB Cash';
    case '/images/common/webshop/coin_gold.png': return 'Golden Ticket';
    case '/images/common/webshop/token/star_ticket/img_token_star_ticket.png': return 'Star Ticket';
    default: return null;
  }
}

function product($: CheerioAPI, element: Element, baseUrl: string): WebstoreProduct {
  const row = $(element);
  const name = row.find('.con > .desc > .name');
  const link = row.find('.con > a.s_link');
  const price = row.find('.con > .desc > .price');
  const url = link.length === 1 ? officialUrl(link.attr('href'), baseUrl, true) : null;
  if (name.length !== 1 || !name.text().trim() || !url) changedLayout();
  return {
    name: name.text().trim(), url,
    imageUrl: officialUrl(row.find('.con > .item > .img > img').attr('src'), baseUrl, false),
    price: price.find('font').length === 1 ? parseInteger(price.find('font').text()) : null,
    originalPrice: price.find('.del_line').length === 1 ? parseInteger(price.find('.del_line').text()) : null,
    currency: price.find('img').length === 1 ? currency(price.find('img').attr('src'), baseUrl) : null,
    discountPercent: row.find('.con > .item > .sale > font').length === 1
      ? decimal(row.find('.con > .item > .sale > font').text().trim().replace(/%$/, ''), 100) : null,
    rating: row.children('.rate').length === 1 ? decimal(row.children('.rate').text().trim(), 5) : null,
    tags: row.find('.con > .desc > .state > span').map((_, tag) => $(tag).text().trim()).get().filter(Boolean),
  };
}

/** Only product-list children count; account-limit list items are not products. */
export function parseWebstoreProducts(html: string, category: WebstoreCategory, baseUrl: string): WebstoreProduct[] {
  assertAccessibleWebstoreHtml(html);
  const $ = load(html);
  const list = $(`${webstoreCategories[category].selector} > .inner > .item_wrap > .item_list`);
  if (list.length !== 1 || list.children().not('li').length) changedLayout();
  return list.children('li').map((_, element) => product($, element, baseUrl)).get();
}

function targetPage(href: string | undefined): number | null {
  const match = href?.match(/^javascript:goPage\((\d+)\);$/);
  const page = match ? parseInteger(match[1]) : null;
  return page !== null && page > 0 ? page : null;
}

export function parseWebstoreHtml(html: string, category: WebstoreCategory, requestedPage: number, sourceUrl: string): WebstorePage {
  const products = parseWebstoreProducts(html, category, new URL(sourceUrl).origin);
  const $ = load(html);
  const paging = $(`${webstoreCategories[category].selector} > .inner > .paging_wrap > ul`);
  if (paging.length !== 1 || paging.children('.on').length !== 1) changedLayout();
  const page = parseInteger(paging.children('.on').text());
  if (page !== requestedPage || page === null || page < 1) changedLayout();
  const last = paging.children('.last').children('a');
  const next = paging.children('.next').children('a');
  const prev = paging.children('.prev').children('a');
  if (last.length !== 1 || next.length !== 1 || prev.length !== 1) changedLayout();
  const lastTarget = targetPage(last.attr('href'));
  const totalPages = lastTarget ?? (last.attr('href') === 'javascript:void(0);' ? page : null);
  if (totalPages === null || totalPages < page
    || (page < totalPages ? targetPage(next.attr('href')) !== page + 1 : next.attr('href') !== 'javascript:void(0);')
    || (page > 1 ? targetPage(prev.attr('href')) !== page - 1 : prev.attr('href') !== 'javascript:void(0);')) changedLayout();
  return { category, page, totalPages, products, sourceUrl, fetchedAt: new Date() };
}
