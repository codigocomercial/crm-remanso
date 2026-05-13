import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .rpc('recalcular_margens', { p_org_id: ORG_ID })

    if (error) throw new Error(error.message)

    const updated = data ?? 0
    return NextResponse.json({
      success: true,
      updated,
      message: `${updated} pedidos recalculados com custos operacionais e MP atuais`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
