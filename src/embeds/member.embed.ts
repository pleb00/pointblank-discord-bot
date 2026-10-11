import { EmbedBuilder } from 'discord.js';
import type { MemberDetail } from '../models/member.model.js';
import { displayText, formatNumber } from '../utils/formatter.js';

export function memberEmbed(detail: MemberDetail, clanName: string) {
  const embed = new EmbedBuilder().setColor(0x2b8a6e).setTitle(`Player Information — ${displayText(detail.nickname, 230)}`)
    .setDescription(`Clan: ${displayText(detail.clanName ?? clanName)}`)
    .addFields(
      { name: 'EXP', value: formatNumber(detail.exp), inline: true },
      { name: 'Kills', value: formatNumber(detail.kills), inline: true },
      { name: 'Deaths', value: formatNumber(detail.deaths), inline: true },
      { name: 'Headshots', value: formatNumber(detail.headshots), inline: true },
    ).setFooter({ text: 'pointblank.id • Unavailable values: N/A' }).setTimestamp();
  if (detail.rankIconUrl) embed.setThumbnail(detail.rankIconUrl);
  return { embeds: [embed], allowedMentions: { parse: [] as never[] } };
}
