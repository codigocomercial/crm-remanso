import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST() {
  try {
    const supabase = await createClient()

    // 1. Buscar custos operacionais por mês
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

    // 2. Buscar custo MP agregado por pedido via SQL
    const { data: costRows, error: costError } = await supabase
      .rpc('calc_cost_mp_by_order', { p_org_id: ORG_ID })

    // Fallback: se RPC não existir, buscar manualmente
    let costMpMap: Record<string, number> = {}

    if (costError || !costRows) {
      // Buscar order_items e products separadamente
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, sku, quantity')
        .eq('org_id', ORG_ID)

      const { data: prods } = await supabase
        .from('products')
        .select('sku, cost_price')
        .eq('org_id', ORG_ID)

      const prodMap: Record<string, number> = {}
      for (const p of prods ?? []) {
        prodMap[p.sku] = Number(p.cost_price ?? 0)
      }

      for (const item of items ?? []) {
        const cost = prodMap[item.sku] ?? 0
        const qty = Number(item.quantity ?? 1)
        costMpMap[item.order_id] = (costMpMap[item.order_id] ?? 0) + cost * qty
      }
    } else {
      for (const row of costRows) {
        costMpMap[row.order_id] = Number(row.cost_mp)
      }
    }

    // 3. Buscar todos os pedidos
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_value, freight, units_count, ordered_at')
      .eq('org_id', ORG_ID)

    if (!orders?.length) {
      return NextResponse.json({ success: true, updated: 0, message: 'Nenhum pedido encontrado' })
    }

    let updated = 0

    for (const order of orders) {
      const orderedAt = order.ordered_at ? new Date(order.ordered_at) : new Date()
      const mesKey = `${orderedAt.getFullYear()}-${orderedAt.getMonth() + 1}`
      const opCostPerUnit = opCostMap[mesKey] ?? 0
      const unitsCount = order.units_count || 0
      const costMp = costMpMap[order.id] ?? 0
      const totalCost = costMp + (opCostPerUnit * unitsCount)
      const totalVenda = order.total_value || 0
      const frete = order.freight || 0
      const margin = totalVenda - totalCost - frete
      const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

      await supabase
        .from('orders')
        .update({ total_cost: totalCost, margin, margin_pct: marginPct })
        .eq('id', order.id)

      updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `${updated} pedidos recalculados com custos operacionais e MP atuais`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
