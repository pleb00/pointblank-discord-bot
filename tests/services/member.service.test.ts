import { describe, expect, it, vi } from 'vitest';
import { findMember, MemberService, sortMembersByRank } from '../../src/services/member.service.js';
import { ClanService } from '../../src/services/clan.service.js';
import type { PointBlankClient } from '../../src/clients/pointblank.client.js';
import type { ClanMember } from '../../src/models/member.model.js';
import { parseMemberList } from '../../src/parsers/member.parser.js';
import { createLogger } from '../../src/utils/logger.js';
import { baseUrl, clan, emptyPlayerSearchHtml, fixtureHtml, playerDetailJson, playerSearchHtml } from '../helpers.js';

describe('roster rank ordering', () => {
  // Synthetic members exercise numeric asset ordering, not a verified rank-name hierarchy.
  const member = (nickname: string, rankIconUrl: string | null): ClanMember => ({ nickname, env: `fixture-${nickname}`, rankIconUrl });
  const icon = (rank: number) => `${baseUrl}/images/common/icon_ranking/rank_${rank}.png`;

  it('sorts numeric ranks descending, preserves ties and leaves the original roster intact', () => {
    const members = Object.freeze([
      member('Nine', icon(9)), member('Ten first', icon(10)), member('Hundred', icon(100)), member('Ten second', icon(10)),
    ]);
    expect(sortMembersByRank(members)).toEqual([members[2], members[1], members[3], members[0]]);
    expect(members.map(entry => entry.nickname)).toEqual(['Nine', 'Ten first', 'Hundred', 'Ten second']);
  });

  it('puts absent, malformed and untrusted ranks last while retaining their original order', () => {
    const members = [
      member('Missing', null), member('Foreign', 'https://other.example/rank_999.png'), member('Zero', icon(0)),
      member('Malformed', 'not a URL'), member('Valid', icon(46)), member('Query', `${icon(999)}?env=fixture`),
      member('Clan icon', `${baseUrl}/images/common/icon_ranking/clan_999.png`),
    ];
    expect(sortMembersByRank(members)).toEqual([members[4], members[2], members[0], members[1], members[3], members[5], members[6]]);
  });

  it('accepts an empty roster', () => {
    expect(sortMembersByRank([])).toEqual([]);
  });
});

describe('nickname matching', () => {
  const members = parseMemberList(fixtureHtml, baseUrl);
  it('prefers exact matches and permits case-insensitive convenience', () => {
    expect(findMember(members, 'plebb').nickname).toBe('pLebb');
    expect(findMember(members, 'He`Cans13+TNG').env).toBe(members[1]!.env);
    const ambiguous = [{ ...members[0]!, nickname: 'Nick' }, { ...members[1]!, nickname: 'nick' }];
    expect(findMember(ambiguous, 'nick')).toBe(ambiguous[1]);
    expect(() => findMember(ambiguous, 'NICK')).toThrow('More than one');
  });
  it('rejects missing and ambiguous exact nicknames', () => {
    expect(() => findMember(members, 'missing')).toThrow('not found');
    expect(() => findMember([members[0]!, { ...members[0]!, env: 'different' }], 'pLebb')).toThrow('More than one');
  });
});

describe('services', () => {
  function setup(html = fixtureHtml) {
    const client = {
      getClanHtml: vi.fn().mockResolvedValue(html), getPlayerSearchHtml: vi.fn().mockResolvedValue(playerSearchHtml),
      getMemberDetail: vi.fn().mockResolvedValue(playerDetailJson),
    };
    const clans = new ClanService(client as unknown as PointBlankClient, baseUrl, 300_000);
    const members = new MemberService(client as unknown as PointBlankClient, baseUrl, createLogger('silent'));
    return { client, clans, members };
  }
  it('deduplicates clan fetches and shares the snapshot with the roster', async () => {
    const { client, clans } = setup();
    await Promise.all([clans.getSnapshot(clan), clans.getRoster(clan)]);
    expect(client.getClanHtml).toHaveBeenCalledTimes(1);
  });
  it('fetches details only for the matched search identifier and preserves HTML rank information', async () => {
    const { client, members } = setup();
    const detail = await members.getPlayer('pLebb');
    expect(client.getPlayerSearchHtml).toHaveBeenCalledExactlyOnceWith('pLebb');
    expect(client.getMemberDetail).toHaveBeenCalledExactlyOnceWith('search%2Bid%2F%3D%3D');
    expect(client.getClanHtml).not.toHaveBeenCalled();
    expect(detail.nickname).toBe('pLebb');
    expect(detail.rankIconUrl).toContain('rank_46');
    expect(detail).toMatchObject({ ranking: 71209, rankName: 'Brigadier', exp: 3789431, kills: 21053, deaths: 11687, headshots: 18968, clanName: 'AutoWin', clanMemberCount: 28, clanRanking: 1391886 });
    expect(detail.killDeathRatio).toBeCloseTo(21053 / 11687);
    expect(detail.headshotRatio).toBeCloseTo(18968 / 21053 * 100);
    expect(detail).not.toHaveProperty('env');
  });
  it('rejects partial nicknames even if the upstream response contains a longer nickname', async () => {
    const { client, members } = setup();
    await expect(members.getPlayer('pLeb')).rejects.toThrow('complete nickname');
    expect(client.getMemberDetail).not.toHaveBeenCalled();
  });
  it('does not call the detail endpoint for an explicit no-match result', async () => {
    const { client, members } = setup();
    client.getPlayerSearchHtml.mockResolvedValue(emptyPlayerSearchHtml);
    await expect(members.getPlayer('pLeb')).rejects.toThrow('not found');
    expect(client.getMemberDetail).not.toHaveBeenCalled();
  });
  it('does not choose between ambiguous player identifiers', async () => {
    const { client, members } = setup();
    // Synthetic duplicated search row with a distinct identifier.
    const row = playerSearchHtml.match(/<div class="r_tr">[\s\S]*?\n {4}<\/div>/)![0];
    client.getPlayerSearchHtml.mockResolvedValue(playerSearchHtml.replace(row, row + row.replace('search%2Bid%2F%3D%3D', 'other')));
    await expect(members.getPlayer('pLebb')).rejects.toThrow('More than one');
    expect(client.getMemberDetail).not.toHaveBeenCalled();
  });
  it('rejects changed search markup before requesting player details', async () => {
    const { client, members } = setup();
    client.getPlayerSearchHtml.mockResolvedValue(playerSearchHtml.replace('data-env=', 'data-changed='));
    await expect(members.getPlayer('pLebb')).rejects.toThrow('page structure');
    expect(client.getMemberDetail).not.toHaveBeenCalled();
  });
  it('propagates detail request failures instead of claiming a complete player profile', async () => {
    const { client, members } = setup();
    client.getMemberDetail.mockRejectedValue(new Error('test-detail-unavailable'));
    await expect(members.getPlayer('pLebb')).rejects.toThrow('test-detail-unavailable');
  });
  it('does not use the search EXP to hide a missing detail EXP', async () => {
    const { client, members } = setup();
    client.getMemberDetail.mockResolvedValue({ Kill: '100', Death: '20', Headshot: '25' });
    expect(await members.getPlayer('pLebb')).toMatchObject({ exp: null, kills: 100, deaths: 20, headshots: 25, clanName: null, clanMemberCount: null, clanRanking: null, killDeathRatio: 5, headshotRatio: 25 });
  });
  it('detects incomplete roster without blocking the profile command', async () => {
    const { clans } = setup(fixtureHtml.replace('<font>3</font>', '<font>91</font>'));
    expect((await clans.getSnapshot(clan)).info.memberCount).toBe(91);
    await expect(clans.getRoster(clan)).rejects.toThrow('incomplete');
  });
  it('handles empty roster and changed markup clearly', async () => {
    const empty = '<div class="info"><div class="name">Clan</div></div>';
    await expect(setup(empty).clans.getRoster(clan)).rejects.toThrow('no readable');
    const zero = empty.replace('</div></div>', '</div><div class="members">0/200</div></div>');
    expect((await setup(zero).clans.getRoster(clan)).members).toEqual([]);
  });
  it('resolves multiple clans through separate cached snapshots', async () => {
    const { client, clans } = setup();
    await clans.getSnapshot(clan);
    expect((await clans.getSnapshot({ ...clan, id: 'second', uniqueId: 'second-id' })).info.id).toBe('second');
    expect(client.getClanHtml).toHaveBeenCalledTimes(2);
  });
});
