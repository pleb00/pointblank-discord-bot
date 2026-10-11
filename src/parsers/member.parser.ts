import { load } from 'cheerio';
import { z } from 'zod';
import type { ClanMember, MemberDetail } from '../models/member.model.js';
import { assertAccessibleHtml } from '../clients/pointblank.client.js';
import { absoluteImageUrl } from './clan.parser.js';
import { AppError } from '../utils/errors.js';
import { parseInteger } from '../utils/formatter.js';

export function parseMemberList(html: string, baseUrl: string): ClanMember[] {
  assertAccessibleHtml(html);
  const $ = load(html);
  const members: ClanMember[] = [];
  const seen = new Set<string>();
  const roster = $('.clan_section .list.member .over_wrap > ul');
  const anchors = roster.length ? roster.find('a.user[data-env][data-nick]') : $('a.user[data-env][data-nick]');
  anchors.each((_, anchor) => {
    const element = $(anchor);
    // The supplied example places roster entries in list items, unlike the master link.
    if (!element.closest('li').length) return;
    const nickname = element.attr('data-nick')!;
    const env = element.attr('data-env')!;
    if (!nickname.trim() || !env.trim()) throw new AppError('UNEXPECTED_HTML', 'Point Blank returned an invalid roster entry.');
    const key = JSON.stringify([nickname, env]);
    if (seen.has(key)) return;
    seen.add(key);
    members.push({ nickname, env, rankIconUrl: absoluteImageUrl(element.find('img').first().attr('src'), baseUrl) });
  });
  return members;
}

const rawDetailSchema = z.object({
  Exp: z.unknown().optional(),
  Kill: z.unknown().optional(),
  Death: z.unknown().optional(),
  Headshot: z.unknown().optional(),
  ClanName: z.unknown().optional(),
});

export function normalizeMemberDetail(raw: unknown, member: ClanMember): MemberDetail {
  const parsed = rawDetailSchema.safeParse(raw);
  if (!parsed.success) throw new AppError('UNEXPECTED_JSON', 'Point Blank returned invalid player details.');
  const data = parsed.data;
  const detail: MemberDetail = {
    nickname: member.nickname,
    exp: parseInteger(data.Exp),
    kills: parseInteger(data.Kill),
    deaths: parseInteger(data.Death),
    headshots: parseInteger(data.Headshot),
    rankIconUrl: member.rankIconUrl,
    clanName: typeof data.ClanName === 'string' && data.ClanName.trim() ? data.ClanName : null,
  };
  if ([detail.exp, detail.kills, detail.deaths, detail.headshots].every(value => value === null)) {
    throw new AppError('UNEXPECTED_JSON', 'Point Blank did not return usable player statistics.');
  }
  return detail;
}
