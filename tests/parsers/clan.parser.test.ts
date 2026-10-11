import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { absoluteImageUrl, calculateOutcomeRates, parseClanHtml, parsePercentage, rankProgress } from '../../src/parsers/clan.parser.js';
import { baseUrl, clan, fixtureHtml, loginHtml } from '../helpers.js';

const statisticsHtml = readFileSync(new URL('../fixtures/clan-total-statistics.html', import.meta.url), 'utf8');

describe('clan parsing', () => {
  it('extracts supplied profile fields and excludes labels/footer info', () => {
    const info = parseClanHtml(fixtureHtml, clan, baseUrl);
    expect(info).toMatchObject({ id: 'hepatica', name: '`Hepatica', master: 'He`Cans13+TNG', memberCount: 3, maxMembers: 200, createdAt: '19. Mar. 2026' });
    expect(info.rank).toEqual({ name: 'Recon Battalion', iconUrl: `${baseUrl}/images/common/icon_ranking/clan_34.png`, progressPercentage: 24.5, exp: null });
    expect(Object.values(info.statistics)).toEqual([null, null, null, null, null]);
  });
  it('does not invent match statistics from unrelated content', () => {
    const html = fixtureHtml.replace('</section>', '<div>Total matches: 999. Wins: 500. EXP: 1000</div></section>');
    expect(parseClanHtml(html, clan, baseUrl).statistics.totalMatches).toBeNull();
  });
  it('parses the verified Total Stat panel using the website percentages', () => {
    const statistics = parseClanHtml(fixtureHtml + statisticsHtml, clan, baseUrl).statistics;
    expect(statistics).toEqual({ totalMatches: 28446, wins: 26742, losses: 1702, winRate: 94, lossRate: 6 });
    expect(statistics.wins! + statistics.losses!).not.toBe(statistics.totalMatches);
  });
  it('keeps total statistics separate from season panels', () => {
    const season = statisticsHtml.replace('class=clan_record', 'class=season').replace('28,446', '14,223').replace('94.0', '50.0');
    expect(parseClanHtml(fixtureHtml + season + statisticsHtml, clan, baseUrl).statistics.winRate).toBe(94);
    expect(parseClanHtml(fixtureHtml + season, clan, baseUrl).statistics.totalMatches).toBeNull();
  });
  it('does not calculate unknown outcome rates when displayed rates are missing', () => {
    const html = statisticsHtml.replace(/<font class="ani_num">[^<]+<\/font>/g, '');
    expect(parseClanHtml(fixtureHtml + html, clan, baseUrl).statistics).toMatchObject({ wins: 26742, losses: 1702, winRate: null, lossRate: null });
  });
  it('rejects ambiguous panels and malformed statistics without substituting other fields', () => {
    expect(parseClanHtml(fixtureHtml + statisticsHtml + statisticsHtml, clan, baseUrl).statistics.totalMatches).toBeNull();
    const malformed = statisticsHtml.replaceAll('94.0', '101.0').replace('26,742', '26,74');
    expect(parseClanHtml(fixtureHtml + malformed, clan, baseUrl).statistics).toMatchObject({ wins: null, winRate: null, lossRate: 6 });
    expect(parseClanHtml(fixtureHtml + statisticsHtml.replace('Total</span> Stat', 'Other</span> Stat'), clan, baseUrl).statistics.totalMatches).toBeNull();
  });
  it('rejects login gates and changed or ambiguous required selectors', () => {
    expect(() => parseClanHtml(loginHtml, clan, baseUrl)).toThrow('requires login');
    expect(() => parseClanHtml('<html>No clan</html>', clan, baseUrl)).toThrow('Could not read');
    expect(() => parseClanHtml(fixtureHtml + '<div class="info"><div class="name">Other</div></div>', clan, baseUrl)).toThrow('Could not read');
  });
  it('uses null for unavailable optional fields', () => {
    const info = parseClanHtml('<div class="info"><div class="name">Clan</div></div>', clan, baseUrl);
    expect(info.master).toBeNull();
    expect(info.memberCount).toBeNull();
    expect(info.rank.progressPercentage).toBeNull();
  });
  it.each([['width:0%', 0], ['color:red; WIDTH:100% !important;', 100], ['width:101%', null], ['width:2px', null], ['max-width:30%', null]])('parses progress %s', (style, value) => {
    expect(rankProgress(style as string)).toBe(value);
  });
  it('allows only same-origin HTTPS image URLs', () => {
    expect(absoluteImageUrl('/rank.png', baseUrl)).toBe(`${baseUrl}/rank.png`);
    expect(absoluteImageUrl('javascript:alert(1)', baseUrl)).toBeNull();
    expect(absoluteImageUrl('https://other.example/rank.png', baseUrl)).toBeNull();
  });
  it.each([['94.0%', 94], ['6.0', 6], ['', null], ['101%', null], ['1e2%', null], ['-1%', null]])('validates displayed percentage %s', (text, value) => {
    expect(parsePercentage(text as string)).toBe(value);
  });
});

describe('outcome rates (separate from the website displayed percentages)', () => {
  it('uses wins + losses when these are the only outcomes', () => {
    expect(calculateOutcomeRates(3, 1)).toEqual({ winRate: 75, lossRate: 25 });
  });
  it('includes draws in the denominator when supplied', () => {
    expect(calculateOutcomeRates(3, 1, 1)).toEqual({ winRate: 60, lossRate: 20 });
  });
  it('rejects invalid or empty totals', () => {
    expect(calculateOutcomeRates(0, 0)).toEqual({ winRate: null, lossRate: null });
    expect(calculateOutcomeRates(-1, 2).winRate).toBeNull();
    expect(calculateOutcomeRates(Number.MAX_SAFE_INTEGER, 2).winRate).toBeNull();
  });
});
