import { NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

const ORIGEM = 'Vitória da Conquista, BA, Brasil'
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY

export async function POST() {
  try {
    const supabase = createServiceClient()

    // Buscar empresas sem distância que têm cidade
    const { data: companies } = await supabase
      .from('companies')
      .select('id, city, state')
      .eq('org_id', ORG_ID)
      .is('distance_km', null)
      .not('city', 'is', null)

    if (!companies || companies.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'Nenhuma empresa sem distância' })
    }

    // Agrupar por cidade para evitar chamadas duplicadas
    const cityMap = new Map<string, number[]>() // cidade → [ids]
    for (const c of companies) {
      const key = `${c.city}, ${c.state}, Brasil`
      if (!cityMap.has(key)) cityMap.set(key, [])
      cityMap.get(key)!.push(c.id)
    }

    let updated = 0
    const BATCH = 25 // Google Maps aceita até 25 destinos por vez

    const cities = Array.from(cityMap.keys())

    for (let i = 0; i < cities.length; i += BATCH) {
      const batch = cities.slice(i, i + BATCH)
      const destinos = batch.map(c => encodeURIComponent(c)).join('|')

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(ORIGEM)}&destinations=${destinos}&mode=driving&language=pt-BR&key=${GOOGLE_KEY}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.status !== 'OK') continue

      for (let j = 0; j < batch.length; j++) {
        const element = data.rows[0]?.elements[j]
        if (element?.status !== 'OK') continue

        const distanceKm = Math.round(element.distance.value / 1000)
        const ids = cityMap.get(batch[j]) ?? []

        for (const id of ids) {
          await supabase.from('companies')
            .update({ distance_km: distanceKm, updated_at: new Date().toISOString() })
            .eq('id', id)
          updated++
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200))
    }

    return NextResponse.json({ success: true, updated, total: companies.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
