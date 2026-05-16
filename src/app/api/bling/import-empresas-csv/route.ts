import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

// Tabela de coordenadas por cidade
const COORDS: Record<string, [number, number]> = {
  'Salvador': [-12.9714, -38.5014],
  'Feira de Santana': [-12.2664, -38.9661],
  'Vitória da Conquista': [-14.8619, -40.8444],
  'Ilhéus': [-14.7890, -39.0492],
  'Itabuna': [-14.7860, -39.2783],
  'Juazeiro': [-9.4219, -40.5031],
  'Barreiras': [-12.1522, -45.0006],
  'Guanambi': [-14.2228, -42.7814],
  'Poções': [-14.5219, -40.3664],
  'Itapetinga': [-15.2489, -40.2489],
  'Jequié': [-13.8578, -40.0839],
  'Brumado': [-14.2039, -41.6642],
  'Caetité': [-14.0678, -42.4731],
  'Bom Jesus da Lapa': [-13.2553, -43.4189],
  'Porto Seguro': [-16.4483, -39.0647],
  'Eunápolis': [-16.3756, -39.5778],
  'Teixeira de Freitas': [-17.5350, -39.7414],
  'São João do Paraíso': [-15.3089, -42.0178],
  'Mascote': [-15.5628, -39.3008],
  'Itororó': [-15.1228, -40.0647],
}

const FABRICA = [-14.8619, -40.8444]

function calcDist(city: string): number | null {
  const coords = COORDS[city]
  if (!coords) return null
  const R = 6371
  const dLat = (coords[0] - FABRICA[0]) * Math.PI / 180
  const dLng = (coords[1] - FABRICA[1]) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(FABRICA[0] * Math.PI/180) * Math.cos(coords[0] * Math.PI/180) * Math.sin(dLng/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json()
    if (!csv) return NextResponse.json({ error: 'CSV não enviado' }, { status: 400 })

    const supabase = createServiceClient()

    // Buscar vendedores para mapear nome → id
    const { data: sellers } = await supabase.from('sellers').select('id, name').eq('org_id', ORG_ID)
    const sellerMap = new Map((sellers ?? []).map((s: any) => [s.name?.toUpperCase(), s.id]))

    const lines = csv.split('\n').filter((l: string) => l.trim())
    const header = lines[0].split(';').map((h: string) => h.replace(/"/g, '').trim())

    const idx = (name: string) => header.indexOf(name)

    let imported = 0, updated = 0, errors = 0

    const BATCH = 50
    const rows = lines.slice(1)

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const upserts = batch.map((line: string) => {
        const cols = line.split(';').map((c: string) => c.replace(/"/g, '').trim())
        const blingId = cols[idx('ID')]
        const nome = cols[idx('Nome')]
        const fantasia = cols[idx('Fantasia')]
        const cidade = cols[idx('Cidade')]
        const uf = cols[idx('UF')]
        const cnpj = cols[idx('CNPJ / CPF')]
        const fone = cols[idx('Fone')]
        const celular = cols[idx('Celular')]
        const email = cols[idx('E-mail')]
        const situacao = cols[idx('Situação')]
        const vendedor = cols[idx('Vendedor')]?.toUpperCase()

        if (!blingId || !nome) return null

        const seller_id = vendedor ? sellerMap.get(vendedor) ?? null : null
        const distance_km = cidade ? calcDist(cidade) : null

        return {
          org_id: ORG_ID,
          bling_id: Number(blingId),
          name: nome,
          fantasia: fantasia || null,
          cnpj: cnpj || null,
          phone: fone || null,
          whatsapp: celular || null,
          email: email || null,
          city: cidade || null,
          state: uf || null,
          seller_id,
          distance_km,
          is_active: situacao === 'Ativo',
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }).filter(Boolean)

      if (upserts.length === 0) continue

      const { error } = await supabase.from('companies').upsert(upserts, {
        onConflict: 'bling_id',
        ignoreDuplicates: false,
      })

      if (error) { errors += upserts.length; console.error(error.message) }
      else {
        imported += upserts.length

        // Salvar contatos linha por linha
        for (const line of batch) {
          const cols = line.split(';').map((c: string) => c.replace(/"/g, '').trim())
          const blingId = cols[idx('ID')]
          const nomeContato = cols[idx('Contatos')]?.trim()
          const fone = cols[idx('Fone')]?.trim()
          const celular = cols[idx('Celular')]?.trim()

          if (!nomeContato || !blingId) continue

          const { data: company } = await supabase.from('companies')
            .select('id').eq('bling_id', Number(blingId)).eq('org_id', ORG_ID).maybeSingle()
          if (!company) continue

          await supabase.from('contacts').upsert({
            org_id: ORG_ID,
            company_id: company.id,
            full_name: nomeContato,
            phone: fone || null,
            whatsapp: celular || null,
            source: 'bling',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'org_id,full_name,company_id', ignoreDuplicates: false })
        }
      }
    }

    return NextResponse.json({ success: true, imported, updated, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
