import { NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('bling_tokens').select('access_token').eq('org_id', ORG_ID).single()
  const token = data?.access_token
  if (!token) return NextResponse.json({ error: 'sem token' })

  const res = await fetch('https://www.bling.com.br/Api/v3/vendedores?limite=5', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  return NextResponse.json(json)
}
