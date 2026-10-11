import 'dotenv/config';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const officialBase = z.string().url().default('https://www.pointblank.id').refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && ['www.pointblank.id', 'pointblank.id'].includes(url.hostname)
    && !url.port && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}, 'Use the official Point Blank HTTPS origin');

export const integrationEnvSchema = z.object({
  POINTBLANK_BASE_URL: officialBase,
  CLANS_CONFIG_PATH: z.string().min(1).default('config/clans.json'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REQUEST_TIMEOUT_MS: positiveInt(15_000),
  REQUEST_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  POINTBLANK_MIN_REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(0),
  REQUEST_MAX_QUEUE_WAIT_MS: z.coerce.number().int().min(0).max(5000).default(2000),
  CLAN_CACHE_TTL_SECONDS: positiveInt(300),
  MEMBER_CACHE_TTL_SECONDS: positiveInt(120),
  LOGO_CACHE_TTL_SECONDS: positiveInt(1800),
  LOGO_TIMEOUT_MS: positiveInt(20_000),
  PAGINATION_TIMEOUT_SECONDS: z.coerce.number().int().min(10).max(600).default(120),
  ROSTER_PAGE_SIZE: z.coerce.number().int().min(10).max(20).default(15),
});

const envSchema = integrationEnvSchema.extend({
  DISCORD_TOKEN: z.string().trim().min(1),
  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
  DISCORD_GUILD_ID: z.preprocess(value => value === '' ? undefined : value, z.string().regex(/^\d{17,20}$/).optional()),
});

export type Environment = z.infer<typeof envSchema>;
export type IntegrationEnvironment = z.infer<typeof integrationEnvSchema>;

export function loadEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) throw new AppError('CONFIG_INVALID', `Invalid environment variables: ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}. Check .env.example.`);
  return parsed.data;
}
