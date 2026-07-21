import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'
import { mapBlingOrderStatus } from '@/lib/bling/order-status'
import { createHmac } from 'crypto'

const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET ?? '95bf4297fe093bab99e168f15737c7d31e5a454d944e21f1bc53e95f5aec'

// Valida assinatura HMAC do Bling
function validateSignature(payload: string, signature: string): boolean {
  const hash = createHmac('sha256', CLIENT_SECRET).update(payload, 'utf8').digest('hex')
  return signature === `sha256=${hash}`
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('X-Bling-Signature-256') ?? ''

    // Validar assinatura
    if (!validateSignature(rawBody, signature)) {
      console.error('[webhook/bling] assinatura inválida')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const event: string = body.event ?? ''
    const data = body.data ?? {}

    console.log(`[webhook/bling] evento: ${event}`)

    const supabase = createServiceClient()

    // ── PRODUTO ──────────────────────────────────────────
    if (event === 'product.created' || event === 'product.updated') {
      const p = data
      if (p.id && p.codigo) {
        await supabase.from('products').upsert({
          org_id: ORG_ID,
          bling_id: p.id,
          sku: p.codigo,
          name: p.nome ?? '',
          price: p.preco ?? null,
          cost_price: p.precoCusto ?? null,
          stock_quantity: p.estoque?.saldoVirtualTotal ?? 0,
          is_active: p.situacao === 'A',
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,sku', ignoreDuplicates: false })
      }
    }

    if (event === 'product.deleted') {
      await supabase.from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('bling_id', data.id)
        .eq('org_id', ORG_ID)
    }

    // ── ESTOQUE ───────────────────────────────────────────
    if (event === 'stock.updated' || event === 'virtual_stock.updated') {
      const productId = data.produto?.id
      const saldo = data.saldoVirtualTotal ?? data.saldo ?? null
      if (productId && saldo !== null) {
        await supabase.from('products')
          .update({ stock_quantity: saldo, updated_at: new Date().toISOString() })
          .eq('bling_id', productId)
          .eq('org_id', ORG_ID)
      }
    }

    // ── PEDIDO DE VENDA ───────────────────────────────────
    if (event === 'order.created' || event === 'order.updated') {
      const o = data
      if (!o.id) return NextResponse.json({ ok: true })

      // Buscar custo operacional do mês do pedido
      const orderedAt = o.data ? new Date(o.data) : new Date()
      const year = orderedAt.getFullYear()
      const month = orderedAt.getMonth() + 1

      const { data: opCost } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('year', year)
        .eq('month', month)
        .single()

      const opCostPerUnit = opCost
        ? (opCost.labor + opCost.admin + opCost.truck + opCost.maintenance +
           opCost.misc + opCost.tax + opCost.icms + opCost.freight_purchase +
           opCost.interest + opCost.discount_boletos) / opCost.units_produced
        : 0

      const { data: org } = await supabase
        .from('organizations')
        .select('tax_rate')
        .eq('id', ORG_ID)
        .single()
      const taxRate = Number(org?.tax_rate ?? 4.5) / 100

      const itens = o.itens ?? []
      const unitsCount = itens.reduce((s: number, i: any) => s + Number(i.quantidade ?? 1), 0)
      const totalBruto = Number(o.totalProdutos ?? 0)
      const desconto = Number(o.desconto?.valor ?? 0)
      const totalVenda = totalBruto - desconto
      const frete = Number(o.transporte?.frete ?? 0)

      // Custo MP — buscar cost_price dos produtos
      let totalCostMp = 0
      for (const item of itens) {
        const { data: prod } = await supabase
          .from('products')
          .select('cost_price')
          .eq('sku', item.codigo)
          .eq('org_id', ORG_ID)
          .single()
        totalCostMp += Number(prod?.cost_price ?? 0) * Number(item.quantidade ?? 1)
      }

      const totalCost = totalCostMp + (opCostPerUnit * unitsCount)
      const impostos = totalVenda * taxRate
      const margin = totalVenda - totalCost - impostos
      const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

      // Buscar empresa pelo CNPJ
      const cnpj = o.contato?.numeroDocumento ?? null
      let companyId = null
      if (cnpj) {
        const { data: company } = await supabase
          .from('companies').select('id').eq('cnpj', cnpj).eq('org_id', ORG_ID).single()
        companyId = company?.id ?? null
      }

      // Buscar vendedor
      const { data: seller } = await supabase
        .from('sellers').select('id').eq('bling_id', o.vendedor?.id).single()

      const orderPayload = {
        org_id: ORG_ID,
        bling_id: o.id,
        bling_number: String(o.numero ?? ''),
        client_name: o.contato?.nome ?? '',
        client_cnpj: cnpj,
        company_id: companyId,
        seller_id: seller?.id ?? null,
        ordered_at: o.data ? new Date(o.data).toISOString() : new Date().toISOString(),
        status: mapBlingOrderStatus(o.situacao),
        total_value: totalVenda,
        freight: frete,
        total_cost: totalCost,
        margin,
        margin_pct: marginPct,
        units_count: unitsCount,
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: savedOrder, error: orderError } = await supabase
        .from('orders')
        .upsert(orderPayload, { onConflict: 'bling_id', ignoreDuplicates: false })
        .select('id')
        .single()

      if (orderError) {
        console.error('[webhook/bling] erro ao salvar pedido:', orderError.message)
      } else if (savedOrder && itens.length > 0) {
        // Salvar itens
        await supabase.from('order_items').delete().eq('order_id', savedOrder.id)
        const itemsPayload = itens.map((item: any) => ({
          order_id: savedOrder.id,
          org_id: ORG_ID,
          sku: item.codigo,
          description: item.descricao ?? '',
          quantity: Number(item.quantidade ?? 1),
          unit_price: Number(item.valor ?? 0),
          total_price: Number(item.valor ?? 0) * Number(item.quantidade ?? 1),
        }))
        await supabase.from('order_items').insert(itemsPayload)
      }
    }

    // Sempre responder 200 em até 5 segundos
    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[webhook/bling] erro:', err.message)
    // Retornar 200 mesmo com erro interno — evita retry loop do Bling
    return NextResponse.json({ ok: true })
  }
}
