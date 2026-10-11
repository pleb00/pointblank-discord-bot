import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { ClanInfo } from '../models/clan.model.js';
import { displayText, formatNumber, formatPercentage, truncate } from '../utils/formatter.js';

export function clanEmbed(info: ClanInfo, logo?: Buffer, logoUnavailable = false) {
  const embed = new EmbedBuilder().setColor(0x2b8a6e).setTitle(displayText(info.name, 256))
    .setAuthor({
      name: truncate(`${info.rank.name || 'N/A'}`, 256),
      ...(info.rank.iconUrl ? { iconURL: info.rank.iconUrl } : {}),
    })
    .addFields(
      {
        name: 'Clan details',
        value: [
          `**Master:** ${displayText(info.master, 400)}`,
          `**Members:** ${formatNumber(info.memberCount)} / ${formatNumber(info.maxMembers)}`,
          `**Created:** ${displayText(info.createdAt, 400)}`,
        ].join('\n'),
      },
      { name: 'Rank progress', value: formatPercentage(info.rank.progressPercentage) },
      {
        name: 'Overall match record',
        value: [
          `**Total matches:** ${formatNumber(info.statistics.totalMatches)}`,
          `**Wins:** ${formatNumber(info.statistics.wins)} • ${formatPercentage(info.statistics.winRate)}`,
          `**Losses:** ${formatNumber(info.statistics.losses)} • ${formatPercentage(info.statistics.lossRate)}`,
        ].join('\n'),
      },
    ).setFooter({ text: 'pointblank.id' }).setTimestamp();
  if (logoUnavailable) embed.setDescription('Clan logo is temporarily unavailable.');
  const files: AttachmentBuilder[] = [];
  if (logo) {
    files.push(new AttachmentBuilder(logo, { name: 'clan-logo.png' }));
    embed.setImage('attachment://clan-logo.png');
  }
  return { embeds: [embed], files, allowedMentions: { parse: [] as never[] } };
}
