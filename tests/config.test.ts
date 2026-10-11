import { describe, expect, it } from 'vitest';
import { ClanRegistry, validateClanConfig } from '../src/config/clan-config.js';
import { loadEnvironment } from '../src/config/env.js';
import { clan } from './helpers.js';

describe('multi-clan configuration', () => {
  const second = { ...clan, id: 'second', name: 'Second', uniqueId: 'second/==', enabled: true };
  it('preserves exact identifiers and resolves defaults and selected clans', () => {
    const config = validateClanConfig({ defaultClan: clan.id, clans: [clan, second] });
    const registry = new ClanRegistry(config);
    expect(registry.resolve().uniqueId).toBe(clan.uniqueId);
    expect(registry.resolve('second').uniqueId).toBe('second/==');
    expect(registry.choices('sec')).toEqual([{ name: 'Second (second)', value: 'second' }]);
    expect(() => registry.resolve('missing')).toThrow('not configured');
  });
  it('prevents duplicate IDs, missing defaults, and disabled defaults', () => {
    expect(() => validateClanConfig({ defaultClan: clan.id, clans: [clan, clan] })).toThrow('Duplicate');
    expect(() => validateClanConfig({ defaultClan: 'missing', clans: [clan] })).toThrow('Default');
    expect(() => validateClanConfig({ defaultClan: clan.id, clans: [{ ...clan, enabled: false }] })).toThrow('enabled');
  });
  it('excludes disabled clans from resolution and autocomplete', () => {
    const registry = new ClanRegistry(validateClanConfig({ defaultClan: clan.id, clans: [clan, { ...second, enabled: false }] }));
    expect(registry.choices('second')).toEqual([]);
    expect(() => registry.resolve('second')).toThrow('disabled');
  });
  it('limits autocomplete to 25 options', () => {
    const clans = Array.from({ length: 30 }, (_, i) => ({ ...clan, id: `clan-${i}` }));
    expect(new ClanRegistry(validateClanConfig({ defaultClan: 'clan-0', clans })).choices('')).toHaveLength(25);
  });
});

describe('environment validation', () => {
  const valid = { DISCORD_TOKEN: 'test-only', DISCORD_CLIENT_ID: '123456789012345678' };
  it('loads defaults and permits an omitted guild for global commands', () => {
    expect(loadEnvironment(valid).CLAN_CACHE_TTL_SECONDS).toBe(300);
    expect(loadEnvironment(valid).POINTBLANK_MIN_REQUEST_INTERVAL_MS).toBe(0);
    expect(loadEnvironment({ ...valid, DISCORD_GUILD_ID: '' }).DISCORD_GUILD_ID).toBeUndefined();
  });
  it('rejects invalid secrets without including their values in errors', () => {
    expect(() => loadEnvironment({ DISCORD_TOKEN: 'secret-do-not-print', DISCORD_CLIENT_ID: 'secret-invalid-id' })).toThrow('DISCORD_CLIENT_ID');
    try { loadEnvironment({ DISCORD_CLIENT_ID: 'secret-invalid-id' }); }
    catch (error) { expect(String(error)).not.toContain('secret-invalid-id'); }
  });
  it('requires official HTTPS origin and validates optional request spacing', () => {
    expect(() => loadEnvironment({ ...valid, POINTBLANK_BASE_URL: 'https://other.example' })).toThrow('POINTBLANK_BASE_URL');
    expect(loadEnvironment({ ...valid, POINTBLANK_MIN_REQUEST_INTERVAL_MS: '0' }).POINTBLANK_MIN_REQUEST_INTERVAL_MS).toBe(0);
    expect(loadEnvironment({ ...valid, POINTBLANK_MIN_REQUEST_INTERVAL_MS: '1000' }).POINTBLANK_MIN_REQUEST_INTERVAL_MS).toBe(1000);
    expect(() => loadEnvironment({ ...valid, POINTBLANK_MIN_REQUEST_INTERVAL_MS: '-1' })).toThrow('POINTBLANK_MIN_REQUEST_INTERVAL_MS');
    expect(() => loadEnvironment({ ...valid, ROSTER_PAGE_SIZE: '200' })).toThrow('ROSTER_PAGE_SIZE');
  });
});
