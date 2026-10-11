import { loadClanConfig } from '../src/config/clan-config.js';
import { loadEnvironment } from '../src/config/env.js';
import { publicError } from '../src/utils/errors.js';

try {
  const env = loadEnvironment();
  const config = await loadClanConfig(env.CLANS_CONFIG_PATH);
  console.log(`Configuration valid: ${config.clans.filter(clan => clan.enabled).length} enabled clan(s), default ${config.defaultClan}.`);
} catch (error) {
  console.error(publicError(error));
  process.exitCode = 1;
}
