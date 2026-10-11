import { REST } from 'discord.js';
import { loadEnvironment } from './config/env.js';
import { loadClanConfig } from './config/clan-config.js';
import { infoClanCommand } from './commands/info-clan.command.js';
import { infoMemberCommand } from './commands/info-member.command.js';
import { createLogger } from './utils/logger.js';
import { publicError, safeError } from './utils/errors.js';
import { registrationError, registrationRoute, verifyCommandRegistration } from './services/command-registration.service.js';
import type { Environment } from './config/env.js';

const logger = createLogger();
let env: Environment | undefined;
try {
  env = loadEnvironment();
  await loadClanConfig(env.CLANS_CONFIG_PATH);
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  await verifyCommandRegistration(rest, env);
  await rest.put(registrationRoute(env), { body: [infoClanCommand.toJSON(), infoMemberCommand.toJSON()] });
  logger.info({ scope: env.DISCORD_GUILD_ID ? 'guild' : 'global' }, 'Registered /info-clan and /info-member');
} catch (error) {
  const failure = env ? registrationError(error, env) : error;
  logger.error({ ...safeError(error), message: publicError(failure) }, 'Command registration failed');
  process.exitCode = 1;
}
