import type { Environment } from './config/env.js';
import { ClanRegistry, loadClanConfig } from './config/clan-config.js';
import { PointBlankClient } from './clients/pointblank.client.js';
import { ClanService } from './services/clan.service.js';
import { MemberService } from './services/member.service.js';
import { LogoService } from './services/logo.service.js';
import { ClanLogoRenderer } from './renderers/clan-logo.renderer.js';
import { createLogger } from './utils/logger.js';
import { RequestGate } from './utils/rate-limit.js';
import type { CommandContext } from './commands/command.js';
import { REST } from 'discord.js';
import { RankEmojiClient } from './clients/rank-emoji.client.js';
import { RankIconClient } from './clients/rank-icon.client.js';
import { RankEmojiService } from './services/rank-emoji.service.js';

export async function createApplication(env: Environment): Promise<CommandContext> {
  const registry = new ClanRegistry(await loadClanConfig(env.CLANS_CONFIG_PATH));
  const logger = createLogger(env.LOG_LEVEL);
  const gate = new RequestGate(env.POINTBLANK_MIN_REQUEST_INTERVAL_MS, env.REQUEST_MAX_QUEUE_WAIT_MS);
  const client = new PointBlankClient(env, gate, logger);
  const clans = new ClanService(client, env.POINTBLANK_BASE_URL, env.CLAN_CACHE_TTL_SECONDS * 1000, logger);
  const members = new MemberService(clans, client, logger);
  const logos = new LogoService(new ClanLogoRenderer(env.LOGO_TIMEOUT_MS, gate), env.LOGO_CACHE_TTL_SECONDS * 1000);
  const emojiRest = new REST({ version: '10', timeout: env.REQUEST_TIMEOUT_MS, retries: env.REQUEST_MAX_RETRIES }).setToken(env.DISCORD_TOKEN);
  const rankEmojis = new RankEmojiService(new RankEmojiClient(emojiRest, env.DISCORD_CLIENT_ID), new RankIconClient(env.REQUEST_TIMEOUT_MS), logger);
  return { registry, logger, clans, members, logos, rankEmojis, env };
}
