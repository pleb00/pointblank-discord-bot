import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import { RankIconClient } from '../../src/clients/rank-icon.client.js';
import { RankEmojiClient } from '../../src/clients/rank-emoji.client.js';
import { safeError } from '../../src/utils/errors.js';

const source = 'https://www.pointblank.id/images/common/icon_ranking/rank_41.png';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=', 'base64');

describe('rank icon asset client', () => {
  it('downloads original clan PNG assets and rejects Discord proxy URLs', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, data: png });
    const client = new RankIconClient(1000, { get } as unknown as AxiosInstance);
    const clanSource = source.replace('rank_41.png', 'clan_34.png');
    expect(await client.getImage(clanSource)).toBe(png);
    expect(get).toHaveBeenCalledExactlyOnceWith(clanSource);
    await expect(client.getImage('https://images-ext-1.discordapp.net/external/fixture/clan_34.png')).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
    expect(get).toHaveBeenCalledOnce();
  });
  it('retains original PNG bytes and rejects unusable HTTP or image responses', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, data: png });
    const client = new RankIconClient(1000, { get } as unknown as AxiosInstance);
    expect(await client.getImage(source)).toBe(png);
    for (const response of [{ status: 404, data: png }, { status: 200, data: Buffer.from('<html>Login</html>') }, { status: 200, data: Buffer.alloc(256 * 1024 + 1) }]) {
      get.mockResolvedValueOnce(response);
      await expect(client.getImage(source)).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
    }
    const before = get.mock.calls.length;
    await expect(client.getImage('https://other.example/rank_41.png')).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
    expect(get.mock.calls.length).toBe(before);
  });

  it('sanitizes network errors containing request credentials', async () => {
    const get = vi.fn().mockRejectedValue(new Error('private-request-authorization'));
    const client = new RankIconClient(1000, { get } as unknown as AxiosInstance);
    const failure = await client.getImage(source).catch(error => error);
    expect(failure.code).toBe('RANK_ICON_FAILED');
    expect(JSON.stringify(safeError(failure))).not.toContain('private');
    expect(failure.cause).toBeUndefined();
  });
});

describe('Discord application emoji client', () => {
  it('lists and creates managed clan badges with their own emoji names', async () => {
    const badge = { name: 'pb_clan_rank_34', id: '123456789012345678', animated: false };
    const rest = {
      get: vi.fn().mockResolvedValue({ items: [badge, { ...badge, name: 'pb_clan_34' }] }),
      post: vi.fn().mockResolvedValue(badge),
    };
    const client = new RankEmojiClient(rest, '123456789012345679');
    expect(await client.list()).toEqual(new Map([['pb_clan_rank_34', '<:pb_clan_rank_34:123456789012345678>']]));
    expect(await client.create('pb_clan_rank_34', png)).toBe('<:pb_clan_rank_34:123456789012345678>');
    expect(rest.post).toHaveBeenCalledWith('/applications/123456789012345679/emojis', { body: { name: 'pb_clan_rank_34', image: `data:image/png;base64,${png.toString('base64')}` } });
    await expect(client.create('pb_clan_34', png)).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
  });
  it('lists only managed rank names and uploads original bytes to the application route', async () => {
    const existing = { name: 'pb_rank_41', id: '123456789012345678', animated: false };
    const rest = {
      get: vi.fn().mockResolvedValue({ items: [existing, { ...existing, name: 'other_emoji' }, { ...existing, name: 'pb_rank_46', animated: true }] }),
      post: vi.fn().mockResolvedValue(existing),
    };
    const client = new RankEmojiClient(rest, '123456789012345679');
    expect(await client.list()).toEqual(new Map([['pb_rank_41', '<:pb_rank_41:123456789012345678>']]));
    expect(await client.create('pb_rank_41', png)).toBe('<:pb_rank_41:123456789012345678>');
    expect(rest.post).toHaveBeenCalledWith('/applications/123456789012345679/emojis', { body: { name: 'pb_rank_41', image: `data:image/png;base64,${png.toString('base64')}` } });
    await expect(client.create('unrelated-name', png)).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
    rest.post.mockResolvedValueOnce({ ...existing, name: 'pb_rank_46' });
    await expect(client.create('pb_rank_41', png)).rejects.toMatchObject({ code: 'RANK_ICON_FAILED' });
  });
});
