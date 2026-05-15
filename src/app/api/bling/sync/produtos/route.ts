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
    // Busca todos os produtos ativos (simples e com composição)
    const data = await blingFetch(`/produtos?pagina=${page}&limite=100&situacao=A&tipo=P,K`, token)
    const produtos = data?.data ?? []
    if (produtos.length === 0) break

    for (const p of produtos) {
      if (!p.id) continue

      // Busca detalhe individual — precoCusto na listagem pode estar desatualizado
      let detail = p
      try {
        const d = await blingFetch(`/produtos/${p.id}`, token)
        if (d?.data) detail = d.data
      } catch { /* usa dados da listagem */ }

      const { error } = await supabase.from('products').upsert({
        org_id: ORG_ID,
        bling_id: detail.id,
        name: detail.nome ?? '',
        sku: detail.codigo ?? null,
        product_line: detail.linhaProduto?.descricao ?? null,
        category: detail.linhaProduto?.descricao ?? null,
        price: detail.preco ?? null,
        cost_price: detail.precoCusto ?? null,
        stock_quantity: detail.estoque?.saldoVirtualTotal ?? 0,
        is_active: detail.situacao === 'A',
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,sku', ignoreDuplicates: false })

      if (error) console.error(`[sync/produtos] erro SKU ${p.codigo}:`, error.message)
      else total++
    }

    if (produtos.length < 100) break
    page++
  }

  console.log(`[sync/produtos] ${total} produtos sincronizados`)
}
