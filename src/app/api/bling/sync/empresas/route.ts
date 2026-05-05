import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

async function getBlingToken() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('bling_tokens')
        .select('access_token')
        .single()
    return data?.access_token
}

async function blingFetch(path: string, token: string) {
    const res = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`Bling API error ${res.status}: ${JSON.stringify(json)}`)
    return json
}

export async function POST() {
    try {
        const supabase = await createClient()
        const token = await getBlingToken()

        if (!token) {
            console.error('[sync/empresas] token não encontrado')
            return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })
        }

        console.log('[sync/empresas] iniciando...')

        const data = await blingFetch('/contatos?pagina=1&limite=10', token)
        console.log('[sync/empresas] retorno:', JSON.stringify(data).slice(0, 500))

        return NextResponse.json({ success: true, debug: data })

    } catch (error: any) {
        console.error('[sync/empresas] erro:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}