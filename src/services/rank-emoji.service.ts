import type { Logger } from 'pino';
import type { RankEmojiStore } from '../clients/rank-emoji.client.js';
import type { RankIconClient } from '../clients/rank-icon.client.js';
import type { ClanMember } from '../models/member.model.js';
import { AsyncCache } from '../utils/cache.js';
import { safeError } from '../utils/errors.js';
import { rankIconAsset, type RankIconKind } from '../utils/rank-icon.js';

export class RankEmojiService {
  private existing: Promise<Map<string, string>> | null = null;
  private readonly icons = new AsyncCache<string>(3_600_000, 500);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly emojis: RankEmojiStore,
    private readonly images: Pick<RankIconClient, 'getImage'>,
    private readonly logger: Logger,
  ) {}

  private applicationEmojis(): Promise<Map<string, string>> {
    this.existing ??= this.emojis.list().catch(error => { this.existing = null; throw error; });
    return this.existing;
  }

  forMembers(members: ClanMember[]): Promise<ReadonlyMap<string, string>> {
    return this.forSources(members.map(member => member.rankIconUrl), 'member');
  }

  async forClan(source: string | null): Promise<string | null> {
    if (!source) return null;
    return (await this.forSources([source], 'clan')).get(source) ?? null;
  }

  private async forSources(candidates: (string | null)[], kind: RankIconKind): Promise<ReadonlyMap<string, string>> {
    const sources = [...new Set(candidates.filter((source): source is string => rankIconAsset(source, kind) !== null))];
    if (!sources.length) return new Map();
    let existing: Map<string, string>;
    try { existing = await this.applicationEmojis(); }
    catch (error) {
      this.logger.warn(safeError(error), 'Rank emoji setup failed');
      return new Map();
    }
    const resolved = await Promise.all(sources.map(async source => {
      const asset = rankIconAsset(source, kind)!;
      try {
        const emoji = await this.icons.get(asset.emojiName, async () => {
          const known = existing.get(asset.emojiName);
          if (known) return known;
          // Serial creation limits website asset requests and Discord emoji mutations.
          const work = this.queue.then(async () => {
            const alreadyCreated = existing.get(asset.emojiName);
            if (alreadyCreated) return alreadyCreated;
            const image = await this.images.getImage(asset.url);
            const created = await this.emojis.create(asset.emojiName, image);
            existing.set(asset.emojiName, created);
            return created;
          });
          this.queue = work.then(() => undefined, () => undefined);
          return work;
        });
        return [source, emoji] as const;
      } catch (error) {
        this.logger.warn(safeError(error), 'Rank icon unavailable');
        return null;
      }
    }));
    return new Map(resolved.filter((entry): entry is readonly [string, string] => entry !== null));
  }
}
