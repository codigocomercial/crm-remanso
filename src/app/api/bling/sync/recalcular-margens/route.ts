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

    // 2. Buscar custo MP de todos os pedidos via order_items + products
    const { data: costRows } = await supabase
      .from('order_items')
      .select(`
        order_id,
        quantity,
        product:products ( cost_price )
      `)
      .eq('org_id', ORG_ID)

    // Agregar custo MP por order_id
    const costMpMap: Record<string, number> = {}
    for (const row of costRows ?? []) {
      const costPrice = Number((row.product as any)?.cost_price ?? 0)
      const qty = Number(row.quantity ?? 1)
      costMpMap[row.order_id] = (costMpMap[row.order_id] ?? 0) + costPrice * qty
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
