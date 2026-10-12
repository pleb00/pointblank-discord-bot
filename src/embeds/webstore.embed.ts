import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { webstoreCategories, type WebstorePage } from '../models/webstore.model.js';
import { displayText, formatNumber, formatPercentage } from '../utils/formatter.js';

export const WEBSTORE_ITEMS_PER_VIEW = 5;

export function webstoreViewCount(page: WebstorePage): number {
  return Math.max(1, Math.ceil(page.products.length / WEBSTORE_ITEMS_PER_VIEW));
}

export function webstorePage(page: WebstorePage, view: number, session: string, expired = false) {
  const start = view * WEBSTORE_ITEMS_PER_VIEW;
  const products = page.products.slice(start, start + WEBSTORE_ITEMS_PER_VIEW);
  const embeds = products.map(product => {
    const lines = [`**Price:** ${formatNumber(product.price)} ${product.currency ?? '(currency N/A)'}`];
    if (page.category === 'sale' || product.originalPrice !== null || product.discountPercent !== null) lines.push(`**Original price:** ${formatNumber(product.originalPrice)}`);
    if (page.category === 'sale' || product.discountPercent !== null) lines.push(`**Discount:** ${formatPercentage(product.discountPercent)}`);
    if (page.category === 'star' || product.rating !== null) lines.push(`**Rating:** ${product.rating === null ? 'N/A' : `${product.rating.toFixed(1)} / 5`}`);
    if (product.tags.length) lines.push(displayText(product.tags.join(' · '), 200));
    const embed = new EmbedBuilder().setColor(0xe9a23b).setTitle(displayText(product.name, 240))
      .setURL(product.url).setDescription(lines.join('\n'));
    if (product.imageUrl) embed.setThumbnail(product.imageUrl);
    return embed;
  });
  if (!embeds.length) embeds.push(new EmbedBuilder().setColor(0xe9a23b).setDescription('No products are listed on this catalogue page.'));
  embeds.at(-1)!.setFooter({ text: `Point Blank webstore${expired ? ' · Navigation expired; run /webstore again' : ''}` }).setTimestamp(page.fetchedAt);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`webstore:${session}:prev`).setLabel('Previous').setStyle(ButtonStyle.Secondary)
      .setDisabled(expired || (page.page === 1 && view === 0)),
    new ButtonBuilder().setCustomId(`webstore:${session}:next`).setLabel('Next').setStyle(ButtonStyle.Secondary)
      .setDisabled(expired || (page.page === page.totalPages && view >= webstoreViewCount(page) - 1)),
  );
  const items = products.length ? ` · Items ${start + 1}–${start + products.length} / ${page.products.length}` : '';
  return {
    content: `### Webstore — ${webstoreCategories[page.category].label}\n[Catalogue page ${page.page} / ${page.totalPages}](${page.sourceUrl})${items}`,
    embeds, components: [row], allowedMentions: { parse: [] as never[] },
  };
}
