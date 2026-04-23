import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST /api/webhooks/lead
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Validate webhook secret
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse & basic-validate payload
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
      {
        success: false,
        error: 'Missing required fields: org_id, title, contact.full_name, contact.whatsapp',
      },
      { status: 422 },
    )
  }

  const supabase = createAdminClient()

  try {
    // 3. Fetch the default pipeline stage for this org
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('org_id', org_id)
      .eq('is_default', true)
      .single()

    if (stageError || !stage) {
      return NextResponse.json(
        { success: false, error: 'Default pipeline stage not found for this org' },
        { status: 404 },
      )
    }

    const stageId = stage.id

    // 4. Check for an existing contact with the same WhatsApp number within the org
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', org_id)
      .eq('whatsapp', contact.whatsapp)
      .maybeSingle()

    let contactId: string

    if (existingContact) {
      // 5a. Reuse existing contact
      contactId = existingContact.id
    } else {
      // 5b. Create a new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          org_id,
          full_name: contact.full_name,
          phone: contact.phone ?? null,
          whatsapp: contact.whatsapp,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error('[webhook/lead] contact insert error:', contactError)
        return NextResponse.json(
          { success: false, error: 'Failed to create contact' },
          { status: 500 },
        )
      }

      contactId = newContact.id
    }

    // 6. Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id,
        contact_id: contactId,
        pipeline_stage_id: stageId,
        title,
        source: source ?? null,
        notes: notes ?? null,
        metadata: metadata ?? null,
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[webhook/lead] lead insert error:', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead' },
        { status: 500 },
      )
    }

    const leadId = lead.id

    // 7. Register the automation event
    const { error: eventError } = await supabase.from('automation_events').insert({
      org_id,
      event_type: 'lead_created_via_webhook',
      payload: {
        lead_id: leadId,
        contact_id: contactId,
        pipeline_stage_id: stageId,
        source: source ?? null,
      },
    })

    if (eventError) {
      // Non-fatal: log but don't fail the request
      console.error('[webhook/lead] automation_events insert error:', eventError)
    }

    // 8. Return success
    return NextResponse.json({ success: true, lead_id: leadId }, { status: 201 })
  } catch (err) {
    console.error('[webhook/lead] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
