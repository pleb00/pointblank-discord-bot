import { describe, expect, it } from 'vitest';
import { normalizePlayerDetail, parsePlayerSearch } from '../../src/parsers/player.parser.js';
import { baseUrl, emptyPlayerSearchHtml, loginHtml, playerDetailJson, playerSearchHtml } from '../helpers.js';

describe('individual player search', () => {
  it('extracts the original identity and row rank icon, excluding popup icons', () => {
    expect(parsePlayerSearch(playerSearchHtml, baseUrl)).toEqual([{
      nickname: 'pLebb', env: 'search%2Bid%2F%3D%3D', rankIconUrl: `${baseUrl}/images/common/icon_ranking/rank_46.png`,
      ranking: 71209, rankName: 'Brigadier', exp: 7178,
    }]);
  });
  it('accepts a supplied table excerpt without the outer page shell', () => {
    const table = playerSearchHtml.match(/<div class="nrank_table">[\s\S]*?<\/div><\/div><\/div>/)![0];
    expect(parsePlayerSearch(table, baseUrl)[0]).toMatchObject({ nickname: 'pLebb', ranking: 71209, rankName: 'Brigadier', exp: 7178 });
  });
  it('keeps missing rank text and malformed or missing numeric fields null', () => {
    const html = playerSearchHtml.replace('71209', '-1').replace('7,178', '7,17').replace('Brigadier', '');
    expect(parsePlayerSearch(html, baseUrl)[0]).toMatchObject({ ranking: null, exp: null, rankName: null });
    const missing = playerSearchHtml.replace('r_td win', 'r_td changed').replace('r_td exp ml', 'r_td changed');
    expect(parsePlayerSearch(missing, baseUrl)[0]).toMatchObject({ ranking: null, exp: null });
  });
  it('preserves nickname case, punctuation, Unicode, spaces and plus signs', () => {
    const nickname = 'He`Cans13+TNG 玩家 ♥ + space';
    expect(parsePlayerSearch(playerSearchHtml.replaceAll('pLebb', nickname), baseUrl)[0]!.nickname).toBe(nickname);
  });
  it('recognizes the verified no-match marker', () => {
    expect(parsePlayerSearch(emptyPlayerSearchHtml, baseUrl)).toEqual([]);
  });
  it.each([
    playerSearchHtml.replace('class="nrank_table"', 'class="changed"'),
    playerSearchHtml.replace('class="r_tr"', 'class="changed"'),
    playerSearchHtml.replace('data-env=', 'data-changed='),
    playerSearchHtml.replace('data-nick=', 'data-changed='),
    playerSearchHtml.replace('search%2Bid%2F%3D%3D', ''),
    playerSearchHtml.replace('data-nick="pLebb"', 'data-nick=" "'),
    emptyPlayerSearchHtml.replace('Our search has no matches!', 'Unknown response'),
    emptyPlayerSearchHtml.replace('nodata_n', 'changed'),
    playerSearchHtml + playerSearchHtml,
  ])('rejects changed required selectors or unusable identities %#', html => {
    expect(() => parsePlayerSearch(html, baseUrl)).toThrow('page structure');
  });
  it.each([
    'https://foreign.example/rank_46.png',
    '/images/common/icon_ranking/clan_46.png',
    '/images/common/icon_ranking/rank_46.png?env=synthetic',
    '/images/common/icon_ranking/unknown.png',
  ])('keeps unavailable or untrusted rank icons null: %s', src => {
    expect(parsePlayerSearch(playerSearchHtml.replace('/images/common/icon_ranking/rank_46.png', src), baseUrl)[0]!.rankIconUrl).toBeNull();
  });
  it('does not substitute a popup rank image when the row image is missing', () => {
    const html = playerSearchHtml.replace('<img src="/images/common/icon_ranking/rank_46.png" alt="">', '');
    expect(parsePlayerSearch(html, baseUrl)[0]!.rankIconUrl).toBeNull();
  });
  it.each([loginHtml, '<div class="g-recaptcha"></div>'])('rejects login and CAPTCHA responses %#', html => {
    expect(() => parsePlayerSearch(html, baseUrl)).toThrow(/login|verification/);
  });
});

describe('combined player statistics', () => {
  const player = parsePlayerSearch(playerSearchHtml, baseUrl)[0]!;
  it('combines the supplied JSON with the search identity and calculates both ratios', () => {
    const detail = normalizePlayerDetail(playerDetailJson, player);
    expect(detail).toMatchObject({ nickname: 'pLebb', ranking: 71209, rankName: 'Brigadier', exp: 3789431, kills: 21053, deaths: 11687, headshots: 18968, clanName: 'AutoWin', clanMemberCount: 28, clanRanking: 1391886, rankIconUrl: player.rankIconUrl });
    expect(detail.killDeathRatio).toBeCloseTo(21053 / 11687);
    expect(detail.headshotRatio).toBeCloseTo(18968 / 21053 * 100);
    expect(detail).not.toHaveProperty('env');
  });
  it('keeps zero denominators unavailable and valid zero numerators as zero', () => {
    expect(normalizePlayerDetail({ Exp: '0', Kill: '0', Death: '0', Headshot: '0' }, player)).toMatchObject({ killDeathRatio: null, headshotRatio: null });
    expect(normalizePlayerDetail({ Kill: '0', Death: '10', Headshot: '0' }, player)).toMatchObject({ killDeathRatio: 0, headshotRatio: null });
    expect(normalizePlayerDetail({ Kill: '10', Death: '5', Headshot: '0' }, player)).toMatchObject({ killDeathRatio: 2, headshotRatio: 0 });
  });
  it('keeps malformed or missing clan fields and ratio inputs null', () => {
    expect(normalizePlayerDetail({ Kill: '100', Death: 'bad', Headshot: '25', ClanName: ' ', ClanTroops: '2,8', ClanExpRank: -1 }, player)).toMatchObject({ exp: null, kills: 100, deaths: null, killDeathRatio: null, headshotRatio: 25, clanName: null, clanMemberCount: null, clanRanking: null });
    expect(normalizePlayerDetail({ Exp: '0' }, player)).toMatchObject({ killDeathRatio: null, headshotRatio: null });
  });
  it.each([null, [], {}, { error: 'not found' }])('rejects unusable detail responses %#', raw => {
    expect(() => normalizePlayerDetail(raw, player)).toThrow();
  });
});
