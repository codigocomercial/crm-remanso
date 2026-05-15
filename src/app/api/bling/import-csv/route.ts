import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json()
    if (!csv) return NextResponse.json({ error: 'CSV não enviado' }, { status: 400 })

    const supabase = createServiceClient()
    const lines = csv.split('\n').filter((l: string) => l.trim())
    
    // Primeira linha é o cabeçalho
    const header = lines[0].split(';').map((h: string) => h.replace(/"/g, '').trim())
    
    const idxId = header.indexOf('ID')
    const idxCodigo = header.indexOf('Código')
    const idxDescricao = header.indexOf('Descrição')
    const idxPreco = header.indexOf('Preço')
    const idxCusto = header.indexOf('Preço de custo')
    const idxSituacao = header.indexOf('Situação')
    const idxEstoque = header.indexOf('Estoque')

    const parseNum = (v: string) => parseFloat(v.replace(/"/g, '').replace('.', '').replace(',', '.')) || 0

    let imported = 0
    const BATCH = 50

    const rows = lines.slice(1)
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const upserts = batch.map((line: string) => {
        const cols = line.split(';')
        const blingId = cols[idxId]?.replace(/"/g, '').trim()
        const sku = cols[idxCodigo]?.replace(/"/g, '').trim()
        const name = cols[idxDescricao]?.replace(/"/g, '').trim()
        const price = parseNum(cols[idxPreco] ?? '0')
        const costPrice = parseNum(cols[idxCusto] ?? '0')
        const isActive = cols[idxSituacao]?.replace(/"/g, '').trim() === 'Ativo'
        const stock = parseNum(cols[idxEstoque] ?? '0')

        if (!sku) return null
        return {
          org_id: ORG_ID,
          bling_id: blingId ? Number(blingId) : null,
          sku,
          name: name || sku,
          price,
          cost_price: costPrice,
          is_active: isActive,
          stock_quantity: stock,
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }).filter(Boolean)

      if (upserts.length === 0) continue

      const { error } = await supabase.from('products').upsert(upserts, {
        onConflict: 'org_id,sku',
        ignoreDuplicates: false,
      })

      if (error) console.error('[import-csv] erro batch:', error.message)
      else imported += upserts.length
    }

    return NextResponse.json({ success: true, imported })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
