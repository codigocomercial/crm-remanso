'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { useUserRole } from '@/hooks/useUserRole'
import { MarginDisplay } from '@/components/ui/MarginIndicator'
import { RefreshCw, Search, ShoppingBag, MapPin } from 'lucide-react'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  em_aberto: { label: 'Em Aberto', color: '#1D6FA4', bg: '#EBF4FB' },
  em_andamento: { label: 'Em Andamento', color: '#B45309', bg: '#FEF3C7' },
  em_digitacao: { label: 'Rascunho', color: '#6B7280', bg: '#F1F5F9' },
  atendido: { label: 'Entregue', color: '#2F6F5D', bg: '#EBF5F1' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
  perdido: { label: 'Perdido', color: '#9333EA', bg: '#F5F3FF' },
}

const TABLE_COLUMNS = '80px 100px minmax(200px, 1fr) 60px 90px 110px 100px 110px'

interface Order {
  id: string
  bling_number: string | null
  client_name: string | null
  client_cnpj: string | null
  client_city: string | null
  client_state: string | null
  seller_name: string | null
  status: string
  total_value: number | null
  freight: number | null
  margin: number | null
  margin_pct: number | null
  total_cost: number | null
  units_count: number | null
  ordered_at: string | null
  company_id: string | null
}

interface OrderItem {
  id: string
  sku: string | null
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function PropostasPage() {
  const { can } = useUserRole()
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [companies, setCompanies] = useState<Record<string, { fantasia: string | null; name: string }>>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [sellerFilter, setSellerFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState(() => {
    const n = new Date(); return toDateStr(new Date(n.getFullYear(), n.getMonth(), 1))
  })
  const [dateTo, setDateTo] = useState(() => {
    const n = new Date(); return toDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItem[]>>({})
  const [sellers, setSellers] = useState<string[]>([])

  useEffect(() => { load() }, [])

  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  }, [search, statusFilter, sellerFilter, dateFrom, dateTo])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('crm_orders')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('ordered_at', { ascending: false })
      .limit(300)

    if (search.trim()) query = query.or(`client_name.ilike.%${search}%,bling_number.ilike.%${search}%`)
    if (statusFilter !== 'todos') query = query.eq('status', statusFilter)
    if (sellerFilter !== 'todos') query = query.eq('seller_name', sellerFilter)
    if (dateFrom) query = query.gte('ordered_at', dateFrom)
    if (dateTo) query = query.lte('ordered_at', `${dateTo}T23:59:59`)

    const { data } = await query
    const list = data ?? []
    setOrders(list)

    const uniqueSellers = [...new Set(list.map(o => o.seller_name).filter(Boolean))] as string[]
    setSellers(uniqueSellers)

    const companyIds = [...new Set(list.map(o => o.company_id).filter(Boolean))] as string[]
    if (companyIds.length > 0) {
      const { data: comps } = await supabase.from('crm_companies').select('id, fantasia, name').in('id', companyIds)
      const map: Record<string, { fantasia: string | null; name: string }> = {}
      for (const c of comps ?? []) map[c.id] = c
      setCompanies(map)
    }

    setLoading(false)
  }

  async function toggleExpand(orderId: string) {
    if (expandedId === orderId) { setExpandedId(null); return }
    setExpandedId(orderId)
    if (itemsMap[orderId]) return
    const { data } = await supabase.from('crm_order_items').select('*').eq('order_id', orderId).order('description')
    setItemsMap(prev => ({ ...prev, [orderId]: data ?? [] }))
  }

  async function syncPedidos() {
    setSyncing(true)
    const res = await fetch('/api/bling/sync/pedidos', { method: 'POST' })
    const data = await res.json()
    if (!data.success) {
      alert(`Erro ao sincronizar: ${data.error}`)
      setSyncing(false)
      return
    }
    // Recarregar a cada 30s por 30 minutos
    let attempts = 0
    const interval = setInterval(() => {
      load()
      attempts++
      if (attempts >= 60) {
        clearInterval(interval)
        setSyncing(false)
      }
    }, 30000)
    // Primeira recarga em 30s
    setTimeout(() => load(), 30000)
  }

  const fmt = (v: number | null) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  function navMonth(dir: -1 | 1) {
    const base = new Date(dateFrom + 'T12:00:00')
    const first = new Date(base.getFullYear(), base.getMonth() + dir, 1)
    const last  = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    setDateFrom(toDateStr(first))
    setDateTo(toDateStr(last))
  }

  const mesLabel = (() => {
    const d = new Date(dateFrom + 'T12:00:00')
    const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()
  const clientName = (o: Order) => {
    if (o.company_id && companies[o.company_id]) {
      const c = companies[o.company_id]
      return c.fantasia || c.name
    }
    return o.client_name ?? '—'
  }

  const totalVenda = orders.reduce((s, o) => s + (o.total_value ?? 0), 0)
  const totalMargem = orders.reduce((s, o) => s + (o.margin ?? 0), 0)
  const totalUrnas = orders.reduce((s, o) => s + (o.units_count ?? 0), 0)
  const margemMedia = totalVenda > 0 ? (totalMargem / totalVenda) * 100 : 0

  return (
    <div className="animate-fade-in">
      <div className="sticky top-0 z-20" style={{ backdropFilter: "blur(8px)" }}>
      <PageHeader
        title="Pedidos de Venda"
        subtitle={`${orders.length} pedido(s) · ${totalUrnas} urnas · Total R$ ${fmt(totalVenda)}${can('view_margins') ? ` · Margem ${margemMedia.toFixed(1)}%` : ''}`}
      >
        <button onClick={syncPedidos} disabled={syncing} className="btn-remanso-outline flex items-center gap-1.5">
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Bling'}
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="rm-card mb-5 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--neutral-300)' }} />
            <input type="text" placeholder="Buscar cliente, nº pedido..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand-teal)'; e.currentTarget.style.backgroundColor = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.backgroundColor = 'var(--neutral-100)' }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => navMonth(-1)}
              className="px-2.5 py-2 rounded-lg border text-[14px] leading-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>
              ‹
            </button>
            <span className="text-[13px] font-semibold min-w-[110px] text-center" style={{ color: 'var(--neutral-700)' }}>
              {mesLabel}
            </span>
            <button onClick={() => navMonth(1)}
              className="px-2.5 py-2 rounded-lg border text-[14px] leading-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>
              ›
            </button>
            <span className="text-[11px] mx-1" style={{ color: 'var(--neutral-300)' }}>|</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-[12px] rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-400)' }}>até</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-[12px] rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }} />
          </div>
          {sellers.length > 0 && (
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
              className="px-3 py-2 text-[12px] rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }}>
              <option value="todos">Todos vendedores</option>
              {sellers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['todos', 'em_aberto', 'em_andamento', 'atendido', 'perdido', 'cancelado'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-[12px] px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: statusFilter === s ? (s === 'todos' ? 'var(--brand-teal)' : STATUS[s]?.bg) : 'var(--neutral-100)',
                color: statusFilter === s ? (s === 'todos' ? 'white' : STATUS[s]?.color) : 'var(--neutral-500)',
                border: `1px solid ${statusFilter === s ? 'transparent' : 'rgba(0,0,0,0.06)'}`,
              }}>
              {s === 'todos' ? 'Todos' : STATUS[s]?.label}
            </button>
          ))}
        </div>
      </div>

      </div>

      {/* Tabela */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rm-card animate-pulse h-14" style={{ background: 'var(--neutral-100)' }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rm-card flex flex-col items-center py-16 text-center">
          <ShoppingBag size={40} className="mb-4" style={{ color: 'var(--neutral-300)' }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--neutral-700)' }}>
            {search ? 'Nenhum pedido encontrado' : 'Nenhum pedido sincronizado'}
          </p>
          <p className="text-[13px] mb-5" style={{ color: 'var(--neutral-500)' }}>
            {search ? 'Tente outro termo' : 'Clique em Sincronizar Bling para importar'}
          </p>
          {!search && (
            <button onClick={syncPedidos} className="btn-remanso flex items-center gap-2">
              <RefreshCw size={13} /> Sincronizar agora
            </button>
          )}
        </div>
      ) : (
        <div className="rm-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          {/* Cabeçalho */}
          <div className="hidden md:grid items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase"
            style={{
              gridTemplateColumns: TABLE_COLUMNS,
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              background: 'var(--neutral-50)',
              color: 'var(--neutral-500)',
              letterSpacing: '0.05em',
            }}>
            <span>Nº</span>
            <span>Data</span>
            <span>Cliente</span>
            <span className="text-center">Urnas</span>
            <span className="text-center">Total</span>
            <span className="text-center">Margem</span>
            <span className="text-center">Vendedor</span>
            <span className="text-center">Status</span>
          </div>

          {orders.map((order, i) => {
            const st = STATUS[order.status] ?? STATUS.em_aberto
            const isExpanded = expandedId === order.id
            const items = itemsMap[order.id] ?? []
            const marginPct = order.margin_pct ?? 0

            return (
              <div key={order.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                <button onClick={() => toggleExpand(order.id)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors">
                  <div className="grid items-center gap-2" style={{ gridTemplateColumns: TABLE_COLUMNS }}>

                    <span className="text-[14px] font-bold" style={{ color: 'var(--brand-teal)' }}>
                      #{order.bling_number ?? '—'}
                    </span>

                    <span className="text-[12px]" style={{ color: 'var(--neutral-500)' }}>
                      {fmtDate(order.ordered_at)}
                    </span>

                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--neutral-800)' }}>
                        {clientName(order)}
                      </p>
                      {order.client_city && (
                        <p className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--neutral-400)' }}>
                          <MapPin size={9} /> {order.client_city}/{order.client_state}
                        </p>
                      )}
                    </div>

                    <span className="text-[12px] font-semibold text-center" style={{ color: 'var(--neutral-700)' }}>
                      {order.units_count ?? '—'}
                    </span>

                    <span className="text-[13px] font-semibold text-right" style={{ color: 'var(--neutral-800)' }}>
                      R$ {fmt(order.total_value)}
                    </span>

                    <div className="flex justify-center">
                      <MarginDisplay pct={marginPct} value={order.margin ?? 0} type="order" />
                    </div>

                    <span className="text-[12px] truncate text-center" style={{ color: 'var(--neutral-600)' }}>
                      {order.seller_name ?? '—'}
                    </span>

                    <div className="flex justify-center">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Itens expandidos */}
                {isExpanded && (
                  <div className="px-4 pb-4" style={{ background: 'var(--neutral-50)', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <p className="text-[11px] font-semibold uppercase pt-3 pb-2"
                      style={{ color: 'var(--neutral-500)', letterSpacing: '0.05em' }}>
                      Itens do Pedido
                    </p>
                    {items.length === 0 ? (
                      <p className="text-[12px]" style={{ color: 'var(--neutral-400)' }}>Carregando...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-[12px] py-1.5 px-3 rounded-lg bg-white"
                            style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>
                                {item.sku}
                              </span>
                              <span className="truncate" style={{ color: 'var(--neutral-700)' }}>{item.description}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 ml-4">
                              <span style={{ color: 'var(--neutral-500)' }}>{item.quantity}x</span>
                              <span style={{ color: 'var(--neutral-500)' }}>R$ {fmt(item.unit_price)}</span>
                              <span className="font-semibold w-24 text-right" style={{ color: 'var(--neutral-800)' }}>
                                R$ {fmt(item.total_price)}
                              </span>
                            </div>
                          </div>
                        ))}

                        <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                          <div className="flex justify-between text-[12px]">
                            <span style={{ color: 'var(--neutral-500)' }}>Valor urnas</span>
                            <span className="font-semibold" style={{ color: 'var(--neutral-800)' }}>R$ {fmt(order.total_value)}</span>
                          </div>
                          {(order.freight ?? 0) > 0 && (
                            <div className="flex justify-between text-[12px]">
                              <span style={{ color: 'var(--neutral-500)' }}>Frete cobrado</span>
                              <span className="font-semibold" style={{ color: '#1D6FA4' }}>+ R$ {fmt(order.freight)}</span>
                            </div>
                          )}
                          {(order.freight ?? 0) === 0 && (
                            <div className="flex justify-between text-[12px]">
                              <span style={{ color: 'var(--neutral-500)' }}>Frete</span>
                              <span className="font-semibold" style={{ color: '#B45309' }}>Negociado grátis</span>
                            </div>
                          )}
                          {can('view_margins') && (
                            <div className="flex justify-between text-[13px] pt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                              <span className="font-bold" style={{ color: 'var(--neutral-700)' }}>Margem bruta</span>
                              <span className="font-bold" style={{ color: (order.margin ?? 0) >= 0 ? '#2F6F5D' : '#DC2626' }}>
                                R$ {fmt(order.margin)} ({(order.margin_pct ?? 0).toFixed(1)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}
