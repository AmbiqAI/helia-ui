// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/*
 * Type-checked rules are on. They are the reason this config exists: the ones
 * that matter to a streaming app — no-floating-promises, no-misused-promises —
 * cannot be expressed without types, and a dropped await on `connect` or
 * `disconnect` leaves the transport in a state the UI does not show.
 */
export default tseslint.config(
  { ignores: ['dist/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Both top-level entries in this plugin are still the eslintrc shape, where
  // `plugins` is an array; the flat namespace is the one ESLint 10 accepts.
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: {
      parserOptions: {
        // eslint.config.js is outside tsconfig's include, so it is linted from
        // the default project rather than failing to resolve.
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
