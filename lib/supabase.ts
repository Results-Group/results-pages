import { createClient } from '@supabase/supabase-js'

// Server-only: this client uses the service-role key, which bypasses RLS and
// must never reach the browser. Next.js strips non-NEXT_PUBLIC_ env vars from
// client bundles, so importing this from a client component would otherwise
// fail with a cryptic "supabaseKey is required" at module evaluation.
// Fail loudly instead, naming the actual problem.
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase is server-only and must not be imported from a client component. ' +
      'Import types with `import type`, and move any shared runtime helpers into a ' +
      'client-safe module (see lib/report-template.ts).'
  )
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
