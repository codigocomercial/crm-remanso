import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'

    let query = supabase
      .from('freight_loads')
      .select(`
        *,
        freight_load_orders (
          id, order_id, bling_number, units_count, order_value, cost_mp, cost_op,
          freight_charged, margin, margin_pct,
          client_name, client_city, client_state, added_at
        )
      `)
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enriquecer com nome fantasia da empresa (via company_id do pedido)
    const allOrderIds = (data || []).flatMap((l: any) =>
      (l.freight_load_orders || []).map((flo: any) => flo.order_id).filter(Boolean)
    )
    const companyMap = new Map<string, string>()
    if (allOrderIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('crm_orders')
        .select('id, company:crm_companies(fantasia, corporate_name)')
        .in('id', allOrderIds)
      ;(ordersData || []).forEach((o: any) => {
        const name = o.company?.fantasia || o.company?.corporate_name || null
        if (name) companyMap.set(o.id, name)
      })
    }

    // Montar estrutura compatível com o front (order.bling_number)
    const loads = (data || []).map((load: any) => ({
      ...load,
      freight_load_orders: (load.freight_load_orders || []).map((flo: any) => ({
        ...flo,
        company_fantasia: companyMap.get(flo.order_id) || null,
        order: { id: flo.order_id, bling_number: flo.bling_number, status: null, ordered_at: null }
      }))
    }))

    return NextResponse.json({ loads })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()

    const { data, error } = await supabase
      .from('freight_loads')
      .insert({
        org_id: ORG_ID,
        route_name: body.route_name,
        destination_city: body.destination_city,
        destination_state: body.destination_state,
        distance_km: body.distance_km,
        max_units: body.max_units || 48,
        transport_type: body.transport_type || 'own',
        cost_per_km: body.cost_per_km,
        driver_daily_cost: body.driver_daily_cost,
        trip_days: body.trip_days || 1,
        freight_per_unit: body.freight_per_unit || 30,
        estimated_departure: body.estimated_departure,
        observations: body.observations,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ load: data })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}