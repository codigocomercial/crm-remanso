import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const { id, name, email, phone, is_active } = body

    if (id) {
      // Update
      const { error } = await supabase.from('sellers').update({
        name, email: email || null, phone: phone || null, is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('org_id', ORG_ID)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      // Insert
      const { error } = await supabase.from('sellers').insert({
        org_id: ORG_ID, name, email: email || null, phone: phone || null, is_active,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
