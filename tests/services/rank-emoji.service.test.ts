import { describe, expect, it, vi } from 'vitest';
import { RankEmojiService } from '../../src/services/rank-emoji.service.js';
import { createLogger } from '../../src/utils/logger.js';
import { rankIconAsset } from '../../src/utils/rank-icon.js';
import type { ClanMember } from '../../src/models/member.model.js';

const source = 'https://www.pointblank.id/images/common/icon_ranking/rank_41.png';
const emoji = '<:pb_rank_41:123456789012345678>';
const clanSource = 'https://www.pointblank.id/images/common/icon_ranking/clan_34.png';
const clanEmoji = '<:pb_clan_rank_34:123456789012345679>';
const member = (rankIconUrl: string | null = source): ClanMember => ({ nickname: 'A`Player', env: 'fixture-id', rankIconUrl });

function setup(existing = new Map<string, string>()) {
  const emojis = { list: vi.fn().mockResolvedValue(existing), create: vi.fn().mockResolvedValue(emoji) };
  const images = { getImage: vi.fn().mockResolvedValue(Buffer.from('original-image')) };
  const logger = createLogger('silent');
  const warn = vi.spyOn(logger, 'warn');
  return { service: new RankEmojiService(emojis, images, logger), emojis, images, warn };
}

describe('application rank emoji integration', () => {
  it('uploads the original clan badge once across concurrent profile requests', async () => {
    const { service, emojis, images } = setup();
    emojis.create.mockResolvedValue(clanEmoji);
    expect(await Promise.all([service.forClan(clanSource), service.forClan(clanSource)])).toEqual([clanEmoji, clanEmoji]);
    expect(images.getImage).toHaveBeenCalledExactlyOnceWith(clanSource);
    expect(emojis.create).toHaveBeenCalledExactlyOnceWith('pb_clan_rank_34', Buffer.from('original-image'));
    await service.forClan(clanSource);
    expect(emojis.create).toHaveBeenCalledOnce();
  });

  it('reuses clan badges independently of member ranks with the same asset number', async () => {
    const memberSource = source.replace('rank_41.png', 'rank_34.png');
    const memberEmoji = '<:pb_rank_34:123456789012345678>';
    const { service, emojis, images } = setup(new Map([['pb_rank_34', memberEmoji], ['pb_clan_rank_34', clanEmoji]]));
    const [roster, badge] = await Promise.all([service.forMembers([member(memberSource)]), service.forClan(clanSource)]);
    expect(roster.get(memberSource)).toBe(memberEmoji);
    expect(badge).toBe(clanEmoji);
    expect(images.getImage).not.toHaveBeenCalled();
    expect(emojis.create).not.toHaveBeenCalled();
  });

  it('does not request missing, member or untrusted URLs as clan badges', async () => {
    const { service, emojis, images } = setup();
    const invalid = [null, source, clanSource + '?format=webp', clanSource.replace('www.pointblank.id', 'other.example'), 'https://images-ext-1.discordapp.net/external/fixture/clan_34.png'];
    expect(await Promise.all(invalid.map(value => service.forClan(value)))).toEqual(invalid.map(() => null));
    expect(emojis.list).not.toHaveBeenCalled();
    expect(images.getImage).not.toHaveBeenCalled();
  });

  it('returns a clan fallback on failed uploads and retries on the next request', async () => {
    const { service, emojis, warn } = setup();
    emojis.create.mockRejectedValueOnce(new Error('private-clan-request')).mockResolvedValue(clanEmoji);
    expect(await service.forClan(clanSource)).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-clan-request');
    expect(await service.forClan(clanSource)).toBe(clanEmoji);
  });

  it('uploads the exact roster icon once across duplicate members and concurrent rosters', async () => {
    const { service, emojis, images } = setup();
    const [first, second] = await Promise.all([service.forMembers([member(), member()]), service.forMembers([member()])]);
    expect(first.get(source)).toBe(emoji);
    expect(second.get(source)).toBe(emoji);
    expect(emojis.list).toHaveBeenCalledOnce();
    expect(images.getImage).toHaveBeenCalledExactlyOnceWith(source);
    expect(emojis.create).toHaveBeenCalledExactlyOnceWith('pb_rank_41', Buffer.from('original-image'));
    await service.forMembers([member()]);
    expect(emojis.create).toHaveBeenCalledOnce();
  });

  it('reuses application emojis across restarts without downloading or uploading again', async () => {
    const { service, emojis, images } = setup(new Map([['pb_rank_41', emoji]]));
    expect((await service.forMembers([member()])).get(source)).toBe(emoji);
    expect(images.getImage).not.toHaveBeenCalled();
    expect(emojis.create).not.toHaveBeenCalled();
  });

  it('skips missing or untrusted assets without any external requests', async () => {
    const { service, emojis, images } = setup();
    const untrusted = [null, 'https://other.example/rank_41.png', 'http://www.pointblank.id/images/common/icon_ranking/rank_41.png', source + '?env=private', source.replace('rank_41.png', 'clan_41.png')];
    expect((await service.forMembers(untrusted.map(value => member(value)))).size).toBe(0);
    expect(emojis.list).not.toHaveBeenCalled();
    expect(images.getImage).not.toHaveBeenCalled();
    expect(rankIconAsset('not a URL')).toBeNull();
    expect(rankIconAsset(source.replace('www.pointblank.id', 'user:secret@www.pointblank.id'))).toBeNull();
  });

  it('recovers from an upload failure and does not expose its raw message', async () => {
    const { service, emojis, warn } = setup();
    emojis.create.mockRejectedValueOnce(new Error('private-token-and-query-url'));
    expect((await service.forMembers([member()])).size).toBe(0);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-token');
    expect((await service.forMembers([member()])).get(source)).toBe(emoji);
    expect(emojis.create).toHaveBeenCalledTimes(2);
  });

  it('returns a usable fallback and retries after a failed application emoji list', async () => {
    const { service, emojis, images } = setup();
    emojis.list.mockRejectedValueOnce(new Error('private-authorization'));
    expect((await service.forMembers([member()])).size).toBe(0);
    expect(images.getImage).not.toHaveBeenCalled();
    expect((await service.forMembers([member()])).get(source)).toBe(emoji);
    expect(emojis.list).toHaveBeenCalledTimes(2);
  });
});
