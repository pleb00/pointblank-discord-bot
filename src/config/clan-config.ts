import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

export const clanConfigSchema = z.object({
  defaultClan: z.string().min(1),
  clans: z.array(z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    name: z.string().trim().min(1).max(100),
    uniqueId: z.string().min(1).max(4096).refine(value => value.trim() === value && !/\s/.test(value)),
    enabled: z.boolean(),
  }).strict()).min(1),
}).strict().superRefine((config, context) => {
  const ids = new Set<string>();
  config.clans.forEach((clan, index) => {
    if (ids.has(clan.id)) context.addIssue({ code: 'custom', path: ['clans', index, 'id'], message: 'Duplicate clan ID' });
    ids.add(clan.id);
  });
  if (!config.clans.some(clan => clan.id === config.defaultClan && clan.enabled)) {
    context.addIssue({ code: 'custom', path: ['defaultClan'], message: 'Default clan must exist and be enabled' });
  }
});

export type ClanConfig = z.infer<typeof clanConfigSchema>;
export type ConfiguredClan = ClanConfig['clans'][number];

export function validateClanConfig(input: unknown): ClanConfig {
  const parsed = clanConfigSchema.safeParse(input);
  if (!parsed.success) throw new AppError('CONFIG_INVALID', `Invalid clan configuration: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return parsed.data;
}

export async function loadClanConfig(path: string): Promise<ClanConfig> {
  try { return validateClanConfig(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('CONFIG_INVALID', 'Could not read clan configuration. Check the JSON file and its path.');
  }
}

export class ClanRegistry {
  constructor(private readonly config: ClanConfig) {}

  resolve(id?: string | null): ConfiguredClan {
    const clan = this.config.clans.find(entry => entry.id === (id ?? this.config.defaultClan) && entry.enabled);
    if (!clan) throw new AppError('CLAN_NOT_FOUND', 'That clan is not configured or is disabled. Select a clan from autocomplete.');
    return clan;
  }

  choices(query: string) {
    const lowered = query.toLowerCase();
    return this.config.clans.filter(clan => clan.enabled && `${clan.id} ${clan.name}`.toLowerCase().includes(lowered))
      .slice(0, 25).map(clan => ({ name: `${clan.name} (${clan.id})`.slice(0, 100), value: clan.id }));
  }
}
