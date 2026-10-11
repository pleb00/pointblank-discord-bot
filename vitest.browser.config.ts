import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/browser/**/*.test.ts'], testTimeout: 30_000, restoreMocks: true },
});
