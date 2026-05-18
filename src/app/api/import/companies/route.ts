import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

interface CompanyPayload {
  bling_id: number
  corporate_name: string
  fantasy_name: string | null
  cnpj: string | null
  state_registration: string | null
  city: string | null
  state: string | null
  address: string | null
  number: string | null
  neighborhood: string | null
  zip_code: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  is_active: boolean
  client_since: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companies: CompanyPayload[] = body.companies ?? []

    if (!companies.length) {
      return NextResponse.json({ error: 'Nenhuma empresa enviada' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Buscar org_id
    const orgId = process.env.NEXT_PUBLIC_ORG_ID!

    let inserted = 0
    let updated = 0
    const errors: string[] = []

    // Processar em lotes de 50
    const BATCH = 50
    for (let i = 0; i < companies.length; i += BATCH) {
      const batch = companies.slice(i, i + BATCH).map(c => ({
        bling_id: c.bling_id,
        org_id: orgId,
        corporate_name: c.corporate_name,
        fantasy_name: c.fantasy_name || null,
        cnpj: c.cnpj || null,
        state_registration: c.state_registration || null,
        city: c.city || null,
        state: c.state || null,
        address: c.address || null,
        number: c.number || null,
        neighborhood: c.neighborhood || null,
        zip_code: c.zip_code || null,
        phone: c.phone || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        is_active: c.is_active,
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { error, count } = await supabase
        .from('companies')
        .upsert(batch, {
          onConflict: 'bling_id',
          ignoreDuplicates: false,
        })
        .select('id')

      if (error) {
        errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
      } else {
        // Aproximação: se já existia = update, se não = insert
        updated += batch.length
      }
    }

    inserted = Math.max(0, companies.length - updated)

    return NextResponse.json({
      success: errors.length === 0,
      inserted,
      updated,
      errors,
    })
  } catch (err) {
    console.error('Import companies error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
