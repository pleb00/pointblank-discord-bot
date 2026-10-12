import { SlashCommandBuilder } from 'discord.js';
import type { CommandHandler } from './command.js';
import { playerEmbed } from '../embeds/player.embed.js';

export const infoPlayerCommand = new SlashCommandBuilder().setName('info-player').setDescription('Find a player by their complete nickname')
  .addStringOption(option => option.setName('nick').setDescription('Complete player nickname').setMaxLength(100).setRequired(true));

export const executeInfoPlayer: CommandHandler = async (interaction, context) => {
  await interaction.deferReply();
  const nickname = interaction.options.getString('nick', true);
  await interaction.editReply(playerEmbed(await context.members.getPlayer(nickname)));
};
