import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CLIENT_ID = process.env.BLING_CLIENT_ID!
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET!
const REDIRECT_URI = process.env.BLING_REDIRECT_URI!

/* ────────────────────────────────────────────────
   Troca o authorization_code por access + refresh token
──────────────────────────────────────────────── */
async function exchangeCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
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
    throw new Error(`Bling token exchange failed (${res.status}): ${text}`)
  }

  return res.json()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const BASE = 'https://crm.urnasremanso.com.br/integracoes'

  // 1. Verificar erro retornado pelo Bling
  if (error) {
    console.error('[bling/callback] Bling retornou erro:', error)
    return NextResponse.redirect(`${BASE}?bling_error=${encodeURIComponent(error)}`)
  }

  // 2. Verificar presença do code
  if (!code) {
    console.error('[bling/callback] authorization code ausente')
    return NextResponse.redirect(`${BASE}?bling_error=missing_code`)
  }

  // 3. (Opcional) Validar state para prevenir CSRF
  if (state !== 'crm-remanso') {
    console.error('[bling/callback] state inválido:', state)
    return NextResponse.redirect(`${BASE}?bling_error=invalid_state`)
  }

  // 4. Trocar code por tokens
  let tokens: Awaited<ReturnType<typeof exchangeCode>>
  try {
    tokens = await exchangeCode(code)
  } catch (err) {
    console.error('[bling/callback] erro ao trocar code:', err)
    return NextResponse.redirect(`${BASE}?bling_error=token_exchange_failed`)
  }

  // 5. Persistir tokens no Supabase
  const supabase = await createClient()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('bling_tokens')
    .upsert(
      {
        org_id: process.env.NEXT_PUBLIC_ORG_ID!,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    )

  if (dbError) {
    console.error('[bling/callback] erro ao salvar tokens:', dbError)
    return NextResponse.redirect(`${BASE}?bling_error=db_save_failed`)
  }

  // 6. Redirecionar com sucesso
  return NextResponse.redirect('https://crm.urnasremanso.com.br/integracoes?bling_connected=1')
}
