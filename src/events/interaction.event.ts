import { MessageFlags, TextDisplayBuilder, type Interaction } from 'discord.js';
import { clanAutocomplete, type CommandContext } from '../commands/command.js';
import { executeInfoClan } from '../commands/info-clan.command.js';
import { activeRosters, executeInfoMember } from '../commands/info-member.command.js';
import { executeInfoPlayer } from '../commands/info-player.command.js';
import { activeWebstores, executeWebstore } from '../commands/webstore.command.js';
import { publicError, safeError } from '../utils/errors.js';

export async function handleInteraction(interaction: Interaction, context: CommandContext): Promise<void> {
  try {
    if (interaction.isAutocomplete()) { await clanAutocomplete(interaction, context); return; }
    // Active roster collectors own their messages. Old buttons receive a useful private response.
    if (interaction.isButton() && interaction.customId.startsWith('roster:')) {
      if (!activeRosters.has(interaction.message.id)) {
        await interaction.reply({ content: 'This roster navigation expired. Run /info-member again.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('webstore:')) {
      if (!activeWebstores.has(interaction.message.id)) {
        await interaction.reply({ content: 'This catalogue navigation expired. Run /webstore again.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    switch (interaction.commandName) {
      case 'info-clan': await executeInfoClan(interaction, context); break;
      case 'info-member': await executeInfoMember(interaction, context); break;
      case 'info-player': await executeInfoPlayer(interaction, context); break;
      case 'webstore': await executeWebstore(interaction, context); break;
      default: await interaction.reply({ content: 'This command is unavailable. Refresh the bot commands.', flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    context.logger.error({ ...safeError(error), ...(interaction.isChatInputCommand() ? { command: interaction.commandName } : {}) }, 'Interaction failed');
    try {
      if (interaction.isAutocomplete()) { if (!interaction.responded) await interaction.respond([]); }
      else if (interaction.isRepliable()) {
        const content = publicError(error);
        if (interaction.deferred || interaction.replied) {
          // A Components V2 response cannot later be edited back to legacy content.
          if (interaction.isChatInputCommand() && interaction.commandName === 'info-clan') {
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [new TextDisplayBuilder().setContent(content)], attachments: [], allowedMentions: { parse: [] } });
          } else await interaction.editReply({ content, embeds: [], components: [], attachments: [], allowedMentions: { parse: [] } });
        }
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      }
    } catch (responseError) { context.logger.warn(safeError(responseError), 'Interaction expired or reply could not be delivered'); }
  }
}
