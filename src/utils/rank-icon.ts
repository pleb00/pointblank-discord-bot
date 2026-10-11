export type RankIconKind = 'member' | 'clan';

/** Only the original public assets for the requested rank kind can be uploaded. */
export function rankIconAsset(source: string | null, kind: RankIconKind = 'member'): { url: string; emojiName: string; rankNumber: number } | null {
  if (!source) return null;
  try {
    const url = new URL(source);
    const match = url.pathname.match(/^\/images\/common\/icon_ranking\/(rank|clan)_(\d{1,6})\.png$/);
    const rank = match?.[2];
    const prefix = kind === 'clan' ? 'clan' : 'rank';
    if (!rank || match?.[1] !== prefix || url.protocol !== 'https:' || !['www.pointblank.id', 'pointblank.id'].includes(url.hostname)
      || url.port || url.username || url.password || url.search || url.hash) return null;
    return { url: url.href, emojiName: `pb_${kind === 'clan' ? 'clan_' : ''}rank_${rank}`, rankNumber: Number(rank) };
  } catch { return null; }
}
