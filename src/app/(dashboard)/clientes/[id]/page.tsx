'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Phone, MapPin, Edit2, MessageCircle,
  RefreshCw, DollarSign, Loader2, Save, Building2,
  Mail, Calendar, Truck
} from 'lucide-react'

interface Contact {
  id: string
  org_id?: string
  full_name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  job_title: string | null
  city: string | null
  state: string | null
  source: string | null
  status: string
  notes: string | null
  reorder_cycle_days: number | null
  last_order_at: string | null
  next_followup_at: string | null
  average_order_value: number | null
  customer_type: string | null
  distance_km: number | null
}

interface Interaction {
  id: string
  type: string
  content: string
  direction: string
  created_at: string
}

export default function ClienteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('note')

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', whatsapp: '',
    job_title: '', city: '', state: '', notes: '',
    reorder_cycle_days: '', average_order_value: '',
    customer_type: '', distance_km: '', status: 'active',
  })

  useEffect(() => { loadContact() }, [id])

  const loadContact = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: contactData } = await supabase.from('contacts').select('*').eq('id', id).single()
    const { data: interactionsData } = await supabase.from('interactions').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(20)
    if (contactData) {
      setContact(contactData)
      setForm({
        full_name: contactData.full_name || '',
        email: contactData.email || '',
        phone: contactData.phone || '',
        whatsapp: contactData.whatsapp || '',
        job_title: contactData.job_title || '',
        city: contactData.city || '',
        state: contactData.state || 'BA',
        notes: contactData.notes || '',
        reorder_cycle_days: contactData.reorder_cycle_days?.toString() || '',
        average_order_value: contactData.average_order_value?.toString() || '',
        customer_type: contactData.customer_type || '',
        distance_km: contactData.distance_km?.toString() || '',
        status: contactData.status || 'active',
      })
    }
    if (interactionsData) setInteractions(interactionsData)
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('contacts').update({
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      job_title: form.job_title || null,
      city: form.city || null,
      state: form.state || null,
      notes: form.notes || null,
      reorder_cycle_days: form.reorder_cycle_days ? parseInt(form.reorder_cycle_days) : null,
      average_order_value: form.average_order_value ? parseFloat(form.average_order_value) : null,
      customer_type: form.customer_type || null,
      distance_km: form.distance_km ? parseInt(form.distance_km) : null,
      status: form.status,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    setShowEdit(false)
    loadContact()
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    const supabase = createClient()
    await supabase.from('interactions').insert({
      contact_id: id,
      org_id: contact?.org_id,
      type: noteType,
      content: newNote,
      direction: 'outbound',
    })
    setNewNote('')
    loadContact()
  }

  const recompraStatus = () => {
    if (!contact?.next_followup_at) return { label: 'Não agendado', color: 'text-muted-foreground', bg: 'bg-muted' }
    const days = Math.floor((new Date(contact.next_followup_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: `Atrasado ${Math.abs(days)}d`, color: 'text-red-500', bg: 'bg-red-500/10' }
    if (days <= 7) return { label: `Em ${days}d`, color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
    return { label: `Em ${days}d`, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const interactionIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
      case 'call': return <Phone className="w-3.5 h-3.5 text-blue-400" />
      case 'email': return <Mail className="w-3.5 h-3.5 text-purple-400" />
      case 'visit': return <Truck className="w-3.5 h-3.5 text-orange-400" />
      default: return <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      inactive: { label: 'Inativo', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
      prospect: { label: 'Prospect', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    }
    const item = map[s] || { label: s, cls: 'bg-muted text-muted-foreground border-border' }
    return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${item.cls}`}>{item.label}</span>
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
    </div>
  )
  if (!contact) return (
    <div className="text-center py-20 text-muted-foreground">Cliente não encontrado</div>
  )

  const status = recompraStatus()

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{contact.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.job_title || 'Sem função definida'} {contact.city ? `• ${contact.city}/${contact.state}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                WhatsApp
              </Button>
            </a>
          )}
          <Button size="sm" className="gap-2" onClick={() => setShowEdit(true)}>
            <Edit2 className="w-4 h-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info básica */}
        <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            Informações do Cliente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-foreground">{contact.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-foreground">{contact.whatsapp || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-foreground">{contact.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Localização</p>
                <p className="text-foreground">
                  {contact.city && contact.state ? `${contact.city} / ${contact.state}` : '—'}
                  {contact.distance_km ? ` • ${contact.distance_km} km` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Status:</span>
            {statusBadge(contact.status)}
          </div>
          {contact.notes && (
            <div className="bg-muted/40 rounded-xl p-3 text-sm text-muted-foreground border border-border">
              <p className="text-xs font-medium text-foreground mb-1">Observações</p>
              {contact.notes}
            </div>
          )}
        </div>

        {/* Inteligência comercial */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-primary" />
            Comercial
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Ticket médio</p>
              <p className="font-semibold text-foreground">
                {contact.average_order_value
                  ? `R$ ${contact.average_order_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Ciclo de recompra</p>
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-primary" />
                {contact.reorder_cycle_days ? `${contact.reorder_cycle_days} dias` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Último pedido</p>
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                {formatDate(contact.last_order_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Próximo follow-up</p>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.bg} ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de interações */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-primary" />
          Histórico de Interações
        </h2>

        {/* Nova interação */}
        <div className="flex gap-2">
          <select
            value={noteType}
            onChange={e => setNoteType(e.target.value)}
            className="text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="note">Nota</option>
            <option value="call">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="visit">Visita</option>
          </select>
          <Input
            placeholder="Registrar interação..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            className="flex-1 text-sm"
          />
          <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>
            Registrar
          </Button>
        </div>

        {/* Lista */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma interação registrada.</p>
          ) : interactions.map(i => (
            <div key={i.id} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                {interactionIcon(i.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{i.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {i.direction === 'inbound' ? '← Recebido' : '→ Enviado'} • {new Date(i.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog de edição */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input className="mt-1.5" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Cargo / Função</Label>
              <Input className="mt-1.5" placeholder="Ex: Proprietário" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="mt-1.5 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1.5" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input className="mt-1.5" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input className="mt-1.5" placeholder="5577999991234" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input className="mt-1.5" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input className="mt-1.5" maxLength={2} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label>Distância da sede (km)</Label>
              <Input className="mt-1.5" type="number" value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo de cliente</Label>
              <select
                value={form.customer_type}
                onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}
                className="mt-1.5 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione</option>
                <option value="funeraria">Funerária</option>
                <option value="plano">Plano Funerário</option>
                <option value="hospital">Hospital</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <Label>Ciclo de recompra (dias)</Label>
              <Input className="mt-1.5" type="number" value={form.reorder_cycle_days} onChange={e => setForm(f => ({ ...f, reorder_cycle_days: e.target.value }))} />
            </div>
            <div>
              <Label>Ticket médio (R$)</Label>
              <Input className="mt-1.5" type="number" value={form.average_order_value} onChange={e => setForm(f => ({ ...f, average_order_value: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Informações adicionais..."
                className="mt-1.5 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}