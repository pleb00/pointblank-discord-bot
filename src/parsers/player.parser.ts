import { load } from 'cheerio';
import type { PlayerDetail, PlayerSearchResult } from '../models/member.model.js';
import { assertAccessibleHtml } from '../clients/pointblank.client.js';
import { absoluteImageUrl } from './clan.parser.js';
import { AppError } from '../utils/errors.js';
import { rankIconAsset } from '../utils/rank-icon.js';
import { parseInteger } from '../utils/formatter.js';
import { normalizeMemberDetail } from './member.parser.js';

/** Ranking search markup observed on October 12, 2026; no roster fallback. */
export function parsePlayerSearch(html: string, baseUrl: string): PlayerSearchResult[] {
  assertAccessibleHtml(html);
  const $ = load(html);
  const table = $('.nrank_table');
  const changed = () => new AppError('UNEXPECTED_HTML', 'Could not read the player search results. Point Blank may have changed its page structure.');
  if (table.length !== 1) throw changed();
  const rows = table.children('.r_tr');
  const noMatches = table.children('.nodata_n');
  if (noMatches.length === 1 && noMatches.text().trim() === 'Our search has no matches!' && rows.length === 0) return [];
  if (rows.length === 0 || noMatches.length !== 0) throw changed();
  const players: PlayerSearchResult[] = [];
  rows.each((_, row) => {
    const result = $(row);
    const anchor = result.find('.r_td.name > a[data-env][data-nick]');
    if (anchor.length !== 1) throw changed();
    const nickname = anchor.attr('data-nick')!;
    const env = anchor.attr('data-env')!;
    if (!nickname.trim() || !env.trim()) throw changed();
    const images = result.find('.r_td.rank .rank_img img');
    const icon = images.length === 1 ? absoluteImageUrl(images.attr('src'), baseUrl) : null;
    const rank = result.find('.r_td.rank > .txt');
    const rankText = rank.length === 1 ? rank.clone().find('.rank_img').remove().end().text().trim() : '';
    const ranking = result.children('.r_td.win');
    const exp = result.find('.r_td.exp > .txt');
    players.push({
      nickname, env, rankIconUrl: rankIconAsset(icon)?.url ?? null, rankName: rankText || null,
      ranking: ranking.length === 1 ? parseInteger(ranking.text()) : null,
      exp: exp.length === 1 ? parseInteger(exp.text()) : null,
    });
  });
  return players;
}

function counterRatio(numerator: number | null, denominator: number | null): number | null {
  return numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator;
}

export function normalizePlayerDetail(raw: unknown, player: PlayerSearchResult): PlayerDetail {
  const detail = normalizeMemberDetail(raw, player);
  const headshotRatio = counterRatio(detail.headshots, detail.kills);
  return {
    ...detail,
    ranking: player.ranking,
    rankName: player.rankName,
    killDeathRatio: counterRatio(detail.kills, detail.deaths),
    headshotRatio: headshotRatio === null ? null : headshotRatio * 100,
  };
}
