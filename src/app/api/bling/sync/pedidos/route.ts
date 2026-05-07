import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

async function getBlingToken() {
  const supabase = await createClient()
  const { data } = await supabase.from('bling_tokens').select('access_token').single()
  return data?.access_token
}

async function blingFetch(path: string, token: string) {
  await new Promise(r => setTimeout(r, 350))
  const res = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Bling ${res.status}: ${JSON.stringify(json)}`)
  return json
}

export async function POST() {
  try {
    const token = await getBlingToken()
    if (!token) return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })
    runSync(token).catch(err => console.error('[sync/pedidos]', err.message))
    return NextResponse.json({ success: true, message: 'Sincronização de pedidos iniciada' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function runSync(token: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  let page = 1
  let total = 0

  while (true) {
    // Buscar pedidos de venda — últimos 90 dias
    const dataInicio = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const data = await blingFetch(
      `/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${dataInicio}`,
      token
    )
    const pedidos = data?.data ?? []
    if (pedidos.length === 0) break

    for (const p of pedidos) {
      // Buscar detalhe do pedido para ter os itens
      let detail: any = null
      try {
        const d = await blingFetch(`/pedidos/vendas/${p.id}`, token)
        detail = d?.data ?? p
      } catch {
        detail = p
      }

      const itens = detail?.itens ?? []
      const contato = detail?.contato ?? {}
      const vendedor = detail?.vendedor ?? {}
      const totalValue = Number(detail?.totalProdutos ?? detail?.total ?? 0)

      // Mapear situação
      const situacaoId = detail?.situacao?.id ?? detail?.situacao
      const situacaoMap: Record<number, string> = {
        6: 'em_aberto', 9: 'atendido', 12: 'cancelado',
        15: 'em_andamento', 18: 'em_digitacao'
      }
      const status = situacaoMap[situacaoId] ?? 'em_aberto'

      // Upsert do pedido
      const { data: orderData, error } = await supabase
        .from('orders')
        .upsert({
          org_id: ORG_ID,
          bling_id: detail.id,
          bling_number: String(detail.numero ?? ''),
          bling_situation: String(situacaoId ?? ''),
          status,
          total_value: totalValue,
          client_name: contato?.nome ?? '',
          client_cnpj: contato?.numeroDocumento ?? '',
          client_city: contato?.endereco?.municipio ?? '',
          client_state: contato?.endereco?.uf ?? '',
          client_address: [
            contato?.endereco?.endereco,
            contato?.endereco?.numero,
            contato?.endereco?.bairro,
          ].filter(Boolean).join(', '),
          seller_name: vendedor?.nome ?? '',
          ordered_at: detail.data ? new Date(detail.data).toISOString() : null,
          expected_date: detail.dataPrevista ?? null,
          observations: detail.observacoes ?? null,
          discount: Number(detail?.desconto?.valor ?? 0),
          freight: Number(detail?.transporte?.frete ?? 0),
          bling_synced_at: new Date().toISOString(),
        }, { onConflict: 'bling_id' })
        .select('id')
        .single()

      if (error || !orderData) {
        console.error('[sync/pedidos] erro upsert:', error?.message)
        continue
      }

      const orderId = orderData.id

      // Deletar itens antigos e reinserir
      await supabase.from('order_items').delete().eq('order_id', orderId)

      for (const item of itens) {
        const sku = item?.codigo ?? item?.produto?.codigo ?? ''
        // Tentar vincular ao produto cadastrado
        const { data: prod } = await supabase
          .from('products')
          .select('id')
          .eq('org_id', ORG_ID)
          .eq('sku', sku)
          .single()

        await supabase.from('order_items').insert({
          org_id: ORG_ID,
          order_id: orderId,
          bling_item_id: item.id ?? null,
          product_id: prod?.id ?? null,
          sku,
          description: item?.descricao ?? item?.produto?.descricao ?? '',
          quantity: Number(item?.quantidade ?? 1),
          unit_price: Number(item?.valor ?? item?.valorUnitario ?? 0),
          total_price: Number(item?.quantidade ?? 1) * Number(item?.valor ?? item?.valorUnitario ?? 0),
        })
      }

      total++
    }

    if (pedidos.length < 100) break
    page++
  }

  console.log(`[sync/pedidos] ${total} pedidos sincronizados`)
}
