import { AttachmentBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import type { ClanInfo } from '../models/clan.model.js';
import { displayText, formatNumber, formatPercentage, formatProgressBar, truncate } from '../utils/formatter.js';
import { rankIconAsset } from '../utils/rank-icon.js';

export function clanProfile(info: ClanInfo, logo?: Buffer, logoUnavailable = false, rankEmoji: string | null = null) {
  const text = (content: string) => new TextDisplayBuilder().setContent(content);
  const container = new ContainerBuilder().setAccentColor(0x2b8a6e);
  const files: AttachmentBuilder[] = [];
  if (logo) {
    const description = truncate(`${info.name} clan logo`, 1024);
    files.push(new AttachmentBuilder(logo, { name: 'clan-logo.png', description }));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL('attachment://clan-logo.png').setDescription(description),
    ));
  }
  container.addTextDisplayComponents(text(`# ${displayText(info.name, 256)}`));
  if (logoUnavailable) container.addTextDisplayComponents(text('-# Clan logo is temporarily unavailable.'));
  container.addTextDisplayComponents(text([
    '### Clan details',
    `**Master:** ${displayText(info.master, 400)}`,
    `**Members:** ${formatNumber(info.memberCount)} / ${formatNumber(info.maxMembers)}`,
    `**Created:** ${displayText(info.createdAt, 400)}`,
  ].join('\n')));
  container.addSeparatorComponents(new SeparatorBuilder());
  const asset = rankIconAsset(info.rank.iconUrl, 'clan');
  const badge = asset ? rankEmoji ?? `[Rank badge](${asset.url})` : null;
  const rank = text(`### Clan rank\n${badge ? `${badge} ` : ''}${displayText(info.rank.name, 256)}`);
  const progress = text(`**Rank progress:** ${formatProgressBar(info.rank.progressPercentage)}`);
  container.addTextDisplayComponents(rank, progress);
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(text([
    '### Overall match record',
    `**Total matches:** ${formatNumber(info.statistics.totalMatches)}`,
    `**Wins:** ${formatNumber(info.statistics.wins)} • ${formatPercentage(info.statistics.winRate)}`,
    `**Losses:** ${formatNumber(info.statistics.losses)} • ${formatPercentage(info.statistics.lossRate)}`,
  ].join('\n')));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(text(`-# pointblank.id • Updated <t:${Math.floor(Date.now() / 1000)}:R>`));
  return { flags: MessageFlags.IsComponentsV2 as const, components: [container], files, allowedMentions: { parse: [] as never[] } };
}
