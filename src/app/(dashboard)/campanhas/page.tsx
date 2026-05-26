'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Megaphone, Plus, Send, Clock, CheckCircle2, XCircle, FileImage,
  Users, Loader2, ChevronRight, ImageIcon, ArrowLeft, Search,
  Filter, CheckSquare, Square, UserCheck, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

// ─── Paleta de cores dos grupos ───────────────────────────────────────────────
const GROUP_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  emerald: { bg: '#D1FAE5', text: '#065F46', hex: '#10b981' },
  blue:    { bg: '#DBEAFE', text: '#1E40AF', hex: '#3b82f6' },
  yellow:  { bg: '#FEF9C3', text: '#854D0E', hex: '#eab308' },
  orange:  { bg: '#FFEDD5', text: '#9A3412', hex: '#f97316' },
  red:     { bg: '#FEE2E2', text: '#991B1B', hex: '#ef4444' },
  purple:  { bg: '#F3E8FF', text: '#6B21A8', hex: '#a855f7' },
  gray:    { bg: '#F3F4F6', text: '#374151', hex: '#6b7280' },
}

function GroupBadge({ name, color }: { name: string; color: string }) {
  const c = GROUP_COLORS[color] ?? GROUP_COLORS.gray
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {name}
    </span>
  )
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',  color: 'bg-zinc-500/15 text-zinc-400',     icon: FileImage },
  scheduled: { label: 'Agendada',  color: 'bg-blue-500/15 text-blue-400',     icon: Clock },
  sending:   { label: 'Enviando',  color: 'bg-yellow-500/15 text-yellow-400', icon: Loader2 },
  sent:      { label: 'Enviada',   color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-400',       icon: XCircle },
} as const

const CONTACT_STATUS_CONFIG = {
  pending:   { label: 'Pendente',   color: 'text-zinc-400' },
  queued:    { label: 'Na fila',    color: 'text-blue-400' },
  sending:   { label: 'Enviando',   color: 'text-yellow-400' },
  sent:      { label: 'Enviado',    color: 'text-emerald-500' },
  failed:    { label: 'Falhou',     color: 'text-red-500' },
  read:      { label: 'Lido',       color: 'text-emerald-400' },
  replied:   { label: 'Respondeu',  color: 'text-primary' },
  paused:    { label: 'Pausado',    color: 'text-zinc-400' },
  cancelled: { label: 'Cancelado',  color: 'text-zinc-400' },
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string
  name: string
  message_template: string
  media_url: string | null
  status: keyof typeof STATUS_CONFIG
  scheduled_at: string | null
  sent_count: number
  total_contacts: number
  failed_count: number
  filter_cities: string[] | null
  created_at: string
}

interface ContactRow {
  id: string
  name: string
  company_name: string | null
  city: string | null
  state: string | null
  whatsapp: string | null
  group_id: string | null
  group_name: string | null
  group_color: string | null
  in_queue: boolean
  queue_status: string | null
}

interface ContactGroup {
  id: string
  name: string
  color: string
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
  const Icon = cfg.icon
  const progress = campaign.total_contacts > 0
    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) : 0

  return (
    <div onClick={onOpen}
      className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{campaign.message_template}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {campaign.total_contacts} na fila
          </span>
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {campaign.sent_count} enviados
          </span>
          {campaign.failed_count > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              {campaign.failed_count} falhou
            </span>
          )}
        </div>
        {campaign.status === 'sent' && (
          <span className="font-semibold text-emerald-500">{progress}%</span>
        )}
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {campaign.status === 'sending' && (
        <div className="mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{campaign.sent_count} de {campaign.total_contacts} enviados</p>
        </div>
      )}
    </div>
  )
}

// ─── New Campaign Dialog ──────────────────────────────────────────────────────
function NewCampaignDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !message.trim()) return
    setLoading(true)
    const supabase = createClient()

    let media_url: string | null = null
    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('campanhas').upload(path, mediaFile, { upsert: true })
      if (!uploadErr && upload) {
        const { data: { publicUrl } } = supabase.storage.from('campanhas').getPublicUrl(upload.path)
        media_url = publicUrl
      }
    }

    const { data: campaign, error } = await supabase.from('campaigns').insert({
      org_id: ORG_ID,
      name: name.trim(),
      message_template: message.trim(),
      media_url,
      status: 'draft',
      total_contacts: 0,
      sent_count: 0,
      failed_count: 0,
    }).select('id').single()

    setLoading(false)
    if (!error && campaign) {
      onCreated(campaign.id)
      onClose()
      setName(''); setMessage(''); setMediaFile(null); setMediaPreview(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>  {/* fechamento só pelos botões */}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" /> Nova Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nome da campanha</Label>
            <Input placeholder="Ex: Mudança de número — Maio 2026"
              value={name} onChange={e => setName(e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label>Mensagem</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Use{' '}
              <code className="bg-muted px-1 rounded">{'{{nome}}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{{empresa}}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{{cidade}}'}</code>
            </p>
            <Textarea placeholder="Bom dia {{nome}}! Gostaríamos de informar..."
              value={message} onChange={e => setMessage(e.target.value)}
              rows={5} className="mt-1.5 resize-none" />
          </div>

          <div>
            <Label>Banner / Foto (opcional)</Label>
            <div className="mt-1.5">
              {mediaPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={mediaPreview} alt="preview" className="w-full max-h-48 object-cover" />
                  <button onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                  <span className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WEBP até 10MB</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)) } }} />
                </label>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary" />
              Após criar, você escolhe os contatos manualmente na tela da campanha.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim() || !message.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Campaign Detail View ─────────────────────────────────────────────────────
function CampaignDetail({ campaign, onBack, onRefresh }: {
  campaign: Campaign
  onBack: () => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<'fila' | 'contatos'>('fila')
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [disparando, setDisparando] = useState(false)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [filterCity, setFilterCity] = useState('')

  const supabase = createClient()
  const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
  const Icon = cfg.icon

  // Carregar grupos
  useEffect(() => {
    supabase.from('crm_contact_groups').select('id,name,color')
      .eq('org_id', ORG_ID).order('sort_order')
      .then(({ data }) => setGroups(data ?? []))
  }, [])

  // Carregar contatos com status na fila
  const loadContacts = useCallback(async () => {
    setLoadingContacts(true)

    // Buscar contatos elegíveis
    let query = supabase
      .from('crm_contacts_with_company')
      .select('id, name, company_name, city, state, whatsapp, group_id, group_name, group_color')
      .eq('org_id', ORG_ID)
      .eq('status', 'active')
      .eq('receive_campaigns', true)
      .not('whatsapp', 'is', null)
      .order('name')

    if (search) query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`)
    if (filterCity) query = query.ilike('city', `%${filterCity}%`)
    if (filterGroup === 'none') query = query.is('group_id', null)
    else if (filterGroup !== 'all') query = query.eq('group_id', filterGroup)

    const { data: contactsData } = await query

    // Buscar quem já está na fila desta campanha
    const { data: queueData } = await supabase
      .from('campaign_contacts')
      .select('contact_id, status')
      .eq('campaign_id', campaign.id)

    const queueMap = new Map((queueData ?? []).map(q => [q.contact_id, q.status]))

    setContacts((contactsData ?? []).map(c => ({
      ...c,
      in_queue: queueMap.has(c.id),
      queue_status: queueMap.get(c.id) ?? null,
    })))

    setLoadingContacts(false)
  }, [campaign.id, search, filterGroup, filterCity])

  useEffect(() => {
    if (tab === 'contatos') loadContacts()
  }, [tab, loadContacts])

  // Contador de pendentes — carregado independente da aba ativa
  const [totalPending, setTotalPending] = useState<number>(0)

  // Carregar contador de pendentes (sempre, não depende da aba)
  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
    setTotalPending(count ?? 0)
  }, [campaign.id])

  useEffect(() => { loadPendingCount() }, [loadPendingCount])

  // Fila da campanha
  const [queue, setQueue] = useState<Array<{
    id: string; contact_id: string; status: string; sent_at: string | null; error_msg: string | null;
    name: string; company_name: string; whatsapp: string
  }>>([])
  const [loadingQueue, setLoadingQueue] = useState(false)

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    const { data } = await supabase
      .from('campaign_contacts')
      .select('id, contact_id, status, sent_at, error_msg')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true })

    if (!data) { setLoadingQueue(false); return }

    // Buscar nomes
    const ids = data.map(d => d.contact_id)
    const { data: contactsInfo } = await supabase
      .from('crm_contacts_with_company')
      .select('id, name, company_name, whatsapp')
      .in('id', ids)

    const infoMap = new Map((contactsInfo ?? []).map(c => [c.id, c]))

    setQueue(data.map(d => ({
      ...d,
      name: infoMap.get(d.contact_id)?.name ?? '—',
      company_name: infoMap.get(d.contact_id)?.company_name ?? '—',
      whatsapp: infoMap.get(d.contact_id)?.whatsapp ?? '—',
    })))
    setLoadingQueue(false)
  }, [campaign.id])

  useEffect(() => {
    if (tab === 'fila') loadQueue()
  }, [tab, loadQueue])

  // Selecionar / desselecionar
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    const notInQueue = contacts.filter(c => !c.in_queue).map(c => c.id)
    setSelected(new Set(notInQueue))
  }

  function clearSelection() { setSelected(new Set()) }

  // Adicionar selecionados à fila
  async function addToQueue() {
    if (selected.size === 0) return
    setAdding(true)

    const rows = Array.from(selected).map(contact_id => ({
      campaign_id: campaign.id,
      contact_id,
      status: 'pending',
    }))

    await supabase.from('campaign_contacts').upsert(rows, { onConflict: 'campaign_id,contact_id' })

    // Atualizar total_contacts na campanha
    const { count } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)

    await supabase.from('campaigns')
      .update({ total_contacts: count ?? 0 })
      .eq('id', campaign.id)

    setSelected(new Set())
    setAdding(false)
    loadContacts()
    loadPendingCount()
    onRefresh()
  }

  // Remover da fila
  async function removeFromQueue(contact_id: string) {
    await supabase.from('campaign_contacts')
      .delete()
      .eq('campaign_id', campaign.id)
      .eq('contact_id', contact_id)

    const { count } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)

    await supabase.from('campaigns')
      .update({ total_contacts: count ?? 0 })
      .eq('id', campaign.id)

    loadQueue()
    onRefresh()
  }

  // Disparar campanha
  async function disparar() {
    const pendingCount = queue.filter(q => q.status === 'pending').length
    if (pendingCount === 0) { alert('Nenhum contato pendente na fila.'); return }
    if (!confirm(`Confirma o disparo para ${pendingCount} contato(s)?\n\nOs envios serão feitos 1 por minuto.`)) return

    setDisparando(true)
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)

    const response = await fetch('https://n8n.promptcomercial.com.br/webhook/disparar-campanha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaign.id }),
    })

    setDisparando(false)
    if (response.ok) {
      onRefresh()
      loadQueue()
      loadPendingCount()
    } else {
      alert('Erro ao acionar o disparo. Verifique o n8n.')
      await supabase.from('campaigns').update({ status: 'draft' }).eq('id', campaign.id)
    }
  }

  const pendingCount = totalPending  // usa contador independente de aba
  const sentCount = queue.filter(q => q.status === 'sent').length
  const failedCount = queue.filter(q => q.status === 'failed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack}
            className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{campaign.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                <Icon className="w-3 h-3" />{cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Botão disparar */}
        {(campaign.status === 'draft' || campaign.status === 'sending') && (
          <Button onClick={disparar} disabled={disparando || pendingCount === 0}
            className="gap-2">
            {disparando
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Disparando...</>
              : <><Send className="w-4 h-4" /> Disparar ({pendingCount})</>
            }
          </Button>
        )}
      </div>

      {/* Layout duas colunas */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Coluna esquerda — mensagem + stats (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mensagem */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Mensagem</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.message_template}</p>
            {campaign.media_url && (
              <div className="mt-3">
                <img src={campaign.media_url} alt="banner" className="rounded-lg max-h-32 object-cover" />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Na fila', value: queue.length, color: 'text-foreground' },
              { label: 'Enviados', value: sentCount, color: 'text-emerald-500' },
              { label: 'Falhou', value: failedCount, color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita — fila + contatos (3/5) */}
        <div className="lg:col-span-3 space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {[
          { value: 'fila', label: 'Fila de envio' },
          { value: 'contatos', label: 'Adicionar contatos' },
        ].map(t => (
          <button key={t.value} onClick={() => setTab(t.value as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: FILA ─────────────────────────────────────────────────────── */}
      {tab === 'fila' && (
        <div className="space-y-3">
          {loadingQueue ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
            </div>
          ) : queue.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-card/50">
              <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground">Fila vazia</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vá em "Adicionar contatos" para selecionar quem vai receber esta campanha.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setTab('contatos')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar contatos
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>{queue.length} contato(s) na fila · {pendingCount} pendente(s)</span>
                <button onClick={() => setTab('contatos')}
                  className="text-primary hover:underline font-medium">
                  + Adicionar mais
                </button>
              </div>
              <div className="space-y-2">
                {queue.map(q => {
                  const sc = CONTACT_STATUS_CONFIG[q.status as keyof typeof CONTACT_STATUS_CONFIG]
                    ?? CONTACT_STATUS_CONFIG.pending
                  return (
                    <div key={q.id}
                      className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{q.company_name || q.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {q.company_name ? q.name : ''}{q.company_name && q.whatsapp ? ' · ' : ''}{q.whatsapp}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      {q.status === 'pending' && (
                        <button onClick={() => removeFromQueue(q.contact_id)}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB: CONTATOS ───────────────────────────────────────────────── */}
      {tab === 'contatos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar nome ou empresa..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 text-sm" />
            </div>
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">Todos os grupos</option>
              <option value="none">Sem grupo</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Input placeholder="Filtrar por cidade..."
              value={filterCity} onChange={e => setFilterCity(e.target.value)}
              className="text-sm" />
          </div>

          {/* Barra de ações */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={selectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                <CheckSquare className="w-3.5 h-3.5" /> Selecionar disponíveis
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={clearSelection}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Square className="w-3.5 h-3.5" /> Limpar
                  </button>
                </>
              )}
            </div>
            {selected.size > 0 && (
              <Button size="sm" onClick={addToQueue} disabled={adding}>
                {adding
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Adicionando...</>
                  : <><UserCheck className="w-3.5 h-3.5 mr-1.5" /> Adicionar {selected.size} à fila</>
                }
              </Button>
            )}
          </div>

          {/* Lista de contatos */}
          {loadingContacts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum contato encontrado com esses filtros.
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground px-1">
                {contacts.length} contato(s) · {contacts.filter(c => c.in_queue).length} já na fila
              </p>
              {contacts.map(contact => {
                const isSelected = selected.has(contact.id)
                return (
                  <div key={contact.id}
                    onClick={() => !contact.in_queue && toggleSelect(contact.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      contact.in_queue
                        ? 'bg-muted/30 border-border opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-primary/5 border-primary/30 cursor-pointer'
                          : 'bg-card border-border hover:border-primary/20 cursor-pointer'
                    }`}>
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {contact.in_queue ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{contact.name}</span>
                        {contact.group_name && contact.group_color && (
                          <GroupBadge name={contact.group_name} color={contact.group_color} />
                        )}
                        {contact.in_queue && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                            Na fila
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {contact.company_name && <span>{contact.company_name} · </span>}
                        {[contact.city, contact.state].filter(Boolean).join(', ')}
                        {contact.whatsapp && <span> · {contact.whatsapp}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
        </div> {/* fim coluna direita */}
      </div> {/* fim grid duas colunas */}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false })
    if (data) setCampaigns(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  function handleCreated(id: string) {
    loadCampaigns().then(() => {
      // Abrir a campanha recém-criada direto na tela de contatos
      const supabase = createClient()
      supabase.from('campaigns').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setSelectedCampaign(data) })
    })
  }

  function refreshSelected() {
    if (!selectedCampaign) return
    const supabase = createClient()
    supabase.from('campaigns').select('*').eq('id', selectedCampaign.id).single()
      .then(({ data }) => {
        if (data) setSelectedCampaign(data)
        loadCampaigns()
      })
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)
  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    totalReach: campaigns.reduce((a, c) => a + (c.sent_count || 0), 0),
    draft: campaigns.filter(c => c.status === 'draft').length,
  }

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (selectedCampaign) {
    return (
      <div className="space-y-6">
        <CampaignDetail
          campaign={selectedCampaign}
          onBack={() => setSelectedCampaign(null)}
          onRefresh={refreshSelected}
        />
      </div>
    )
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Campanhas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Disparos personalizados via WhatsApp com controle total
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Megaphone, color: 'text-primary' },
          { label: 'Enviadas', value: stats.sent, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Mensagens', value: stats.totalReach.toLocaleString('pt-BR'), icon: Send, color: 'text-blue-500' },
          { label: 'Rascunhos', value: stats.draft, icon: FileImage, color: 'text-zinc-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Todas' },
          { value: 'draft', label: 'Rascunhos' },
          { value: 'scheduled', label: 'Agendadas' },
          { value: 'sending', label: 'Enviando' },
          { value: 'sent', label: 'Enviadas' },
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-16 bg-card/50">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Nenhuma campanha ainda</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm">
            Crie sua primeira campanha e adicione os contatos manualmente.
          </p>
          <Button className="mt-6" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar primeira campanha
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CampaignCard key={c.id} campaign={c} onOpen={() => setSelectedCampaign(c)} />
          ))}
        </div>
      )}

      <NewCampaignDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}