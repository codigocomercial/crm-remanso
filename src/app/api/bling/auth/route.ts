import { NextResponse } from 'next/server'

const CLIENT_ID = process.env.BLING_CLIENT_ID!
const REDIRECT_URI = process.env.BLING_REDIRECT_URI!

export async function GET() {
  const url = new URL('https://www.bling.com.br/Api/v3/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('state', 'crm-remanso')
  return NextResponse.redirect(url.toString())
}
