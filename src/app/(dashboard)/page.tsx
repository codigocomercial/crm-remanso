'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, TrendingUp, RefreshCw, Plus, ArrowRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { timeAgo, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { StatCard, PageHeader, SectionHeader, StatusBadge } from '@/components/ui/rm-components'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface RecentContact {
  id: string
  full_name: string
  city: string | null
  state: string | null
  source: string | null
  created_at: string
  reorder_cycle_days: number | null
  next_followup_at: string | null
}

const chartData = [
  { mes: 'Nov', pedidos: 18, novos: 3 },
  { mes: 'Dez', pedidos: 24, novos: 5 },
  { mes: 'Jan', pedidos: 20, novos: 2 },
  { mes: 'Fev', pedidos: 31, novos: 4 },
  { mes: 'Mar', pedidos: 27, novos: 6 },
  { mes: 'Abr', pedidos: 35, novos: 4 },
]

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function getStatus(dias: number): 'ok' | 'warn' | 'late' {
  if (dias < 0) return 'late'
  if (dias <= 3) return 'warn'
  return 'ok'
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<RecentContact[]>([])
  const [recompras, setRecompras] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalContacts: 0, pendingTasks: 0, reorders: 0, pipelineCount: 0, novosMes: 0,
  })

  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const hojeLabel = hoje.charAt(0).toUpperCase() + hoje.slice(1)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [
        { count: totalContacts },
        { count: novosMes },
        { count: pendingTasks },
        { count: reorders },
        { data: recentContacts },
        { data: recomprasData },
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('created_at', mesInicio),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
        supabase.from('contacts')
          .select('id,full_name,city,state,source,created_at,reorder_cycle_days,next_followup_at')
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('contacts')
          .select('id,full_name,next_followup_at,reorder_cycle_days')
          .not('next_followup_at', 'is', null)
          .lte('next_followup_at', em7dias)
          .order('next_followup_at', { ascending: true }).limit(5),
      ])

      setMetrics({
        totalContacts: totalContacts ?? 0, novosMes: novosMes ?? 0,
        pendingTasks: pendingTasks ?? 0, reorders: reorders ?? 0, pipelineCount: 0
      })
      setContacts(recentContacts ?? [])

      const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0)
      setRecompras((recomprasData ?? []).map(r => ({
        ...r,
        diasRestantes: Math.round((new Date(r.next_followup_at).getTime() - hoje0.getTime()) / 86400000),
      })))
      setLoading(false)
    }
    load()
  }, [])

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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard variant="teal" label="Clientes" value={metrics.totalContacts}
          trend="up" trendLabel={`+${metrics.novosMes} este mês`} icon={Users} />
        <StatCard label="Pipeline aberto" value={metrics.pipelineCount}
          sub="negociações ativas" icon={TrendingUp} />
        <StatCard variant="gold" label="Recompras mapeadas" value={metrics.reorders}
          sub="ciclos ativos" icon={RefreshCw} />
        <StatCard label="Tarefas pendentes" value={metrics.pendingTasks}
          sub="aguardando" />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rm-card">
          <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--neutral-900)' }}>
            Pedidos por mês
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3DBFA0" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#3DBFA0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="pedidos" stroke="#3DBFA0" fill="url(#gradTeal)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rm-card">
          <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--neutral-900)' }}>
            Novos clientes
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="novos" fill="#C9A227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Clientes + Recompras ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Clientes recentes */}
        <div className="rm-card">
          <SectionHeader title="Clientes recentes" linkHref="/clientes" linkLabel="Ver todos" />
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--neutral-100)' }} />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: 'var(--neutral-300)' }}>
              Nenhum cliente cadastrado ainda
            </p>
          ) : (
            <div>
              {contacts.map(c => {
                const loc = [c.city, c.state].filter(Boolean).join(', ')
                const dias = c.next_followup_at
                  ? Math.round((new Date(c.next_followup_at).getTime() - Date.now()) / 86400000)
                  : null

                return (
                  <Link key={c.id} href={`/clientes/${c.id}`}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: 'var(--brand-teal-light)', color: 'var(--brand-teal-dark)' }}>
                      {initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate" style={{ color: 'var(--neutral-900)' }}>
                        {c.full_name}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--neutral-500)' }}>
                        {loc || c.source || 'Sem localização'} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    {dias !== null && (
                      <StatusBadge
                        status={getStatus(dias)}
                        label={c.reorder_cycle_days ? `${c.reorder_cycle_days}d` : 'ativo'}
                      />
                    )}
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
                      style={{ color: 'var(--neutral-500)' }} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recompras próximas */}
        <div className="rm-card">
          <SectionHeader title="Recompras próximas" linkHref="/recompra" linkLabel="Painel" />
          {recompras.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: 'var(--neutral-300)' }}>
              Nenhuma recompra nos próximos 7 dias
            </p>
          ) : (
            <div className="space-y-3">
              {recompras.map(r => {
                const status = getStatus(r.diasRestantes)
                const label = r.diasRestantes < 0
                  ? `${Math.abs(r.diasRestantes)}d atrasado`
                  : r.diasRestantes === 0 ? 'Hoje' : `+${r.diasRestantes}d`
                const pct = r.reorder_cycle_days
                  ? Math.min(100, Math.max(0, Math.round(((r.reorder_cycle_days - r.diasRestantes) / r.reorder_cycle_days) * 100)))
                  : 100
                const barColor = status === 'late' ? 'var(--color-danger)'
                  : status === 'warn' ? 'var(--brand-gold)' : 'var(--brand-teal)'

                return (
                  <Link key={r.id} href={`/clientes/${r.id}`} className="block group">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[13px] font-bold truncate" style={{ color: 'var(--neutral-900)' }}>
                        {r.full_name}
                      </p>
                      <StatusBadge status={status} label={label} />
                    </div>
                    <div className="progress-bar">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}