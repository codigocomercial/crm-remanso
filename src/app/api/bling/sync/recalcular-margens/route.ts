import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST() {
  try {
    const supabase = await createClient()

    // 1. Buscar todos os custos operacionais
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

    // 2. Buscar todos os pedidos com seus itens
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_value, freight, units_count, ordered_at, cost_mp')
      .eq('org_id', ORG_ID)

    if (!orders?.length) {
      return NextResponse.json({ success: true, updated: 0, message: 'Nenhum pedido encontrado' })
    }

    let updated = 0
    const updates: any[] = []

    for (const order of orders) {
      const orderedAt = order.ordered_at ? new Date(order.ordered_at) : new Date()
      const mesKey = `${orderedAt.getFullYear()}-${orderedAt.getMonth() + 1}`
      const opCostPerUnit = opCostMap[mesKey] ?? 0
      const unitsCount = order.units_count || 0
      const costMp = order.cost_mp || 0
      const totalCost = costMp + (opCostPerUnit * unitsCount)
      const totalVenda = order.total_value || 0
      const frete = order.freight || 0
      const margin = totalVenda - totalCost - frete
      const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

      updates.push({
        id: order.id,
        total_cost: totalCost,
        margin,
        margin_pct: marginPct,
      })
    }

    // Atualizar em lotes de 50
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50)
      for (const u of batch) {
        await supabase
          .from('orders')
          .update({
            total_cost: u.total_cost,
            margin: u.margin,
            margin_pct: u.margin_pct,
          })
          .eq('id', u.id)
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `${updated} pedidos recalculados com os custos operacionais atuais`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
