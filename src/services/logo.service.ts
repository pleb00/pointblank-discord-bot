import { createHash } from 'node:crypto';
import type { ClanSnapshot } from '../models/clan.model.js';
import { ClanLogoRenderer } from '../renderers/clan-logo.renderer.js';
import { AsyncCache } from '../utils/cache.js';

export class LogoService {
  private readonly logos: AsyncCache<Buffer>;
  constructor(private readonly renderer: ClanLogoRenderer, ttlMs: number) { this.logos = new AsyncCache(ttlMs, 100); }

  getLogo(snapshot: ClanSnapshot): Promise<Buffer> {
    const key = createHash('sha256').update(snapshot.sourceUrl).update(snapshot.html).digest('hex');
    return this.logos.get(key, () => this.renderer.render(snapshot.sourceUrl, snapshot.html));
  }

  close(): Promise<void> { this.logos.clear(); return this.renderer.close(); }
}
