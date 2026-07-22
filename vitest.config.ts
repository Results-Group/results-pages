import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    // Mirror the "@/*" -> "./*" alias from tsconfig.json
    alias: { '@': resolve(__dirname, './') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // The signing helpers refuse to run without a secret. A fixed value keeps
      // signatures reproducible across runs; it is never a real credential.
      SESSION_SECRET: 'test-secret-not-used-anywhere-real',
    },
  },
})
