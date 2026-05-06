import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY!
const ORIGEM = 'Vitória da Conquista, BA, Brasil'
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST() {
  try {
    const supabase = await createClient()

    // Buscar empresas sem distância calculada
    const { data: empresas } = await supabase
      .from('companies')
      .select('id, city, state')
      .eq('org_id', ORG_ID)
      .not('city', 'is', null)
      .neq('city', '')
      .neq('city', '0')

    if (!empresas || empresas.length === 0) {
      return NextResponse.json({ success: true, atualizadas: 0 })
    }

    // Cidades únicas para economizar chamadas
    const cidadesUnicas = new Map<string, string[]>()
    for (const e of empresas) {
      const key = `${e.city}, ${e.state}, Brasil`
      if (!cidadesUnicas.has(key)) cidadesUnicas.set(key, [])
      cidadesUnicas.get(key)!.push(e.id)
    }

    const cidades = Array.from(cidadesUnicas.keys())
    console.log(`[distancias] ${cidades.length} cidades únicas para calcular`)

    // Processar em lotes de 25
    const CHUNK = 25
    let atualizadas = 0

    for (let i = 0; i < cidades.length; i += CHUNK) {
      const lote = cidades.slice(i, i + CHUNK)
      const destinos = lote.join('|')

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(ORIGEM)}&destinations=${encodeURIComponent(destinos)}&mode=driving&language=pt-BR&key=${GOOGLE_KEY}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.status !== 'OK') {
        console.error('[distancias] Google API error:', data.status, data.error_message)
        continue
      }

      const elements = data.rows[0].elements

      for (let j = 0; j < lote.length; j++) {
        const element = elements[j]
        const cidade = lote[j]
        const ids = cidadesUnicas.get(cidade)!

        if (element.status === 'OK') {
          const km = Math.round(element.distance.value / 1000)
          await supabase
            .from('companies')
            .update({ distance_km: km })
            .in('id', ids)
          atualizadas += ids.length
          console.log(`[distancias] ${cidade}: ${km} km — ${ids.length} empresa(s)`)
        } else {
          console.warn(`[distancias] ${cidade}: ${element.status}`)
        }
      }

      // Delay para não exceder rate limit
      if (i + CHUNK < cidades.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({ success: true, atualizadas })

  } catch (error: any) {
    console.error('[distancias] erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
