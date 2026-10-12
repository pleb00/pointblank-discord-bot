import type { Logger } from 'pino';
import type { ClanMember, PlayerIdentity } from '../models/member.model.js';
import { PointBlankClient } from '../clients/pointblank.client.js';
import { normalizePlayerDetail, parsePlayerSearch } from '../parsers/player.parser.js';
import { AppError } from '../utils/errors.js';
import { rankIconAsset } from '../utils/rank-icon.js';

export function sortMembersByRank(members: readonly ClanMember[]): ClanMember[] {
  return members.map(member => ({ member, rank: rankIconAsset(member.rankIconUrl)?.rankNumber ?? null }))
    .sort((left, right) => (right.rank ?? -1) - (left.rank ?? -1))
    .map(({ member }) => member);
}

export function findMember<T extends PlayerIdentity>(members: T[], nickname: string): T {
  const exact = members.filter(member => member.nickname === nickname);
  const matches = exact.length ? exact : members.filter(member => member.nickname.toLowerCase() === nickname.toLowerCase());
  if (matches.length === 0) throw new AppError('MEMBER_NOT_FOUND', 'That player nickname was not found. Enter the complete nickname and check every character.');
  if (matches.length > 1) throw new AppError('AMBIGUOUS_MEMBER', 'More than one player matches. Use the exact nickname, including capitalization.');
  return matches[0]!;
}

export class MemberService {
  constructor(private readonly client: PointBlankClient, private readonly baseUrl: string, private readonly logger: Logger) {}

  async getPlayer(nickname: string) {
    const players = parsePlayerSearch(await this.client.getPlayerSearchHtml(nickname), this.baseUrl);
    const player = findMember(players, nickname);
    const detail = normalizePlayerDetail(await this.client.getMemberDetail(player.env), player);
    const unavailableFields = (['exp', 'kills', 'deaths', 'headshots'] as const).filter(field => detail[field] === null);
    if (unavailableFields.length) this.logger.warn({ unavailableFields }, 'Player details contain missing or malformed statistics');
    return detail;
  }
}
