import { Routes, type REST } from 'discord.js';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

const emojiSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/), name: z.string(), animated: z.boolean().default(false),
});
const listSchema = z.object({ items: z.array(emojiSchema) });
const managedRankName = /^pb_(?:clan_)?rank_\d{1,6}$/;

export interface RankEmojiStore {
  list(): Promise<Map<string, string>>;
  create(name: string, image: Buffer): Promise<string>;
}

export class RankEmojiClient implements RankEmojiStore {
  constructor(private readonly rest: Pick<REST, 'get' | 'post'>, private readonly applicationId: string) {}

  async list(): Promise<Map<string, string>> {
    const response = listSchema.parse(await this.rest.get(Routes.applicationEmojis(this.applicationId)));
    return new Map(response.items.filter(emoji => managedRankName.test(emoji.name) && !emoji.animated)
      .map(emoji => [emoji.name, `<:${emoji.name}:${emoji.id}>`]));
  }

  async create(name: string, image: Buffer): Promise<string> {
    if (!managedRankName.test(name)) throw new AppError('RANK_ICON_FAILED', 'Invalid rank emoji name.');
    const emoji = emojiSchema.parse(await this.rest.post(Routes.applicationEmojis(this.applicationId), {
      body: { name, image: `data:image/png;base64,${image.toString('base64')}` },
    }));
    if (emoji.name !== name || emoji.animated) throw new AppError('RANK_ICON_FAILED', 'Discord returned an unexpected rank emoji.');
    return `<:${emoji.name}:${emoji.id}>`;
  }
}
