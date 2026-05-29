'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, TrendingUp, DollarSign, Package, Lightbulb } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import { StatCard, PageHeader, SectionHeader } from '@/components/ui/rm-components'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function pct(v: number) {
  return v.toFixed(1).replace('.', ',') + '%'
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const margem = payload.find((p: any) => p.dataKey === 'margem')?.value
  const custoFixo = payload.find((p: any) => p.dataKey === 'custoFixo')?.value
  const lucro = payload.find((p: any) => p.dataKey === 'lucro')?.value
  const temLucro = lucro !== null && lucro !== undefined
  return (
    <div style={{ background: 'white', border: '1px solid #F1F5F9', borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Dia {label}</p>
      {margem != null && <p style={{ color: '#3E8F76', marginBottom: 3 }}>Margem acumulada: {fmt(margem)}</p>}
      {custoFixo != null && <p style={{ color: '#EF4444', marginBottom: 3 }}>Custo fixo: {fmt(custoFixo)}</p>}
      {temLucro && <p style={{ color: '#1D6FE8', marginBottom: 3 }}>Lucro real: {fmt(lucro)}</p>}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9', fontWeight: 600, color: temLucro ? '#3E8F76' : '#D97706' }}>
        {temLucro ? '✓ Lucro positivo' : '→ Cobrindo custos fixos'}
      </div>
    </div>
  )
}

interface PrevMetrics {
  valorVendas: number
  margemAcum: number
  lucroReal: number
  pedidosMes: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [metrics, setMetrics] = useState({ valorVendas: 0, margemAcum: 0, lucroReal: 0, pedidosMes: 0 })
  const [prevMetrics, setPrevMetrics] = useState<PrevMetrics | null>(null)
  const [custoFixoMensal, setCustoFixoMensal] = useState(60000)
  const [chartData, setChartData] = useState<{
    dia: string; custoFixo: number; margem: number | null; lucro: number | null
  }[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])

  const now = new Date()
  const isCurrentMonth = selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth()
  const isPastMonth = selectedDate < new Date(now.getFullYear(), now.getMonth(), 1)
  const diasNoMes = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()
  const diasDecorridos = isPastMonth ? diasNoMes : isCurrentMonth ? now.getDate() : 0

  const hoje = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const hojeLabel = hoje.charAt(0).toUpperCase() + hoje.slice(1)

  const mesLabel = (() => {
    const s = format(selectedDate, 'MMMM yyyy', { locale: ptBR })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()

  const prevMesLabel = (() => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
    const s = format(d, 'MMMM', { locale: ptBR })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()

  const prevMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  useEffect(() => {
    setLoading(true)
    async function load() {
      const supabase = createClient()
      const mesInicio = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString()
      const mesFim = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString()
      const mesInicioPrev = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1).toISOString()
      const mesFimPrev = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0).toISOString()

      const [
        { data: pedidosMesData },
        { data: opCostData },
        { data: pedidosDiarios },
        { data: topData },
        { data: pedidosPrevData },
        { data: opCostPrevData },
        { data: pedidosDiariosPrev },
      ] = await Promise.all([
        supabase.from('crm_orders').select('id, total_value, ordered_at, units_count').gte('ordered_at', mesInicio).lte('ordered_at', mesFim),
        supabase.from('operational_costs').select('labor, admin, truck, maintenance, misc, icms, freight_purchase, interest').eq('year', selectedDate.getFullYear()).eq('month', selectedDate.getMonth() + 1).single(),
        supabase.from('crm_orders_freight').select('ordered_at, total_value, tax_amount, cost_mp, custo_frete_proporcional').gte('ordered_at', mesInicio).lte('ordered_at', mesFim).order('ordered_at', { ascending: true }),
        supabase.from('crm_orders').select('client_name, company_id, total_value, units_count').gte('ordered_at', mesInicio).lte('ordered_at', mesFim),
        // Mês anterior
        supabase.from('crm_orders').select('id, total_value, ordered_at, units_count').gte('ordered_at', mesInicioPrev).lte('ordered_at', mesFimPrev),
        supabase.from('operational_costs').select('labor, admin, truck, maintenance, misc, icms, freight_purchase, interest').eq('year', selectedDate.getMonth() === 0 ? selectedDate.getFullYear() - 1 : selectedDate.getFullYear()).eq('month', selectedDate.getMonth() === 0 ? 12 : selectedDate.getMonth()).single(),
        supabase.from('crm_orders_freight').select('total_value, tax_amount, cost_mp, custo_frete_proporcional').gte('ordered_at', mesInicioPrev).lte('ordered_at', mesFimPrev),
      ])

      // ── Custo fixo mês atual ─────────────────────────────────────────────
      const op = opCostData as any
      const custoFixo = op
        ? [op.labor, op.admin, op.truck, op.maintenance, op.misc, op.icms, op.freight_purchase, op.interest].reduce((s: number, v: any) => s + Number(v ?? 0), 0)
        : 60000
      setCustoFixoMensal(custoFixo)

      // ── Custo fixo mês anterior ──────────────────────────────────────────
      const opPrev = opCostPrevData as any
      const custoFixoPrev = opPrev
        ? [opPrev.labor, opPrev.admin, opPrev.truck, opPrev.maintenance, opPrev.misc, opPrev.icms, opPrev.freight_purchase, opPrev.interest].reduce((s: number, v: any) => s + Number(v ?? 0), 0)
        : 60000

      // ── Agrupa margem por dia (mês atual) ────────────────────────────────
      const diasNoMesLocal = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()
      const margemPorDia = new Map<string, number>()
      for (const p of (pedidosDiarios as any[]) ?? []) {
        const dia = new Date(p.ordered_at).getDate()
        const key = String(dia).padStart(2, '0')
        const custoVar = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
        margemPorDia.set(key, (margemPorDia.get(key) ?? 0) + (Number(p.total_value ?? 0) - custoVar))
      }

      // ── Monta array do gráfico ───────────────────────────────────────────
      const chartArr = []
      let margemAcum = 0
      let peDia = -1
      for (let d = 1; d <= diasNoMesLocal; d++) {
        const key = String(d).padStart(2, '0')
        const ehFuturo = isPastMonth ? false : isCurrentMonth ? d > now.getDate() : true
        if (!ehFuturo) {
          margemAcum += margemPorDia.get(key) ?? 0
          if (peDia === -1 && margemAcum >= custoFixo) peDia = d
        }
        const lucro: number | null = !ehFuturo && peDia !== -1 && d >= peDia ? Math.round(margemAcum - custoFixo) : null
        chartArr.push({ dia: `${d}`, custoFixo, margem: ehFuturo ? null : Math.round(margemAcum), lucro })
      }
      setChartData(chartArr)

      // ── Métricas mês atual ───────────────────────────────────────────────
      const valorVendas = (pedidosMesData ?? []).reduce((s, o) => s + Number(o.total_value ?? 0), 0)
      const pedidosMes = pedidosMesData?.length ?? 0
      const lucroReal = peDia !== -1 ? Math.max(0, margemAcum - custoFixo) : 0
      setMetrics({ valorVendas, margemAcum, lucroReal, pedidosMes })

      // ── Métricas mês anterior ────────────────────────────────────────────
      const valorVendasPrev = (pedidosPrevData ?? []).reduce((s, o) => s + Number(o.total_value ?? 0), 0)
      const pedidosMesPrev = pedidosPrevData?.length ?? 0
      let margemAcumPrev = 0
      for (const p of (pedidosDiariosPrev as any[]) ?? []) {
        const custoVar = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
        margemAcumPrev += Number(p.total_value ?? 0) - custoVar
      }
      const lucroRealPrev = Math.max(0, margemAcumPrev - custoFixoPrev)
      setPrevMetrics({ valorVendas: valorVendasPrev, margemAcum: margemAcumPrev, lucroReal: lucroRealPrev, pedidosMes: pedidosMesPrev })

      // ── Top clientes ─────────────────────────────────────────────────────
      const clienteMap = new Map<string, { nome: string; receita: number; urnas: number }>()
      for (const o of topData ?? []) {
        const key = o.company_id ?? o.client_name
        const prev = clienteMap.get(key) ?? { nome: o.client_name, receita: 0, urnas: 0 }
        clienteMap.set(key, { nome: prev.nome, receita: prev.receita + Number(o.total_value ?? 0), urnas: prev.urnas + Number(o.units_count ?? 0) })
      }
      setTopClientes(Array.from(clienteMap.values()).sort((a, b) => b.receita - a.receita).slice(0, 5))
      setLoading(false)
    }
    load()
  }, [selectedDate])

  // ── Derivados ────────────────────────────────────────────────────────────
  const diaEquilibrio = chartData.findIndex(d => d.lucro !== null)
  const peAtingido = diaEquilibrio >= 0

  // Deltas vs mês anterior
  const delta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : null
  const deltaVendas = prevMetrics ? delta(metrics.valorVendas, prevMetrics.valorVendas) : null
  const deltaLucro = prevMetrics ? delta(metrics.lucroReal, prevMetrics.lucroReal) : null
  const deltaPedidos = prevMetrics ? delta(metrics.pedidosMes, prevMetrics.pedidosMes) : null

  const trendLabel = (d: number | null) => {
    if (d === null) return undefined
    const sign = d >= 0 ? '▲' : '▼'
    return `${sign} ${Math.abs(d).toFixed(0)}% vs ${prevMesLabel}`
  }
  const trendDir = (d: number | null): 'up' | 'down' | undefined => d === null ? undefined : d >= 0 ? 'up' : 'down'

  // % lucro / faturamento
  const lucroSobreFaturamento = metrics.valorVendas > 0 && metrics.lucroReal > 0
    ? (metrics.lucroReal / metrics.valorVendas) * 100
    : null

  // Projeção de fechamento
  const projecaoLucro = isCurrentMonth && diasDecorridos > 0 && metrics.margemAcum > 0
    ? Math.round((metrics.margemAcum / diasDecorridos) * diasNoMes - custoFixoMensal)
    : null

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: string[] = []

  if (peAtingido) {
    const diaNum = chartData[diaEquilibrio]?.dia
    const mesNum = String(selectedDate.getMonth() + 1).padStart(2, '0')
    insights.push(`🎯 Custos fixos cobertos em ${diaNum}/${mesNum}`)
  } else if (diasDecorridos > 0 && metrics.margemAcum > 0) {
    const ritmoDiario = metrics.margemAcum / diasDecorridos
    const diasParaPE = Math.ceil((custoFixoMensal - metrics.margemAcum) / ritmoDiario)
    const estimado = now.getDate() + diasParaPE
    if (estimado <= diasNoMes) {
      insights.push(`⏳ No ritmo atual, custos fixos cobertos por volta do dia ${estimado}`)
    } else {
      insights.push(`⚠️ No ritmo atual, o ponto de equilíbrio não será atingido este mês`)
    }
  }

  if (lucroSobreFaturamento !== null) {
    insights.push(`💡 Lucro representa ${pct(lucroSobreFaturamento)} do faturamento do mês`)
  }

  if (projecaoLucro !== null && projecaoLucro > 0) {
    insights.push(`📈 Projeção de fechamento: ${fmt(projecaoLucro)} de lucro`)
  } else if (deltaLucro !== null && prevMetrics && prevMetrics.lucroReal > 0) {
    const sign = deltaLucro >= 0 ? '▲' : '▼'
    insights.push(`${sign} Lucro ${deltaLucro >= 0 ? '+' : ''}${deltaLucro.toFixed(0)}% comparado a ${prevMesLabel}`)
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <PageHeader title="Dashboard" subtitle={hojeLabel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={prevMonth} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 12px', color: '#9CA3AF', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>{mesLabel}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 12px', color: isCurrentMonth ? '#374151' : '#9CA3AF', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', fontSize: '16px', lineHeight: 1, opacity: isCurrentMonth ? 0.35 : 1 }}>›</button>
        </div>
      </PageHeader>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Valor em Vendas"
          value={fmt(metrics.valorVendas)}
          sub="mês atual"
          icon={ShoppingBag}
          valueColor="#3E8F76"
          trend={trendDir(deltaVendas)}
          trendLabel={trendLabel(deltaVendas)}
        />
        <StatCard
          label="Margem de Contribuição"
          value={fmt(metrics.margemAcum)}
          sub="acumulada no mês"
          icon={TrendingUp}
        />
        <StatCard
          label="Lucro Real"
          value={metrics.lucroReal > 0 ? fmt(metrics.lucroReal) : 'Aguardando PE'}
          sub={lucroSobreFaturamento !== null ? `${pct(lucroSobreFaturamento)} do faturamento` : ' '}
          icon={DollarSign}
          valueColor={metrics.lucroReal > 0 ? '#1D6FE8' : metrics.lucroReal < 0 ? '#DC2626' : '#D97706'}
          trend={trendDir(deltaLucro)}
          trendLabel={trendLabel(deltaLucro)}
        />
        <StatCard
          label="Pedidos do Mês"
          value={metrics.pedidosMes}
          sub="pedidos realizados"
          icon={Package}
          trend={trendDir(deltaPedidos)}
          trendLabel={trendLabel(deltaPedidos)}
        />
      </div>

      {/* ── Insights da Gestão ── */}
      {insights.length > 0 && (
        <div className="rm-card" style={{ padding: '14px 20px' }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280' }}>
              Insights da gestão
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {insights.map((insight, i) => (
              <p key={i} style={{ fontSize: '13px', color: 'var(--neutral-700)', lineHeight: 1.5 }}>
                {insight}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Gráfico Ponto de Equilíbrio ── */}
      <div className="rm-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280' }}>
              Ponto de Equilíbrio — {mesLabel}
            </p>
            {peAtingido ? (
              <p className="text-[12px] mt-1" style={{ color: 'var(--brand-teal)' }}>
                🎯 Custos fixos cobertos em {chartData[diaEquilibrio]?.dia}/{String(selectedDate.getMonth() + 1).padStart(2, '0')}
              </p>
            ) : (
              <p className="text-[12px] mt-1" style={{ color: '#B45309' }}>
                ⚠ Ponto de equilíbrio ainda não atingido
              </p>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {peAtingido && (
              <ReferenceLine
                x={chartData[diaEquilibrio]?.dia}
                stroke="#F59E0B"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: '⚑ PE atingido', position: 'insideTopRight', fontSize: 10, fill: '#D97706' }}
              />
            )}
            <Line type="monotone" dataKey="custoFixo" name="Custo Fixo" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="margem" name="Margem de Contribuição" stroke="#3E8F76" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line
              type="monotone" dataKey="lucro" name="Lucro Real" stroke="#1D6FE8" strokeWidth={2.5} connectNulls={false}
              dot={(props: any) => {
                const { cx, cy, index } = props
                if (index === diaEquilibrio && cx != null && cy != null) {
                  return <circle key="pe-dot" cx={cx} cy={cy} r={5} fill="#1D6FE8" stroke="white" strokeWidth={2} />
                }
                return <g key={`empty-${index}`} />
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {chartData.length > 0 && (() => {
            const last = chartData[chartData.findLastIndex(d => d.margem !== null)]
            return (
              <>
                <div className="text-center">
                  <p className="text-[11px]" style={{ color: '#6B7280' }}>Custo Fixo Mensal</p>
                  <p className="text-[14px] font-bold" style={{ color: '#EF4444' }}>{fmt(last?.custoFixo ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px]" style={{ color: '#6B7280' }}>Margem de Contribuição</p>
                  <p className="text-[14px] font-bold" style={{ color: '#3E8F76' }}>{fmt(last?.margem ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px]" style={{ color: '#6B7280' }}>Lucro Real</p>
                  <p className="text-[14px] font-bold" style={{ color: '#1D6FE8' }}>
                    {metrics.lucroReal > 0 ? fmt(metrics.lucroReal) : 'Aguardando PE'}
                  </p>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Top Clientes do Mês ── */}
      <div className="rm-card">
        <SectionHeader title="Top clientes do mês" linkHref="/empresas" linkLabel="Ver todos" />
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--neutral-100)' }} />
            ))}
          </div>
        ) : topClientes.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: 'var(--neutral-300)' }}>Nenhum pedido este mês</p>
        ) : (
          <div className="space-y-2">
            {topClientes.map((c, i) => {
              const p = topClientes[0].receita > 0 ? (c.receita / topClientes[0].receita) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold w-4 flex-shrink-0" style={{ color: 'var(--neutral-400)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>{c.nome}</p>
                      <span className="text-[12px] font-bold ml-2 flex-shrink-0" style={{ color: 'var(--brand-teal)' }}>{fmt(c.receita)}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--neutral-100)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: 'var(--brand-teal)' }} />
                    </div>
                  </div>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--neutral-500)' }}>{c.urnas} urnas</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
