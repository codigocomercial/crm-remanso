import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

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
          id, order_id, bling_number, units_count, order_value, cost_mp, cost_op,
          freight_charged, margin, margin_pct,
          client_name, client_city, client_state, added_at
        )
      `)
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .single()

    if (error || !load) return NextResponse.json({ error: 'Carga não encontrada' }, { status: 404 })

    const loadFormatted = {
      ...load,
      freight_load_orders: (load.freight_load_orders || []).map((flo: any) => ({
        ...flo,
        order: { id: flo.order_id, bling_number: flo.bling_number, status: null, ordered_at: null }
      }))
    }

    const orderIdsInLoad = (load.freight_load_orders || []).map((o: any) => o.order_id).filter(Boolean)

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let suggestionsQuery = supabase
      .from('crm_orders')
      .select(`
        id, bling_number, client_name, client_city, client_state,
        total_value, units_count, margin_pct, ordered_at,
        company:crm_companies ( id, fantasia, city, state, distance_km, reorder_cycle_days, last_order_at )
      `)
      .eq('org_id', ORG_ID)
      .in('status', ['em_aberto', 'em_andamento'])
      .not('id', 'in', `(${['00000000-0000-0000-0000-000000000000', ...orderIdsInLoad].join(',')})`)
      .order('ordered_at', { ascending: false })
      .limit(200)

    if (dateFrom) suggestionsQuery = suggestionsQuery.gte('ordered_at', dateFrom)
    if (dateTo) suggestionsQuery = suggestionsQuery.lte('ordered_at', dateTo + 'T23:59:59')

    const { data: suggestions } = await suggestionsQuery

    const { data: nearbyContacts } = await supabase
      .from('crm_companies')
      .select('id, fantasia, name, city, state, distance_km, reorder_cycle_days, last_order_at, average_order_value')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .not('distance_km', 'is', null)
      .order('distance_km', { ascending: true })
      .limit(30)

    return NextResponse.json({ load: loadFormatted, suggestions: suggestions || [], nearbyContacts: nearbyContacts || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── Helper: recalcula margem de todos os pedidos da carga ─────────────────
// Lógica:
//   custo_viagem = distance_km × cost_per_km + driver_daily × trip_days
//   frete_cobrado = soma dos freight_charged de todos os pedidos
//   deficit_frete = custo_viagem - frete_cobrado  (pode ser negativo = sobra)
//   deficit_por_urna = deficit_frete / total_urnas
//   margem_na_carga = margem_crm - (deficit_por_urna × urnas_do_pedido)
async function recalcularMargensCarga(supabase: any, loadId: string) {
  // Buscar dados da carga
  const { data: loadData } = await supabase
    .from('freight_loads')
    .select('distance_km, cost_per_km, driver_daily_cost, trip_days')
    .eq('id', loadId)
    .single()

  // Buscar todos os pedidos da carga com margem real do crm
  const { data: loadOrders } = await supabase
    .from('freight_load_orders')
    .select('id, order_id, units_count, freight_charged')
    .eq('load_id', loadId)

  if (!loadOrders || loadOrders.length === 0) {
    // Zerar totais se não há pedidos
    await supabase.from('freight_loads').update({
      used_units: 0, total_units: 0, total_revenue: 0,
      total_cost_mp: 0, total_cost_op: 0,
      total_freight_cost: 0, total_freight_charged: 0,
      total_margin: 0, total_margin_pct: 0,
    }).eq('id', loadId)
    return
  }

  // Buscar margem real de cada pedido no crm
  const orderIds = loadOrders.map((o: any) => o.order_id)
  const { data: crmOrders } = await supabase
    .from('crm_orders')
    .select('id, total_value, margin, margin_pct, cost_mp, freight')
    .in('id', orderIds)

  const crmMap = new Map<string, any>((crmOrders || []).map((o: any) => [o.id, o]))

  // Calcular custo da viagem
  const freightCost = ((loadData?.distance_km || 0) * (loadData?.cost_per_km || 0)) +
    ((loadData?.driver_daily_cost || 0) * (loadData?.trip_days || 1))

  // Totais da carga
  const totalUnits = loadOrders.reduce((s: number, o: any) => s + (o.units_count || 0), 0)
  const totalFreightCharged = loadOrders.reduce((s: number, o: any) => s + Number(o.freight_charged || 0), 0)

  // Déficit de frete rateado por urna
  const deficitFrete = freightCost - totalFreightCharged
  const deficitPorUrna = totalUnits > 0 ? deficitFrete / totalUnits : 0

  // Recalcular margem de cada pedido na carga
  let totalRevenue = 0, totalCostMp = 0, totalMargin = 0

  for (const flo of loadOrders) {
    const crm = crmMap.get(flo.order_id)
    if (!crm) continue

    const margemCrm = Number(crm.margin || 0)
    const margemNaCarga = margemCrm - (deficitPorUrna * (flo.units_count || 0))
    const totalValue = Number(crm.total_value || 0)
    const margemPctNaCarga = totalValue > 0 ? (margemNaCarga / totalValue) * 100 : 0

    await supabase.from('freight_load_orders')
      .update({
        margin: margemNaCarga,
        margin_pct: margemPctNaCarga,
        cost_mp: Number(crm.cost_mp || 0),
        order_value: totalValue,
      })
      .eq('id', flo.id)

    totalRevenue += totalValue
    totalCostMp += Number(crm.cost_mp || 0)
    totalMargin += margemNaCarga
  }

  const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  // Atualizar totais da carga
  await supabase.from('freight_loads').update({
    used_units: totalUnits,
    total_units: totalUnits,
    total_revenue: totalRevenue,
    total_cost_mp: totalCostMp,
    total_freight_cost: freightCost,
    total_freight_charged: totalFreightCharged,
    total_margin: totalMargin,
    total_margin_pct: totalMarginPct,
  }).eq('id', loadId)
}

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
      const { data: order } = await supabase
        .from('crm_orders')
        .select('id, bling_number, total_value, freight, margin, margin_pct, total_cost, cost_mp, units_count, client_name, client_city, client_state, ordered_at')
        .eq('id', body.order_id)
        .single()

      if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

      // Inserir com margem temporária — será recalculada logo abaixo
      const { error: insertError } = await supabase
        .from('freight_load_orders')
        .insert({
          load_id: id,
          order_id: body.order_id,
          bling_number: order.bling_number,
          org_id: ORG_ID,
          units_count: order.units_count || 0,
          order_value: order.total_value || 0,
          cost_mp: order.cost_mp || 0,
          cost_op: 0,
          freight_charged: Number(order.freight) || 0,
          margin: order.margin || 0,
          margin_pct: order.margin_pct || 0,
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
      const allowed = ['route_name', 'destination_city', 'destination_state', 'distance_km',
        'max_units', 'transport_type', 'cost_per_km', 'driver_daily_cost', 'trip_days',
        'freight_per_unit', 'estimated_departure', 'observations', 'route_notes']
      const updates: any = {}
      allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k] })
      await supabase.from('freight_loads').update(updates).eq('id', id).eq('org_id', ORG_ID)
    }

    // Recalcular margens de todos os pedidos da carga
    await recalcularMargensCarga(supabase, id)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

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
      .eq('status', 'forming')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}