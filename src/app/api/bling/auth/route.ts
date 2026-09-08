import { NextResponse } from 'next/server'
import { BLING_AUTHORIZE_URL } from '@/lib/bling/api'

const CLIENT_ID = process.env.BLING_CLIENT_ID!
const REDIRECT_URI = process.env.BLING_REDIRECT_URI!

export async function GET() {
  const url = new URL(BLING_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('state', 'crm-remanso')
  return NextResponse.redirect(url.toString())
}
