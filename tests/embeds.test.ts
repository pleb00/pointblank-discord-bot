import { describe, expect, it } from 'vitest';
import { ComponentType, MessageFlags } from 'discord.js';
import { clanProfile } from '../src/embeds/clan-profile.js';
import { playerEmbed } from '../src/embeds/player.embed.js';
import { rosterPage } from '../src/embeds/roster.embed.js';
import { parseClanHtml } from '../src/parsers/clan.parser.js';
import { normalizePlayerDetail, parsePlayerSearch } from '../src/parsers/player.parser.js';
import { baseUrl, clan, fixtureHtml, playerDetailJson, playerSearchHtml } from './helpers.js';

function clanText(output: ReturnType<typeof clanProfile>): string {
  return output.components[0]!.toJSON().components.flatMap(component => {
    if (component.type === ComponentType.TextDisplay) return [component.content];
    if (component.type === ComponentType.Section) return component.components.map(text => text.content);
    return [];
  }).join('\n');
}

describe('Discord presentation', () => {
  it('places each actual rank emoji before the escaped nickname and removes technical rank labels', () => {
    const source = `${baseUrl}/images/common/icon_ranking/rank_41.png`;
    const emoji = '<:pb_rank_41:123456789012345678>';
    const members = [{ nickname: 'TABRAK`Slytherin', env: 'fixture', rankIconUrl: source }, { nickname: 'Unknown', env: 'fixture-2', rankIconUrl: null }];
    const output = rosterPage('Hepatica', members, 0, 15, 'session', false, new Map([[source, emoji]]));
    expect(output.embeds[0]!.toJSON().description).toBe(`1. ${emoji} **TABRAK\\\`Slytherin**\n2. Rank N/A **Unknown**`);
    expect(output.embeds[0]!.toJSON().footer!.text).toBe('Page 1 / 1');
    expect(output.embeds[0]!.toJSON().description).not.toContain('Rank icon #');
  });

  it('falls back to the actual icon link without breaking Discord limits or guessing an icon', () => {
    const source = `${baseUrl}/images/common/icon_ranking/rank_41.png`;
    const members = Array.from({ length: 20 }, () => ({ nickname: '😀'.repeat(2000), env: 'fixture', rankIconUrl: source }));
    const output = rosterPage('Clan', members, 0, 20, 'session');
    const description = output.embeds[0]!.toJSON().description!;
    expect(description).toContain(`1. [Rank](${source}) **`);
    expect(description.length).toBeLessThanOrEqual(4096);
    expect(description.split('\n')).toHaveLength(20);
  });

  it('paginates a 200-person roster within embed limits', () => {
    const members = Array.from({ length: 200 }, (_, index) => ({ nickname: `He\`Cans13+TNG ${index}`, env: `env-${index}`, rankIconUrl: `${baseUrl}/images/common/icon_ranking/rank_46.png` }));
    const first = rosterPage('Hepatica', members, 0, 15, 'session');
    expect(first.embeds[0]!.toJSON().description!.split('\n')).toHaveLength(15);
    expect(first.embeds[0]!.length).toBeLessThan(6000);
    expect(first.components[0]!.toJSON().components.map(button => button.disabled)).toEqual([true, false]);
    const last = rosterPage('Hepatica', members, 999, 15, 'session');
    expect(last.embeds[0]!.toJSON().footer!.text).toContain('Page 14 / 14');
    expect(last.components[0]!.toJSON().components.map(button => button.disabled)).toEqual([false, true]);
    expect(rosterPage('Hepatica', members, 1, 15, 'session', true).components[0]!.toJSON().components.every(button => button.disabled)).toBe(true);
  });
  it('bounds long nicknames and prevents mentions', () => {
    const members = Array.from({ length: 20 }, () => ({ nickname: '**@everyone**' + '😀'.repeat(2000), env: 'fixture', rankIconUrl: null }));
    const output = rosterPage('Clan', members, 0, 20, 'session');
    expect(output.embeds[0]!.toJSON().description!.length).toBeLessThanOrEqual(4096);
    expect(output.allowedMentions.parse).toEqual([]);
  });
  it('places the attached clan logo first and the rank badge directly above its progress', () => {
    const rankEmoji = '<:pb_clan_rank_34:123456789012345678>';
    const output = clanProfile(parseClanHtml(fixtureHtml, clan, baseUrl), Buffer.from('test-image'), false, rankEmoji);
    const components = output.components[0]!.toJSON().components;
    expect(output.flags).toBe(MessageFlags.IsComponentsV2);
    expect(components[0]).toMatchObject({ type: ComponentType.MediaGallery, items: [{ media: { url: 'attachment://clan-logo.png' } }] });
    expect(components[1]).toMatchObject({ type: ComponentType.TextDisplay, content: expect.stringMatching(/^# /) });
    expect(output.files).toHaveLength(1);
    const rankIndex = components.findIndex(component => component.type === ComponentType.TextDisplay && component.content.startsWith('### Clan rank'));
    expect(components[rankIndex]).toMatchObject({ type: ComponentType.TextDisplay, content: `### Clan rank\n${rankEmoji} Recon Battalion` });
    expect(components[rankIndex + 1]).toMatchObject({ type: ComponentType.TextDisplay, content: '**Rank progress:** `███░░░░░░░░░` 24.5%' });
    expect(components.some(component => component.type === ComponentType.Section)).toBe(false);
    const content = clanText(output);
    expect(content.indexOf('### Clan details')).toBeLessThan(content.indexOf('### Clan rank'));
    expect(content).toContain('**Total matches:** N/A\n**Wins:** N/A • N/A\n**Losses:** N/A • N/A');
    expect(content).toContain('-# pointblank.id');
  });
  it('keeps missing rank progress as N/A without showing an empty progress bar or a broken logo', () => {
    const info = parseClanHtml('<div class="info"><div class="name">Clan</div></div>', clan, baseUrl);
    const output = clanProfile(info, undefined, true);
    expect(clanText(output)).toContain('### Clan rank\nN/A\n**Rank progress:** N/A');
    expect(clanText(output)).toContain('Clan logo is temporarily unavailable.');
    expect(clanText(output)).not.toContain('░');
    expect(output.files).toEqual([]);
    expect(output.components[0]!.toJSON().components.some(component => component.type === ComponentType.MediaGallery)).toBe(false);
  });
  it('bounds combined component text and suppresses mentions in upstream names', () => {
    const info = parseClanHtml(fixtureHtml, clan, baseUrl);
    info.name = '**@everyone**' + '😀'.repeat(3000);
    info.master = info.createdAt = info.rank.name = info.name;
    const output = clanProfile(info, Buffer.from('test-image'));
    expect(clanText(output).length).toBeLessThanOrEqual(4000);
    expect(clanText(output)).not.toContain('@everyone');
    expect(output.allowedMentions.parse).toEqual([]);
  });
  it('groups every requested player and clan statistic without exposing the identifier', () => {
    const player = parsePlayerSearch(playerSearchHtml, baseUrl)[0]!;
    const output = playerEmbed(normalizePlayerDetail(playerDetailJson, player));
    const embed = output.embeds[0]!.toJSON();
    expect(embed.thumbnail!.url).toBe(`${baseUrl}/images/common/icon_ranking/rank_46.png`);
    expect(embed.fields).toEqual([
      { name: 'Player Info', value: '**Game Ranking:** 71,209\n**Rank:** Brigadier\n**Total EXP:** 3,789,431\n\n**Kill:** 21,053\n**Death:** 11,687\n**Kill/Death Ratio:** 1.80\n\n**Headshot:** 18,968\n**Headshot Ratio:** 90.10%' },
      { name: 'Clan Info', value: '**Name:** AutoWin\n**Members:** 28\n**Ranking:** 1,391,886' },
    ]);
    expect(JSON.stringify(embed)).not.toContain(player.env);
    expect(output.allowedMentions.parse).toEqual([]);
  });
  it('shows unavailable fields and undefined ratios as N/A and omits an unavailable icon', () => {
    const player = { nickname: '**@everyone**', env: 'synthetic', ranking: null, rankName: null, exp: null, rankIconUrl: null };
    const output = playerEmbed(normalizePlayerDetail({ Kill: '0', Death: '0' }, player));
    const embed = output.embeds[0]!.toJSON();
    expect(embed.fields![0]!.value).toContain('**Kill/Death Ratio:** N/A');
    expect(embed.fields![0]!.value).toContain('**Headshot Ratio:** N/A');
    expect(embed.fields![0]!.value).toContain('**Kill:** 0\n**Death:** 0');
    expect(embed.fields![1]!.value).toBe('**Name:** N/A\n**Members:** N/A\n**Ranking:** N/A');
    expect(embed.thumbnail).toBeUndefined();
    expect(embed.title).not.toContain('@everyone');
  });
  it('escapes upstream text and bounds each grouped field within Discord limits', () => {
    const longName = '**@everyone**' + '😀'.repeat(3000);
    const player = { nickname: longName, env: 'synthetic', ranking: null, rankName: longName, exp: null, rankIconUrl: null };
    const output = playerEmbed(normalizePlayerDetail({ Exp: '0', ClanName: longName }, player));
    const embed = output.embeds[0]!.toJSON();
    expect(embed.title!.length).toBeLessThanOrEqual(256);
    expect(embed.fields!.every(field => field.value.length <= 1024)).toBe(true);
    expect(output.embeds[0]!.length).toBeLessThanOrEqual(6000);
    expect(JSON.stringify(embed)).not.toContain('@everyone');
    expect(output.allowedMentions.parse).toEqual([]);
  });
});
