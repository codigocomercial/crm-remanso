'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Calculator, X } from 'lucide-react'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CAMPOS = [
  { key: 'labor',            label: 'Mão-de-Obra' },
  { key: 'admin',            label: 'Despesas Adm' },
  { key: 'truck',            label: 'Caminhão' },
  { key: 'maintenance',      label: 'Manutenção' },
  { key: 'misc',             label: 'Desp. Diversas' },
  { key: 'tax',              label: 'Impostos' },
  { key: 'icms',             label: 'ICMS' },
  { key: 'freight_purchase', label: 'Frete Compra' },
  { key: 'interest',         label: 'Juros' },
  { key: 'discount_boletos', label: 'Desconto Boletos' },
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

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Converte valor numérico para string formatada para exibição no input
function fmtInput(v: number): string {
  if (!v) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Converte string digitada para número
function parseInput(val: string): number {
  // Remove tudo exceto dígitos e vírgula/ponto
  const clean = val.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

function totalMes(r: OpCost) {
  return r.labor + r.admin + r.truck + r.maintenance + r.misc +
         r.tax + r.icms + r.freight_purchase + r.interest + r.discount_boletos
}

function custoPorUrna(r: OpCost) {
  if (!r.units_produced) return 0
  return totalMes(r) / r.units_produced
}

export default function CustosOperacionaisPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<OpCost[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<OpCost | null>(null)
  const [form, setForm] = useState<Omit<OpCost, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  function handleNum(key: string, val: string) {
    // Permite digitar livremente — só parseia ao sair do campo
    const n = parseInput(val)
    setForm(f => ({ ...f, [key]: n }))
  }

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
    // Garantir que todos os campos numéricos são números, não strings
    const payload = {
      ...form,
      org_id: ORG_ID,
      ...CAMPOS.reduce((acc, c) => ({
        ...acc,
        [c.key]: parseInput(String((form as any)[c.key] || '0'))
      }), {})
    }
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

  const totalForm = CAMPOS.reduce((s, c) => s + (Number((form as any)[c.key]) || 0), 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: 'var(--neutral-900)' }}>
            <Calculator size={20} style={{ color: 'var(--brand-teal)' }} />
            Custos Operacionais
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--neutral-500)' }}>
            Custos mensais rateados por urna produzida
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
          style={{ backgroundColor: 'var(--brand-teal)' }}>
          <Plus size={14} /> Novo Mês
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--neutral-100)' }} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm flex flex-col items-center py-16 text-center"
          style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <Calculator size={40} className="mb-4" style={{ color: 'var(--neutral-300)' }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--neutral-700)' }}>Nenhum custo cadastrado</p>
          <p className="text-[13px] mb-5" style={{ color: 'var(--neutral-500)' }}>
            Cadastre os custos mensais para calcular a margem dos pedidos
          </p>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            <Plus size={13} /> Cadastrar primeiro mês
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'var(--neutral-50)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Mês/Ano</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Urnas Prod.</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Total Custos</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--neutral-600)' }}>Custo/Urna</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id}
                  style={{ borderBottom: i < records.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--neutral-900)' }}>
                {editing ? 'Editar Custos' : 'Novo Mês de Custos'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X size={18} style={{ color: 'var(--neutral-400)' }} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>Mês</label>
                  <select value={form.month}
                    onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>Ano</label>
                  <input type="number" value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>Urnas Produzidas</label>
                  <input type="number" value={form.units_produced || ''}
                    onChange={e => setForm(f => ({ ...f, units_produced: Number(e.target.value) }))}
                    placeholder="Ex: 450"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {CAMPOS.map(c => (
                  <div key={c.key}>
                    <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>
                      {c.label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]"
                        style={{ color: 'var(--neutral-400)' }}>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          focusedField === c.key
                            ? ((form as any)[c.key] || '')
                            : fmtInput((form as any)[c.key] || 0)
                        }
                        onFocus={() => setFocusedField(c.key)}
                        onBlur={e => {
                          setFocusedField(null)
                          handleNum(c.key, e.target.value)
                        }}
                        onChange={e => {
                          if (focusedField === c.key) {
                            setForm(f => ({ ...f, [c.key]: e.target.value as any }))
                          }
                        }}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border outline-none text-right"
                        style={{ borderColor: 'var(--surface-border)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {form.units_produced > 0 && (
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ backgroundColor: 'var(--neutral-50)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div>
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--neutral-500)' }}>TOTAL MENSAL</p>
                    <p className="text-[15px] font-bold" style={{ color: 'var(--neutral-800)' }}>R$ {fmt(totalForm)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--neutral-500)' }}>CUSTO POR URNA</p>
                    <p className="text-[18px] font-bold" style={{ color: 'var(--brand-teal)' }}>
                      R$ {fmt(totalForm / form.units_produced)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>Observação</label>
                <textarea value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none resize-none"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }} />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-[13px] font-semibold rounded-xl border"
                style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--neutral-600)' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-[13px] font-semibold rounded-xl text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-teal)' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
