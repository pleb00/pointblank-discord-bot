import { DiscordAPIError, HTTPError } from 'discord.js';

export type ErrorCode =
  | 'CONFIG_INVALID' | 'CLAN_NOT_FOUND' | 'ACCESS_REQUIRED' | 'UNEXPECTED_HTML'
  | 'UNEXPECTED_JSON' | 'EMPTY_ROSTER' | 'INCOMPLETE_ROSTER' | 'MEMBER_NOT_FOUND'
  | 'AMBIGUOUS_MEMBER' | 'UPSTREAM_UNAVAILABLE' | 'REQUEST_TIMEOUT' | 'RATE_LIMIT'
  | 'LOGO_FAILED' | 'DISCORD_AUTH_INVALID' | 'DISCORD_APPLICATION_MISMATCH'
  | 'DISCORD_REGISTRATION_ACCESS' | 'RANK_ICON_FAILED';

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
  }
}

export type LogoStage = 'browser' | 'context' | 'navigation' | 'profile' | 'styles' | 'layers' | 'screenshot';
export type LogoFailure = 'BROWSER_NOT_INSTALLED' | 'BROWSER_CLOSED' | 'NETWORK_FAILED' | 'TIMEOUT'
  | 'ELEMENT_NOT_FOUND' | 'STYLES_FAILED' | 'IMAGE_FAILED' | 'RENDER_FAILED';

/** Predefined diagnostic fields; raw Playwright messages can contain query identifiers. */
export class LogoRenderError extends AppError {
  constructor(public readonly stage: LogoStage, public readonly reason: LogoFailure) {
    super('LOGO_FAILED', reason === 'BROWSER_NOT_INSTALLED'
      ? 'The logo browser is not installed. Run npm run install:browser on the bot host.'
      : `Clan logo rendering failed during ${stage}. Check the bot log for the failure reason.`);
    this.name = 'LogoRenderError';
  }
}

export function publicError(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'An unexpected error occurred. Please try again later.';
}

/** Do not serialize upstream errors: Axios embeds request headers and identifiers. */
export function safeError(error: unknown): { name: string; code?: string; status?: number; discordCode?: string; stage?: LogoStage; reason?: LogoFailure } {
  if (error instanceof LogoRenderError) return { name: error.name, code: error.code, stage: error.stage, reason: error.reason };
  if (error instanceof AppError) return {
    name: error.name, code: error.code,
    ...(error.cause instanceof DiscordAPIError ? { discordCode: String(error.cause.code), status: error.cause.status } : {}),
    ...(error.cause instanceof HTTPError ? { status: error.cause.status } : {}),
  };
  if (error instanceof DiscordAPIError) return { name: error.name, code: String(error.code), status: error.status };
  if (error instanceof HTTPError) return { name: error.name, status: error.status };
  return { name: error instanceof Error ? error.name : 'UnknownError' };
}

