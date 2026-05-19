import { NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

const BLING_URL = 'https://www.bling.com.br/Api/v3'
const DELAY_MS = 400

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const STATUS_MAP: Record<number, string> = {
  6: 'em_aberto', 9: 'em_aberto', 11: 'em_aberto',
  15: 'em_andamento', 12: 'atendido', 13: 'cancelado'
}

export async function POST() {
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('bling_tokens').select('access_token').eq('org_id', ORG_ID).single()

  if (!tokenData?.access_token)
    return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })

  const token = tokenData.access_token

  async function blingGet(path: string) {
    await sleep(DELAY_MS)
    const res = await fetch(`${BLING_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`Bling ${res.status}: ${path}`)
    return res.json()
  }

  // ─── Helper: resolve vendedor pelo nome ──────────────────────────────────
  async function resolveSeller(vendorName: string | null): Promise<string | null> {
    if (!vendorName?.trim()) return null
    const name = vendorName.trim()
    const { data: seller } = await supabase
      .schema('crm').from('sellers').select('id')
      .eq('org_id', ORG_ID).ilike('name', name).maybeSingle()
    if (seller) return seller.id
    // Cria se não existir
    const { data: ns } = await supabase
      .schema('crm').from('sellers')
      .insert({ org_id: ORG_ID, name: name.toUpperCase(), is_active: true })
      .select('id').single()
    return ns?.id ?? null
  }

  try {
    // ─── 1. Buscar IDs do Bling desde jan/2026 ────────────────────────────
    const dataInicio = '2026-01-01'
    let blingIds: number[] = []
    let page = 1
    while (true) {
      const data = await blingGet(`/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${dataInicio}`)
      const pedidos = data?.data ?? []
      if (pedidos.length === 0) break
      blingIds = blingIds.concat(pedidos.map((p: any) => p.id))
      if (pedidos.length < 100) break
      page++
    }

    // ─── 2. Verificar quais já têm itens ─────────────────────────────────
    const { data: existingOrders } = await supabase
      .from('crm_orders').select('id, bling_id').eq('org_id', ORG_ID).in('bling_id', blingIds)

    const { data: ordersWithItems } = await supabase
      .from('crm_order_items').select('order_id').eq('org_id', ORG_ID)

    const idsWithItems = new Set((ordersWithItems ?? []).map((i: any) => i.order_id))
    const blingIdsWithItems = new Set(
      (existingOrders ?? []).filter((o: any) => idsWithItems.has(o.id)).map((o: any) => o.bling_id)
    )

    const toProcess = blingIds.filter(id => !blingIdsWithItems.has(id))

    // ─── 3. Buscar configurações ──────────────────────────────────────────
    const { data: org } = await supabase.schema('crm').from('organizations').select('tax_rate').eq('id', ORG_ID).single()
    const taxRate = Number(org?.tax_rate ?? 4.5) / 100

    const { data: opCosts } = await supabase
      .schema('crm').from('operational_costs')
      .select('year, month, cost_per_unit').eq('org_id', ORG_ID)
    const opCostMap = new Map((opCosts ?? []).map((c: any) => [`${c.year}-${c.month}`, Number(c.cost_per_unit ?? 0)]))

    let processed = 0, sellerUpdated = 0, errors = 0

    // ─── 4. Processar pedidos novos (sem itens) ───────────────────────────
    for (const blingId of toProcess) {
      try {
        const detail = await blingGet(`/pedidos/vendas/${blingId}`)
        const p = detail?.data
        if (!p) continue

        const itens = p.itens ?? []
        const totalBruto = Number(p.totalProdutos ?? 0)
        const desconto = Number(p.desconto?.valor ?? 0)
        const totalVenda = totalBruto - desconto
        const frete = Number(p.transporte?.frete ?? 0)
        const unitsCount = itens.reduce((s: number, i: any) => s + Number(i.quantidade ?? 1), 0)

        // Custo MP
        let costMp = 0
        for (const item of itens) {
          const { data: prod } = await supabase.from('crm_products').select('cost_price')
            .eq('sku', item.codigo?.trim()).eq('org_id', ORG_ID).maybeSingle()
          costMp += Number(prod?.cost_price ?? 0) * Number(item.quantidade ?? 1)
        }

        // Custo operacional
        const orderedAt = p.data ? new Date(p.data) : new Date()
        const costOp = (opCostMap.get(`${orderedAt.getFullYear()}-${orderedAt.getMonth() + 1}`) ?? 0) * unitsCount

        // CML
        const taxAmount = totalVenda * taxRate
        const margin = totalVenda - costMp - costOp - taxAmount
        const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

        // Empresa por CNPJ
        const cnpj = p.contato?.numeroDocumento?.replace(/\D/g, '') ?? null
        let companyId = null
        if (cnpj) {
          const { data: co } = await supabase.from('crm_companies').select('id')
            .eq('cnpj', cnpj).eq('org_id', ORG_ID).maybeSingle()
          companyId = co?.id ?? null
        }

        const sellerId = await resolveSeller(p.vendedor?.nome ?? null)

        await supabase.rpc('upsert_crm_order_full', {
          p_org_id: ORG_ID, p_bling_id: p.id,
          p_bling_number: String(p.numero ?? ''),
          p_company_id: companyId, p_seller_id: sellerId,
          p_client_name: p.contato?.nome ?? '',
          p_client_cnpj: p.contato?.numeroDocumento ?? null,
          p_client_city: p.contato?.endereco?.municipio ?? null,
          p_client_state: p.contato?.endereco?.uf ?? null,
          p_ordered_at: p.data ?? new Date().toISOString().split('T')[0],
          p_status: STATUS_MAP[Number(p.situacao?.id)] ?? 'em_aberto',
          p_payment_notes: p.observacoes ?? null,
          p_total_value: totalVenda, p_freight: frete, p_discount: desconto,
          p_grand_total: totalVenda + frete, p_units_count: unitsCount,
          p_cost_mp: costMp, p_cost_op: costOp, p_tax_amount: taxAmount,
          p_total_cost: costMp + costOp, p_margin: margin, p_margin_pct: marginPct,
          p_itens: itens,
        })

        processed++
      } catch (err: any) {
        console.error(`[sync/pedidos] erro pedido ${blingId}:`, err.message)
        errors++
      }
    }

    // ─── 5. Atualizar vendedor nos pedidos sem seller_id ──────────────────
    const { data: semVendedor } = await supabase
      .schema('crm').from('orders')
      .select('id, bling_id, bling_number')
      .eq('org_id', ORG_ID)
      .is('seller_id', null)

    for (const order of semVendedor ?? []) {
      try {
        const detail = await blingGet(`/pedidos/vendas/${order.bling_id}`)
        const p = detail?.data
        if (!p) continue

        const vendorName = p.vendedor?.nome ?? null
        if (!vendorName) continue

        const sellerId = await resolveSeller(vendorName)
        if (!sellerId) continue

        await supabase.schema('crm').from('orders')
          .update({ seller_id: sellerId, updated_at: new Date().toISOString() })
          .eq('id', order.id)

        sellerUpdated++
      } catch (err: any) {
        console.error(`[sync/vendedor] erro ${order.bling_number}:`, err.message)
        errors++
      }
    }

    // ─── 6. Atualizar métricas das empresas ───────────────────────────────
    await supabase.rpc('update_company_metrics', { p_org_id: ORG_ID })

    return NextResponse.json({
      success: true, processed, sellerUpdated, errors,
      total_bling: blingIds.length,
      message: `${processed} pedidos novos, ${sellerUpdated} vendedores vinculados${errors > 0 ? `, ${errors} erros` : ''}`
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}