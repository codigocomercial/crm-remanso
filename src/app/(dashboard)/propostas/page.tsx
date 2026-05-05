'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Search, FileText, TrendingUp, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ProposalModal } from './ProposalModal'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  gerada:    { label: 'Gerada',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviada:   { label: 'Enviada',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  aprovada:  { label: 'Aprovada',  color: 'bg-green-100 text-green-700 border-green-200' },
  perdida:   { label: 'Perdida',   color: 'bg-red-100 text-red-700 border-red-200' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export type Proposal = {
  id: string
  bling_number: string | null
  contact_id: string | null
  client_name: string | null
  client_company: string | null
  status: string
  total: number | null
  issued_at: string | null
  created_at: string
  contacts?: { full_name: string } | null
}

export default function PropostasPage() {
  const supabase = createClient()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Proposal | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  const fetchOrgId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
    return data?.org_id ?? null
  }, [supabase])

  const fetchProposals = useCallback(async (oid: string) => {
    setLoading(true)
    let query = supabase
      .from('proposals')
      .select('*, contacts(full_name)')
      .eq('org_id', oid)
      .order('created_at', { ascending: false })
    if (filterStatus !== 'todos') query = query.eq('status', filterStatus)
    const { data } = await query
    setProposals((data as Proposal[]) ?? [])
    setLoading(false)
  }, [supabase, filterStatus])

  useEffect(() => {
    fetchOrgId().then(oid => {
      if (oid) { setOrgId(oid); fetchProposals(oid) }
    })
  }, [fetchOrgId, fetchProposals])

  const filtered = proposals.filter(p => {
    const term = search.toLowerCase()
    return (
      (p.bling_number ?? '').toLowerCase().includes(term) ||
      (p.client_name ?? '').toLowerCase().includes(term) ||
      (p.client_company ?? '').toLowerCase().includes(term) ||
      (p.contacts?.full_name ?? '').toLowerCase().includes(term)
    )
  })

  const emAberto   = proposals.filter(p => ['gerada', 'enviada'].includes(p.status)).length
  const aprovadas  = proposals.filter(p => p.status === 'aprovada').length
  const valorAprov = proposals.filter(p => p.status === 'aprovada').reduce((s, p) => s + (p.total ?? 0), 0)

  const handleSaved = () => {
    if (orgId) fetchProposals(orgId)
    setModalOpen(false)
    setEditing(null)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Propostas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie as propostas enviadas aos clientes</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="gap-2 text-white"
          style={{ backgroundColor: 'var(--brand-teal)' }}
        >
          <Plus className="w-4 h-4" />
          Nova Proposta
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<FileText className="w-5 h-5" />}    label="Total"          value={proposals.length}           bg="bg-blue-50"    fg="text-blue-600" />
        <MetricCard icon={<Clock className="w-5 h-5" />}       label="Em Aberto"      value={emAberto}                   bg="bg-amber-50"   fg="text-amber-600" />
        <MetricCard icon={<CheckCircle className="w-5 h-5" />} label="Aprovadas"      value={aprovadas}                  bg="bg-green-50"   fg="text-green-600" />
        <MetricCard icon={<TrendingUp className="w-5 h-5" />}  label="Valor Aprovado" value={formatCurrency(valorAprov)} bg="bg-emerald-50" fg="text-emerald-600" />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? 'todos')}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <div className="hidden sm:grid grid-cols-[1fr_2fr_2fr_1.5fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nº Proposta</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data</span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center h-[350px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50 mb-4" />
            <p className="text-sm text-muted-foreground">Carregando propostas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center h-[350px]">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-foreground">Nenhuma proposta encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Crie sua primeira proposta clicando em &quot;Nova Proposta&quot;</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-500 border-gray-200' }
              const nome = p.contacts?.full_name ?? p.client_name ?? '—'
              const data = p.issued_at ?? p.created_at
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_2fr_2fr_1.5fr_1fr_1fr] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer items-center"
                  onClick={() => { setEditing(p); setModalOpen(true) }}
                >
                  <span className="font-mono text-sm font-semibold text-foreground truncate">{p.bling_number ?? '—'}</span>
                  <span className="text-sm text-foreground truncate">{nome}</span>
                  <span className="text-sm text-muted-foreground truncate">{p.client_company ?? '—'}</span>
                  <span className="text-sm font-medium text-foreground">{p.total != null ? formatCurrency(p.total) : '—'}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">{new Date(data).toLocaleDateString('pt-BR')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalOpen && orgId && (
        <ProposalModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={handleSaved}
          proposal={editing}
          orgId={orgId}
        />
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, bg, fg }: {
  icon: React.ReactNode; label: string; value: number | string; bg: string; fg: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
      <div className={`p-2 rounded-lg ${bg} ${fg}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}
