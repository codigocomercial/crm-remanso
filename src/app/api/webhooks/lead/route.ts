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

/* ────────────────────────────────────────────────
   Sanitiza o full_name caso venha como JSON string
   Ex: '{"nome":"Andréa","whatsapp":"557799..."}' → 'Andréa'
──────────────────────────────────────────────── */
function sanitizeName(raw: string): string {
  if (!raw) return raw

  // Se começa com '{', tenta extrair o nome do JSON
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return (
        parsed.nome ||
        parsed.name ||
        parsed.full_name ||
        parsed.pushName ||
        parsed.notifyName ||
        raw  // fallback: retorna o bruto se não achar nenhum campo de nome
      )
    } catch {
      return raw
    }
  }

  // Se começa com '[', pode ser array — pega o primeiro
  if (raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed[0]) {
        return sanitizeName(String(parsed[0]))
      }
    } catch {
      return raw
    }
  }

  return raw.trim()
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

  // 3. Sanitizar full_name — protege contra JSON bruto vindo da Laura
  const fullName = sanitizeName(contact?.full_name ?? '')

  if (!org_id || !title || !fullName || !contact?.whatsapp) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: org_id, title, contact.full_name, contact.whatsapp' },
      { status: 422 },
    )
  }

  const supabase = createAdminClient()

  try {
    // 4. Verificar se contato já existe pelo whatsapp
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', org_id)
      .eq('whatsapp', contact.whatsapp)
      .maybeSingle()

    // ✅ Se contato já existe, retorna sucesso sem criar nada
    if (existingContact) {
      return NextResponse.json({
        success: true,
        contact_id: existingContact.id,
        lead_id: null,
        message: 'Contato já existe — nenhum registro duplicado criado'
      }, { status: 200 })
    }

    // 5. Contato novo — buscar estágio default do pipeline
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

    // 6. Criar contato novo (com nome já sanitizado)
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        org_id,
        full_name: fullName,
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

    // 7. Criar lead para o novo contato
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id,
        contact_id: newContact.id,
        stage_id: stageId,
        title,
        source: source ?? null,
        notes: notes ?? null,
        metadata: metadata ?? null,
        priority: 'medium',
        currency: 'BRL',
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

    // 8. Evento de automação
    await supabase.from('automation_events').insert({
      org_id,
      event_type: 'lead_created_via_webhook',
      payload: { lead_id: lead.id, contact_id: newContact.id, stage_id: stageId, source },
    })

    return NextResponse.json({
      success: true,
      contact_id: newContact.id,
      lead_id: lead.id,
      message: 'Contato e lead criados com sucesso'
    }, { status: 201 })

  } catch (err) {
    console.error('[webhook/lead] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint ativo', version: '3.1' })
}