import type { Client } from 'discord.js';
import type { Logger } from 'pino';

export function onReady(client: Client<true>, logger: Logger): void {
  logger.info({ bot: client.user.tag }, 'Discord bot ready');
}
