import { NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

const CLIENT_ID = process.env.BLING_CLIENT_ID!
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET!

export async function POST() {
  const supabase = createServiceClient()

  // 1. Buscar refresh_token salvo
  const { data: integration, error: fetchError } = await supabase
    .from('bling_tokens')
    .select('refresh_token')
    .eq('org_id', ORG_ID)
    .single()

  if (fetchError || !integration?.refresh_token) {
    return NextResponse.json(
      { success: false, error: 'Bling não está conectado ou refresh_token ausente' },
      { status: 400 },
    )
  }

  // 2. Trocar refresh_token por novos tokens
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
  })

  const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[bling/refresh] falha ao renovar token:', text)
    return NextResponse.json(
      { success: false, error: 'Falha ao renovar token', detail: text },
      { status: 502 },
    )
  }

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // 3. Atualizar tokens no Supabase
  const { error: updateError } = await supabase
    .from('bling_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ORG_ID)

  if (updateError) {
    console.error('[bling/refresh] erro ao salvar tokens renovados:', updateError)
    return NextResponse.json(
      { success: false, error: 'Tokens renovados mas falha ao salvar no banco' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, expires_at: expiresAt })
}
