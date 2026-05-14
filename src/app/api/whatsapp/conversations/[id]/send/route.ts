import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.promptcomercial.com.br'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '967A510F45A3-4E5D-9BC4-29FE1E97B15F'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'crm-remanso'

// POST — envia mensagem e salva no banco
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient()

    const { id: conversationId } = await params
    const body = await request.json()
    const { content, message_type = 'text' } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Mensagem não pode estar vazia' }, { status: 400 })
    }

    // Busca dados do usuário logado (usa org_id para pegar o admin)
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('org_id', ORG_ID)
      .eq('role', 'admin')
      .single()

    // Busca conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, whatsapp_number, contact_id, company_id, handled_by_bot')
      .eq('id', conversationId)
      .eq('org_id', ORG_ID)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    // Envia via Evolution API
    const evolutionRes = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: conversation.whatsapp_number,
          text: content.trim(),
        }),
      }
    )

    if (!evolutionRes.ok) {
      const err = await evolutionRes.text()
      console.error('Evolution API error:', err)
      return NextResponse.json({ error: 'Erro ao enviar pelo WhatsApp' }, { status: 500 })
    }

    const evolutionData = await evolutionRes.json()
    const whatsappMessageId = evolutionData?.key?.id || null

    // Salva mensagem como outbound
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        org_id: ORG_ID,
        direction: 'outbound',
        content: content.trim(),
        message_type,
        whatsapp_message_id: whatsappMessageId,
        status: 'sent',
        sent_by_user_id: '0890984d-99a3-4a12-bc7a-618edef29dfd',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (msgError) {
      console.error('Erro ao salvar mensagem:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Registra em interactions
    await supabase
      .from('interactions')
      .insert({
        org_id: ORG_ID,
        contact_id: conversation.contact_id,
        type: 'whatsapp',
        origin: 'outbound',
        content: content.trim(),
      })

    // Se bot ainda estava ativo, pausa automaticamente ao vendedor responder
    if (conversation.handled_by_bot) {
      await supabase
        .from('conversations')
        .update({
          handled_by_bot: false,
          bot_paused_at: new Date().toISOString(),
          bot_paused_by: '0890984d-99a3-4a12-bc7a-618edef29dfd',
          assigned_to: '0890984d-99a3-4a12-bc7a-618edef29dfd',
        })
        .eq('id', conversationId)
    }

    return NextResponse.json({ message, success: true })

  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
