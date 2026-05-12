import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// GET — lista conversas com dados do contato e empresa
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'open'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const offset = (page - 1) * limit

    let query = supabase
      .from('conversations')
      .select(`
        id,
        whatsapp_number,
        status,
        unread_count,
        last_message_at,
        last_message_preview,
        handled_by_bot,
        bot_paused_at,
        assigned_to,
        created_at,
        contact:contacts (
          id,
          full_name,
          whatsapp,
          email,
          city,
          state,
          customer_type,
          reorder_cycle_days,
          last_order_at,
          average_order_value
        ),
        company:companies (
          id,
          name,
          fantasia,
          city,
          state
        ),
        assigned_user:users!conversations_assigned_to_fkey (
          id,
          full_name
        )
      `, { count: 'exact' })
      .eq('org_id', ORG_ID)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: conversations, error, count } = await query

    if (error) {
      console.error('Erro ao buscar conversas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filtro por busca client-side (nome do contato ou empresa)
    let filtered = conversations || []
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter((c: any) =>
        c.contact?.full_name?.toLowerCase().includes(s) ||
        c.company?.fantasia?.toLowerCase().includes(s) ||
        c.company?.name?.toLowerCase().includes(s) ||
        c.whatsapp_number?.includes(search)
      )
    }

    return NextResponse.json({
      conversations: filtered,
      total: count || 0,
      page,
      limit,
      hasMore: offset + limit < (count || 0),
    })

  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH — ações na conversa: pause_bot, resume_bot, close, reopen, mark_read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getServiceClient()

    const body = await request.json()
    const { conversation_id, action } = body

    if (!conversation_id || !action) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const updateMap: Record<string, object> = {
      pause_bot: {
        handled_by_bot: false,
        bot_paused_at: new Date().toISOString(),
        bot_paused_by: '0890984d-99a3-4a12-bc7a-618edef29dfd',
        assigned_to: '0890984d-99a3-4a12-bc7a-618edef29dfd',
      },
      resume_bot: {
        handled_by_bot: true,
        bot_paused_at: null,
        bot_paused_by: null,
      },
      close: { status: 'closed' },
      reopen: { status: 'open' },
      mark_read: { unread_count: 0 },
    }

    const updateData = updateMap[action]
    if (!updateData) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation_id)
      .eq('org_id', ORG_ID)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ conversation: data })

  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
