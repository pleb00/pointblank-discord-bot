import { Client, Events, GatewayIntentBits } from 'discord.js';
import { createApplication } from './app.js';
import { loadEnvironment } from './config/env.js';
import { handleInteraction } from './events/interaction.event.js';
import { onReady } from './events/ready.event.js';
import { stopRosters } from './commands/info-member.command.js';
import { createLogger } from './utils/logger.js';
import { publicError, safeError } from './utils/errors.js';

const bootstrapLogger = createLogger();
let client: Client | undefined;
let closeResources: (() => Promise<void>) | undefined;
let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  stopRosters();
  client?.destroy();
  try { await closeResources?.(); }
  catch (error) { bootstrapLogger.warn(safeError(error), 'Resource cleanup failed'); }
}

try {
  const context = await createApplication(loadEnvironment());
  closeResources = () => context.logos.close();
  client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, ready => onReady(ready, context.logger));
  client.on(Events.InteractionCreate, interaction => { void handleInteraction(interaction, context); });
  client.on(Events.Error, error => context.logger.error(safeError(error), 'Discord client error'));
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
  await client.login(context.env.DISCORD_TOKEN);
} catch (error) {
  bootstrapLogger.fatal({ ...safeError(error), message: publicError(error) }, 'Bot startup failed');
  await stop();
  process.exitCode = 1;
}
