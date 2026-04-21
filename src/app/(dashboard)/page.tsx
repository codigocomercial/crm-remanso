'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, TrendingUp, CheckSquare, RefreshCw, Plus, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCurrency, timeAgo, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface RecentContact {
  id: string
  full_name: string
  phone: string | null
  source: string | null
  created_at: string
  reorder_cycle_days: number
  next_followup_at: string | null
  average_order_value: number | null
}

interface PendingTask {
  id: string
  title: string
  due_at: string | null
  priority: string
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  chatbot: 'Chatbot',
  site: 'Site',
  indicacao: 'Indicação',
  instagram: 'Instagram',
  prospeccao: 'Prospecção',
  manual: 'Manual',
}

const chartData = [
  { mes: 'Nov', pedidos: 18, novos: 3 },
  { mes: 'Dez', pedidos: 24, novos: 5 },
  { mes: 'Jan', pedidos: 20, novos: 2 },
  { mes: 'Fev', pedidos: 31, novos: 4 },
  { mes: 'Mar', pedidos: 27, novos: 6 },
  { mes: 'Abr', pedidos: 35, novos: 4 },
]

function MetricCard({ title, value, icon: Icon, color, loading }: {
  title: string; value: string | number; icon: React.ElementType; color: string; loading: boolean
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<RecentContact[]>([])
  const [tasks, setTasks] = useState<PendingTask[]>([])
  const [metrics, setMetrics] = useState({
    totalContacts: 0,
    pendingTasks: 0,
    reorders: 0,
    pipelineCount: 0,
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [
        { count: totalContacts },
        { count: pendingTasks },
        { count: reorders },
        { count: pipelineCount },
        { data: recentContacts },
        { data: pendingTasksData },
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
        supabase.from('pipeline_deals').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase
          .from('contacts')
          .select('id, full_name, phone, source, created_at, reorder_cycle_days, next_followup_at, average_order_value')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('id, title, due_at, priority')
          .eq('status', 'pending')
          .order('due_at', { ascending: true })
          .limit(5),
      ])

      setMetrics({
        totalContacts: totalContacts ?? 0,
        pendingTasks: pendingTasks ?? 0,
        reorders: reorders ?? 0,
        pipelineCount: pipelineCount ?? 0,
      })
      setContacts(recentContacts ?? [])
      setTasks(pendingTasksData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do CRM Urnas Remanso</p>
        </div>
        <Button size="sm">
          <Link href="/clientes/novo">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo cliente
          </Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Clientes" value={metrics.totalContacts} icon={Users}
          color="bg-blue-500/10 text-blue-500" loading={loading} />
        <MetricCard title="Pipeline aberto" value={metrics.pipelineCount} icon={TrendingUp}
          color="bg-violet-500/10 text-violet-500" loading={loading} />
        <MetricCard title="Tarefas pendentes" value={metrics.pendingTasks} icon={CheckSquare}
          color="bg-amber-500/10 text-amber-500" loading={loading} />
        <MetricCard title="Recompras mapeadas" value={metrics.reorders} icon={RefreshCw}
          color="bg-emerald-500/10 text-emerald-500" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Pedidos por mês</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradPedidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{
                background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                borderRadius: 8, fontSize: 12,
              }} />
              <Area type="monotone" dataKey="pedidos" stroke="hsl(var(--primary))"
                fill="url(#gradPedidos)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Novos clientes</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{
                background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                borderRadius: 8, fontSize: 12,
              }} />
              <Bar dataKey="novos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent contacts + tasks */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent contacts */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Clientes recentes</h2>
            <Button variant="ghost" size="sm" >
              <Link href="/clientes" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {contacts.map(c => (
                <Link key={c.id} href={`/clientes/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABEL[c.source ?? ''] ?? c.source ?? '—'} · {timeAgo(c.created_at)}
                    </p>
                  </div>
                  {c.next_followup_at && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                      {formatDate(c.next_followup_at)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Tarefas pendentes</h2>
            <Button variant="ghost" size="sm" >
              <Link href="/tarefas" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckSquare className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma tarefa pendente</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tasks.map(t => {
                const overdue = t.due_at && new Date(t.due_at) < new Date()
                return (
                  <div key={t.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors">
                    {overdue
                      ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{t.title}</p>
                      {t.due_at && (
                        <p className={`text-xs ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {formatDate(t.due_at)}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.low}`}>
                      {t.priority}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
