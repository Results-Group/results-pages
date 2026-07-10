import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ADMIN_PASSWORD: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  PIZZAHOUSE_DB_HOST: z.string().optional(),
  PIZZAHOUSE_DB_USER: z.string().optional(),
  PIZZAHOUSE_DB_PASSWORD: z.string().optional(),
  PIZZAHOUSE_DB_NAME: z.string().optional(),
  PIZZAHOUSE_DB_PORT: z.string().optional(),
  PIZZAHOUSE_DASHBOARD_PASSWORD: z.string().optional(),
  // Monday.com integration (Results Digital workspace only)
  MONDAY_API_TOKEN: z.string().optional(),
  MONDAY_BOARD_ID: z.string().optional(),
  MONDAY_SYNC_WORKSPACE_ID: z.string().uuid().optional(),
  // Google Gemini AI (translation + Excel parsing)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _validated = false

export function validateEnv(): Env {
  if (_validated) return process.env as unknown as Env
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Missing or invalid environment variables:\n${formatted}`)
  }
  _validated = true
  return result.data
}
