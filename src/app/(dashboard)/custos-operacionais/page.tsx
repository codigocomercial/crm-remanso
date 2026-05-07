'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { Plus, Pencil, Trash2, Calculator } from 'lucide-react'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CAMPOS = [
  { key: 'labor',           label: 'Mão-de-Obra' },
  { key: 'admin',           label: 'Despesas Adm' },
  { key: 'truck',           label: 'Caminhão' },
  { key: 'maintenance',     label: 'Manutenção' },
  { key: 'misc',            label: 'Desp. Diversas' },
  { key: 'tax',             label: 'Impostos' },
  { key: 'icms',            label: 'ICMS' },
  { key: 'freight_purchase',label: 'Frete Compra' },
  { key: 'interest',        label: 'Juros' },
  { key: 'discount_boletos',label: 'Desconto Boletos' },
]

interface OpCost {
  id: string
  year: number
  month: number
  units_produced: number
  labor: number
  admin: number
  truck: number
  maintenance: number
  misc: number
  tax: number
  icms: number
  freight_purchase: number
  interest: number
  discount_boletos: number
  notes: string | null
}

const EMPTY: Omit<OpCost, 'id'> = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  units_produced: 0,
  labor: 0, admin: 0, truck: 0, maintenance: 0, misc: 0,
  tax: 0, icms: 0, freight_purchase: 0, interest: 0, discount_boletos: 0,
  notes: '',
}

export default function CustosOperacionaisPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<OpCost[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<OpCost | null>(null)
  const [form, setForm] = useState<Omit<OpCost, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('operational_costs')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(r: OpCost) {
    setEditing(r)
    setForm({ ...r })
    setShowModal(true)
  }

  async function save() {
    setSaving(true)
    const payload = { ...form, org_id: ORG_ID }
    if (editing) {
      await supabase.from('operational_costs').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('operational_costs').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('operational_costs').delete().eq('id', id)
    load()
  }

  function totalMes(r: OpCost) {
    return r.labor + r.admin + r.truck + r.maintenance + r.misc +
           r.tax + r.icms + r.freight_purchase + r.interest + r.discount_boletos
  }

  function custoPorUrna(r: OpCost) {
    if (!r.units_produced) return 0
    return totalMes(r) / r.units_produced
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtInput = (v: number) => v === 0 ? '' : String(v).replace('.', ',')

  function handleNum(key: string, val: string) {
    const n = parseFloat(val.replace(',', '.')) || 0
    setForm(f => ({ ...f, [key]: n }))
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Custos Operacionais" subtitle="Custos mensais rateados por urna produzida">
        <button onClick={openNew} className="btn-remanso flex items-center gap-1.5">
          <Plus size={13} /> Novo Mês
        </button>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rm-card animate-pulse h-16" style={{ background: 'var(--neutral-100)' }} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rm-card flex flex-col items-center py-16 text-center">
          <Calculator size={40} className="mb-4" style={{ color: 'var(--neutral-300)' }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--neutral-700)' }}>
            Nenhum custo cadastrado
          </p>
          <p className="text-[13px] mb-5" style={{ color: 'var(--neutral-500)' }}>
            Cadastre os custos mensais para calcular a margem dos pedidos
          </p>
          <button onClick={openNew} className="btn-remanso flex items-center gap-2">
            <Plus size={13} /> Cadastrar primeiro mês
          </button>
        </div>
      ) : (
        <div className="rm-card p-0 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'var(--neutral-50)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Mês/Ano</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Urnas Prod.</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Total Custos</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Custo/Urna</th>
                {CAMPOS.map(c => (
                  <th key={c.key} className="text-right px-4 py-3 font-semibold hidden lg:table-cell" style={{ color: 'var(--neutral-600)' }}>
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                  className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--neutral-800)' }}>
                    {MESES[r.month - 1]}/{r.year}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--neutral-700)' }}>
                    {r.units_produced.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--brand-teal)' }}>
                    R$ {fmt(totalMes(r))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--neutral-900)' }}>
                    R$ {fmt(custoPorUrna(r))}
                  </td>
                  {CAMPOS.map(c => (
                    <td key={c.key} className="px-4 py-3 text-right hidden lg:table-cell" style={{ color: 'var(--neutral-600)' }}>
                      R$ {fmt(Number((r as any)[c.key]))}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-neutral-100 transition-colors">
                        <Pencil size={13} style={{ color: 'var(--neutral-400)' }} />
                      </button>
                      <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                        <Trash2 size={13} style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="p-6 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--neutral-900)' }}>
                {editing ? 'Editar Custos' : 'Novo Mês de Custos'}
              </h2>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Mês/Ano/Urnas */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                    Mês
                  </label>
                  <select
                    value={form.month}
                    onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  >
                    {MESES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                    Ano
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                    Urnas Produzidas
                  </label>
                  <input
                    type="number"
                    value={form.units_produced || ''}
                    onChange={e => setForm(f => ({ ...f, units_produced: Number(e.target.value) }))}
                    placeholder="Ex: 450"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  />
                </div>
              </div>

              {/* Custos */}
              <div className="grid grid-cols-2 gap-4">
                {CAMPOS.map(c => (
                  <div key={c.key}>
                    <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                      {c.label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--neutral-400)' }}>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fmtInput((form as any)[c.key])}
                        onChange={e => handleNum(c.key, e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border outline-none text-right"
                        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview custo/urna */}
              {form.units_produced > 0 && (
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: 'var(--neutral-50)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div>
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--neutral-500)' }}>TOTAL MENSAL</p>
                    <p className="text-[15px] font-bold" style={{ color: 'var(--neutral-800)' }}>
                      R$ {fmt(CAMPOS.reduce((s, c) => s + (Number((form as any)[c.key]) || 0), 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--neutral-500)' }}>CUSTO POR URNA</p>
                    <p className="text-[18px] font-bold" style={{ color: 'var(--brand-teal)' }}>
                      R$ {fmt(CAMPOS.reduce((s, c) => s + (Number((form as any)[c.key]) || 0), 0) / form.units_produced)}
                    </p>
                  </div>
                </div>
              )}

              {/* Observação */}
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                  Observação
                </label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none resize-none"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <button onClick={() => setShowModal(false)} className="btn-remanso-outline">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="btn-remanso">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
