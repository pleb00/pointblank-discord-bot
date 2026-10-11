import { SlashCommandBuilder } from 'discord.js';
import type { CommandHandler } from './command.js';
import { clanProfile } from '../embeds/clan-profile.js';
import { safeError } from '../utils/errors.js';

export const infoClanCommand = new SlashCommandBuilder().setName('info-clan').setDescription('Show a configured Point Blank clan profile')
  .addStringOption(option => option.setName('clan').setDescription('Configured clan (uses the default if omitted)').setAutocomplete(true));

export const executeInfoClan: CommandHandler = async (interaction, context) => {
  await interaction.deferReply();
  const clan = context.registry.resolve(interaction.options.getString('clan'));
  const snapshot = await context.clans.getSnapshot(clan);
  let logo: Buffer | undefined;
  try { logo = await context.logos.getLogo(snapshot); }
  catch (error) { context.logger.warn({ clanId: clan.id, ...safeError(error) }, 'Clan logo failed'); }
  const rankEmoji = await context.rankEmojis.forClan(snapshot.info.rank.iconUrl);
  await interaction.editReply(clanProfile(snapshot.info, logo, !logo, rankEmoji));
};
