#!/usr/bin/env node
/**
 * Provision or reset an admin user in the admin_users table.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/create-admin.mjs <email> <password> [name]
 *
 * Requires: @supabase/supabase-js and bcryptjs (already in project deps).
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const [,, email, password, name = 'Admin'] = process.argv

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [name]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const hash = await bcrypt.hash(password, 12)

const { data: existing } = await supabase
  .from('admin_users')
  .select('id')
  .eq('email', email.toLowerCase().trim())
  .maybeSingle()

if (existing) {
  const { error } = await supabase
    .from('admin_users')
    .update({ password_hash: hash, name, role: 'admin' })
    .eq('id', existing.id)
  if (error) { console.error('Update failed:', error.message); process.exit(1) }
  console.log(`Updated existing admin: ${email}`)
} else {
  const { error } = await supabase
    .from('admin_users')
    .insert({ email: email.toLowerCase().trim(), password_hash: hash, name, role: 'admin' })
  if (error) { console.error('Insert failed:', error.message); process.exit(1) }
  console.log(`Created admin: ${email}`)
}

console.log('Done.')
