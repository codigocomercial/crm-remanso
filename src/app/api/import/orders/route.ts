import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function parseNum(val: string): number {
  if (!val) return 0
  return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0
}

function parseDate(val: string): string {
  // DD/MM/YYYY ou YYYY-MM-DD → YYYY-MM-DDT12:00:00Z
  // Fixar meio-dia UTC evita que a data "volte" um dia ao ser convertida para UTC-3 (Brasil)
  if (!val) {
    const today = new Date().toISOString().split('T')[0]
    return `${today}T12:00:00Z`
  }
  const trimmed = val.trim()
  // Formato DD/MM/YYYY
  const partsSlash = trimmed.split('/')
  if (partsSlash.length === 3) {
    const iso = `${partsSlash[2]}-${partsSlash[1].padStart(2, '0')}-${partsSlash[0].padStart(2, '0')}`
    return `${iso}T12:00:00Z`
  }
  // Formato YYYY-MM-DD (com ou sem hora)
  const dateOnly = trimmed.split('T')[0].split(' ')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return `${dateOnly}T12:00:00Z`
  }
  return trimmed
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ';'
  const headers = lines[0].split(sep).map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.replace(/^"|"$/g, '').trim())
    if (values.length < 2) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json()
    if (!csv) return NextResponse.json({ error: 'CSV não enviado' }, { status: 400 })

    const supabase = createServiceClient()
    const rows = parseCSV(csv)

    if (rows.length === 0) return NextResponse.json({ error: 'CSV vazio ou inválido' }, { status: 400 })

    // Agrupar linhas por número do pedido
    const pedidosMap = new Map<string, { info: Record<string, string>, itens: Record<string, string>[] }>()

    for (const row of rows) {
      const num = row['Número pedido']?.trim()
      if (!num) continue
      if (!pedidosMap.has(num)) {
        pedidosMap.set(num, { info: row, itens: [] })
      }
      pedidosMap.get(num)!.itens.push(row)
    }

    // Buscar tax_rate
    const { data: org } = await supabase.from('organizations').select('tax_rate').eq('id', ORG_ID).single()
    const taxRate = Number(org?.tax_rate ?? 4.5) / 100

    // Buscar custos operacionais
    const { data: opCosts } = await supabase.from('operational_costs').select('year, month, cost_per_unit').eq('org_id', ORG_ID)
    const opCostMap = new Map((opCosts ?? []).map((c: any) => [`${c.year}-${c.month}`, Number(c.cost_per_unit ?? 0)]))

    // Buscar produtos para custo MP
    const { data: products } = await supabase.from('crm_products').select('sku, cost_price').eq('org_id', ORG_ID)
    const productMap = new Map((products ?? []).map((p: any) => [p.sku?.trim(), Number(p.cost_price ?? 0)]))

    // Buscar empresas para vincular por CNPJ
    const { data: companies } = await supabase.from('crm_companies').select('id, cnpj').eq('org_id', ORG_ID)
    const companyMap = new Map((companies ?? []).map((c: any) => [c.cnpj?.replace(/\D/g, ''), c.id]))

    // Buscar/criar vendedores
    const { data: sellers } = await supabase.from('crm_sellers').select('id, name').eq('org_id', ORG_ID)
    const sellerMap = new Map((sellers ?? []).map((s: any) => [s.name?.toUpperCase().trim(), s.id]))

    async function getOrCreateSeller(name: string): Promise<string | null> {
      if (!name?.trim()) return null
      const key = name.toUpperCase().trim()
      if (sellerMap.has(key)) return sellerMap.get(key)!
      const { data } = await supabase.schema('crm').from('sellers')
        .insert({ org_id: ORG_ID, name: name.trim(), is_active: true })
        .select('id').single()
      if (data?.id) sellerMap.set(key, data.id)
      return data?.id ?? null
    }

    let created = 0, updated = 0, errors = 0
    const errorDetails: string[] = []

    for (const [num, { info, itens }] of pedidosMap) {
      try {
        const cnpj = info['CPF/CNPJ Comprador']?.replace(/\D/g, '') ?? null
        const companyId = cnpj ? companyMap.get(cnpj) ?? null : null
        const sellerId = await getOrCreateSeller(info['Vendedor'] ?? '')

        const orderedAt = parseDate(info['Data'])
        const totalPedido = parseNum(info['Total Pedido'])
        const frete = parseNum(info['Valor Frete Pedido'])
        const desconto = parseNum(info['Valor Desconto Pedido'])
        const totalVenda = totalPedido - frete

        // Calcular urnas e custo MP
        const unitsCount = itens.reduce((s, i) => s + parseNum(i['Quantidade']), 0)
        let costMp = 0
        for (const item of itens) {
          const sku = item['SKU']?.trim()
          const qty = parseNum(item['Quantidade'])
          const cost = productMap.get(sku) ?? 0
          costMp += cost * qty
        }

        // Custo operacional — extrai ano/mês da string ISO, sem conversão de fuso
        const [yyyy, mm] = orderedAt.split('T')[0].split('-')
        const opKey = `${parseInt(yyyy)}-${parseInt(mm)}`
        const costOp = (opCostMap.get(opKey) ?? 0) * unitsCount

        // CML
        const taxAmount = totalVenda * taxRate
        const margin = totalVenda - costMp - costOp - taxAmount
        const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

        const status = 'atendido' // CSV do Bling só exporta pedidos faturados

        // Mapear itens
        const itensJson = itens.map(i => ({
          codigo: i['SKU']?.trim(),
          descricao: i['Produto'] ?? '',
          quantidade: parseNum(i['Quantidade']),
          valor: parseNum(i['Valor Unitário']),
        }))

        // Verificar se já existe
        const { data: existing } = await supabase
          .from('crm_orders')
          .select('id')
          .eq('bling_number', num)
          .eq('org_id', ORG_ID)
          .maybeSingle()

        const { error } = await supabase.rpc('upsert_crm_order_full', {
          p_org_id: ORG_ID,
          p_bling_id: parseInt(num),
          p_bling_number: num,
          p_company_id: companyId,
          p_seller_id: sellerId,
          p_client_name: info['Nome Comprador'] ?? '',
          p_client_cnpj: info['CPF/CNPJ Comprador'] ?? null,
          p_client_city: info['Cidade Comprador'] ?? null,
          p_client_state: info['UF Comprador'] ?? null,
          p_ordered_at: orderedAt,
          p_status: status,
          p_payment_notes: info['Observações'] ?? null,
          p_total_value: totalVenda,
          p_freight: frete,
          p_discount: desconto,
          p_grand_total: totalPedido,
          p_units_count: Math.round(unitsCount),
          p_cost_mp: costMp,
          p_cost_op: costOp,
          p_tax_amount: taxAmount,
          p_total_cost: costMp + costOp,
          p_margin: margin,
          p_margin_pct: marginPct,
          p_itens: itensJson,
        })

        if (error) {
          errors++
          errorDetails.push(`Pedido ${num}: ${error.message}`)
        } else {
          existing ? updated++ : created++
        }
      } catch (err: any) {
        errors++
        errorDetails.push(`Pedido ${num}: ${err.message}`)
      }
    }

    // Atualizar métricas das empresas e last_order_at dos contatos
    await supabase.rpc('update_company_metrics', { p_org_id: ORG_ID })
    await supabase.rpc('update_contacts_last_order', { p_org_id: ORG_ID })

    return NextResponse.json({
      success: errors === 0,
      total_pedidos: pedidosMap.size,
      created,
      updated,
      errors,
      error_details: errorDetails.slice(0, 10),
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}