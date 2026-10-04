import globals from 'globals';

export default [
  {
    files: ['kzones/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // test hook asserted by the Playwright suites
        window: 'readonly',
      },
    },
    rules: {
      // `caughtErrors: 'none'` — this file uses several intentionally empty
      // catch blocks (`catch (e) { /* already released */ }`) to absorb a
      // failure that genuinely does not matter. Reporting them as unused
      // variables would mean either deleting the guard or adding dead reads.
      'no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],

      // Deliberately off. app.js is loaded as a classic <script src> (no
      // type="module"), so top-level function declarations are file-scoped
      // globals and that is how the file is written on purpose — wrapping it
      // in an IIFE to satisfy this rule would be churn, not a fix.
      'no-implicit-globals': 'off',
    },
  },
];