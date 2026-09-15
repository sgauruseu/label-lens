import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * The rule that actually protects the architecture is the last block: `src/core` may not
 * import from `src/adapters` or `src/ui`, and may not touch a browser global. Without it the
 * purity of the domain is a convention, and conventions rot under time pressure.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
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
);
