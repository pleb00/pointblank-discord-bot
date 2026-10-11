import type { ConfiguredClan } from '../config/clan-config.js';
import { PointBlankClient, clanUrl } from '../clients/pointblank.client.js';
import { parseClanHtml } from '../parsers/clan.parser.js';
import { parseMemberList } from '../parsers/member.parser.js';
import type { ClanSnapshot } from '../models/clan.model.js';
import { AsyncCache } from '../utils/cache.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from 'pino';

export class ClanService {
  private readonly snapshots: AsyncCache<ClanSnapshot>;

  constructor(private readonly client: PointBlankClient, private readonly baseUrl: string, ttlMs: number, private readonly logger?: Logger) {
    this.snapshots = new AsyncCache(ttlMs);
  }

  getSnapshot(clan: ConfiguredClan): Promise<ClanSnapshot> {
    return this.snapshots.get(JSON.stringify([clan.id, clan.uniqueId]), async () => {
      const html = await this.client.getClanHtml(clan.uniqueId);
      const info = parseClanHtml(html, clan, this.baseUrl);
      const unavailableFields = Object.entries({ master: info.master, memberCount: info.memberCount, maxMembers: info.maxMembers,
        createdAt: info.createdAt, rankName: info.rank.name, rankIcon: info.rank.iconUrl, rankProgress: info.rank.progressPercentage })
        .filter(([, value]) => value === null).map(([field]) => field);
      if (unavailableFields.length) this.logger?.warn({ clanId: clan.id, unavailableFields }, 'Clan profile fields are missing or malformed');
      return { info, html, sourceUrl: clanUrl(this.baseUrl, clan.uniqueId).href };
    });
  }

  async getRoster(clan: ConfiguredClan) {
    const snapshot = await this.getSnapshot(clan);
    const members = parseMemberList(snapshot.html, this.baseUrl);
    if (members.length === 0 && snapshot.info.memberCount !== 0) {
      throw new AppError('EMPTY_ROSTER', 'Point Blank returned no readable clan members. The roster may be unavailable or the page structure changed.');
    }
    if (snapshot.info.memberCount !== null && snapshot.info.memberCount !== members.length) {
      throw new AppError('INCOMPLETE_ROSTER', 'Point Blank returned an incomplete roster. Please try again later; its page may have changed.');
    }
    return { info: snapshot.info, members };
  }
}
