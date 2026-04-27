'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

const CICLOS = [
  { value: 30, label: '30 dias' },
  { value: 45, label: '45 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
]

export default function NovaEmpresaPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', city: '', state: 'BA', segment: 'Funerária',
    distance_km: '', reorder_cycle_days: '90',
    website: '', notes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Nome da empresa é obrigatório'); return }
    setSaving(true)

    const { data, error } = await supabase.from('companies').insert({
      org_id: ORG_ID,
      name: form.name.trim(),
      city: form.city || null,
      state: form.state || null,
      segment: form.segment || null,
      distance_km: form.distance_km ? parseInt(form.distance_km) : null,
      reorder_cycle_days: parseInt(form.reorder_cycle_days) || 90,
      website: form.website || null,
      notes: form.notes || null,
    }).select('id').single()

    setSaving(false)
    if (!error && data) router.push(`/empresas/${data.id}`)
    else alert('Erro ao salvar: ' + error?.message)
  }

  const inputClass = "w-full px-3 py-2 text-[13px] rounded-lg border outline-none transition-all"
  const inputStyle = { borderColor: 'rgba(0,0,0,0.1)' }
  const onFocus = (e: any) => e.currentTarget.style.borderColor = 'var(--brand-teal)'
  const onBlur  = (e: any) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'

  return (
    <div className="animate-fade-in max-w-xl">
      <PageHeader title="Nova Empresa" subtitle="Cadastrar funerária">
        <Link href="/empresas"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
          style={{ color: 'var(--neutral-500)' }}>
          <ArrowLeft size={13} /> Voltar
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {/* Dados principais */}
        <div className="rm-card space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>
            Dados da empresa
          </p>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
              Nome da funerária *
            </label>
            <input type="text" placeholder="Ex: Pax Nacional" value={form.name}
              onChange={e => set('name', e.target.value)}
              className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                Cidade
              </label>
              <input type="text" placeholder="Ex: Jequié" value={form.city}
                onChange={e => set('city', e.target.value)}
                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                Estado (UF)
              </label>
              <input type="text" placeholder="BA" maxLength={2} value={form.state}
                onChange={e => set('state', e.target.value.toUpperCase())}
                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
              📍 Distância da fábrica (km)
            </label>
            <input type="number" placeholder="Ex: 150" value={form.distance_km}
              onChange={e => set('distance_km', e.target.value)}
              className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            <p className="text-[11px] mt-1" style={{ color: 'var(--neutral-500)' }}>
              Distância de Vitória da Conquista até esta funerária — usado para filtrar campanhas por raio.
            </p>
          </div>
        </div>

        {/* Comportamento de compra */}
        <div className="rm-card space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>
            Comportamento de compra
          </p>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
              Ciclo de recompra
            </label>
            <select value={form.reorder_cycle_days} onChange={e => set('reorder_cycle_days', e.target.value)}
              className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
              {CICLOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Observações */}
        <div className="rm-card">
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
            Observações
          </label>
          <textarea rows={3} placeholder="Informações adicionais sobre a empresa..."
            value={form.notes} onChange={e => set('notes', e.target.value)}
            className={inputClass + ' resize-none'} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-remanso w-full justify-center py-3 text-[14px]">
          {saving ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Salvando...</>
          ) : (
            <><Save size={14} /> Salvar empresa</>
          )}
        </button>
      </div>
    </div>
  )
}
