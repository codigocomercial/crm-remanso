import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// Cliente admin com service role para criar usuários
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Verifica se o usuário logado é admin
async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  return data?.role === 'admin'
}

// GET — lista usuários da org
export async function GET() {
  try {
    const supabase = await createClient()
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, created_at')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — convidar novo usuário
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { email, full_name, role = 'seller', password } = body

    if (!email || !full_name || !password) {
      return NextResponse.json({ error: 'Email, nome e senha são obrigatórios' }, { status: 400 })
    }

    if (!['admin', 'manager', 'seller'].includes(role)) {
      return NextResponse.json({ error: 'Role inválido' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirma automaticamente sem precisar de email
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Cria o registro na tabela users
    const { error: userError } = await adminClient
      .from('users')
      .insert({
        id: authData.user.id,
        org_id: ORG_ID,
        full_name,
        email,
        role,
        is_active: true,
      })

    if (userError) {
      // Rollback — remove o usuário do Auth se falhou no banco
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: { id: authData.user.id, email, full_name, role } })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — alterar role ou desativar usuário
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const body = await request.json()
    const { user_id, role, is_active } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })
    }

    // Não deixa o admin alterar o próprio role
    if (user_id === currentUser?.id && role && role !== 'admin') {
      return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil' }, { status: 400 })
    }

    const updates: any = {}
    if (role) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user_id)
      .eq('org_id', ORG_ID)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove usuário
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!await checkAdmin(supabase)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })
    if (user_id === currentUser?.id) {
      return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Remove do banco
    await supabase.from('users').delete().eq('id', user_id).eq('org_id', ORG_ID)

    // Remove do Auth
    await adminClient.auth.admin.deleteUser(user_id)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
