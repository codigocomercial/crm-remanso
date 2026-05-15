import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('bling_tokens').select('access_token').single()
  const token = data?.access_token
  if (!token) return NextResponse.json({ error: 'sem token' })

  const res = await fetch('https://www.bling.com.br/Api/v3/pedidos/vendas/25794390138', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  const d = json?.data ?? {}
  return NextResponse.json({
    total: d.total,
    totalProdutos: d.totalProdutos,
    desconto: d.desconto,
    outrasDespesas: d.outrasDespesas,
    totalVenda: d.totalVenda,
    valor: d.valor,
    keys_top_level: Object.keys(d),
  })
}
