'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, TrendingUp, Truck, Megaphone, Plus } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import Link from 'next/link'
import { StatCard, PageHeader, SectionHeader } from '@/components/ui/rm-components'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    valorVendas: 0, pedidosMes: 0, cargasCriadas: 0, campanhasEnviadas: 0,
  })
  const [chartData, setChartData] = useState<{
    dia: string
    custoFixo: number
    receita: number | null
    margem: number | null
  }[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const hojeLabel = hoje.charAt(0).toUpperCase() + hoje.slice(1)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const now = new Date()
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      // ── Queries paralelas ────────────────────────────────────────────────
      const [
        { data: pedidosMesData },
        { data: cargasData },
        { data: campanhasData },
        { data: opCostData },
        { data: pedidosDiarios },
        { data: topData },
      ] = await Promise.all([
        // Pedidos do mês
        supabase.from('crm_orders')
          .select('id, total_value, cost_mp, freight, tax_amount, ordered_at, units_count')
          .gte('ordered_at', mesInicio).lte('ordered_at', mesFim),
        // Cargas
        supabase.from('freight_loads').select('id').eq('org_id', process.env.NEXT_PUBLIC_ORG_ID!),
        // Campanhas enviadas
        supabase.from('campaigns').select('id').eq('status', 'sent'),
        // Custo operacional do mês
        supabase.from('operational_costs')
          .select('labor, admin, truck, maintenance, misc, icms, freight_purchase, interest, units_produced')
          .eq('year', now.getFullYear()).eq('month', now.getMonth() + 1)
          .single(),
        // Pedidos do mês agrupados por dia
        supabase.from('crm_orders')
          .select('ordered_at, total_value, cost_mp, freight, tax_amount')
          .gte('ordered_at', mesInicio).lte('ordered_at', mesFim)
          .order('ordered_at', { ascending: true }),
        // Top 5 clientes do mês
        supabase.from('crm_orders')
          .select('client_name, company_id, total_value, units_count')
          .gte('ordered_at', mesInicio).lte('ordered_at', mesFim),
      ])

      // ── Cards ────────────────────────────────────────────────────────────
      const valorVendas = (pedidosMesData ?? []).reduce((s, o) => s + Number(o.total_value ?? 0), 0)
      const pedidosMes = pedidosMesData?.length ?? 0
      const cargasCriadas = cargasData?.length ?? 0
      const campanhasEnviadas = campanhasData?.length ?? 0

      setMetrics({ valorVendas, pedidosMes, cargasCriadas, campanhasEnviadas })

      // ── Custo fixo mensal ────────────────────────────────────────────────
      const op = opCostData as any
      const custoFixoMensal = op
        ? [op.labor, op.admin, op.truck, op.maintenance, op.misc, op.icms, op.freight_purchase, op.interest]
            .reduce((s: number, v: any) => s + Number(v ?? 0), 0)
        : 60000 // fallback

      const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const custoPorDia = custoFixoMensal / diasNoMes

      // ── Gráfico Ponto de Equilíbrio ──────────────────────────────────────
      // Agrupa pedidos por dia
      const pedidosPorDia = new Map<string, { receita: number; margem: number }>()
      for (const p of pedidosDiarios ?? []) {
        const dia = new Date(p.ordered_at).getDate()
        const key = String(dia).padStart(2, '0')
        // Margem de Contribuição = Receita - Frete - Imposto - Custo MP (SEM custo fixo)
        const margem = Number(p.total_value ?? 0) - Number(p.freight ?? 0) - Number(p.tax_amount ?? 0) - Number(p.cost_mp ?? 0)
        const prev = pedidosPorDia.get(key) ?? { receita: 0, margem: 0 }
        pedidosPorDia.set(key, {
          receita: prev.receita + Number(p.total_value ?? 0),
          margem: prev.margem + margem,
        })
      }

      // Monta array dia a dia acumulando — mostra TODOS os dias do mês
      // Dias futuros mostram só a linha de custo fixo (projeção)
      const chartArr = []
      let receitaAcum = 0
      let margemAcum = 0

      for (let d = 1; d <= diasNoMes; d++) {
        const key = String(d).padStart(2, '0')
        const dia = pedidosPorDia.get(key) ?? { receita: 0, margem: 0 }
        const ehFuturo = d > now.getDate()

        if (!ehFuturo) {
          receitaAcum += dia.receita
          margemAcum += dia.margem
        }

        chartArr.push({
          dia: `${d}`,
          custoFixo: Math.round(custoPorDia * d),
          receita: ehFuturo ? null : Math.round(receitaAcum),
          margem: ehFuturo ? null : Math.round(margemAcum),
        })
      }
      setChartData(chartArr)

      // ── Top clientes ─────────────────────────────────────────────────────
      const clienteMap = new Map<string, { nome: string; receita: number; urnas: number }>()
      for (const o of topData ?? []) {
        const key = o.company_id ?? o.client_name
        const prev = clienteMap.get(key) ?? { nome: o.client_name, receita: 0, urnas: 0 }
        clienteMap.set(key, {
          nome: prev.nome,
          receita: prev.receita + Number(o.total_value ?? 0),
          urnas: prev.urnas + Number(o.units_count ?? 0),
        })
      }
      const top5 = Array.from(clienteMap.values())
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 5)
      setTopClientes(top5)

      setLoading(false)
    }
    load()
  }, [])

  // Ponto de equilíbrio atingido?
  const peAtingido = chartData.some(d => d.margem !== null && d.margem >= d.custoFixo)
  const diaEquilibrio = chartData.findIndex(d => d.margem !== null && d.margem >= d.custoFixo)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <PageHeader title="Dashboard" subtitle={hojeLabel}>
        <a href="https://wa.me/5577981019659" target="_blank" rel="noreferrer" className="btn-wpp">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.15c-.17.2-.35.22-.65.07a8.17 8.17 0 01-2.4-1.48 9.03 9.03 0 01-1.66-2.07c-.17-.3-.02-.46.13-.61l.44-.51c.14-.16.18-.3.27-.5.09-.2.05-.37-.02-.52s-.67-1.61-.91-2.2c-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.11.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.19-.57-.34z" />
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.1-1.34A10 10 0 1012 2z" />
          </svg>
          WhatsApp
        </a>
        <Link href="/clientes/novo" className="btn-remanso">
          <Plus size={13} /> Novo cliente
        </Link>
      </PageHeader>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard variant="teal" label="Valor em Vendas" value={fmt(metrics.valorVendas)}
          sub="mês atual" icon={ShoppingBag} />
        <StatCard label="Pedidos do Mês" value={metrics.pedidosMes}
          sub="pedidos realizados" icon={TrendingUp} />
        <StatCard label="Cargas Criadas" value={metrics.cargasCriadas}
          sub="total de cargas" icon={Truck} />
        <StatCard label="Campanhas Enviadas" value={metrics.campanhasEnviadas}
          sub="campanhas ativas" icon={Megaphone} />
      </div>

      {/* ── Gráfico Ponto de Equilíbrio ── */}
      <div className="rm-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280' }}>
              Ponto de Equilíbrio — {format(new Date(), 'MMMM/yyyy', { locale: ptBR })}
            </p>
            {diaEquilibrio >= 0 && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--brand-teal)' }}>
                ✓ Ponto de equilíbrio atingido no dia {diaEquilibrio + 1}
              </p>
            )}
            {!peAtingido && chartData.length > 0 && (
              <p className="text-[12px] mt-1" style={{ color: '#B45309' }}>
                ⚠ Ponto de equilíbrio ainda não atingido
              </p>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false}
              tickFormatter={v => v.replace('Dia ', '')} />
            <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #F1F5F9', borderRadius: 10, fontSize: 12 }}
              formatter={(value: any) => fmt(value)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="custoFixo" name="Custo Fixo Acumulado"
              stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="receita" name="Receita Acumulada"
              stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="margem" name="Margem de Contribuição"
              stroke="#3E8F76" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {chartData.length > 0 && (
            <>
              <div className="text-center">
                <p className="text-[11px]" style={{ color: '#6B7280' }}>Custo Fixo Total</p>
                <p className="text-[14px] font-bold" style={{ color: '#EF4444' }}>
                  {fmt(chartData[chartData.length - 1].custoFixo)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px]" style={{ color: '#6B7280' }}>Receita Acumulada</p>
                <p className="text-[14px] font-bold" style={{ color: '#3B82F6' }}>
                  {fmt(chartData[chartData.length - 1].receita)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px]" style={{ color: '#6B7280' }}>Margem de Contribuição</p>
                <p className="text-[14px] font-bold" style={{ color: '#3E8F76' }}>
                  {fmt(chartData[chartData.length - 1].margem)}
                </p>
              </div>
            </>
          )}
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
          <p className="text-[13px] text-center py-8" style={{ color: 'var(--neutral-300)' }}>
            Nenhum pedido este mês
          </p>
        ) : (
          <div className="space-y-2">
            {topClientes.map((c, i) => {
              const pct = topClientes[0].receita > 0 ? (c.receita / topClientes[0].receita) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold w-4 flex-shrink-0" style={{ color: 'var(--neutral-400)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>
                        {c.nome}
                      </p>
                      <span className="text-[12px] font-bold ml-2 flex-shrink-0" style={{ color: 'var(--brand-teal)' }}>
                        {fmt(c.receita)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--neutral-100)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-teal)' }} />
                    </div>
                  </div>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--neutral-500)' }}>
                    {c.urnas} urnas
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
