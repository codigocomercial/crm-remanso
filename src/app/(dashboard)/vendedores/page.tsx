'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, UserCheck, Loader2, Plus, Edit2, X } from 'lucide-react'

type Seller = {
  id: string
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  bling_id: number | null
}

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export default function VendedoresPage() {
  const supabase = createClient()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Seller | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', is_active: true })

  const fetchSellers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sellers').select('*').eq('org_id', ORG_ID).order('name')
    setSellers(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSellers() }, [fetchSellers])

  const filtered = sellers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', is_active: true })
    setShowModal(true)
  }

  function openEdit(s: Seller) {
    setEditing(s)
    setForm({ name: s.name, email: s.email ?? '', phone: s.phone ?? '', is_active: s.is_active })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/sellers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing?.id, ...form }),
    })
    if (res.ok) {
      await fetchSellers()
      setShowModal(false)
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 text-[13px] rounded-lg border outline-none bg-white"
  const inputStyle = { borderColor: 'rgba(0,0,0,0.12)' }
  const onFocus = (e: any) => e.currentTarget.style.borderColor = 'var(--brand-teal)'
  const onBlur = (e: any) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--neutral-900)' }}>Vendedores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--neutral-500)' }}>Equipe comercial da Urnas Remanso</p>
        </div>
        <button onClick={openNew} className="btn-remanso">
          <Plus size={14} /> Novo vendedor
        </button>
      </div>

      {/* Busca */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--neutral-400)' }} />
        <input placeholder="Buscar vendedor..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-[13px] rounded-lg border outline-none"
          style={{ borderColor: 'rgba(0,0,0,0.1)' }}
          onFocus={onFocus} onBlur={onBlur} />
      </div>

      {/* Tabela */}
      <div className="rm-card p-0 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1fr_40px] gap-4 px-6 py-3 border-b"
          style={{ borderColor: 'var(--neutral-200)', background: 'var(--neutral-100)' }}>
          {['Nome', 'Email', 'Telefone', 'Status', ''].map(h => (
            <span key={h} className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--brand-teal)' }} />
            <p className="text-[13px]" style={{ color: 'var(--neutral-500)' }}>Carregando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <UserCheck className="w-10 h-10" style={{ color: 'var(--neutral-300)' }} />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--neutral-700)' }}>Nenhum vendedor encontrado</p>
            <button onClick={openNew} className="text-[13px] font-medium mt-1" style={{ color: 'var(--brand-teal)' }}>
              + Cadastrar primeiro vendedor
            </button>
          </div>
        ) : (
          <div>
            {filtered.map(s => (
              <div key={s.id} className="grid grid-cols-[2fr_2fr_1.5fr_1fr_40px] gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors border-b last:border-0"
                style={{ borderColor: 'var(--neutral-100)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--brand-teal)' }}>
                    {s.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <span className="text-[13px] font-medium truncate" style={{ color: 'var(--neutral-900)' }}>{s.name}</span>
                </div>
                <span className="text-[13px] truncate" style={{ color: 'var(--neutral-500)' }}>{s.email ?? '—'}</span>
                <span className="text-[13px]" style={{ color: 'var(--neutral-500)' }}>{s.phone ?? '—'}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit border ${s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {s.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <button onClick={() => openEdit(s)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-100 transition-colors">
                  <Edit2 size={13} style={{ color: 'var(--neutral-400)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rm-card w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold" style={{ color: 'var(--neutral-900)' }}>
                {editing ? 'Editar vendedor' : 'Novo vendedor'}
              </p>
              <button onClick={() => setShowModal(false)} className="hover:opacity-70">
                <X size={18} style={{ color: 'var(--neutral-400)' }} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--neutral-500)' }}>Nome *</label>
                <input type="text" placeholder="Nome completo" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--neutral-500)' }}>Email</label>
                <input type="email" placeholder="email@exemplo.com" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--neutral-500)' }}>Telefone</label>
                <input type="tel" placeholder="(77) 99999-9999" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                  style={{ background: form.is_active ? 'var(--brand-teal)' : 'var(--neutral-300)' }}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-4' : 'left-0.5'}`} />
                </button>
                <span className="text-[13px]" style={{ color: 'var(--neutral-700)' }}>
                  {form.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-remanso flex-1 justify-center">
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar vendedor'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
                style={{ color: 'var(--neutral-500)' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
