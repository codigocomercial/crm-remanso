import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

interface ProductPayload {
  bling_id: number
  sku: string
  name: string
  sale_price: number
  cost_price: number
  is_active: boolean
  stock_quantity: number | null
}

function parseBR(val: string): number {
  if (!val) return 0
  const s = val.trim()
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(s) || 0
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const products: ProductPayload[] = body.products ?? []

    if (!products.length) {
      return NextResponse.json({ error: 'Nenhum produto enviado' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const orgId = process.env.NEXT_PUBLIC_ORG_ID!

    let updated = 0
    const errors: string[] = []

    const BATCH = 50
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH).map(p => ({
        bling_id: p.bling_id,
        org_id: orgId,
        sku: p.sku,
        name: p.name,
        sale_price: p.sale_price,
        cost_price: p.cost_price > 0 ? p.cost_price : null,
        is_active: false, // nunca sobrescrever via import
        stock_quantity: p.stock_quantity != null ? Math.round(p.stock_quantity) : 0,
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .schema('crm')
        .from('products')
        .upsert(batch, { onConflict: 'bling_id', ignoreDuplicates: false })
        .select('id')

      if (error) {
        errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
      } else {
        updated += batch.length
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated,
      errors,
    })
  } catch (err) {
    console.error('Import products error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
