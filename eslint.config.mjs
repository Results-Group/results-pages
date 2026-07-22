// eslint-config-next 16 ships native flat configs, so they are imported
// directly — no FlatCompat shim needed.
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/**',
      'supabase/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // A handful of Supabase row-mapping spots use `any` on purpose; report
      // them without failing the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // ── Pre-existing patterns, downgraded so CI can start enforcing today ──
      // These React Compiler rules flag ~20 long-standing spots (effects that
      // setState to derive from props, effects calling useCallback fns declared
      // below them, `window.location.href` assignment). None is a live bug, but
      // clearing them means reworking effect ordering and dependency arrays
      // across the admin — a behaviour-risky refactor that deserves its own
      // change. Kept as warnings so they stay visible and new ones are noticed.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react/display-name': 'warn',
    },
  },
]

export default eslintConfig
