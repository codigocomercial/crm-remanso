import { createClient } from '@supabase/supabase-js'

// Client com service role — para uso exclusivo em API routes (server-side)
// As chaves são lidas das env vars; nunca hardcodar aqui
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias nas env vars')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID || '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'
