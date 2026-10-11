import { load } from 'cheerio';
import type { ConfiguredClan } from '../config/clan-config.js';
import type { ClanInfo } from '../models/clan.model.js';
import { assertAccessibleHtml } from '../clients/pointblank.client.js';
import { AppError } from '../utils/errors.js';
import { parseInteger } from '../utils/formatter.js';

export function absoluteImageUrl(src: string | undefined, baseUrl: string): string | null {
  if (!src) return null;
  try {
    const url = new URL(src, baseUrl);
    return url.protocol === 'https:' && url.origin === new URL(baseUrl).origin ? url.href : null;
  } catch { return null; }
}

export function rankProgress(style: string | undefined): number | null {
  const match = style?.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)%\s*(?:!important\s*)?(?:;|$)/i);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function parsePercentage(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/** Only invoke once the website's outcome definitions have been independently verified. */
export function calculateOutcomeRates(wins: number, losses: number, draws = 0) {
  if (![wins, losses, draws].every(value => Number.isSafeInteger(value) && value >= 0)) return { winRate: null, lossRate: null };
  const total = wins + losses + draws;
  if (!Number.isSafeInteger(total) || total === 0) return { winRate: null, lossRate: null };
  return { winRate: wins / total * 100, lossRate: losses / total * 100 };
}

export function parseClanHtml(html: string, clan: ConfiguredClan, baseUrl: string): ClanInfo {
  assertAccessibleHtml(html);
  const $ = load(html);
  const names = $('.info .name');
  if (names.length !== 1 || !names.first().text().trim()) {
    throw new AppError('UNEXPECTED_HTML', 'Could not read the clan profile. The clan ID may be invalid or Point Blank changed its page structure.');
  }
  const info = names.first().closest('.info');
  const textWithoutLabel = (selector: string) => {
    const element = info.find(selector).first().clone();
    element.find('span').remove();
    return element.text().replace(/\s+/g, ' ').trim() || null;
  };
  const countText = textWithoutLabel('.members');
  const counts = countText?.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/);
  const master = info.find('.master a').first();
  // Verified on the corrected public link: Total Stat is separate from both season panels.
  const totals = $('.clan_section .record .clan_record > .section');
  const totalStats = totals.length === 1 && totals.children('.tit').text().replace(/\s+/g, ' ').trim() === 'Total Stat'
    ? totals : $();
  const totalMatchText = totalStats.find('.con > .match').first().clone();
  totalMatchText.find('span').remove();
  const outcome = (label: 'win' | 'lose') => {
    const columns = totalStats.find('.graph li > .gr00').filter((_, element) =>
      $(element).find('.desc .tit').text().trim().toLowerCase() === label);
    if (columns.length !== 1) return { count: null, rate: null };
    return {
      count: parseInteger(columns.find('.num').first().text()),
      rate: parsePercentage(columns.find('.desc .ani_num').first().text()),
    };
  };
  const wins = outcome('win');
  const losses = outcome('lose');
  return {
    id: clan.id,
    name: names.first().text().trim(),
    master: master.attr('data-nick') || master.text().trim() || null,
    memberCount: counts ? parseInteger(counts[1]) : null,
    maxMembers: counts ? parseInteger(counts[2]) : null,
    createdAt: textWithoutLabel('.date'),
    rank: {
      name: info.find('.rank .bar').first().text().trim() || null,
      iconUrl: absoluteImageUrl(info.find('.rank img').first().attr('src'), baseUrl),
      progressPercentage: rankProgress(info.find('.rank .bar_on').first().attr('style')),
      exp: null,
    },
    // Use the site's displayed rates. Observed wins + losses differ from total matches by two.
    // Their outcome definitions are not established, so do not calculate replacement rates.
    statistics: {
      totalMatches: parseInteger(totalMatchText.text()),
      wins: wins.count, losses: losses.count, winRate: wins.rate, lossRate: losses.rate,
    },
  };
}
