import { defineConfig } from 'vitest/config';

/**
 * Tests cover `src/core` only, and `src/core` is pure — so the suite runs in a plain Node
 * environment with no DOM and no React plugin. If a test ever needs either, that test does not
 * belong in core (see CLAUDE.md).
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Only the unit tests. The Playwright suite in tests/ runs under its own runner.
    include: ['src/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts', 'src/core/testing.ts'],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
