import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// GET — detalhes da carga + sugestões de clientes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params

    const { data: load, error } = await supabase
      .from('freight_loads')
      .select(`
        *,
        freight_load_orders (
          id, units_count, order_value, cost_mp, cost_op,
          freight_charged, margin, margin_pct,
          client_name, client_city, client_state, added_at,
          order:orders ( id, bling_number, status, ordered_at, company_id )
        )
      `)
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .single()

    if (error || !load) return NextResponse.json({ error: 'Carga não encontrada' }, { status: 404 })

    // Sugestões: pedidos em aberto não vinculados a cargas
    const orderIdsInLoad = load.freight_load_orders?.map((o: any) => o.order?.id).filter(Boolean) || []

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let suggestionsQuery = supabase
      .from('orders')
      .select(`
        id, bling_number, client_name, client_city, client_state,
        total_value, units_count, margin_pct, ordered_at,
        company:companies ( id, fantasia, city, state, distance_km, reorder_cycle_days, last_order_at )
      `)
      .eq('org_id', ORG_ID)
      .in('status', ['em_aberto', 'em_andamento'])
      .not('id', 'in', `(${['00000000-0000-0000-0000-000000000000', ...orderIdsInLoad].join(',')})`)
      .order('ordered_at', { ascending: false })
      .limit(50)

    if (dateFrom) suggestionsQuery = suggestionsQuery.gte('ordered_at', dateFrom)
    if (dateTo) suggestionsQuery = suggestionsQuery.lte('ordered_at', dateTo + 'T23:59:59')

    const { data: suggestions } = await suggestionsQuery

    // Clientes próximos da recompra na mesma direção
    const { data: nearbyContacts } = await supabase
      .from('companies')
      .select('id, fantasia, name, city, state, distance_km, reorder_cycle_days, last_order_at, average_order_value')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .not('distance_km', 'is', null)
      .order('distance_km', { ascending: true })
      .limit(30)

    return NextResponse.json({ load, suggestions: suggestions || [], nearbyContacts: nearbyContacts || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — atualizar carga ou adicionar/remover pedido
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (action === 'add_order') {
      // Busca dados do pedido
      const { data: order } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', body.order_id)
        .single()

      if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

      // Busca custo operacional do mês do pedido
      const orderDate = new Date(order.ordered_at)
      const { data: opCost } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('year', orderDate.getFullYear())
        .eq('month', orderDate.getMonth() + 1)
        .single()

      const costPerUnit = opCost && opCost.units_produced > 0
        ? (opCost.labor + opCost.admin + opCost.truck + opCost.maintenance + opCost.misc) / opCost.units_produced
        : 0

      const units = order.units_count || 0
      const costOp = costPerUnit * units
      // Usa o frete real do pedido (negociado com o cliente) — não o padrão da carga
      const freightCharged = Number(order.freight) || 0
      const margin = (order.total_value || 0) - (order.total_cost || 0) - costOp
      const marginPct = order.total_value > 0 ? (margin / order.total_value) * 100 : 0

      const { error: insertError } = await supabase
        .from('freight_load_orders')
        .insert({
          load_id: id,
          order_id: body.order_id,
          org_id: ORG_ID,
          units_count: units,
          order_value: order.total_value,
          cost_mp: order.total_cost,
          cost_op: costOp,
          freight_charged: freightCharged,
          margin,
          margin_pct: marginPct,
          client_name: order.client_name,
          client_city: order.client_city,
          client_state: order.client_state,
          added_by: user.id,
        })

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    } else if (action === 'remove_order') {
      await supabase
        .from('freight_load_orders')
        .delete()
        .eq('load_id', id)
        .eq('order_id', body.order_id)

    } else if (action === 'update_status') {
      await supabase
        .from('freight_loads')
        .update({ status: body.status })
        .eq('id', id)
        .eq('org_id', ORG_ID)

    } else {
      // Atualiza campos da carga
      const allowed = ['route_name', 'destination_city', 'destination_state', 'distance_km',
        'max_units', 'transport_type', 'cost_per_km', 'driver_daily_cost', 'trip_days',
        'freight_per_unit', 'estimated_departure', 'observations', 'route_notes']
      const updates: any = {}
      allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k] })

      await supabase
        .from('freight_loads')
        .update(updates)
        .eq('id', id)
        .eq('org_id', ORG_ID)
    }

    // Recalcula totais da carga
    const { data: loadOrders } = await supabase
      .from('freight_load_orders')
      .select('units_count, order_value, cost_mp, cost_op, freight_charged, margin')
      .eq('load_id', id)

    const { data: loadData } = await supabase
      .from('freight_loads')
      .select('distance_km, cost_per_km, driver_daily_cost, trip_days')
      .eq('id', id)
      .single()

    const totalUnits = loadOrders?.reduce((s, o) => s + (o.units_count || 0), 0) || 0
    const totalRevenue = loadOrders?.reduce((s, o) => s + (o.order_value || 0), 0) || 0
    const totalCostMp = loadOrders?.reduce((s, o) => s + (o.cost_mp || 0), 0) || 0
    const totalCostOp = loadOrders?.reduce((s, o) => s + (o.cost_op || 0), 0) || 0
    const totalFreightCharged = loadOrders?.reduce((s, o) => s + (o.freight_charged || 0), 0) || 0

    const freightCost = ((loadData?.distance_km || 0) * (loadData?.cost_per_km || 0)) +
      ((loadData?.driver_daily_cost || 0) * (loadData?.trip_days || 1))

    const totalMargin = totalRevenue - totalCostMp - totalCostOp - freightCost + totalFreightCharged
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    await supabase
      .from('freight_loads')
      .update({
        used_units: totalUnits,
        total_units: totalUnits,
        total_revenue: totalRevenue,
        total_cost_mp: totalCostMp,
        total_cost_op: totalCostOp,
        total_freight_cost: freightCost,
        total_freight_charged: totalFreightCharged,
        total_margin: totalMargin,
        total_margin_pct: totalMarginPct,
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — excluir carga
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await params

    const { error } = await supabase
      .from('freight_loads')
      .delete()
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .eq('status', 'forming') // Só pode deletar se ainda em formação

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
