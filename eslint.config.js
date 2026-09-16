import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The rule that actually protects the architecture is the `src/core` block: it may not import
 * from `src/adapters` or `src/ui`, and may not touch a browser global. Without it the purity of
 * the domain is a convention, and conventions rot under time pressure.
 *
 * The WebdriverIO suite under `testing/` is plain JavaScript and runs in a very different
 * environment — Mocha's BDD globals, WebdriverIO's `browser` and `$`, and code that is sent to
 * the browser to be executed there. It gets its own block rather than an ignore, because a
 * linter that skips a directory is a linter that stops finding bugs in it.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/*', '**/ui/*', 'react', 'react-dom'],
              message:
                'src/core must stay pure. Pass the data in as an argument instead of reaching for I/O.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core must stay pure — no browser globals.' },
        { name: 'document', message: 'src/core must stay pure — no browser globals.' },
        { name: 'localStorage', message: 'src/core must stay pure — no browser globals.' },
        { name: 'fetch', message: 'src/core must stay pure — no network.' },
      ],
    },
  },
  {
    files: ['src/core/**/*.test.ts', 'src/core/testing.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The WebdriverIO comparison suite: plain JS, Mocha globals, WDIO globals.
    files: ['testing/**/*.js', 'wdio.conf.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.mocha,
        // A WDIO spec mixes two runtimes in one file: most of it runs in Node, but the callback
        // passed to `browser.execute()` is serialised and run inside the page. The linter cannot
        // tell the two apart, so browser globals have to be allowed everywhere in this folder —
        // which means a stray `document` in Node code lints clean and fails at runtime. The
        // Playwright suite is in TypeScript, where the same boundary is a type error.
        ...globals.browser,
        // Injected by the WDIO test runner, not imported.
        browser: 'readonly',
        $: 'readonly',
        $$: 'readonly',
        expect: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
