import { randomUUID } from 'node:crypto';
import { ComponentType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { CommandHandler } from './command.js';
import { isWebstoreCategory } from '../models/webstore.model.js';
import { webstorePage, webstoreViewCount } from '../embeds/webstore.embed.js';
import { AppError, publicError, safeError } from '../utils/errors.js';

export const activeWebstores = new Set<string>();
const webstoreClosers = new Map<string, () => void>();

export function stopWebstores(): void {
  for (const close of webstoreClosers.values()) close();
}

export const webstoreCommand = new SlashCommandBuilder().setName('webstore').setDescription('Browse the Point Blank webstore catalogue')
  .addStringOption(option => option.setName('category').setDescription('Catalogue category').setRequired(true).addChoices(
    { name: 'Trending', value: 'trending' }, { name: 'New', value: 'new' },
    { name: 'Sale', value: 'sale' }, { name: 'Star', value: 'star' },
  ))
  .addIntegerOption(option => option.setName('page').setDescription('Starting catalogue page (default: 1)').setMinValue(1));

export const executeWebstore: CommandHandler = async (interaction, context) => {
  await interaction.deferReply();
  const category = interaction.options.getString('category', true);
  if (!isWebstoreCategory(category)) throw new AppError('CONFIG_INVALID', 'Choose Trending, New, Sale or Star.');
  let page = await context.webstore.getPage(category, interaction.options.getInteger('page') ?? 1);
  let view = 0;
  let expired = false;
  const session = randomUUID();
  const message = await interaction.editReply(webstorePage(page, view, session));
  if (page.totalPages === 1 && webstoreViewCount(page) === 1) return;
  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: context.env.PAGINATION_TIMEOUT_SECONDS * 1000 });
  activeWebstores.add(message.id);
  webstoreClosers.set(message.id, () => collector.stop('shutdown'));
  let queue = Promise.resolve();
  collector.on('collect', button => {
    const action = button.customId === `webstore:${session}:prev` ? -1 : button.customId === `webstore:${session}:next` ? 1 : 0;
    if (!action) return;
    if (button.user.id !== interaction.user.id) {
      void button.reply({ content: 'Only the person who requested this catalogue can change pages.', flags: MessageFlags.Ephemeral })
        .catch(error => context.logger.debug(safeError(error), 'Could not respond to webstore navigation'));
      return;
    }
    const acknowledged = button.deferUpdate().then(() => true).catch(error => {
      context.logger.debug(safeError(error), 'Webstore button acknowledgement failed');
      return false;
    });
    queue = queue.then(async () => {
      if (!await acknowledged || expired) return;
      let nextPage = page;
      let nextView = view + action;
      try {
        if (nextView < 0) {
          if (page.page === 1) return;
          nextPage = await context.webstore.getPage(category, page.page - 1);
          nextView = webstoreViewCount(nextPage) - 1;
        } else if (nextView >= webstoreViewCount(page)) {
          if (page.page === page.totalPages) return;
          nextPage = await context.webstore.getPage(category, page.page + 1);
          nextView = 0;
        }
      } catch (error) {
        context.logger.warn(safeError(error), 'Webstore page retrieval failed');
        await button.followUp({ content: publicError(error), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
      }
      await interaction.editReply(webstorePage(nextPage, nextView, session, expired));
      page = nextPage;
      view = nextView;
    }).catch(error => {
      context.logger.warn(safeError(error), 'Webstore navigation failed');
      collector.stop('unavailable');
    });
  });
  collector.on('end', () => {
    expired = true;
    activeWebstores.delete(message.id);
    webstoreClosers.delete(message.id);
    void queue.then(() => interaction.editReply(webstorePage(page, view, session, true)))
      .catch(error => context.logger.debug(safeError(error), 'Could not disable expired webstore navigation'));
  });
};
