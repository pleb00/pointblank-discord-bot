import { randomUUID } from 'node:crypto';
import { ComponentType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { CommandHandler } from './command.js';
import { rosterPage } from '../embeds/roster.embed.js';
import { sortMembersByRank } from '../services/member.service.js';
import { safeError } from '../utils/errors.js';

export const activeRosters = new Set<string>();
const rosterClosers = new Map<string, () => void>();

export function stopRosters(): void {
  for (const close of rosterClosers.values()) close();
}

export const infoMemberCommand = new SlashCommandBuilder().setName('info-member').setDescription('List the members of a configured clan')
  .addStringOption(option => option.setName('clan').setDescription('Configured clan (uses the default if omitted)').setAutocomplete(true));

export const executeInfoMember: CommandHandler = async (interaction, context) => {
  await interaction.deferReply();
  const clan = context.registry.resolve(interaction.options.getString('clan'));
  const { info, members: rosterMembers } = await context.clans.getRoster(clan);
  const members = sortMembersByRank(rosterMembers);
  const rankEmojis = await context.rankEmojis.forMembers(members);
  const session = randomUUID();
  const pageSize = context.env.ROSTER_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
  let page = 0;
  const message = await interaction.editReply(rosterPage(info.name, members, page, pageSize, session, false, rankEmojis));
  if (totalPages <= 1) return;
  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: context.env.PAGINATION_TIMEOUT_SECONDS * 1000 });
  activeRosters.add(message.id);
  rosterClosers.set(message.id, () => collector.stop('shutdown'));
  let queue = Promise.resolve();
  collector.on('collect', button => {
    const action = button.customId === `roster:${session}:prev` ? -1 : button.customId === `roster:${session}:next` ? 1 : 0;
    if (!action) return;
    if (button.user.id !== interaction.user.id) {
      void button.reply({ content: 'Only the person who requested this roster can change pages.', flags: MessageFlags.Ephemeral })
        .catch(error => context.logger.debug(safeError(error), 'Could not respond to roster navigation'));
      return;
    }
    // Acknowledge immediately; serialize edits so rapid clicks cannot reorder the pages.
    const acknowledged = button.deferUpdate().then(() => true).catch(error => {
      context.logger.debug(safeError(error), 'Roster button acknowledgement failed');
      return false;
    });
    queue = queue.then(async () => {
      if (!await acknowledged) return;
      page = Math.max(0, Math.min(page + action, totalPages - 1));
      await interaction.editReply(rosterPage(info.name, members, page, pageSize, session, false, rankEmojis));
    }).catch(error => {
      context.logger.warn(safeError(error), 'Roster navigation failed');
      collector.stop('unavailable');
    });
  });
  collector.on('end', () => {
    activeRosters.delete(message.id);
    rosterClosers.delete(message.id);
    void queue.then(() => interaction.editReply(rosterPage(info.name, members, page, pageSize, session, true, rankEmojis)))
      .catch(error => context.logger.debug(safeError(error), 'Could not disable expired roster navigation'));
  });
};
