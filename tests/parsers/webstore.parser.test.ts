import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { parseWebstoreHtml, parseWebstoreProducts } from '../../src/parsers/webstore.parser.js';
import { webstoreUrl } from '../../src/clients/pointblank.client.js';
import type { WebstoreCategory } from '../../src/models/webstore.model.js';
import { baseUrl, loginHtml } from '../helpers.js';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/webstore-${name}.html`, import.meta.url), 'utf8');
const trending = fixture('trending');
function parse(html = trending, category: WebstoreCategory = 'trending', page = 1) {
  return parseWebstoreHtml(html, category, page, webstoreUrl(baseUrl, category, page).href);
}

describe('observed webstore catalogue contracts', () => {
  it.each<[WebstoreCategory, number, number]>([['trending', 10, 8], ['new', 5, 1], ['sale', 10, 6], ['star', 10, 7]])(
    'extracts only %s products and verified pagination', (category, count, totalPages) => {
      const page = parse(fixture(category), category);
      expect(page).toMatchObject({ category, page: 1, totalPages });
      expect(page.products).toHaveLength(count);
      expect(page.fetchedAt).toBeInstanceOf(Date);
    },
  );
  it('preserves product names, original images, query parameters, badges and prices', () => {
    const page = parse();
    expect(page.products[0]).toEqual({
      name: 'Red Deluxe Box', price: 635, originalPrice: null, currency: 'PB Cash', discountPercent: null, rating: null,
      tags: ['new', 'hot', 'Random Box'], imageUrl: 'https://cdn2.pointblank.id/Web/upload/image/20250121/1626292100.png',
      url: `${baseUrl}/webstore/goods/view?prev=best&productIdx=1000000575&page=`,
    });
    expect(page.products[2]).toMatchObject({ name: 'New Hanbok Gowoon Set', price: 2816, originalPrice: 4023, discountPercent: 30 });
    expect(page.products.find(product => product.currency === 'Star Ticket')).toBeDefined();
    expect(page.products.every(product => product.currency !== null)).toBe(true);
  });
  it('uses explicit numeric ratings and distinguishes Golden Ticket from PB Cash', () => {
    const products = parse(fixture('star'), 'star').products;
    expect(products[0]).toMatchObject({ name: 'Quick Change Magazine', rating: 5, currency: 'PB Cash', price: 1900 });
    expect(products.find(product => product.currency === 'Golden Ticket')).toMatchObject({ rating: 5, currency: 'Golden Ticket', price: 250 });
  });
  it('reads the requested and final pages without inventing a next page', () => {
    const second = parse(fixture('trending-2'), 'trending', 2);
    expect(second).toMatchObject({ page: 2, totalPages: 8 });
    expect(second.products[0]!.url).not.toBe(parse().products[0]!.url);
    expect(parse(fixture('trending-8'), 'trending', 8)).toMatchObject({ page: 8, totalPages: 8, products: expect.any(Array) });
  });
  it.each<WebstoreCategory>(['trending', 'new', 'sale', 'star'])('also extracts the supplied %s preview without mixing categories', category => {
    const products = parseWebstoreProducts(fixture('index-supplied'), category, baseUrl);
    expect(products).toHaveLength(5);
    expect(products.every(product => product.url.startsWith(`${baseUrl}/webstore/goods/view?productIdx=`))).toBe(true);
  });
});

describe('synthetic missing fields and contract changes', () => {
  it('keeps missing or unverified numeric fields null instead of inferring from badges or star widths', () => {
    const $ = load(fixture('star'));
    const first = $('.item_list > li').first();
    first.find('.price > font').text('12,34');
    first.find('.price > img').attr('src', '/images/common/webshop/unknown_coin.png');
    first.find('.rate').html('<span class="ing" style="width:100%"></span>unavailable');
    first.find('.item').append('<span class="sale"><font>101%</font></span>');
    first.find('.price').append('<span class="del_line">-5</span>');
    expect(parse($.html(), 'star').products[0]).toMatchObject({ price: null, originalPrice: null, currency: null, rating: null, discountPercent: null });
  });
  it('accepts zero prices/ratings and missing optional images', () => {
    const $ = load(fixture('star'));
    const first = $('.item_list > li').first();
    first.find('.price > font').text('0');
    first.find('.rate').text('0.0');
    first.find('.item > .img').remove();
    expect(parse($.html(), 'star').products[0]).toMatchObject({ price: 0, rating: 0, imageUrl: null });
  });
  it.each(['https://evil.example/item.png', 'javascript:alert(1)', 'https://cdn2.pointblank.id:444/x.png', 'https://user:pass@cdn2.pointblank.id/x.png'])('rejects untrusted images: %s', url => {
    const $ = load(trending);
    $('.item_list > li').first().find('.img > img').attr('src', url);
    expect(parse($.html()).products[0]!.imageUrl).toBeNull();
  });
  it.each(['https://evil.example/webstore/goods/view?productIdx=123', '/login?productIdx=123', '/webstore/goods/view', 'javascript:alert(1)'])('fails required untrusted or missing product links: %s', url => {
    const $ = load(trending);
    $('.item_list > li').first().find('.s_link').attr('href', url);
    expect(() => parse($.html())).toThrow('layout changed');
  });
  it.each(['.item_list', '.item_list > li:first-child .name', '.item_list > li:first-child .s_link', '.paging_wrap', '.paging_wrap .on', '.paging_wrap .last'])('fails changed required selectors: %s', selector => {
    const $ = load(trending);
    $(selector).remove();
    expect(() => parse($.html())).toThrow('layout changed');
  });
  it('rejects a category mismatch or a silently repeated first page', () => {
    expect(() => parse(trending, 'sale')).toThrow('layout changed');
    expect(() => parse(trending, 'trending', 2)).toThrow('layout changed');
  });
  it('rejects changed navigation instead of guessing a total or following arbitrary links', () => {
    const $ = load(trending);
    $('.paging_wrap .last a').attr('href', 'javascript:otherPage(8);');
    expect(() => parse($.html())).toThrow('layout changed');
    $('.paging_wrap .last a').attr('href', 'javascript:goPage(8);');
    $('.paging_wrap .next a').attr('href', 'javascript:goPage(7);');
    expect(() => parse($.html())).toThrow('layout changed');
  });
  it('allows a structurally intact empty list without treating missing markup as an empty catalogue', () => {
    const $ = load(fixture('new'));
    $('.item_list').empty();
    expect(parse($.html(), 'new').products).toEqual([]);
    $('.item_list').append('<div class="changed-product">Changed</div>');
    expect(() => parse($.html(), 'new')).toThrow('layout changed');
  });
  it.each([loginHtml, '<div class="h-captcha"></div>'])('fails access-controlled responses clearly %#', html => {
    expect(() => parse(html)).toThrow(/requires login|access verification/);
  });
  it('also handles uninvoked public shopping actions when parsing the full page', () => {
    expect(parse(trending + fixture('public-actions')).products).toHaveLength(10);
    expect(() => parse(trending + fixture('public-actions') + '<script>goWishList();</script>')).toThrow('requires login');
  });
});
