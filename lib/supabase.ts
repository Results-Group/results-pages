// This client uses the service-role key, which bypasses RLS and must never
// reach the browser. `server-only` turns that from a runtime surprise into a
// build error: any client component that imports this module (directly or
// transitively) fails the build with a message naming the offending import
// chain, instead of shipping a page that crashes on "supabaseKey is required".
//
// Types may still be imported freely with `import type` (erased at compile
// time); shared runtime helpers belong in a client-safe module — see
// lib/report-template.ts.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
