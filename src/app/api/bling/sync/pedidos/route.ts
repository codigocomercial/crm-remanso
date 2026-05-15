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
  if (!res.ok) throw new Error(`Bling API ${res.status}: ${JSON.stringify(json)}`)
  return json
}

function mapStatus(situacaoId: number): string {
  const map: Record<number, string> = {
    6:  'em_aberto',
    9:  'atendido',
    12: 'cancelado',
    15: 'em_andamento',
    18: 'em_digitacao',
  }
  return map[situacaoId] ?? 'em_aberto'
}

export async function POST() {
  try {
    const token = await getBlingToken()
    if (!token) return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })
    runSync(token).catch(err => console.error('[sync/pedidos] erro:', err.message))
    return NextResponse.json({ success: true, message: 'Sincronização de pedidos iniciada' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function runSync(token: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Buscar configurações da organização (tax_rate)
  const { data: org } = await supabase
    .from('organizations')
    .select('tax_rate')
    .eq('id', ORG_ID)
    .single()
  const taxRate = Number(org?.tax_rate ?? 4.5) / 100

  // Buscar custos operacionais
  const { data: opCosts } = await supabase
    .from('operational_costs')
    .select('*')
    .eq('org_id', ORG_ID)

  const opCostMap: Record<string, number> = {}
  for (const oc of opCosts ?? []) {
    const total = oc.labor + oc.admin + oc.truck + oc.maintenance + oc.misc +
                  oc.tax + oc.icms + oc.freight_purchase + oc.interest + oc.discount_boletos
    const perUnit = oc.units_produced > 0 ? total / oc.units_produced : 0
    opCostMap[`${oc.year}-${oc.month}`] = perUnit
  }

  // Buscar vendedores para mapear ID → nome
  const { data: sellers } = await supabase
    .from('sellers')
    .select('bling_id, name')
    .eq('org_id', ORG_ID)
  const sellerMap: Record<string, string> = {}
  for (const s of sellers ?? []) {
    if (s.bling_id) sellerMap[String(s.bling_id)] = s.name
  }

  let page = 1
  let total = 0
  const dataInicio = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  while (true) {
    let listData: any
    try {
      listData = await blingFetch(
        `/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${dataInicio}`,
        token
      )
    } catch (e: any) {
      console.error('[sync/pedidos] listagem:', e.message)
      break
    }

    const pedidos = listData?.data ?? []
    if (pedidos.length === 0) break

    for (const p of pedidos) {
      let detail: any
      try {
        const d = await blingFetch(`/pedidos/vendas/${p.id}`, token)
        detail = d?.data ?? p
      } catch { detail = p }

      const itens = detail?.itens ?? []
      const contato = detail?.contato ?? {}
      const situacaoId = Number(detail?.situacao?.id ?? 6)
      const status = mapStatus(situacaoId)

      // total = valor final com desconto já abatido; totalProdutos = bruto sem desconto
      const totalVenda = Number(detail?.total ?? detail?.totalProdutos ?? 0)
      const frete = Number(detail?.transporte?.frete ?? 0)
      const unitsCount = itens.reduce((s: number, i: any) => s + Number(i?.quantidade ?? 1), 0)

      // Vendedor: tentar pelo ID no mapa, senão pelo nome direto
      const vendedorId = String(detail?.vendedor?.id ?? '')
      const sellerName = sellerMap[vendedorId] ?? detail?.vendedor?.nome ?? ''

      // Data do pedido
      const orderedAt = detail?.data ? new Date(detail.data) : new Date()
      const mesKey = `${orderedAt.getFullYear()}-${orderedAt.getMonth() + 1}`
      const opCostPerUnit = opCostMap[mesKey] ?? 0

      // Calcular custo MP pelos SKUs dos itens
      let totalCostMp = 0
      for (const item of itens) {
        const sku = item?.codigo ?? ''
        const qty = Number(item?.quantidade ?? 1)
        if (sku) {
          const { data: prod } = await supabase
            .from('products')
            .select('cost_price')
            .eq('org_id', ORG_ID)
            .eq('sku', sku)
            .single()
          totalCostMp += (Number(prod?.cost_price) || 0) * qty
        }
      }

      const totalCost = totalCostMp + (opCostPerUnit * unitsCount)
      const impostos = totalVenda * taxRate
      const margin = totalVenda - totalCost - impostos  // CML = Venda - CustoMP - CustoOp - Impostos
      const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

      // Buscar empresa pelo CNPJ
      const cnpj = contato?.numeroDocumento ?? ''
      let companyId: string | null = null
      if (cnpj) {
        const cnpjLimpo = cnpj.replace(/\D/g, '')
        const { data: comp } = await supabase
          .from('companies')
          .select('id')
          .eq('org_id', ORG_ID)
          .or(`cnpj.eq.${cnpj},cnpj.eq.${cnpjLimpo}`)
          .single()
        companyId = comp?.id ?? null
      }

      // Upsert pedido
      const { data: orderData, error } = await supabase
        .from('orders')
        .upsert({
          org_id: ORG_ID,
          bling_id: detail.id,
          bling_number: String(detail.numero ?? ''),
          bling_situation: String(situacaoId),
          status,
          total_value: totalVenda,
          freight: frete,
          total_cost: totalCost,
          margin,
          margin_pct: marginPct,
          units_count: unitsCount,
          client_name: contato?.nome ?? '',
          client_cnpj: cnpj,
          seller_name: sellerName,
          ordered_at: detail.data ? detail.data + 'T12:00:00-03:00' : null,
          observations: detail.observacoes ?? null,
          company_id: companyId,
          bling_synced_at: new Date().toISOString(),
        }, { onConflict: 'bling_id' })
        .select('id')
        .single()

      if (error || !orderData) {
        console.error('[sync/pedidos] upsert erro:', error?.message)
        continue
      }

      // Itens
      await supabase.from('order_items').delete().eq('order_id', orderData.id)
      for (const item of itens) {
        const sku = item?.codigo ?? ''
        const qty = Number(item?.quantidade ?? 1)
        const unitPrice = Number(item?.valor ?? 0)
        const { data: prod } = await supabase
          .from('products').select('id')
          .eq('org_id', ORG_ID).eq('sku', sku).single()

        await supabase.from('order_items').insert({
          org_id: ORG_ID,
          order_id: orderData.id,
          product_id: prod?.id ?? null,
          sku,
          description: item?.descricao ?? '',
          quantity: qty,
          unit_price: unitPrice,
          total_price: qty * unitPrice,
        })
      }

      // Atualizar empresa
      if (companyId) {
        const { data: allOrders } = await supabase
          .from('orders').select('total_value, ordered_at')
          .eq('org_id', ORG_ID).eq('company_id', companyId)
          .not('total_value', 'is', null)
        if (allOrders && allOrders.length > 0) {
          const avg = allOrders.reduce((s, o) => s + Number(o.total_value ?? 0), 0) / allOrders.length
          const last = allOrders.sort((a, b) =>
            new Date(b.ordered_at ?? 0).getTime() - new Date(a.ordered_at ?? 0).getTime())[0]
          await supabase.from('companies').update({
            last_order_at: last.ordered_at,
            average_order_value: avg,
          }).eq('id', companyId)
        }
      }

      total++
    }

    if (pedidos.length < 100) break
    page++
  }

  console.log(`[sync/pedidos] ${total} pedidos sincronizados`)

  // Atualiza status ativo/inativo de todos os clientes após o sync
  await supabase.rpc('update_companies_active_status', { p_org_id: ORG_ID })
  console.log('[sync/pedidos] status de clientes atualizado')
}
