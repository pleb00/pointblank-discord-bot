import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ChatInputCommandInteraction, type Interaction, MessageFlags } from 'discord.js';
import { activeWebstores, stopWebstores, webstoreCommand } from '../src/commands/webstore.command.js';
import type { CommandContext } from '../src/commands/command.js';
import type { WebstoreCategory, WebstorePage } from '../src/models/webstore.model.js';
import { handleInteraction } from '../src/events/interaction.event.js';
import { parseWebstoreHtml } from '../src/parsers/webstore.parser.js';
import { webstoreUrl } from '../src/clients/pointblank.client.js';
import { webstorePage } from '../src/embeds/webstore.embed.js';
import { AppError } from '../src/utils/errors.js';
import { createLogger } from '../src/utils/logger.js';
import { baseUrl, testEnvironment } from './helpers.js';

function catalogue(category: WebstoreCategory = 'trending', page = 1) {
  const name = `webstore-${category}${page > 1 ? `-${page}` : ''}.html`;
  return parseWebstoreHtml(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'), category, page, webstoreUrl(baseUrl, category, page).href);
}
function setup(category: WebstoreCategory = 'trending', startPage: number | null = null) {
  const emitter = new EventEmitter();
  const collector = Object.assign(emitter, { stop: vi.fn(() => { emitter.emit('end'); }) });
  const message = { id: 'webstore-test-message', createMessageComponentCollector: vi.fn(() => collector) };
  const state = { deferred: false };
  const interaction = {
    commandName: 'webstore', user: { id: 'owner' },
    get deferred() { return state.deferred; }, replied: false,
    options: { getString: () => category, getInteger: () => startPage },
    deferReply: vi.fn(async () => { state.deferred = true; }),
    editReply: vi.fn(async (_payload: unknown) => message),
    reply: vi.fn().mockResolvedValue(undefined),
    isAutocomplete: () => false, isButton: () => false, isChatInputCommand: () => true, isRepliable: () => true,
  };
  const context = {
    webstore: { getPage: vi.fn(async (selected: WebstoreCategory, page: number) => catalogue(selected, page)) },
    env: testEnvironment, logger: createLogger('silent'),
  };
  const run = () => handleInteraction(interaction as unknown as ChatInputCommandInteraction, context as unknown as CommandContext);
  const last = () => interaction.editReply.mock.calls.at(-1)![0] as ReturnType<typeof webstorePage>;
  function click(direction: 'prev' | 'next' = 'next', user = 'owner') {
    const buttonData = last().components[0]!.toJSON().components[direction === 'prev' ? 0 : 1]!;
    if (!('custom_id' in buttonData)) throw new Error('Expected a button');
    const button = { customId: buttonData.custom_id, user: { id: user }, reply: vi.fn().mockResolvedValue(undefined), deferUpdate: vi.fn().mockResolvedValue(undefined), followUp: vi.fn().mockResolvedValue(undefined) };
    collector.emit('collect', button);
    return button;
  }
  return { interaction, context, collector, message, run, last, click };
}

afterEach(() => { stopWebstores(); });

describe('/webstore command', () => {
  it('registers the requested four choices and an optional positive starting page', () => {
    const command = webstoreCommand.toJSON();
    expect(command.name).toBe('webstore');
    expect(command.options?.map(option => ({ name: option.name, required: option.required ?? false }))).toEqual([
      { name: 'category', required: true }, { name: 'page', required: false },
    ]);
    expect(command.options?.[0]).toMatchObject({ choices: [
      { name: 'Trending', value: 'trending' }, { name: 'New', value: 'new' }, { name: 'Sale', value: 'sale' }, { name: 'Star', value: 'star' },
    ] });
    expect(command.options?.[1]).toMatchObject({ min_value: 1 });
  });
  it('defers and routes to the webstore service, with original product thumbnails and links', async () => {
    const { run, context, interaction, last } = setup();
    await run();
    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(context.webstore.getPage).toHaveBeenCalledExactlyOnceWith('trending', 1);
    expect(last().embeds).toHaveLength(5);
    expect(last().embeds[0]!.toJSON()).toMatchObject({ title: 'Red Deluxe Box', thumbnail: { url: expect.stringContaining('cdn2.pointblank.id') }, url: expect.stringContaining('productIdx=1000000575') });
    expect(last().content).toContain('Trending Now');
    expect(last().content).toContain('Items 1–5 / 10');
    expect(last().components[0]!.toJSON().components[0]!.disabled).toBe(true);
  });
  it('moves locally, then lazily fetches page two, and serializes rapid clicks', async () => {
    const { run, context, interaction, last, click } = setup();
    await run();
    const first = click();
    click();
    expect(first.deferUpdate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(3));
    expect(context.webstore.getPage.mock.calls).toEqual([['trending', 1], ['trending', 2]]);
    expect(last().content).toContain('Catalogue page 2 / 8');
    expect(last().content).toContain('Items 1–5 / 10');
    click('prev');
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(4));
    expect(last().content).toContain('Catalogue page 1 / 8');
    expect(last().content).toContain('Items 6–10 / 10');
  });
  it('denies foreign users and never lets them issue upstream requests', async () => {
    const { run, click, context, interaction } = setup();
    await run();
    const foreign = click('next', 'different-user');
    expect(foreign.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    expect(foreign.deferUpdate).not.toHaveBeenCalled();
    expect(context.webstore.getPage).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledOnce();
  });
  it('starts on the requested catalogue page and prevents navigating beyond the last page', async () => {
    const { run, click, context, last, interaction } = setup('trending', 8);
    await run();
    expect(context.webstore.getPage).toHaveBeenCalledExactlyOnceWith('trending', 8);
    expect(last().content).toContain('Catalogue page 8 / 8');
    expect(last().components[0]!.toJSON().components[1]!.disabled).toBe(true);
    click();
    await new Promise(resolve => setImmediate(resolve));
    expect(context.webstore.getPage).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledOnce();
  });
  it('avoids a collector for the single-page New catalogue', async () => {
    const { run, message, last } = setup('new');
    await run();
    expect(message.createMessageComponentCollector).not.toHaveBeenCalled();
    expect(last().components[0]!.toJSON().components.every(button => button.disabled)).toBe(true);
  });
  it('keeps the current catalogue after an upstream failure and permits retrying', async () => {
    const { run, click, context, interaction, last, collector } = setup();
    await run();
    click();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(2));
    context.webstore.getPage.mockRejectedValueOnce(new AppError('RATE_LIMIT', 'Point Blank request limit reached. Try again later.'));
    const failure = click();
    await vi.waitFor(() => expect(failure.followUp).toHaveBeenCalledOnce());
    expect(failure.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: 'Point Blank request limit reached. Try again later.', flags: MessageFlags.Ephemeral }));
    expect(last().content).toContain('Catalogue page 1 / 8');
    expect(collector.stop).not.toHaveBeenCalled();
    click();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(3));
    expect(last().content).toContain('Catalogue page 2 / 8');
  });
  it('disables controls on expiry and cannot re-enable them when a pending fetch finishes', async () => {
    const { run, click, context, interaction, last, collector, message } = setup();
    await run();
    click();
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(2));
    let complete!: (page: WebstorePage) => void;
    context.webstore.getPage.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    click();
    await vi.waitFor(() => expect(context.webstore.getPage).toHaveBeenCalledTimes(2));
    collector.stop();
    expect(activeWebstores.has(message.id)).toBe(false);
    complete(catalogue('trending', 2));
    await vi.waitFor(() => expect(interaction.editReply).toHaveBeenCalledTimes(4));
    for (const call of interaction.editReply.mock.calls.slice(2)) {
      const payload = call[0] as ReturnType<typeof webstorePage>;
      expect(payload.components[0]!.toJSON().components.every(button => button.disabled)).toBe(true);
    }
    expect(last().embeds.at(-1)!.toJSON().footer!.text).toContain('Navigation expired');
  });
  it('returns readable initial errors without leaking raw exceptions', async () => {
    const { run, context, interaction } = setup();
    context.webstore.getPage.mockRejectedValue(new Error('private upstream payload'));
    await run();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: 'An unexpected error occurred. Please try again later.' }));
  });
  it('responds to stale controls after restart and leaves active collectors in charge', async () => {
    const { context, run, message } = setup();
    const reply = vi.fn().mockResolvedValue(undefined);
    const button = { isAutocomplete: () => false, isButton: () => true, customId: 'webstore:old:next', message: { id: 'old-message' }, reply };
    await handleInteraction(button as unknown as Interaction, context as unknown as CommandContext);
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'This catalogue navigation expired. Run /webstore again.' }));
    await run();
    reply.mockClear();
    button.message.id = message.id;
    await handleInteraction(button as unknown as Interaction, context as unknown as CommandContext);
    expect(reply).not.toHaveBeenCalled();
  });
});

describe('webstore presentation bounds', () => {
  it('escapes hostile names/tags, displays nulls as N/A and remains below Discord limits', () => {
    const page = catalogue('star');
    // Synthetic hostile text and missing values, based on the observed product structure.
    page.products = Array.from({ length: 25 }, () => ({ ...page.products[0]!, name: '**@everyone**'.repeat(100), tags: ['@here*'.repeat(500)], rating: null, price: null, currency: null, discountPercent: null }));
    const payload = webstorePage(page, 0, 'synthetic-session');
    const embeds = payload.embeds.map(embed => embed.toJSON());
    expect(embeds).toHaveLength(5);
    expect(embeds[0]!.title).toContain('@\u200beveryone');
    expect(embeds[0]!.description).toContain('**Price:** N/A');
    expect(embeds[0]!.description).toContain('**Rating:** N/A');
    expect(embeds.every(embed => embed.title!.length <= 256 && embed.description!.length <= 4096)).toBe(true);
    expect(embeds.reduce((sum, embed) => sum + (embed.title?.length ?? 0) + (embed.description?.length ?? 0) + (embed.footer?.text.length ?? 0), 0)).toBeLessThan(6000);
    expect(payload.allowedMentions).toEqual({ parse: [] });
  });
});
