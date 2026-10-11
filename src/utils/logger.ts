import pino from 'pino';

export function createLogger(level: string = 'info') {
  return pino({
    level,
    redact: { paths: ['token', 'env', 'uniqueId', 'headers.authorization', 'req.headers.authorization'], censor: '[REDACTED]' },
  });
}
