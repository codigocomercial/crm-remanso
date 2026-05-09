import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// GET — busca mensagens de uma conversa
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const conversationId = params.id
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')

    // Verifica se a conversa pertence à org
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, org_id, contact_id, whatsapp_number,
        status, handled_by_bot, unread_count,
        contact:contacts ( id, full_name, whatsapp, city, state, customer_type, average_order_value, last_order_at, reorder_cycle_days ),
        company:companies ( id, name, fantasia, city, state )
      `)
      .eq('id', conversationId)
      .eq('org_id', ORG_ID)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    // Busca mensagens
    let query = supabase
      .from('messages')
      .select(`
        id,
        direction,
        content,
        media_url,
        media_type,
        message_type,
        whatsapp_message_id,
        status,
        sent_at,
        sent_by_user:users!messages_sent_by_user_id_fkey (
          id,
          full_name
        )
      `, { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(limit)

    if (before) {
      query = query.lt('sent_at', before)
    }

    const { data: messages, error, count } = await query

    if (error) {
      console.error('Erro ao buscar mensagens:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Zera unread ao abrir
    if ((conversation.unread_count ?? 0) > 0) {
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
    }

    return NextResponse.json({
      messages: messages || [],
      total: count || 0,
      conversation,
    })

  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
