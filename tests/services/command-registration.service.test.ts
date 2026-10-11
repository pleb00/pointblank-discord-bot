import { DiscordAPIError, HTTPError, Routes, type REST } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { registrationError, registrationRoute, verifyCommandRegistration } from '../../src/services/command-registration.service.js';
import { AppError, publicError, safeError } from '../../src/utils/errors.js';

const env = { DISCORD_CLIENT_ID: '123456789012345678', DISCORD_GUILD_ID: '987654321098765432' };
const apiError = (code: number, status = 403) => new DiscordAPIError(
  { code, message: 'private-upstream-content' }, code, status, 'GET', 'https://discord.com/private-url',
  { body: { token: 'private-token' } },
);

describe('command registration preflight', () => {
  it('checks token ownership and reads the chosen guild command endpoint', async () => {
    const rest = { get: vi.fn<REST['get']>().mockResolvedValueOnce({ id: env.DISCORD_CLIENT_ID }).mockResolvedValueOnce([]) };
    await verifyCommandRegistration(rest, env);
    expect(rest.get.mock.calls.map(call => call[0])).toEqual([
      Routes.oauth2CurrentApplication(), Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
    ]);
  });
  it('checks the global endpoint only when no guild was configured', async () => {
    const global = { DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID };
    const rest = { get: vi.fn<REST['get']>().mockResolvedValueOnce({ id: env.DISCORD_CLIENT_ID }).mockResolvedValueOnce([]) };
    await verifyCommandRegistration(rest, global);
    expect(rest.get).toHaveBeenLastCalledWith(Routes.applicationCommands(env.DISCORD_CLIENT_ID));
    expect(registrationRoute(global)).toBe(Routes.applicationCommands(env.DISCORD_CLIENT_ID));
  });
  it('rejects a mismatched token before accessing any command endpoint', async () => {
    const rest = { get: vi.fn<REST['get']>().mockResolvedValue({ id: '111111111111111111' }) };
    await expect(verifyCommandRegistration(rest, env)).rejects.toMatchObject({ code: 'DISCORD_APPLICATION_MISMATCH' });
    expect(rest.get).toHaveBeenCalledTimes(1);
  });
  it('explains missing server authorization and never falls back to global registration', async () => {
    const rest = { get: vi.fn<REST['get']>().mockResolvedValueOnce({ id: env.DISCORD_CLIENT_ID }).mockRejectedValueOnce(apiError(50001)) };
    await expect(verifyCommandRegistration(rest, env)).rejects.toThrow('server ID (not a channel ID)');
    expect(rest.get).toHaveBeenCalledTimes(2);
    expect(rest.get).toHaveBeenLastCalledWith(registrationRoute(env));
  });
  it('explains invalid authentication safely', async () => {
    const rest = { get: vi.fn<REST['get']>().mockRejectedValue(new HTTPError(401, 'private-status', 'GET', 'private-url', {})) };
    await expect(verifyCommandRegistration(rest, env)).rejects.toMatchObject({ code: 'DISCORD_AUTH_INVALID' });
    expect(publicError(registrationError(apiError(50014, 401), env))).toContain('current Bot token');
  });
  it('provides setup guidance for unknown guild and missing permission codes', () => {
    expect(publicError(registrationError(apiError(10004, 404), env))).toContain('DISCORD_GUILD_ID');
    expect(publicError(registrationError(apiError(50013), env))).toContain('applications.commands');
  });
  it('keeps technical metadata while excluding request data from messages and logs', () => {
    const original = apiError(50001);
    const mapped = registrationError(original, env);
    expect(safeError(original)).toEqual({ name: 'DiscordAPIError[50001]', code: '50001', status: 403 });
    expect(safeError(mapped)).toEqual({ name: 'AppError', code: 'DISCORD_REGISTRATION_ACCESS', discordCode: '50001', status: 403 });
    const output = JSON.stringify({ ...safeError(mapped), message: publicError(mapped) });
    expect(output).not.toContain('private');
  });
  it('preserves application errors and leaves unexpected errors sanitized', () => {
    const appError = new AppError('CONFIG_INVALID', 'Invalid configuration');
    expect(registrationError(appError, env)).toBe(appError);
    const unexpected = new Error('private-token');
    expect(registrationError(unexpected, env)).toBe(unexpected);
    expect(publicError(unexpected)).not.toContain('private');
  });
});
