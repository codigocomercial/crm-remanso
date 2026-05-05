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

        let totalVendedores = 0
        let totalEmpresas = 0
        let totalContatos = 0

        // 1. Sincronizar vendedores
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

        // 2. Sincronizar empresas (funerárias) e seus contatos
        let page = 1
        while (true) {
            const data = await blingFetch(
                `/contatos?pagina=${page}&limite=100&tipo=C&situacao=A`,
                token
            )
            const contatos = data?.data ?? []
            if (contatos.length === 0) break

            for (const c of contatos) {
                // Buscar seller_id
                let seller_id = null
                if (c.vendedor?.id) {
                    const { data: seller } = await supabase
                        .from('sellers')
                        .select('id')
                        .eq('bling_id', c.vendedor.id)
                        .single()
                    seller_id = seller?.id ?? null
                }

                // Criar/atualizar empresa
                const { data: company } = await supabase
                    .from('companies')
                    .upsert({
                        org_id: ORG_ID,
                        bling_id: c.id,
                        name: c.nome,
                        cnpj: c.numeroDocumento ?? null,
                        phone: c.telefone ?? null,
                        whatsapp: c.celular ?? null,
                        email: c.email ?? null,
                        city: c.endereco?.municipio ?? null,
                        state: c.endereco?.uf ?? null,
                        seller_id,
                        is_active: true,
                        bling_synced_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'bling_id' })
                    .select('id')
                    .single()

                totalEmpresas++

                // Criar contatos vinculados (pessoasContato)
                const pessoas = c.pessoasContato ?? []
                for (const p of pessoas) {
                    if (!p.nome) continue
                    await supabase.from('contacts').upsert({
                        org_id: ORG_ID,
                        full_name: p.nome,
                        phone: p.telefone ?? null,
                        whatsapp: p.celular ?? null,
                        email: p.email ?? null,
                        company_id: company?.id ?? null,
                        contact_role: p.cargo ?? null,
                        receive_campaigns: false,
                        source: 'bling',
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'org_id,full_name,company_id' })
                    totalContatos++
                }
            }

            if (contatos.length < 100) break
            page++
        }

        return NextResponse.json({
            success: true,
            vendedores: totalVendedores,
            empresas: totalEmpresas,
            contatos: totalContatos,
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}