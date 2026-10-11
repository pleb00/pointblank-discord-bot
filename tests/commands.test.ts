import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { MessageFlags, TextDisplayBuilder } from 'discord.js';
import { executeInfoClan } from '../src/commands/info-clan.command.js';
import { activeRosters, executeInfoMember, stopRosters } from '../src/commands/info-member.command.js';
import type { CommandContext } from '../src/commands/command.js';
import type { ClanMember } from '../src/models/member.model.js';
import { ClanRegistry, validateClanConfig } from '../src/config/clan-config.js';
import { handleInteraction } from '../src/events/interaction.event.js';
import { parseClanHtml } from '../src/parsers/clan.parser.js';
import { parseMemberList } from '../src/parsers/member.parser.js';
import { rosterPage } from '../src/embeds/roster.embed.js';
import { clanProfile } from '../src/embeds/clan-profile.js';
import { AppError } from '../src/utils/errors.js';
import { createLogger } from '../src/utils/logger.js';
import { baseUrl, clan, fixtureHtml, testEnvironment } from './helpers.js';

function setup(commandName = 'info-member', options: Record<string, string | null> = {}) {
  const emitter = new EventEmitter();
  const collector = Object.assign(emitter, { stop: vi.fn(() => { emitter.emit('end'); }) });
  const message = { id: 'test-message', createMessageComponentCollector: vi.fn(() => collector) };
  const state = { deferred: false, replied: false };
  const interaction = {
    commandName, user: { id: 'owner' },
    get deferred() { return state.deferred; },
    get replied() { return state.replied; },
    options: { getString: (name: string) => options[name] ?? null },
    deferReply: vi.fn(async () => { state.deferred = true; }),
    editReply: vi.fn(async (_payload: unknown) => message),
    reply: vi.fn(async (_payload: unknown) => { state.replied = true; }),
    isAutocomplete: () => false, isButton: () => false,
    isChatInputCommand: () => true, isRepliable: () => true,
  };
  const context = {
    registry: new ClanRegistry(validateClanConfig({ defaultClan: clan.id, clans: [clan] })),
    clans: {
      getSnapshot: vi.fn().mockResolvedValue({ info: parseClanHtml(fixtureHtml, clan, baseUrl), html: fixtureHtml, sourceUrl: `${baseUrl}/clan/myclan` }),
      getRoster: vi.fn().mockResolvedValue({ info: { name: 'Hepatica' }, members: Array.from({ length: 31 }, (_, i) => ({ nickname: `Member ${i}`, env: `id${i}`, rankIconUrl: `${baseUrl}/images/common/icon_ranking/rank_46.png` })) }),
    },
    members: { getDetail: vi.fn().mockResolvedValue({ nickname: 'pLebb', exp: 1, kills: 2, deaths: 3, headshots: 4, rankIconUrl: null, clanName: 'Hepatica' }) },
    logos: { getLogo: vi.fn().mockResolvedValue(Buffer.from('image')) },
    rankEmojis: {
      forMembers: vi.fn().mockResolvedValue(new Map([[`${baseUrl}/images/common/icon_ranking/rank_46.png`, '<:pb_rank_46:123456789012345678>']])),
      forClan: vi.fn().mockResolvedValue('<:pb_clan_rank_34:123456789012345679>'),
    },
    env: { ...testEnvironment, DISCORD_TOKEN: 'test-only', DISCORD_CLIENT_ID: '123456789012345678' },
    logger: createLogger('silent'),
  };
  return { interaction, context, collector, message };
}

afterEach(() => { stopRosters(); });

describe('Discord command workflows', () => {
  it('defers a clan command and still edits a readable profile if rendering fails', async () => {
    const { interaction, context } = setup('info-clan');
    context.logos.getLogo.mockRejectedValue(new Error('raw-secret-render-error'));
    await executeInfoClan(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    expect(interaction.deferReply).toHaveBeenCalledOnce();
    const payload = interaction.editReply.mock.calls[0]![0] as ReturnType<typeof clanProfile>;
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(JSON.stringify(payload.components[0]!.toJSON())).toContain('temporarily unavailable');
    expect(context.rankEmojis.forClan).toHaveBeenCalledExactlyOnceWith(`${baseUrl}/images/common/icon_ranking/clan_34.png`);
    expect(JSON.stringify(payload.components[0]!.toJSON())).toContain('<:pb_clan_rank_34:123456789012345679> Recon Battalion');
    expect(context.rankEmojis.forMembers).not.toHaveBeenCalled();
  });
  it('preserves the clan rank name and original-image link when an emoji is unavailable', async () => {
    const { interaction, context } = setup('info-clan');
    context.rankEmojis.forClan.mockResolvedValue(null);
    await executeInfoClan(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    const payload = interaction.editReply.mock.calls[0]![0] as ReturnType<typeof clanProfile>;
    expect(JSON.stringify(payload.components[0]!.toJSON())).toContain(`[Rank badge](${baseUrl}/images/common/icon_ranking/clan_34.png) Recon Battalion`);
  });
  it('routes nick to individual details and skips roster pagination', async () => {
    const { interaction, context, message } = setup('info-member', { nick: 'pLebb' });
    await executeInfoMember(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    expect(context.members.getDetail).toHaveBeenCalledWith(clan, 'pLebb');
    expect(context.rankEmojis.forMembers).not.toHaveBeenCalled();
    expect(message.createMessageComponentCollector).not.toHaveBeenCalled();
  });
  it('restricts navigation to requester and disables expired controls', async () => {
    const { interaction, context, collector, message } = setup();
    await executeInfoMember(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    expect(activeRosters.has(message.id)).toBe(true);
    const first = interaction.editReply.mock.calls[0]![0] as ReturnType<typeof rosterPage>;
    expect(first.embeds[0]!.toJSON().description).toContain('1. <:pb_rank_46:123456789012345678> **Member 0**');
    const nextButton = first.components[0]!.toJSON().components[1]!;
    if (!('custom_id' in nextButton)) throw new Error('Expected a navigation button');
    const nextId = nextButton.custom_id;
    const foreign = { customId: nextId, user: { id: 'different' }, reply: vi.fn().mockResolvedValue(undefined), deferUpdate: vi.fn() };
    collector.emit('collect', foreign);
    expect(foreign.reply).toHaveBeenCalledOnce();
    expect(foreign.deferUpdate).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    const owner = { ...foreign, user: { id: 'owner' }, reply: vi.fn(), deferUpdate: vi.fn().mockResolvedValue(undefined) };
    collector.emit('collect', owner);
    collector.emit('collect', owner);
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(3));
    const lastPage = interaction.editReply.mock.calls[2]![0] as ReturnType<typeof rosterPage>;
    expect(lastPage.embeds[0]!.toJSON().footer!.text).toContain('Page 3 / 3');
    expect(lastPage.embeds[0]!.toJSON().description).toContain('31. <:pb_rank_46:123456789012345678> **Member 30**');
    collector.stop();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(4));
    const expired = interaction.editReply.mock.calls[3]![0] as ReturnType<typeof rosterPage>;
    expect(expired.components[0]!.toJSON().components.every(button => button.disabled)).toBe(true);
    expect(activeRosters.has(message.id)).toBe(false);
    expect(context.rankEmojis.forMembers).toHaveBeenCalledOnce();
    expect(expired.embeds[0]!.toJSON().description).toContain('<:pb_rank_46:123456789012345678>');
  });
  it('keeps numeric rank ordering across pages and expiry even when emojis are unavailable', async () => {
    const { interaction, context, collector } = setup();
    // Synthetic roster; asset numbers specify the requested ordering only.
    const member = (nickname: string, rank: number | null): ClanMember => ({
      nickname, env: `fixture-${nickname}`, rankIconUrl: rank === null ? null : `${baseUrl}/images/common/icon_ranking/rank_${rank}.png`,
    });
    const members = [
      member('Low', 2), member('Unknown', null), member('Tie first', 48), member('Middle', 10), member('High', 50),
      member('Tie second', 48), member('Rank 47', 47), member('Rank 46', 46), member('Rank 45', 45),
      member('Rank 44', 44), member('Rank 43', 43), member('Rank 42', 42),
    ];
    context.clans.getRoster.mockResolvedValue({ info: { name: 'Hepatica' }, members });
    context.env.ROSTER_PAGE_SIZE = 10;
    context.rankEmojis.forMembers.mockResolvedValue(new Map());
    await executeInfoMember(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    const first = interaction.editReply.mock.calls[0]![0] as ReturnType<typeof rosterPage>;
    const description = first.embeds[0]!.toJSON().description!;
    expect(description.split('\n').map(line => line.match(/\*\*(.+)\*\*$/)?.[1])).toEqual([
      'High', 'Tie first', 'Tie second', 'Rank 47', 'Rank 46', 'Rank 45', 'Rank 44', 'Rank 43', 'Rank 42', 'Middle',
    ]);
    expect(description).toContain(`1. [Rank](${baseUrl}/images/common/icon_ranking/rank_50.png) **High**`);
    const nextButton = first.components[0]!.toJSON().components[1]!;
    if (!('custom_id' in nextButton)) throw new Error('Expected a navigation button');
    collector.emit('collect', { customId: nextButton.custom_id, user: { id: 'owner' }, deferUpdate: vi.fn().mockResolvedValue(undefined) });
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(2));
    const second = interaction.editReply.mock.calls[1]![0] as ReturnType<typeof rosterPage>;
    expect(second.embeds[0]!.toJSON().description).toBe(
      `11. [Rank](${baseUrl}/images/common/icon_ranking/rank_2.png) **Low**\n12. Rank N/A **Unknown**`,
    );
    collector.stop();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(3));
    const expired = interaction.editReply.mock.calls[2]![0] as ReturnType<typeof rosterPage>;
    expect(expired.embeds[0]!.toJSON().description).toBe(second.embeds[0]!.toJSON().description);
    expect(context.rankEmojis.forMembers).toHaveBeenCalledOnce();
    expect(members.slice(0, 3).map(entry => entry.nickname)).toEqual(['Low', 'Unknown', 'Tie first']);
  });
  it('avoids collectors for a single page', async () => {
    const { interaction, context, message } = setup();
    context.clans.getRoster.mockResolvedValue({ info: { name: 'Hepatica' }, members: parseMemberList(fixtureHtml, baseUrl) });
    await executeInfoMember(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
    expect(message.createMessageComponentCollector).not.toHaveBeenCalled();
  });
});

describe('interaction error handling', () => {
  it('resolves deferred errors with readable messages', async () => {
    const { interaction, context } = setup('info-clan');
    context.clans.getSnapshot.mockRejectedValue(new AppError('ACCESS_REQUIRED', 'Public data requires login.'));
    await handleInteraction(interaction as unknown as Interaction, context as unknown as CommandContext);
    const payload = interaction.editReply.mock.calls[0]![0] as { flags: MessageFlags; components: TextDisplayBuilder[]; attachments: [] };
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload.components[0]!.toJSON().content).toBe('Public data requires login.');
    expect(payload.attachments).toEqual([]);
  });
  it('uses a compatible component response if sending the clan profile fails', async () => {
    const { interaction, context } = setup('info-clan');
    interaction.editReply.mockRejectedValueOnce(new Error('private-discord-request'));
    await handleInteraction(interaction as unknown as Interaction, context as unknown as CommandContext);
    expect(interaction.editReply).toHaveBeenCalledTimes(2);
    const payload = interaction.editReply.mock.calls[1]![0] as { flags: MessageFlags; components: TextDisplayBuilder[] };
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload.components[0]!.toJSON().content).toBe('An unexpected error occurred. Please try again later.');
    expect(payload).not.toHaveProperty('content');
    expect(payload).not.toHaveProperty('embeds');
  });
  it('does not expose unexpected errors or leave a rejected handler on expired replies', async () => {
    const { interaction, context } = setup();
    context.clans.getRoster.mockRejectedValue(new Error('secret-token-stack'));
    await handleInteraction(interaction as unknown as Interaction, context as unknown as CommandContext);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: 'An unexpected error occurred. Please try again later.' }));
    interaction.editReply.mockRejectedValue(new Error('Expired token'));
    await expect(handleInteraction(interaction as unknown as Interaction, context as unknown as CommandContext)).resolves.toBeUndefined();
  });
  it('responds to stale roster buttons after bot restart', async () => {
    const { context } = setup();
    const reply = vi.fn().mockResolvedValue(undefined);
    const stale = { isAutocomplete: () => false, isButton: () => true, customId: 'roster:old:next', message: { id: 'old-message' }, reply };
    await handleInteraction(stale as unknown as Interaction, context as unknown as CommandContext);
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('expired') }));
  });
});
