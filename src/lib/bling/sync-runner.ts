/**
 * SyncRunner — executa syncs do Bling de forma síncrona com logs
 * Sem background tasks — a requisição fica aberta até terminar
 * O Bling é a fonte de verdade — o CRM apenas espelha os dados
 */
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

const BLING_URL = 'https://www.bling.com.br/Api/v3'
const DELAY_MS = 350

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function blingFetch(path: string, token: string) {
  await sleep(DELAY_MS)
  const res = await fetch(`${BLING_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Bling ${res.status}: ${path}`)
  return res.json()
}

async function getToken(): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('bling_tokens').select('access_token').eq('org_id', ORG_ID).single()
  if (!data?.access_token) throw new Error('Token Bling não encontrado')
  return data.access_token
}

async function startLog(type: string, triggeredBy = 'manual') {
  const supabase = createServiceClient()
  const { data } = await supabase.from('sync_logs').insert({
    org_id: ORG_ID,
    type,
    triggered_by: triggeredBy,
    status: 'running',
  }).select('id').single()
  return data?.id as string
}

async function finishLog(logId: string, stats: {
  processed: number, created: number, updated: number, errors: number, errorDetails: any[]
}, success: boolean) {
  const supabase = createServiceClient()
  await supabase.from('sync_logs').update({
    finished_at: new Date().toISOString(),
    status: success ? 'success' : 'error',
    total_processed: stats.processed,
    total_created: stats.created,
    total_updated: stats.updated,
    total_errors: stats.errors,
    error_details: stats.errorDetails,
  }).eq('id', logId)
}

// ── PRODUTOS ─────────────────────────────────────────────────────────────
export async function syncProdutos() {
  const token = await getToken()
  const supabase = createServiceClient()
  const logId = await startLog('products')
  const stats = { processed: 0, created: 0, updated: 0, errors: 0, errorDetails: [] as any[] }

  try {
    let page = 1
    while (true) {
      const data = await blingFetch(`/produtos?pagina=${page}&limite=100&situacao=A&tipo=P,K`, token)
      const produtos = data?.data ?? []
      if (produtos.length === 0) break

      for (const p of produtos) {
        if (!p.id || !p.codigo) continue
        stats.processed++

        let detail = p
        try {
          const d = await blingFetch(`/produtos/${p.id}`, token)
          if (d?.data) detail = d.data
        } catch {}

        const { data: existing } = await supabase.from('products')
          .select('id').eq('bling_id', detail.id).eq('org_id', ORG_ID).maybeSingle()

        const { error } = await supabase.from('products').upsert({
          org_id: ORG_ID,
          bling_id: detail.id,
          sku: detail.codigo?.trim(),
          name: detail.nome ?? '',
          price: detail.preco ?? null,
          cost_price: detail.precoCusto ?? null,
          stock_quantity: detail.estoque?.saldoVirtualTotal ?? 0,
          is_active: detail.situacao === 'A',
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bling_id', ignoreDuplicates: false })

        if (error) {
          stats.errors++
          stats.errorDetails.push({ sku: detail.codigo, error: error.message })
        } else {
          existing ? stats.updated++ : stats.created++
        }
      }

      if (produtos.length < 100) break
      page++
    }

    await finishLog(logId, stats, true)
  } catch (err: any) {
    stats.errorDetails.push({ error: err.message })
    await finishLog(logId, stats, false)
    throw err
  }

  return stats
}

// ── EMPRESAS ─────────────────────────────────────────────────────────────
export async function syncEmpresas() {
  const token = await getToken()
  const supabase = createServiceClient()
  const logId = await startLog('companies')
  const stats = { processed: 0, created: 0, updated: 0, errors: 0, errorDetails: [] as any[] }

  const FABRICA_LAT = -14.8619
  const FABRICA_LNG = -40.8444

  function calcDist(lat: number, lng: number) {
    const R = 6371
    const dLat = (lat - FABRICA_LAT) * Math.PI / 180
    const dLng = (lng - FABRICA_LNG) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(FABRICA_LAT * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
  }

  try {
    // Sync vendedores
    const vendRes = await blingFetch('/vendedores?limite=100', token)
    for (const v of vendRes?.data ?? []) {
      const nome = v.nome || v.apelido || v.contato?.nome || v.contato?.apelido || ''
      if (!nome) continue
      await supabase.from('sellers').upsert({
        org_id: ORG_ID,
        bling_id: v.id,
        name: nome,
        email: v.email || v.contato?.email || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bling_id', ignoreDuplicates: false })
    }

    const { data: sellers } = await supabase.from('sellers').select('id, bling_id').eq('org_id', ORG_ID)
    const sellerMap = new Map((sellers ?? []).map((s: any) => [s.bling_id, s.id]))

    let page = 1
    while (true) {
      const data = await blingFetch(`/contatos?pagina=${page}&limite=100&tipoContato=C&tipoPessoa=J`, token)
      const contatos = data?.data ?? []
      if (contatos.length === 0) break

      for (const c of contatos) {
        if (!c.id) continue
        stats.processed++

        const seller_id = c.vendedor?.id ? sellerMap.get(c.vendedor.id) ?? null : null
        const lat = c.endereco?.latitude ? Number(c.endereco.latitude) : null
        const lng = c.endereco?.longitude ? Number(c.endereco.longitude) : null
        const distance_km = lat && lng ? calcDist(lat, lng) : null

        const { data: existing } = await supabase.from('companies')
          .select('id').eq('bling_id', c.id).eq('org_id', ORG_ID).maybeSingle()

        const { error } = await supabase.from('companies').upsert({
          org_id: ORG_ID,
          bling_id: c.id,
          name: c.nome ?? '',
          fantasia: c.fantasia ?? null,
          cnpj: c.numeroDocumento ?? null,
          phone: c.telefone ?? null,
          whatsapp: c.celular ?? null,
          email: c.email ?? null,
          city: c.endereco?.municipio ?? null,
          state: c.endereco?.uf ?? null,
          seller_id,
          distance_km,
          is_active: c.situacao === 'A',
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bling_id', ignoreDuplicates: false })

        if (error) {
          stats.errors++
          stats.errorDetails.push({ nome: c.nome, error: error.message })
        } else {
          existing ? stats.updated++ : stats.created++
        }
      }

      if (contatos.length < 100) break
      page++
    }

    await finishLog(logId, stats, true)
  } catch (err: any) {
    stats.errorDetails.push({ error: err.message })
    await finishLog(logId, stats, false)
    throw err
  }

  return stats
}

// ── PEDIDOS ───────────────────────────────────────────────────────────────
export async function syncPedidos() {
  const token = await getToken()
  const supabase = createServiceClient()
  const logId = await startLog('orders')
  const stats = { processed: 0, created: 0, updated: 0, errors: 0, errorDetails: [] as any[] }

  const { data: org } = await supabase.from('organizations').select('tax_rate').eq('id', ORG_ID).single()
  const taxRate = Number(org?.tax_rate ?? 4.5) / 100

  const mapStatus = (id: number) => {
    if ([6, 9, 11].includes(id)) return 'em_aberto'
    if ([15].includes(id)) return 'em_andamento'
    if ([12].includes(id)) return 'atendido'
    if ([13].includes(id)) return 'cancelado'
    return 'em_aberto'
  }

  try {
    let page = 1
    while (true) {
      const data = await blingFetch(`/pedidos/vendas?pagina=${page}&limite=100`, token)
      const pedidos = data?.data ?? []
      if (pedidos.length === 0) break

      for (const p of pedidos) {
        if (!p.id) continue
        stats.processed++

        let detail: any = p
        try {
          const d = await blingFetch(`/pedidos/vendas/${p.id}`, token)
          if (d?.data) detail = d.data
        } catch {}

        const itens = detail?.itens ?? []
        const unitsCount = itens.reduce((s: number, i: any) => s + Number(i.quantidade ?? 1), 0)
        const totalBruto = Number(detail?.totalProdutos ?? 0)
        const desconto = Number(detail?.desconto?.valor ?? 0)
        const totalVenda = totalBruto - desconto
        const frete = Number(detail?.transporte?.frete ?? 0)

        // Custo MP
        let totalCostMp = 0
        for (const item of itens) {
          const { data: prod } = await supabase.from('products')
            .select('cost_price').eq('sku', item.codigo?.trim()).eq('org_id', ORG_ID).maybeSingle()
          totalCostMp += Number(prod?.cost_price ?? 0) * Number(item.quantidade ?? 1)
        }

        // Custo operacional
        const orderedAt = detail?.data ? new Date(detail.data) : new Date()
        const { data: opCost } = await supabase.from('operational_costs')
          .select('*').eq('org_id', ORG_ID)
          .eq('year', orderedAt.getFullYear())
          .eq('month', orderedAt.getMonth() + 1)
          .maybeSingle()

        const opPerUnit = opCost
          ? (opCost.labor + opCost.admin + opCost.truck + opCost.maintenance +
             opCost.misc + opCost.tax + opCost.icms + opCost.freight_purchase +
             opCost.interest + opCost.discount_boletos) / opCost.units_produced
          : 0

        const totalCost = totalCostMp + (opPerUnit * unitsCount)
        const margin = totalVenda - totalCost - (totalVenda * taxRate)
        const marginPct = totalVenda > 0 ? (margin / totalVenda) * 100 : 0

        const cnpj = detail?.contato?.numeroDocumento ?? null
        let companyId = null
        if (cnpj) {
          const { data: company } = await supabase.from('companies')
            .select('id').eq('cnpj', cnpj).eq('org_id', ORG_ID).maybeSingle()
          companyId = company?.id ?? null
        }

        const { data: seller } = await supabase.from('sellers')
          .select('id').eq('bling_id', detail?.vendedor?.id).maybeSingle()

        const { data: existing } = await supabase.from('orders')
          .select('id').eq('bling_id', detail.id).maybeSingle()

        const { data: savedOrder, error } = await supabase.from('orders').upsert({
          org_id: ORG_ID,
          bling_id: detail.id,
          bling_number: String(detail.numero ?? ''),
          client_name: detail?.contato?.nome ?? '',
          client_cnpj: cnpj,
          company_id: companyId,
          seller_id: seller?.id ?? null,
          ordered_at: detail?.data ? new Date(detail.data).toISOString() : new Date().toISOString(),
          status: mapStatus(Number(detail?.situacao?.id ?? 6)),
          total_value: totalVenda,
          freight: frete,
          total_cost: totalCost,
          margin,
          margin_pct: marginPct,
          units_count: unitsCount,
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bling_id', ignoreDuplicates: false }).select('id').single()

        if (error) {
          stats.errors++
          stats.errorDetails.push({ numero: detail.numero, error: error.message })
        } else {
          existing ? stats.updated++ : stats.created++
          if (savedOrder && itens.length > 0) {
            await supabase.from('order_items').delete().eq('order_id', savedOrder.id)
            await supabase.from('order_items').insert(itens.map((item: any) => ({
              order_id: savedOrder.id,
              org_id: ORG_ID,
              sku: item.codigo?.trim(),
              description: item.descricao ?? '',
              quantity: Number(item.quantidade ?? 1),
              unit_price: Number(item.valor ?? 0),
              total_price: Number(item.valor ?? 0) * Number(item.quantidade ?? 1),
            })))
          }
        }
      }

      if (pedidos.length < 100) break
      page++
    }

    await finishLog(logId, stats, true)
  } catch (err: any) {
    stats.errorDetails.push({ error: err.message })
    await finishLog(logId, stats, false)
    throw err
  }

  return stats
}
