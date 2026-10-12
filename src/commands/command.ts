import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { Logger } from 'pino';
import type { ClanRegistry } from '../config/clan-config.js';
import type { Environment } from '../config/env.js';
import type { ClanService } from '../services/clan.service.js';
import type { MemberService } from '../services/member.service.js';
import type { LogoService } from '../services/logo.service.js';
import type { RankEmojiService } from '../services/rank-emoji.service.js';
import type { WebstoreService } from '../services/webstore.service.js';

export interface CommandContext {
  registry: ClanRegistry;
  clans: ClanService;
  members: MemberService;
  webstore: WebstoreService;
  logos: LogoService;
  rankEmojis: RankEmojiService;
  env: Environment;
  logger: Logger;
}

export async function clanAutocomplete(interaction: AutocompleteInteraction, context: CommandContext): Promise<void> {
  const option = interaction.options.getFocused(true);
  await interaction.respond(option.name === 'clan' ? context.registry.choices(String(option.value)) : []);
}

export type CommandHandler = (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>;
