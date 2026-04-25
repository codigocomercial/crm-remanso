'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Phone, MapPin, Edit2, MessageCircle,
  RefreshCw, DollarSign, Loader2, Save, User,
  Building2, Mail, Hash, Calendar, Truck
} from 'lucide-react'

interface Contact {
  id: string
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

  // Form state
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    job_title: '',
    city: '',
    state: '',
    notes: '',
    reorder_cycle_days: '',
    average_order_value: '',
    customer_type: '',
    distance_km: '',
    status: 'active',
  })

  useEffect(() => {
    loadContact()
  }, [id])

  const loadContact = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single()

    const { data: interactionsData } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

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

    const { error } = await supabase
      .from('contacts')
      .update({
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
      })
      .eq('id', id)

    setSaving(false)
    if (!error) {
      setShowEdit(false)
      loadContact()
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    const supabase = createClient()

    await supabase.from('interactions').insert({
      contact_id: id,
      org_id: contact?.['org_id'],
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  if (!contact) {
    return <div className="text-center py-20 text-muted-foreground">Cliente não encontrado</div>
  }

  const status = recompraStatus()

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{contact.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.source === 'laura' ? 'LAURA' : 'INDICAÇÃO'} · Cadastrado como cliente {contact.status === 'active' ? 'ativo' : 'inativo'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Editar Cliente
          </Button>
          {contact.whatsapp && (
            <Button
              onClick={() => window.open(`https://wa.me/${contact.whatsapp}`, '_blank')}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Falar no WhatsApp
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Funerária */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Dados da Funerária
          </h2>

          <div className="space-y-3">
            {contact.phone && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contato Base</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {contact.phone}
                </p>
              </div>
            )}
            {contact.whatsapp && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">WhatsApp</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                  {contact.whatsapp}
                </p>
              </div>
            )}
            {contact.email && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  {contact.email}
                </p>
              </div>
            )}
            {(contact.city || contact.state) && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Endereço</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {[contact.city, contact.state].filter(Boolean).join(' - ')}
                </p>
              </div>
            )}
            {contact.distance_km && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Distância da Sede</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                  {contact.distance_km} km
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inteligência Comercial */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Inteligência Comercial
          </h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Padrão de Recompra</p>
              <p className="text-sm font-medium">
                Ciclo de {contact.reorder_cycle_days || 90} dias
              </p>
              {contact.next_followup_at && (
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              )}
            </div>

            {contact.average_order_value && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ticket Médio</p>
                <p className="text-lg font-bold text-foreground flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  {parseFloat(contact.average_order_value.toString()).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}

            {contact.last_order_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Último Pedido</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {new Date(contact.last_order_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            {contact.customer_type && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tipo de Cliente</p>
                <p className="text-sm font-medium">{contact.customer_type}</p>
              </div>
            )}
          </div>
        </div>

        {/* Registro de Interações */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Registro de Interações
          </h2>

          {/* Add note */}
          <div className="flex gap-2">
            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value)}
              className="h-9 px-3 text-sm bg-muted border border-border rounded-lg text-foreground"
            >
              <option value="note">Anotação</option>
              <option value="call">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="visit">Visita</option>
            </select>
            <Input
              placeholder="Registre um contato, ligação ou anotação..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              className="flex-1"
            />
            <Button onClick={handleAddNote} disabled={!newNote.trim()}>
              Salvar
            </Button>
          </div>

          {/* Interactions list */}
          {interactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum histórico. Registre o primeiro contato acima.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interactions.map(i => (
                <div key={i.id} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">
                      {i.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{i.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(i.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              Editar Cliente
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Dados básicos */}
            <div className="sm:col-span-2">
              <Label>Nome completo / Funerária *</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="mt-1.5"
                placeholder="Nome da funerária"
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="mt-1.5"
                placeholder="5577999999999"
              />
            </div>

            <div>
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                className="mt-1.5"
                placeholder="5577999999999"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1.5"
                placeholder="contato@funeraria.com"
              />
            </div>

            <div>
              <Label>Cargo / Função</Label>
              <Input
                value={form.job_title}
                onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                className="mt-1.5"
                placeholder="Proprietário, Gerente..."
              />
            </div>

            <div>
              <Label>Cidade</Label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="mt-1.5"
                placeholder="Vitória da Conquista"
              />
            </div>

            <div>
              <Label>Estado</Label>
              <Input
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="mt-1.5"
                placeholder="BA"
                maxLength={2}
              />
            </div>

            <div>
              <Label>Distância da sede (km)</Label>
              <Input
                type="number"
                value={form.distance_km}
                onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))}
                className="mt-1.5"
                placeholder="150"
              />
            </div>

            <div>
              <Label>Tipo de cliente</Label>
              <Input
                value={form.customer_type}
                onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}
                className="mt-1.5"
                placeholder="VIP, Regular, Novo..."
              />
            </div>

            {/* Dados comerciais */}
            <div>
              <Label>Ciclo de recompra (dias)</Label>
              <Input
                type="number"
                value={form.reorder_cycle_days}
                onChange={e => setForm(f => ({ ...f, reorder_cycle_days: e.target.value }))}
                className="mt-1.5"
                placeholder="30, 45, 60, 90"
              />
            </div>

            <div>
              <Label>Ticket médio (R$)</Label>
              <Input
                type="number"
                value={form.average_order_value}
                onChange={e => setForm(f => ({ ...f, average_order_value: e.target.value }))}
                className="mt-1.5"
                placeholder="1900.00"
              />
            </div>

            <div>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md text-foreground"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-input rounded-md text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Observações sobre o cliente..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}