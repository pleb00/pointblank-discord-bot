import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { ClanMember } from '../models/member.model.js';
import { displayText, formatNumber } from '../utils/formatter.js';
import { rankIconAsset } from '../utils/rank-icon.js';

function rankDisplay(member: ClanMember, rankEmojis: ReadonlyMap<string, string>): string {
  const asset = rankIconAsset(member.rankIconUrl);
  if (!asset) return 'Rank N/A';
  return rankEmojis.get(member.rankIconUrl!) ?? `[Rank](${asset.url})`;
}

export function rosterPage(clanName: string, members: ClanMember[], requestedPage: number, pageSize: number, session: string, expired = false, rankEmojis: ReadonlyMap<string, string> = new Map()) {
  const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));
  const start = page * pageSize;
  const lines = members.slice(start, start + pageSize).map((member, index) => {
    const prefix = `${start + index + 1}. ${rankDisplay(member, rankEmojis)} **`;
    // Twenty rows of at most 200 characters remain below the description limit.
    return `${prefix}${displayText(member.nickname, Math.min(120, 200 - prefix.length - 2))}**`;
  });
  const embed = new EmbedBuilder().setColor(0x2b8a6e).setTitle(`Clan Members ${displayText(clanName, 230)}`)
    .setDescription(lines.join('\n') || 'This clan has no members.')
    .addFields({ name: 'Total members', value: formatNumber(members.length) })
    .setFooter({ text: `Page ${page + 1} / ${totalPages}${expired ? ' • Navigation expired; run /info-member again' : ''}` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`roster:${session}:prev`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(expired || page === 0),
    new ButtonBuilder().setCustomId(`roster:${session}:next`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(expired || page >= totalPages - 1),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] as never[] } };
}
