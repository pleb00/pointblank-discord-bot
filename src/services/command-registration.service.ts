import { DiscordAPIError, HTTPError, Routes, type REST } from 'discord.js';
import { z } from 'zod';
import type { Environment } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type RegistrationEnvironment = Pick<Environment, 'DISCORD_CLIENT_ID' | 'DISCORD_GUILD_ID'>;
type RegistrationClient = Pick<REST, 'get'>;
const applicationSchema = z.object({ id: z.string() });

export function registrationRoute(env: RegistrationEnvironment) {
  return env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);
}

export function registrationError(error: unknown, env: RegistrationEnvironment): unknown {
  if (error instanceof AppError) return error;
  const status = error instanceof DiscordAPIError || error instanceof HTTPError ? error.status : undefined;
  const code = error instanceof DiscordAPIError ? error.code : undefined;
  if (status === 401 || code === 50014) {
    return new AppError('DISCORD_AUTH_INVALID', 'Discord rejected the bot token. Set DISCORD_TOKEN to the current Bot token from the same application; the Public Key is not a bot token.', { cause: error });
  }
  if (code === 50001 || code === 10004) {
    return new AppError('DISCORD_REGISTRATION_ACCESS', env.DISCORD_GUILD_ID
      ? `Discord cannot access command registration in server ${env.DISCORD_GUILD_ID}. Check that DISCORD_GUILD_ID is the server ID (not a channel ID), then install this application into that server with the bot and applications.commands scopes. See README troubleshooting.`
      : 'Discord cannot access this application\'s command registration. Check that DISCORD_CLIENT_ID and DISCORD_TOKEN belong to the same application.', { cause: error });
  }
  if (code === 50013) {
    return new AppError('DISCORD_REGISTRATION_ACCESS', 'Discord denied command registration permissions. Reauthorize the application for the selected server with the applications.commands scope.', { cause: error });
  }
  return error;
}

/** Read-only checks; never change scopes or register against another server as a fallback. */
export async function verifyCommandRegistration(rest: RegistrationClient, env: RegistrationEnvironment): Promise<void> {
  try {
    const application = applicationSchema.parse(await rest.get(Routes.oauth2CurrentApplication()));
    if (application.id !== env.DISCORD_CLIENT_ID) {
      throw new AppError('DISCORD_APPLICATION_MISMATCH', `The bot token belongs to application ${application.id}, but DISCORD_CLIENT_ID is ${env.DISCORD_CLIENT_ID}. Use the token and Application ID from the same Discord application.`);
    }
    // Check the command endpoint itself: application-command authorization is separate from channel permissions.
    await rest.get(registrationRoute(env));
  } catch (error) { throw registrationError(error, env); }
}
