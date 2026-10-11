import { REST } from 'discord.js';
import { loadEnvironment } from '../src/config/env.js';
import type { Environment } from '../src/config/env.js';
import { registrationError, verifyCommandRegistration } from '../src/services/command-registration.service.js';
import { publicError, safeError } from '../src/utils/errors.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger();
let env: Environment | undefined;
try {
  env = loadEnvironment();
  await verifyCommandRegistration(new REST({ version: '10', timeout: 15_000, retries: 0 }).setToken(env.DISCORD_TOKEN), env);
  logger.info({ scope: env.DISCORD_GUILD_ID ? 'guild' : 'global' }, 'Bot token matches the application and the command endpoint is accessible. No commands were changed.');
} catch (error) {
  logger.error({ ...safeError(error), message: publicError(env ? registrationError(error, env) : error) }, 'Discord configuration check failed');
  process.exitCode = 1;
}
