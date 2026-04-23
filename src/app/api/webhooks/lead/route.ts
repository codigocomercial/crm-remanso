import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ContactPayload {
  full_name: string
  phone?: string
  whatsapp: string
}

interface LeadWebhookPayload {
  org_id: string
  title: string
  source?: string
  contact: ContactPayload
  notes?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  // 1. Validar secret
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse payload
  let payload: LeadWebhookPayload
  try {
    payload = (await request.json()) as LeadWebhookPayload
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { org_id, title, source, contact, notes, metadata } = payload

  if (!org_id || !title || !contact?.full_name || !contact?.whatsapp) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: org_id, title, contact.full_name, contact.whatsapp' },
      { status: 422 },
    )
  }

  const supabase = createAdminClient()

  try {
    // 3. Buscar estágio default, com fallback para o primeiro
    let stageId: string

    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('org_id', org_id)
      .eq('is_default', true)
      .single()

    if (stage) {
      stageId = stage.id
    } else {
      const { data: firstStage, error: firstStageError } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('org_id', org_id)
        .order('position', { ascending: true })
        .limit(1)
        .single()

      if (firstStageError || !firstStage) {
        return NextResponse.json(
          { success: false, error: 'No pipeline stage found for this org' },
          { status: 404 },
        )
      }
      stageId = firstStage.id
    }

    // 4. Verificar contato existente por WhatsApp
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', org_id)
      .eq('whatsapp', contact.whatsapp)
      .maybeSingle()

    let contactId: string

    if (existingContact) {
      contactId = existingContact.id
    } else {
      // 5. Criar contato
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          org_id,
          full_name: contact.full_name,
          phone: contact.phone ?? null,
          whatsapp: contact.whatsapp,
          source: source ?? 'whatsapp',
          status: 'active',
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error('[webhook/lead] contact error:', contactError)
        return NextResponse.json(
          { success: false, error: 'Failed to create contact' },
          { status: 500 },
        )
      }
      contactId = newContact.id
    }

    // 6. Criar lead com campos corretos da tabela
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id,
        contact_id: contactId,
        stage_id: stageId,      // ✅ campo correto (não pipeline_stage_id)
        title,
        source: source ?? null,
        notes: notes ?? null,
        metadata: metadata ?? null,
        priority: 'medium',     // ✅ NOT NULL
        currency: 'BRL',        // ✅ NOT NULL
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[webhook/lead] lead error:', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead', detail: leadError?.message },
        { status: 500 },
      )
    }

    // 7. Evento de automação (não-fatal)
    await supabase.from('automation_events').insert({
      org_id,
      event_type: 'lead_created_via_webhook',
      payload: { lead_id: lead.id, contact_id: contactId, stage_id: stageId, source },
    })

    return NextResponse.json({ success: true, lead_id: lead.id }, { status: 201 })

  } catch (err) {
    console.error('[webhook/lead] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint ativo', version: '2.0' })
}