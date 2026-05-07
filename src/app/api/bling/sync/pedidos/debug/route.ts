import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: tokenData } = await supabase
      .from('bling_tokens')
      .select('access_token, expires_at')
      .single()

    if (!tokenData?.access_token) {
      return NextResponse.json({ erro: 'Token não encontrado' })
    }

    const expirado = new Date(tokenData.expires_at) < new Date()
    if (expirado) {
      return NextResponse.json({ erro: 'Token expirado', expires_at: tokenData.expires_at })
    }

    // Testar listagem de pedidos
    const dataInicio = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=1&limite=5&dataInicial=${dataInicio}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })

    const json = await res.json()

    // Testar detalhe do primeiro pedido se existir
    let detalhe = null
    if (json?.data?.[0]?.id) {
      const res2 = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${json.data[0].id}`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      )
      detalhe = await res2.json()
    }

    return NextResponse.json({
      token_ok: true,
      data_inicio: dataInicio,
      status_bling: res.status,
      total_retornado: json?.data?.length ?? 0,
      primeiro_pedido: json?.data?.[0] ?? null,
      detalhe_primeiro: detalhe?.data ?? null,
      erro_bling: json?.error ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message })
  }
}
