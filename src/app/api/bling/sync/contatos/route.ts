import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

async function getBlingToken() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bling_tokens')
    .select('access_token')
    .single()
  return data?.access_token
}

async function blingFetch(path: string, token: string) {
  const res = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Bling API error: ${res.status}`)
  return res.json()
}

export async function POST() {
  try {
    const supabase = await createClient()
    const token = await getBlingToken()
    if (!token) return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })

    let page = 1
    let totalContatos = 0
    let totalVendedores = 0

    const vendedoresRes = await blingFetch('/vendedores?limite=100', token)
    const vendedores = vendedoresRes?.data ?? []
    for (const v of vendedores) {
      await supabase.from('sellers').upsert({
        org_id: ORG_ID,
        bling_id: v.id,
        name: v.nome,
        email: v.email ?? null,
        is_active: v.situacao === 'A',
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bling_id' })
      totalVendedores++
    }

    while (true) {
      const data = await blingFetch(
        `/contatos?pagina=${page}&limite=100&tipo=C&situacao=A`,
        token
      )
      const contatos = data?.data ?? []
      if (contatos.length === 0) break

      for (const c of contatos) {
        let seller_id = null
        if (c.vendedor?.id) {
          const { data: seller } = await supabase
            .from('sellers')
            .select('id')
            .eq('bling_id', c.vendedor.id)
            .single()
          seller_id = seller?.id ?? null
        }

        const payload = {
          org_id: ORG_ID,
          bling_id: c.id,
          full_name: c.nome,
          client_company: c.fantasia ?? null,
          cnpj: c.numeroDocumento ?? null,
          phone: c.telefone ?? null,
          whatsapp: c.celular ?? null,
          email: c.email ?? null,
          city: c.endereco?.municipio ?? null,
          state: c.endereco?.uf ?? null,
          status: c.situacao === 'A' ? 'active' : 'inactive',
          seller_id,
          source: 'bling',
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // Tenta upsert por bling_id primeiro
        const { error } = await supabase.from('contacts').upsert(payload, { onConflict: 'bling_id' })

        // Se falhou e tem CNPJ, tenta atualizar registro existente por CNPJ
        if (error && c.numeroDocumento) {
          await supabase.from('contacts')
            .update(payload)
            .eq('org_id', ORG_ID)
            .eq('cnpj', c.numeroDocumento)
        }
        totalContatos++
      }

      if (contatos.length < 100) break
      page++
    }

    return NextResponse.json({ success: true, vendedores: totalVendedores, contatos: totalContatos })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
