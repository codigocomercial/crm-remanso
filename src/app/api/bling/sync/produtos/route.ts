import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

async function getBlingToken() {
  const supabase = await createClient()
  const { data } = await supabase.from('bling_tokens').select('access_token').single()
  return data?.access_token
}

async function blingFetch(path: string, token: string) {
  await new Promise(r => setTimeout(r, 400))
  const res = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Bling API error ${res.status}: ${JSON.stringify(json)}`)
  return json
}

export async function POST() {
  try {
    const token = await getBlingToken()
    if (!token) return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })

    runSync(token).catch(err => console.error('[sync/produtos] erro:', err.message))

    return NextResponse.json({ success: true, message: 'Sincronização de produtos iniciada' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function runSync(token: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  let total = 0
  let page = 1

  while (true) {
    const data = await blingFetch(`/produtos?pagina=${page}&limite=100&situacao=A`, token)
    const produtos = data?.data ?? []
    if (produtos.length === 0) break

    for (const p of produtos) {
      await supabase.from('products').upsert({
        org_id: ORG_ID,
        bling_id: p.id,
        name: p.nome ?? '',
        sku: p.codigo ?? null,
        product_line: p.linhaProduto?.descricao ?? null,
        category: p.linhaProduto?.descricao ?? null, // usar category como linha de produto
        price: p.preco ?? null,
        cost_price: p.precoCusto ?? null,
        stock_quantity: p.estoque?.saldoVirtualTotal ?? 0,
        is_active: p.situacao === 'A',
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,sku', ignoreDuplicates: false })

      total++
    }

    if (produtos.length < 100) break
    page++
  }

  console.log(`[sync/produtos] ${total} produtos sincronizados`)
}
