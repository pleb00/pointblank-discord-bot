import type { Logger } from 'pino';
import type { ConfiguredClan } from '../config/clan-config.js';
import type { ClanMember } from '../models/member.model.js';
import { PointBlankClient } from '../clients/pointblank.client.js';
import { normalizeMemberDetail } from '../parsers/member.parser.js';
import { AppError } from '../utils/errors.js';
import { rankIconAsset } from '../utils/rank-icon.js';
import { ClanService } from './clan.service.js';

export function sortMembersByRank(members: readonly ClanMember[]): ClanMember[] {
  return members.map(member => ({ member, rank: rankIconAsset(member.rankIconUrl)?.rankNumber ?? null }))
    .sort((left, right) => (right.rank ?? -1) - (left.rank ?? -1))
    .map(({ member }) => member);
}

export function findMember(members: ClanMember[], nickname: string): ClanMember {
  const exact = members.filter(member => member.nickname === nickname);
  const matches = exact.length ? exact : members.filter(member => member.nickname.toLowerCase() === nickname.toLowerCase());
  if (matches.length === 0) throw new AppError('MEMBER_NOT_FOUND', 'That nickname was not found in the selected clan. Check its spelling and clan.');
  if (matches.length > 1) throw new AppError('AMBIGUOUS_MEMBER', 'More than one member matches. Use the exact nickname, including capitalization.');
  return matches[0]!;
}

export class MemberService {
  constructor(private readonly clans: ClanService, private readonly client: PointBlankClient, private readonly logger: Logger) {}

  async getDetail(clan: ConfiguredClan, nickname: string) {
    const { members } = await this.clans.getRoster(clan);
    const member = findMember(members, nickname);
    const detail = normalizeMemberDetail(await this.client.getMemberDetail(member.env), member);
    const unavailableFields = ['exp', 'kills', 'deaths', 'headshots'].filter(key => detail[key as 'exp' | 'kills' | 'deaths' | 'headshots'] === null);
    if (unavailableFields.length) this.logger.warn({ clanId: clan.id, unavailableFields }, 'Player details contain missing or malformed statistics');
    return detail;
  }
}
