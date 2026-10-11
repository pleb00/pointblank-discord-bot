import { describe, expect, it } from 'vitest';
import { normalizeMemberDetail, parseMemberList } from '../../src/parsers/member.parser.js';
import { baseUrl, detailJson, fixtureHtml, loginHtml } from '../helpers.js';

describe('member roster', () => {
  it('preserves data attributes and converts rank URLs', () => {
    const members = parseMemberList(fixtureHtml, baseUrl);
    expect(members).toHaveLength(3);
    expect(members[0]!.env.endsWith('%3D%3D')).toBe(true);
    expect(members[1]!.nickname).toBe('He`Cans13+TNG');
    expect(members[2]!.nickname).toBe('玩家 ♥ + space');
    expect(members[0]!.rankIconUrl).toBe(`${baseUrl}/images/common/icon_ranking/rank_46.png`);
  });
  it('deduplicates identical links and keeps ambiguous distinct members', () => {
    const entry = '<li><a class="user" data-env="a" data-nick="Same"></a></li>';
    expect(parseMemberList(entry + entry + entry.replace('data-env="a"', 'data-env="b"'), baseUrl)).toHaveLength(2);
  });
  it('scopes a verified roster container and excludes other player lists', () => {
    const roster = '<div class="clan_section"><div class="list member"><div class="over_wrap"><ul><li><a class="user" data-env="member" data-nick="Member"></a></li></ul></div></div></div>';
    const leader = '<ul><li><a class="user" data-env="leader" data-nick="Leader"></a></li></ul>';
    expect(parseMemberList(leader + roster, baseUrl).map(member => member.nickname)).toEqual(['Member']);
  });
  it('handles empty rosters and rejects invalid entries and access gates', () => {
    expect(parseMemberList('<ul></ul>', baseUrl)).toEqual([]);
    expect(() => parseMemberList('<li><a class="user" data-env="" data-nick="pLebb"></a></li>', baseUrl)).toThrow('invalid roster');
    expect(() => parseMemberList(loginHtml, baseUrl)).toThrow('requires login');
  });
});

describe('detail normalization', () => {
  const member = parseMemberList(fixtureHtml, baseUrl)[0]!;
  it('maps numeric fields and obtains icon only from the roster', () => {
    expect(normalizeMemberDetail(detailJson, member)).toEqual({
      nickname: 'pLebb', exp: 9040962, kills: 25484, deaths: 42600, headshots: 11851,
      rankIconUrl: member.rankIconUrl, clanName: '`Hepatica',
    });
  });
  it('normalizes missing or invalid fields to null if useful data remains', () => {
    expect(normalizeMemberDetail({ Exp: '0', Kill: '12,34', Death: -1 }, member)).toMatchObject({ exp: 0, kills: null, deaths: null, headshots: null });
  });
  it.each([null, [], {}, { error: 'not found' }, { Exp: 'NaN' }])('rejects unusable response %j', raw => {
    expect(() => normalizeMemberDetail(raw, member)).toThrow();
  });
});
