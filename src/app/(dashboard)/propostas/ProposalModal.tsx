'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Proposal } from './page'

type Contact = { id: string; full_name: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  proposal: Proposal | null
  orgId: string
}

const STATUS_OPTIONS = [
  { value: 'gerada',    label: 'Gerada' },
  { value: 'enviada',   label: 'Enviada' },
  { value: 'aprovada',  label: 'Aprovada' },
  { value: 'perdida',   label: 'Perdida' },
  { value: 'cancelada', label: 'Cancelada' },
]

export function ProposalModal({ open, onClose, onSaved, proposal, orgId }: Props) {
  const supabase = createClient()
  const isEdit = !!proposal

  const [contacts, setContacts] = useState<Contact[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [contactSearch, setContactSearch] = useState('')

  const [form, setForm] = useState({
    bling_number:   '',
    contact_id:     '',
    client_name:    '',
    client_company: '',
    total:          '',
    status:         'gerada',
    issued_at:      new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (proposal) {
      setForm({
        bling_number:   proposal.bling_number ?? '',
        contact_id:     proposal.contact_id ?? '',
        client_name:    proposal.client_name ?? '',
        client_company: proposal.client_company ?? '',
        total:          proposal.total?.toString() ?? '',
        status:         proposal.status ?? 'gerada',
        issued_at:      proposal.issued_at ? proposal.issued_at.split('T')[0] : new Date().toISOString().split('T')[0],
      })
    }
  }, [proposal])

  useEffect(() => {
    supabase.from('contacts').select('id, full_name').eq('org_id', orgId).order('full_name')
      .then(({ data }) => setContacts(data ?? []))
  }, [supabase, orgId])

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const filteredContacts = contacts.filter(c =>
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  const handleContactChange = (id: string) => {
    const c = contacts.find(x => x.id === id)
    setForm(f => ({ ...f, contact_id: id, client_name: c?.full_name ?? f.client_name }))
  }

  const handleSave = async () => {
    if (!form.bling_number && !form.client_name && !form.contact_id) return
    setSaving(true)
    const payload = {
      org_id:         orgId,
      bling_number:   form.bling_number || null,
      contact_id:     form.contact_id || null,
      client_name:    form.client_name || null,
      client_company: form.client_company || null,
      total:          form.total ? parseFloat(form.total.replace(',', '.')) : null,
      status:         form.status,
      issued_at:      form.issued_at || null,
      updated_at:     new Date().toISOString(),
    }
    if (isEdit) {
      await supabase.from('proposals').update(payload).eq('id', proposal!.id)
    } else {
      await supabase.from('proposals').insert({ ...payload, created_at: new Date().toISOString() })
    }
    setSaving(false)
    onSaved()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await supabase.from('proposals').delete().eq('id', proposal!.id)
    onSaved()
  }

  const canSave = form.bling_number || form.client_name || form.contact_id

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--neutral-900)' }}>
            {isEdit ? 'Editar Proposta' : 'Nova Proposta'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="bling_number">Nº da Proposta <span className="text-gray-400 font-normal">(Bling)</span></Label>
            <Input id="bling_number" placeholder="Ex: 001234" value={form.bling_number} onChange={e => set('bling_number', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input placeholder="Filtrar clientes..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="text-sm" />
            <select
              value={form.contact_id}
              onChange={e => handleContactChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ borderColor: 'rgba(0,0,0,0.12)', color: 'var(--neutral-900)', minHeight: '38px' }}
              size={Math.min(filteredContacts.length + 1, 6)}
            >
              <option value="">— Nenhum —</option>
              {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          {!form.contact_id && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client_name">Nome</Label>
                <Input id="client_name" placeholder="Nome" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client_company">Empresa</Label>
                <Input id="client_company" placeholder="Empresa" value={form.client_company} onChange={e => set('client_company', e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="total">Valor (R$)</Label>
              <Input id="total" placeholder="0,00" value={form.total} onChange={e => set('total', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issued_at">Data</Label>
              <Input id="issued_at" type="date" value={form.issued_at} onChange={e => set('issued_at', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v ?? 'gerada')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2 pt-2">
          {isEdit && (
            <Button
              variant="ghost" size="sm"
              className={cn('mr-auto gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50', confirmDelete && 'bg-red-50 text-red-700')}
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="text-white" style={{ backgroundColor: 'var(--brand-teal)' }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
