'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/hooks/useUserRole'
import { ShoppingBag, TrendingUp, DollarSign, Package, Lightbulb, Bot } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import { StatCard, PageHeader, SectionHeader } from '@/components/ui/rm-components'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  getCalendarDateParts,
  startOfCalendarMonthUtc,
  startOfNextCalendarMonthUtc,
} from '@/lib/calendar-date'
import { isRevenueOrderStatus } from '@/lib/orders/revenue-status'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CUSTO_FIXO_PADRAO = 60000

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
      <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>{label}</p>
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

// ── Pill helper ─────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        padding: '4px 13px',
        borderRadius: 999,
        border: active ? '1px solid #1D9E75' : '1px solid rgba(255,255,255,0.12)',
        background: active ? '#1D9E75' : 'transparent',
        color: active ? '#fff' : '#9CA3AF',
        cursor: 'pointer',
        transition: 'all 0.12s',
        lineHeight: 1.5,
      }}
    >
      {label}
    </button>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  useEffect(() => {
    if (!roleLoading && role === 'seller') router.replace('/atendimentos')
  }, [role, roleLoading, router])

  const now = new Date()
  const anoAtual = now.getFullYear()
  const mesAtual = now.getMonth() + 1

  const [selectedYear, setSelectedYear] = useState(anoAtual)
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(() => new Set([mesAtual]))

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ valorVendas: 0, margemAcum: 0, lucroReal: 0, pedidosMes: 0 })
  const [prevMetrics, setPrevMetrics] = useState<PrevMetrics | null>(null)
  const [custoFixoTotal, setCustoFixoTotal] = useState(CUSTO_FIXO_PADRAO)
  const [chartData, setChartData] = useState<{ dia: string; custoFixo: number; margem: number | null; lucro: number | null }[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])
  const [isSingleMonth, setIsSingleMonth] = useState(true)

  // ── Anos disponíveis ──────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const anos = []
    for (let y = 2025; y <= anoAtual; y++) anos.push(y)
    return anos
  }, [anoAtual])

  // ── Meses disponíveis para o ano selecionado ──────────────────────────────
  const availableMonths = useMemo(() => {
    const limite = selectedYear < anoAtual ? 12 : mesAtual
    const meses = []
    for (let m = 1; m <= limite; m++) meses.push(m)
    return meses
  }, [selectedYear, anoAtual, mesAtual])

  // Quando muda de ano, limpa meses inválidos
  useEffect(() => {
    const limite = selectedYear < anoAtual ? 12 : mesAtual
    setSelectedMonths(prev => {
      const novos = new Set([...prev].filter(m => m <= limite))
      return novos.size > 0 ? novos : new Set([limite])
    })
  }, [selectedYear])

  function toggleMonth(m: number) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) {
        next.delete(m)
        if (next.size === 0) return prev // ao menos 1 mês
      } else {
        next.add(m)
      }
      return next
    })
  }

  // ── Labels ────────────────────────────────────────────────────────────────
  const sortedMonths = useMemo(() => [...selectedMonths].sort((a, b) => a - b), [selectedMonths])

  const periodoLabel = useMemo(() => {
    if (sortedMonths.length === 0) return ''
    if (sortedMonths.length === 1) {
      const s = format(new Date(selectedYear, sortedMonths[0] - 1, 1), 'MMMM yyyy', { locale: ptBR })
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    const primeiro = MESES_PT[sortedMonths[0] - 1]
    const ultimo = MESES_PT[sortedMonths[sortedMonths.length - 1] - 1]
    return `${primeiro} – ${ultimo} ${selectedYear}`
  }, [sortedMonths, selectedYear])

  const prevMesLabel = useMemo(() => {
    if (sortedMonths.length !== 1) return ''
    const m = sortedMonths[0]
    const d = new Date(selectedYear, m - 2, 1)
    const s = format(d, 'MMMM', { locale: ptBR })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [sortedMonths, selectedYear])

  const hoje = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const hojeLabel = hoje.charAt(0).toUpperCase() + hoje.slice(1)

  // ── Carregamento ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedMonths.size === 0) return
    setLoading(true)

    async function load() {
      const supabase = createClient()
      const meses = [...selectedMonths].sort((a, b) => a - b)
      const single = meses.length === 1
      setIsSingleMonth(single)

      // Range total do período selecionado
      const rangeStart = startOfCalendarMonthUtc(selectedYear, meses[0])
      const rangeEndExclusive = startOfNextCalendarMonthUtc(selectedYear, meses[meses.length - 1])

      // Queries em paralelo
      const opPromises = meses.map(m =>
        supabase.from('operational_costs')
          .select('labor,admin,truck,maintenance,misc,icms,freight_purchase,interest')
          .eq('year', selectedYear).eq('month', m).single()
      )

      const [
        { data: allOrders },
        { data: allFreight },
        ...opResults
      ] = await Promise.all([
        supabase.from('crm_orders')
          .select('id,total_value,ordered_at,units_count,client_name,company_id,status')
          .gte('ordered_at', rangeStart).lt('ordered_at', rangeEndExclusive),
        supabase.from('crm_orders_freight')
          .select('id,ordered_at,total_value,tax_amount,cost_mp,custo_frete_proporcional')
          .gte('ordered_at', rangeStart).lt('ordered_at', rangeEndExclusive)
          .order('ordered_at', { ascending: true }),
        ...opPromises,
      ])

      // Filtra apenas meses selecionados (range pode incluir meses intermediários não selecionados)
      function isMesSelecionado(dateStr: string) {
        const parts = getCalendarDateParts(dateStr)
        return parts?.year === selectedYear && selectedMonths.has(parts.month)
      }
      const orders = (allOrders ?? [])
        .filter(o => isMesSelecionado(o.ordered_at))
        .filter(o => isRevenueOrderStatus(o.status))
      const revenueOrderIds = new Set(orders.map(o => o.id))
      const freight = (allFreight ?? [])
        .filter(o => isMesSelecionado(o.ordered_at))
        .filter(o => revenueOrderIds.has(o.id))

      // Custo fixo por mês
      const cfPorMes = new Map<number, number>()
      let totalCF = 0
      meses.forEach((m, i) => {
        const op = (opResults[i] as any)?.data as any
        const cf = op
          ? [op.labor, op.admin, op.truck, op.maintenance, op.misc, op.icms, op.freight_purchase, op.interest]
              .reduce((s: number, v: any) => s + Number(v ?? 0), 0)
          : CUSTO_FIXO_PADRAO
        cfPorMes.set(m, cf)
        totalCF += cf
      })
      setCustoFixoTotal(totalCF)

      // Métricas agregadas
      const valorVendas = orders.reduce((s, o) => s + Number(o.total_value ?? 0), 0)
      const pedidosMes = orders.length
      let margemAcum = 0
      for (const p of freight) {
        const cv = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
        margemAcum += Number(p.total_value ?? 0) - cv
      }
      const lucroReal = Math.max(0, margemAcum - totalCF)
      setMetrics({ valorVendas, margemAcum, lucroReal, pedidosMes })

      // Top clientes
      const clienteMap = new Map<string, { nome: string; receita: number; urnas: number }>()
      for (const o of orders) {
        const key = o.company_id ?? o.client_name
        const prev = clienteMap.get(key) ?? { nome: o.client_name, receita: 0, urnas: 0 }
        clienteMap.set(key, { nome: prev.nome, receita: prev.receita + Number(o.total_value ?? 0), urnas: prev.urnas + Number(o.units_count ?? 0) })
      }
      setTopClientes(Array.from(clienteMap.values()).sort((a, b) => b.receita - a.receita).slice(0, 5))

      // ── Gráfico ──────────────────────────────────────────────────────────
      if (single) {
        // Vista diária (comportamento original)
        const m = meses[0]
        const isCurrentM = selectedYear === anoAtual && m === mesAtual
        const isPastM = selectedYear < anoAtual || (selectedYear === anoAtual && m < mesAtual)
        const diasNoMes = new Date(selectedYear, m, 0).getDate()
        const cf = cfPorMes.get(m) ?? CUSTO_FIXO_PADRAO

        const margemPorDia = new Map<string, number>()
        for (const p of freight) {
          const dia = getCalendarDateParts(p.ordered_at)?.day
          if (!dia) continue
          const key = String(dia).padStart(2, '0')
          const cv = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
          margemPorDia.set(key, (margemPorDia.get(key) ?? 0) + (Number(p.total_value ?? 0) - cv))
        }

        const chartArr = []
        let cumMargem = 0
        let peDia = -1
        for (let d = 1; d <= diasNoMes; d++) {
          const key = String(d).padStart(2, '0')
          const ehFuturo = isPastM ? false : isCurrentM ? d > now.getDate() : true
          if (!ehFuturo) {
            cumMargem += margemPorDia.get(key) ?? 0
            if (peDia === -1 && cumMargem >= cf) peDia = d
          }
          const lucro = !ehFuturo && peDia !== -1 && d >= peDia ? Math.round(cumMargem - cf) : null
          chartArr.push({ dia: `${d}`, custoFixo: cf, margem: ehFuturo ? null : Math.round(cumMargem), lucro })
        }
        setChartData(chartArr)

        // prevMetrics (só no modo mês único)
        const prevM = m === 1 ? 12 : m - 1
        const prevY = m === 1 ? selectedYear - 1 : selectedYear
        const prevStart = startOfCalendarMonthUtc(prevY, prevM)
        const prevEndExclusive = startOfNextCalendarMonthUtc(prevY, prevM)

        const [{ data: prevOrders }, { data: prevFreight }, prevOpRes] = await Promise.all([
          supabase.from('crm_orders').select('id,total_value,status').gte('ordered_at', prevStart).lt('ordered_at', prevEndExclusive),
          supabase.from('crm_orders_freight').select('id,total_value,tax_amount,cost_mp,custo_frete_proporcional').gte('ordered_at', prevStart).lt('ordered_at', prevEndExclusive),
          supabase.from('operational_costs').select('labor,admin,truck,maintenance,misc,icms,freight_purchase,interest').eq('year', prevY).eq('month', prevM).single(),
        ])

        const prevOp = (prevOpRes as any).data as any
        const prevCF = prevOp
          ? [prevOp.labor, prevOp.admin, prevOp.truck, prevOp.maintenance, prevOp.misc, prevOp.icms, prevOp.freight_purchase, prevOp.interest]
              .reduce((s: number, v: any) => s + Number(v ?? 0), 0)
          : CUSTO_FIXO_PADRAO
        const previousRevenueOrders = (prevOrders ?? []).filter(o => isRevenueOrderStatus(o.status))
        const previousRevenueOrderIds = new Set(previousRevenueOrders.map(o => o.id))
        const previousRevenueFreight = (prevFreight ?? []).filter(o => previousRevenueOrderIds.has(o.id))
        const prevValor = previousRevenueOrders.reduce((s, o) => s + Number(o.total_value ?? 0), 0)
        let prevMargem = 0
        for (const p of previousRevenueFreight) {
          const cv = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
          prevMargem += Number(p.total_value ?? 0) - cv
        }
        setPrevMetrics({
          valorVendas: prevValor,
          margemAcum: prevMargem,
          lucroReal: Math.max(0, prevMargem - prevCF),
          pedidosMes: previousRevenueOrders.length,
        })
      } else {
        // Vista mensal acumulada
        const chartArr = []
        let cumMargem = 0
        let cumCF = 0
        let peIdx = -1

        for (let i = 0; i < meses.length; i++) {
          const m = meses[i]
          const isFuture = selectedYear > anoAtual || (selectedYear === anoAtual && m > mesAtual)
          const cf = cfPorMes.get(m) ?? CUSTO_FIXO_PADRAO
          cumCF += cf

          if (!isFuture) {
            const monthFreight = freight.filter(p => getCalendarDateParts(p.ordered_at)?.month === m)
            for (const p of monthFreight) {
              const cv = Number(p.tax_amount ?? 0) + Number(p.cost_mp ?? 0) + Number(p.custo_frete_proporcional ?? 0)
              cumMargem += Number(p.total_value ?? 0) - cv
            }
            if (peIdx === -1 && cumMargem >= cumCF) peIdx = i
          }

          const lucro = !isFuture && peIdx !== -1 && i >= peIdx ? Math.round(cumMargem - cumCF) : null
          chartArr.push({ dia: MESES_PT[m - 1], custoFixo: Math.round(cumCF), margem: isFuture ? null : Math.round(cumMargem), lucro })
        }
        setChartData(chartArr)
        setPrevMetrics(null) // sem comparação em modo multi-mês
      }

      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonths])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const peAtingidoIdx = chartData.findIndex(d => d.lucro !== null)
  const peAtingido = peAtingidoIdx >= 0

  const delta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : null
  const deltaVendas = prevMetrics ? delta(metrics.valorVendas, prevMetrics.valorVendas) : null
  const deltaLucro = prevMetrics ? delta(metrics.lucroReal, prevMetrics.lucroReal) : null
  const deltaPedidos = prevMetrics ? delta(metrics.pedidosMes, prevMetrics.pedidosMes) : null

  const trendLabel = (d: number | null) => {
    if (d === null || !prevMesLabel) return undefined
    return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% vs ${prevMesLabel}`
  }
  const trendDir = (d: number | null): 'up' | 'down' | undefined =>
    d === null ? undefined : d >= 0 ? 'up' : 'down'

  const lucroSobreFaturamento = metrics.valorVendas > 0 && metrics.lucroReal > 0
    ? (metrics.lucroReal / metrics.valorVendas) * 100
    : null

  // Projeção só para mês único corrente
  const isCurrentMonthOnly = sortedMonths.length === 1 && selectedYear === anoAtual && sortedMonths[0] === mesAtual
  const diasNoMes = isCurrentMonthOnly ? new Date(anoAtual, mesAtual, 0).getDate() : 0
  const diasDecorridos = isCurrentMonthOnly ? now.getDate() : 0
  const projecaoLucro = isCurrentMonthOnly && diasDecorridos > 0 && metrics.margemAcum > 0
    ? Math.round((metrics.margemAcum / diasDecorridos) * diasNoMes - custoFixoTotal)
    : null

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights: { label: string; value: string; color: string }[] = []

  if (peAtingido) {
    const label = isSingleMonth ? `dia ${chartData[peAtingidoIdx]?.dia}` : chartData[peAtingidoIdx]?.dia
    insights.push({ label: 'Ponto de equilíbrio', value: `🎯 Cobertos em ${label}`, color: '#3E8F76' })
  } else if (metrics.margemAcum > 0) {
    if (isSingleMonth && diasDecorridos > 0) {
      const ritmo = metrics.margemAcum / diasDecorridos
      const estimado = Math.ceil(custoFixoTotal / ritmo)
      insights.push({
        label: 'Ponto de equilíbrio',
        value: estimado <= diasNoMes ? `⏳ Estimativa: dia ${estimado}` : '⚠️ Fora do alcance este mês',
        color: '#D97706',
      })
    } else {
      insights.push({ label: 'Ponto de equilíbrio', value: '⚠️ Fora do alcance no período', color: '#D97706' })
    }
  }

  if (lucroSobreFaturamento !== null) {
    insights.push({ label: 'Lucro sobre faturamento', value: `💰 ${pct(lucroSobreFaturamento)} do faturamento`, color: '#1D6FE8' })
  }

  if (!isSingleMonth) {
    insights.push({
      label: `${sortedMonths.length} meses | Custo fixo total`,
      value: fmt(custoFixoTotal),
      color: '#EF4444',
    })
  }

  if (projecaoLucro !== null && projecaoLucro > 0) {
    insights.push({ label: 'Projeção de fechamento', value: `📈 ${fmt(projecaoLucro)} de lucro`, color: '#3E8F76' })
  } else if (deltaLucro !== null && prevMetrics && prevMetrics.lucroReal > 0) {
    insights.push({
      label: `vs ${prevMesLabel}`,
      value: `${deltaLucro >= 0 ? '▲' : '▼'} Lucro ${deltaLucro >= 0 ? '+' : ''}${deltaLucro.toFixed(0)}%`,
      color: deltaLucro >= 0 ? '#3E8F76' : '#EF4444',
    })
  }

  const recomendacao = (() => {
    if (!peAtingido && isCurrentMonthOnly && diasDecorridos > diasNoMes * 0.5) return 'Ritmo abaixo do esperado. Acelerar vendas na segunda metade do mês.'
    if (lucroSobreFaturamento !== null && lucroSobreFaturamento > 20) return 'Margem saudável. Bom momento para avaliar expansão de carteira.'
    if (projecaoLucro !== null && projecaoLucro > 0) return 'Margem crescendo acima do custo fixo. Ritmo favorável para superar a meta.'
    if (!isSingleMonth && peAtingido) return `Ponto de equilíbrio coberto no período de ${sortedMonths.length} meses.`
    return 'Acompanhe o ritmo diário para garantir o ponto de equilíbrio no prazo.'
  })()

  if (roleLoading || role === 'seller') return null

  // ── Estilo dos pills ──────────────────────────────────────────────────────
  const pillBase: React.CSSProperties = {
    fontSize: 12, padding: '4px 13px', borderRadius: 999,
    cursor: 'pointer', transition: 'all 0.12s', lineHeight: 1.5, border: '1px solid',
  }
  const pillActive: React.CSSProperties = { ...pillBase, background: '#1D9E75', borderColor: '#1D9E75', color: '#fff', fontWeight: 600 }
  const pillInactive: React.CSSProperties = { ...pillBase, background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: '#9CA3AF', fontWeight: 400 }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header com seletor de período ── */}
      <PageHeader title="Dashboard" subtitle={hojeLabel}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {/* Anos */}
          <div style={{ display: 'flex', gap: 6 }}>
            {availableYears.map(y => (
              <button key={y} onClick={() => setSelectedYear(y)} style={y === selectedYear ? pillActive : pillInactive}>
                {y}
              </button>
            ))}
          </div>
          {/* Meses */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {availableMonths.map(m => (
              <button key={m} onClick={() => toggleMonth(m)} style={selectedMonths.has(m) ? pillActive : pillInactive}>
                {MESES_PT[m - 1]}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Valor em Vendas"
          value={fmt(metrics.valorVendas)}
          sub={isSingleMonth ? 'mês selecionado' : `${sortedMonths.length} meses`}
          icon={ShoppingBag}
          valueColor="#D4A373"
          trend={trendDir(deltaVendas)}
          trendLabel={trendLabel(deltaVendas)}
        />
        <StatCard
          label="Margem de Contribuição"
          value={fmt(metrics.margemAcum)}
          sub="acumulada no período"
          icon={TrendingUp}
          valueColor="#3E8F76"
        />
        <StatCard
          label="Lucro Real"
          value={fmt(metrics.lucroReal)}
          sub={lucroSobreFaturamento !== null ? `${pct(lucroSobreFaturamento)} do faturamento` : ' '}
          icon={DollarSign}
          valueColor={metrics.lucroReal > 0 ? '#1D6FE8' : metrics.lucroReal < 0 ? '#DC2626' : '#D97706'}
          trend={trendDir(deltaLucro)}
          trendLabel={trendLabel(deltaLucro)}
        />
        <StatCard
          label="Pedidos do Mês"
          value={metrics.pedidosMes}
          sub={isSingleMonth ? 'pedidos realizados' : `em ${sortedMonths.length} meses`}
          icon={Package}
          valueColor="#9CA3AF"
          trend={trendDir(deltaPedidos)}
          trendLabel={trendLabel(deltaPedidos)}
        />
      </div>

      {/* ── Gráfico + Insights ── */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>

        {/* Gráfico — 75% */}
        <div className="rm-card" style={{ flex: 3, minWidth: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280' }}>
                Ponto de Equilíbrio — {periodoLabel}
              </p>
              {!isSingleMonth && (
                <p style={{ fontSize: '11px', color: '#6B7280', marginTop: 2 }}>
                  Custo fixo acumulado: {fmt(custoFixoTotal)} ({sortedMonths.length}× {fmt(custoFixoTotal / sortedMonths.length)})
                </p>
              )}
              {peAtingido ? (
                <p className="text-[12px] mt-1" style={{ color: 'var(--brand-teal)' }}>
                  🎯 Custos fixos cobertos em {chartData[peAtingidoIdx]?.dia}
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
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10, fill: '#aaa' }}
                axisLine={false}
                tickLine={false}
                interval={isSingleMonth ? 'preserveStartEnd' : 0}
              />
              <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {peAtingido && (
                <ReferenceLine
                  x={chartData[peAtingidoIdx]?.dia}
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
                  if (index === peAtingidoIdx && cx != null && cy != null) {
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
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>Custo Fixo {isSingleMonth ? 'Mensal' : 'Total'}</p>
                    <p className="text-[14px] font-bold" style={{ color: '#EF4444' }}>{fmt(last?.custoFixo ?? 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>Margem de Contribuição</p>
                    <p className="text-[14px] font-bold" style={{ color: '#3E8F76' }}>{fmt(last?.margem ?? 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>Lucro Real</p>
                    <p className="text-[14px] font-bold" style={{ color: '#1D6FE8' }}>{fmt(metrics.lucroReal)}</p>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Insights — 25% */}
        <div className="rm-card" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '16px' }}>
            <Lightbulb size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', margin: 0 }}>
              Insights
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {insights.map((item, i) => (
              <div key={i} style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: item.color, margin: 0 }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Bot size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', margin: 0 }}>
                Recomendação
              </p>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: 1.55 }}>
              {recomendacao}
            </p>
          </div>
        </div>

      </div>

      {/* ── Top Clientes do Período ── */}
      <div className="rm-card">
        <SectionHeader title={isSingleMonth ? 'Top clientes do mês' : `Top clientes do período`} linkHref="/empresas" linkLabel="Ver todos" />
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--neutral-100)' }} />
            ))}
          </div>
        ) : topClientes.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: 'var(--neutral-300)' }}>Nenhum pedido no período</p>
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
