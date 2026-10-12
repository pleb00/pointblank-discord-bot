import { readFileSync } from 'node:fs';
import type { IntegrationEnvironment } from '../src/config/env.js';
import { integrationEnvSchema } from '../src/config/env.js';
import type { ConfiguredClan } from '../src/config/clan-config.js';

export const baseUrl = 'https://www.pointblank.id';
export const clan: ConfiguredClan = { id: 'hepatica', name: 'Hepatica', uniqueId: 'clan+fixture/==', enabled: true };
export const fixtureHtml = readFileSync(new URL('./fixtures/clan.html', import.meta.url), 'utf8');
export const loginHtml = readFileSync(new URL('./fixtures/login.html', import.meta.url), 'utf8');
export const playerSearchHtml = readFileSync(new URL('./fixtures/player-search.html', import.meta.url), 'utf8');
export const emptyPlayerSearchHtml = readFileSync(new URL('./fixtures/player-search-empty.html', import.meta.url), 'utf8');
export const detailJson: unknown = JSON.parse(readFileSync(new URL('./fixtures/member-detail.json', import.meta.url), 'utf8'));
// Supplied illustrative player JSON from the user's detail-endpoint example; not a live capture.
export const playerDetailJson: unknown = JSON.parse(readFileSync(new URL('./fixtures/player-detail.json', import.meta.url), 'utf8'));
export const testEnvironment: IntegrationEnvironment = integrationEnvSchema.parse({});
