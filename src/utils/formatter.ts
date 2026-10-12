import { escapeMarkdown } from 'discord.js';

const numberFormatter = new Intl.NumberFormat('en-US');
const ratioFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const parsed = Number(text.replaceAll(',', ''));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function formatNumber(value: number | null): string {
  return value === null ? 'N/A' : numberFormatter.format(value);
}

export function formatRatio(value: number | null, percentage = false): string {
  return value === null || !Number.isFinite(value) ? 'N/A' : `${ratioFormatter.format(value)}${percentage ? '%' : ''}`;
}

export function formatPercentage(value: number | null): string {
  return value === null ? 'N/A' : `${Number(value.toFixed(2))}%`;
}

export function formatProgressBar(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return 'N/A';
  const segments = 12;
  const filled = Math.round(value / 100 * segments);
  return `\`${'█'.repeat(filled)}${'░'.repeat(segments - filled)}\` ${formatPercentage(value)}`;
}

export function displayText(value: string | null, limit = 1024): string {
  if (!value) return 'N/A';
  return truncate(escapeMarkdown(value).replaceAll('@', '@\u200b'), limit);
}

export function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  let end = limit - 1;
  if (/[\uD800-\uDBFF]/.test(value[end - 1] ?? '')) end--;
  return `${value.slice(0, end)}…`;
}
