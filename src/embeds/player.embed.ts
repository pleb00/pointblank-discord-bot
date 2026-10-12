import { EmbedBuilder } from 'discord.js';
import type { PlayerDetail } from '../models/member.model.js';
import { displayText, formatNumber, formatRatio } from '../utils/formatter.js';

export function playerEmbed(player: PlayerDetail) {
  const embed = new EmbedBuilder().setColor(0x2b8a6e).setTitle(`${displayText(player.nickname, 230)}`)
    .addFields(
      {
        name: 'Player Info',
        value: [
          `**Game Ranking:** ${formatNumber(player.ranking)}`,
          `**Rank:** ${displayText(player.rankName, 200)}`,
          `**Total EXP:** ${formatNumber(player.exp)}`,
          '',
          `**Kill:** ${formatNumber(player.kills)}`,
          `**Death:** ${formatNumber(player.deaths)}`,
          `**Kill/Death Ratio:** ${formatRatio(player.killDeathRatio)}`,
          '',
          `**Headshot:** ${formatNumber(player.headshots)}`,
          `**Headshot Ratio:** ${formatRatio(player.headshotRatio, true)}`,
        ].join('\n'),
      },
      {
        name: 'Clan Info',
        value: [
          `**Name:** ${displayText(player.clanName, 800)}`,
          `**Members:** ${formatNumber(player.clanMemberCount)}`,
          `**Ranking:** ${formatNumber(player.clanRanking)}`,
        ].join('\n'),
      },
    ).setFooter({ text: 'pointblank.id • Unavailable values: N/A' }).setTimestamp();
  if (player.rankIconUrl) embed.setThumbnail(player.rankIconUrl);
  return { embeds: [embed], allowedMentions: { parse: [] as never[] } };
}
