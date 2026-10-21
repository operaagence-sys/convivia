import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

// Messages d'erreur: voir docs/09-conventions.md (1.3) et CLAUDE.md (5).
const TRACKER_PATTERNS = [
  'posthog-js',
  'posthog-js/*',
  '@vercel/analytics',
  '@vercel/analytics/*',
  '@vercel/speed-insights',
  '@vercel/speed-insights/*',
  '@sentry/browser',
  '@sentry/react',
  '@sentry/nextjs',
  '@/lib/analytics',
  '@/lib/analytics/*',
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.lighthouseci/**',
    'next-env.d.ts',
    'src/types/database.ts',
    'supabase/**',
    'docs/**',
    '.claude/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Pas de console.log perdu (les coordonnees des invites ne doivent jamais etre journalisees).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Les variables d'environnement passent par src/lib/env (validation zod + garde-fous).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/env/**', 'src/instrumentation.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Lis les variables via src/lib/env (validation zod et garde-fous du mode live).',
        },
      ],
    },
  },
  {
    // Aucun traceur ni SDK navigateur dans la page invite (CLAUDE.md 5). Doublon du controle
    // CI `npm run check:trackers`, qui verifie le bundle reel.
    files: ['src/app/i/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: TRACKER_PATTERNS,
              message: 'Aucun traceur ni SDK navigateur sur /i/* (CLAUDE.md 5).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs}', 'tests/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },
]);
