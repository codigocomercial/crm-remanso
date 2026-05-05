import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const dashboardUrl = new URL('/integracoes', request.nextUrl.origin)

  // 1. Verificar erro retornado pelo Bling
  if (error) {
    console.error('[bling/callback] Bling retornou erro:', error)
    dashboardUrl.searchParams.set('bling_error', error)
    return NextResponse.redirect(dashboardUrl.toString())
  }

  // 2. Verificar presença do code
  if (!code) {
    console.error('[bling/callback] authorization code ausente')
    dashboardUrl.searchParams.set('bling_error', 'missing_code')
    return NextResponse.redirect(dashboardUrl.toString())
  }

  // 3. (Opcional) Validar state para prevenir CSRF
  if (state !== 'crm-remanso') {
    console.error('[bling/callback] state inválido:', state)
    dashboardUrl.searchParams.set('bling_error', 'invalid_state')
    return NextResponse.redirect(dashboardUrl.toString())
  }

  // 4. Trocar code por tokens
  let tokens: Awaited<ReturnType<typeof exchangeCode>>
  try {
    tokens = await exchangeCode(code)
  } catch (err) {
    console.error('[bling/callback] erro ao trocar code:', err)
    dashboardUrl.searchParams.set('bling_error', 'token_exchange_failed')
    return NextResponse.redirect(dashboardUrl.toString())
  }

  // 5. Persistir tokens no Supabase
  const supabase = createAdminClient()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('integrations')
    .upsert(
      {
        provider: 'bling',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' },
    )

  if (dbError) {
    console.error('[bling/callback] erro ao salvar tokens:', dbError)
    dashboardUrl.searchParams.set('bling_error', 'db_save_failed')
    return NextResponse.redirect(dashboardUrl.toString())
  }

  // 6. Redirecionar com sucesso
  dashboardUrl.searchParams.set('bling_connected', '1')
  return NextResponse.redirect(dashboardUrl.toString())
}
