'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { ArrowLeft, Plus, Trash2, MapPin, RefreshCw, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  compras:     { label: 'Compras',     color: '#2F6F5D', bg: '#EBF5F1' },
  financeiro:  { label: 'Financeiro',  color: '#9E7F2E', bg: '#FAF3E0' },
  diretor:     { label: 'Diretor',     color: '#5B5BD6', bg: '#EFEFFF' },
  operacional: { label: 'Operacional', color: '#6B7280', bg: '#F9FAFB' },
  outro:       { label: 'Outro',       color: '#6B7280', bg: '#F9FAFB' },
}

interface Company {
  id: string
  name: string
  fantasia: string | null
  city: string | null
  state: string | null
  cnpj: string | null
  phone: string | null
  whatsapp: string | null
  distance_km: number | null
  reorder_cycle_days: number | null
  last_order_at: string | null
  average_order_value: number | null
  segment: string | null
  notes: string | null
}

interface Contact {
  id: string
  full_name: string
  phone: string | null
  whatsapp: string | null
  contact_role: string
  receive_campaigns: boolean
  job_title: string | null
}

type EditField = 'km' | 'ciclo' | null

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<EditField>(null)
  const [editVal, setEditVal] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [savingContact, setSavingContact] = useState(false)

  const [newContact, setNewContact] = useState({
    full_name: '', phone: '', whatsapp: '', contact_role: 'compras', job_title: '',
  })

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: comp }, { data: conts }] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id).single(),
      supabase.from('contacts')
        .select('id,full_name,phone,whatsapp,contact_role,receive_campaigns,job_title')
        .eq('company_id', id).order('contact_role').order('full_name'),
    ])
    setCompany(comp)
    setContacts(conts ?? [])
    setLoading(false)
  }

  function startEdit(field: EditField, current: string) {
    setEditing(field)
    setEditVal(current)
  }

  async function saveEdit() {
    if (!editing || !company) return
    setSavingEdit(true)

    const updates: Partial<Company> = {}
    if (editing === 'km') updates.distance_km = parseInt(editVal) || null
    if (editing === 'ciclo') updates.reorder_cycle_days = parseInt(editVal) || null

    await supabase.from('companies').update(updates).eq('id', id)
    setCompany(prev => prev ? { ...prev, ...updates } : prev)
    setEditing(null)
    setSavingEdit(false)
  }

  async function saveContact() {
    if (!editingContact) return
    setSavingContact(true)
    await supabase.from('contacts').update({
      full_name: editingContact.full_name,
      whatsapp: editingContact.whatsapp,
      phone: editingContact.phone,
      job_title: editingContact.job_title,
      contact_role: editingContact.contact_role,
    }).eq('id', editingContact.id)
    setContacts(prev => prev.map(c => c.id === editingContact.id ? editingContact : c))
    setEditingContact(null)
    setSavingContact(false)
  }

  async function toggleCampaign(contact: Contact) {
    await supabase.from('contacts')
      .update({ receive_campaigns: !contact.receive_campaigns })
      .eq('id', contact.id)
    setContacts(prev => prev.map(c =>
      c.id === contact.id ? { ...c, receive_campaigns: !c.receive_campaigns } : c
    ))
  }

  async function deleteContact(contactId: string) {
    if (!confirm('Remover este contato?')) return
    await supabase.from('contacts').delete().eq('id', contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  async function addContact() {
    if (!newContact.full_name.trim()) return
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.user!.id).single()
    const { data } = await supabase.from('contacts').insert({
      org_id: userData!.org_id,
      company_id: id,
      full_name: newContact.full_name.trim(),
      phone: newContact.phone || null,
      whatsapp: newContact.whatsapp || null,
      contact_role: newContact.contact_role,
      job_title: newContact.job_title || null,
      receive_campaigns: newContact.contact_role === 'compras',
      status: 'active',
    }).select('id,full_name,phone,whatsapp,contact_role,receive_campaigns,job_title').single()
    if (data) {
      setContacts(prev => [...prev, data])
      setNewContact({ full_name: '', phone: '', whatsapp: '', contact_role: 'compras', job_title: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
  const inputStyle = { borderColor: 'rgba(0,0,0,0.1)' }
  const onFocus = (e: any) => e.currentTarget.style.borderColor = 'var(--brand-teal)'
  const onBlur = (e: any) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'

  function EditableRow({
    icon, label, value, field, inputType = 'text', placeholder = ''
  }: {
    icon: React.ReactNode
    label: string
    value: string | null
    field: EditField
    inputType?: string
    placeholder?: string
  }) {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>
            {label}
          </p>
          {editing === field ? (
            <div className="flex items-center gap-1.5">
              <input
                type={inputType}
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                className="px-2 py-1 text-[13px] rounded border outline-none"
                style={{ borderColor: 'var(--brand-teal)', width: '140px' }}
                placeholder={placeholder}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
              />
              <button onClick={saveEdit} disabled={savingEdit}
                className="text-[11px] font-semibold px-2 py-1 rounded"
                style={{ background: 'var(--brand-teal)', color: 'white' }}>
                {savingEdit ? '...' : 'OK'}
              </button>
              <button onClick={() => setEditing(null)}
                className="text-[11px] px-1.5 py-1 rounded hover:bg-gray-100"
                style={{ color: 'var(--neutral-400)' }}>✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="text-[13px]" style={{ color: 'var(--neutral-700)' }}>
                {value || <span style={{ color: 'var(--neutral-300)' }}>Não informado</span>}
              </p>
              <button
                onClick={() => startEdit(field, value?.toString() ?? '')}
                className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
                style={{ color: 'var(--brand-teal)' }}>✏️</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--brand-teal)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!company) return <p>Empresa não encontrada</p>

  return (
    <div className="animate-fade-in">
      <PageHeader title={company.fantasia || company.name}
        subtitle={[company.city, company.state].filter(Boolean).join(', ') || 'Sem localização'}>
        <Link href="/empresas"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
          style={{ color: 'var(--neutral-500)' }}>
          <ArrowLeft size={13} /> Voltar
        </Link>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-4">

        {/* Info da empresa */}
        <div className="space-y-4">
          <div className="rm-card space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>
              Informações
            </p>

            {/* Localização */}
            <div className="flex items-center gap-2">
              <MapPin size={14} style={{ color: 'var(--neutral-400)' }} />
              <p className="text-[13px]" style={{ color: 'var(--neutral-700)' }}>
                {[company.city, company.state].filter(Boolean).join(', ') || '—'}
              </p>
            </div>

            {/* CNPJ */}
            {company.cnpj && (
              <div className="flex items-start gap-2">
                <span className="text-[14px] mt-0.5">🪪</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>CNPJ</p>
                  <p className="text-[13px]" style={{ color: 'var(--neutral-700)' }}>
                    {company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                  </p>
                </div>
              </div>
            )}

            {/* Telefone */}
            {company.phone && (
              <div className="flex items-start gap-2">
                <span className="text-[14px] mt-0.5">📞</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>Telefone</p>
                  <a href={`tel:${company.phone}`} className="text-[13px] hover:opacity-70" style={{ color: 'var(--neutral-700)' }}>
                    {company.phone}
                  </a>
                </div>
              </div>
            )}

            {/* WhatsApp */}
            {company.whatsapp && (
              <div className="flex items-start gap-2">
                <span className="text-[14px] mt-0.5">💬</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>WhatsApp</p>
                  <a href={`https://wa.me/55${company.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="text-[13px] hover:opacity-70" style={{ color: '#128C7E' }}>
                    {company.whatsapp}
                  </a>
                </div>
              </div>
            )}

            {/* Distância */}
            <EditableRow
              icon={<span className="text-[14px]">📍</span>}
              label="Distância da fábrica"
              value={company.distance_km ? `${company.distance_km} km` : null}
              field="km"
              inputType="number"
              placeholder="km"
            />

            {/* Ciclo de recompra */}
            <EditableRow
              icon={<RefreshCw size={14} style={{ color: 'var(--neutral-400)' }} />}
              label="Ciclo de recompra"
              value={company.reorder_cycle_days ? `${company.reorder_cycle_days} dias` : null}
              field="ciclo"
              inputType="number"
              placeholder="dias"
            />

            {/* Última compra — calculado dos pedidos */}
            <div className="flex items-start gap-2">
              <span className="text-[14px] mt-0.5">🗓️</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>
                  Última compra
                </p>
                <p className="text-[13px]" style={{ color: company.last_order_at ? 'var(--neutral-700)' : 'var(--neutral-300)' }}>
                  {company.last_order_at ? new Date(company.last_order_at).toLocaleDateString('pt-BR') : 'Aguardando pedidos'}
                </p>
              </div>
            </div>

            {/* Ticket médio — calculado dos pedidos */}
            <div className="flex items-start gap-2">
              <span className="text-[14px] mt-0.5">💰</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--neutral-400)' }}>
                  Ticket médio
                </p>
                <p className="text-[13px]" style={{ color: company.average_order_value ? 'var(--neutral-700)' : 'var(--neutral-300)' }}>
                  {company.average_order_value ? formatCurrency(company.average_order_value) : 'Aguardando pedidos'}
                </p>
              </div>
            </div>
          </div>

          {company.notes && (
            <div className="rm-card">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--neutral-500)' }}>
                Observações
              </p>
              <p className="text-[13px]" style={{ color: 'var(--neutral-700)' }}>{company.notes}</p>
            </div>
          )}

          {/* Stats */}
          <div className="rm-card">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[24px] font-bold" style={{ color: 'var(--brand-teal)', letterSpacing: '-1px' }}>
                  {contacts.filter(c => c.contact_role === 'compras').length}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--neutral-500)' }}>Compradores</p>
              </div>
              <div>
                <p className="text-[24px] font-bold" style={{ color: 'var(--neutral-700)', letterSpacing: '-1px' }}>
                  {contacts.length}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--neutral-500)' }}>Total contatos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contatos */}
        <div className="lg:col-span-2">
          <div className="rm-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--neutral-900)' }}>Contatos</p>
              <button onClick={() => setShowForm(!showForm)} className="btn-remanso py-1.5 text-[12px]">
                <Plus size={12} /> Novo contato
              </button>
            </div>

            {showForm && (
              <div className="mb-4 p-4 rounded-xl space-y-3" style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--neutral-700)' }}>Adicionar contato</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input type="text" placeholder="Nome completo *" value={newContact.full_name}
                      onChange={e => setNewContact(p => ({ ...p, full_name: e.target.value }))}
                      className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <input type="tel" placeholder="WhatsApp" value={newContact.whatsapp}
                    onChange={e => setNewContact(p => ({ ...p, whatsapp: e.target.value }))}
                    className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  <input type="text" placeholder="Cargo (opcional)" value={newContact.job_title}
                    onChange={e => setNewContact(p => ({ ...p, job_title: e.target.value }))}
                    className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  <div className="col-span-2">
                    <select value={newContact.contact_role}
                      onChange={e => setNewContact(p => ({ ...p, contact_role: e.target.value }))}
                      className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                      <option value="compras">🛒 Compras — recebe campanhas</option>
                      <option value="financeiro">💰 Financeiro</option>
                      <option value="diretor">👔 Diretor/Sócio</option>
                      <option value="operacional">⚙️ Operacional</option>
                      <option value="outro">Outro</option>
                    </select>
                    {newContact.contact_role === 'compras' && (
                      <p className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--brand-teal)' }}>
                        ✓ Este contato receberá as campanhas de WhatsApp
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addContact} disabled={saving} className="btn-remanso flex-1 justify-center">
                    {saving ? 'Salvando...' : 'Salvar contato'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-white transition-colors"
                    style={{ color: 'var(--neutral-500)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Modal edição de contato */}
            {editingContact && (
              <div className="mb-4 p-4 rounded-xl space-y-3" style={{ background: 'var(--neutral-100)', border: '1px solid var(--brand-teal)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--neutral-700)' }}>Editar contato</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input type="text" placeholder="Nome completo *" value={editingContact.full_name}
                      onChange={e => setEditingContact(p => p ? { ...p, full_name: e.target.value } : p)}
                      className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <input type="tel" placeholder="WhatsApp" value={editingContact.whatsapp ?? ''}
                    onChange={e => setEditingContact(p => p ? { ...p, whatsapp: e.target.value } : p)}
                    className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  <input type="text" placeholder="Cargo (opcional)" value={editingContact.job_title ?? ''}
                    onChange={e => setEditingContact(p => p ? { ...p, job_title: e.target.value } : p)}
                    className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  <div className="col-span-2">
                    <select value={editingContact.contact_role}
                      onChange={e => setEditingContact(p => p ? { ...p, contact_role: e.target.value } : p)}
                      className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                      <option value="compras">🛒 Compras</option>
                      <option value="financeiro">💰 Financeiro</option>
                      <option value="diretor">👔 Diretor/Sócio</option>
                      <option value="operacional">⚙️ Operacional</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveContact} disabled={savingContact} className="btn-remanso flex-1 justify-center">
                    {savingContact ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditingContact(null)}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-white transition-colors"
                    style={{ color: 'var(--neutral-500)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {contacts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[13px]" style={{ color: 'var(--neutral-400)' }}>Nenhum contato cadastrado ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(contact => {
                  const role = ROLE_LABELS[contact.contact_role] ?? ROLE_LABELS.outro
                  return (
                    <div key={contact.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)' }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: role.bg, color: role.color }}>
                        {contact.full_name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>
                            {contact.full_name}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: role.bg, color: role.color }}>
                            {role.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {contact.whatsapp && (
                            <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer"
                              className="text-[11px] flex items-center gap-1 hover:opacity-70"
                              style={{ color: '#128C7E' }}>
                              <MessageSquare size={10} /> {contact.whatsapp}
                            </a>
                          )}
                          {contact.job_title && (
                            <span className="text-[11px]" style={{ color: 'var(--neutral-500)' }}>
                              {contact.job_title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-center">
                          <button onClick={() => toggleCampaign(contact)}
                            className="relative w-9 h-5 rounded-full transition-colors"
                            style={{ background: contact.receive_campaigns ? 'var(--brand-teal)' : 'var(--neutral-300)' }}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${contact.receive_campaigns ? 'left-4' : 'left-0.5'}`} />
                          </button>
                          <p className="text-[9px] mt-0.5" style={{ color: 'var(--neutral-400)' }}>
                            {contact.receive_campaigns ? 'Campanha' : 'Sem camp.'}
                          </p>
                        </div>
                        <button onClick={() => setEditingContact(contact)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors">
                          <span className="text-[12px]">✏️</span>
                        </button>
                        <button onClick={() => deleteContact(contact.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                          <Trash2 size={12} style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
