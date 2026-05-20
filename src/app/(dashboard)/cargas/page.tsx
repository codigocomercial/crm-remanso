'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  Truck, Plus, Search, RefreshCw, ChevronRight, ChevronDown,
  Package, MapPin, TrendingUp, Calendar, X, Check,
  AlertCircle, Fuel, User, Clock, Edit2, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, Modal } from '@/components/ui/rm-components'
import { MarginDisplay, ProtectedContent } from '@/components/ui/MarginIndicator'
import { useUserRole } from '@/hooks/useUserRole'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface FreightLoad {
  id: string
  load_number: number
  route_name: string
  destination_city: string
  destination_state: string
  distance_km: number
  max_units: number
  used_units: number
  transport_type: string
  cost_per_km: number
  driver_daily_cost: number
  trip_days: number
  freight_per_unit: number
  total_units: number
  total_revenue: number
  total_cost_mp: number
  total_cost_op: number
  total_freight_cost: number
  total_freight_charged: number
  total_margin: number
  total_margin_pct: number
  status: string
  estimated_departure: string
  observations: string
  created_at: string
  freight_load_orders: FreightLoadOrder[]
}

interface FreightLoadOrder {
  id: string
  order_id: string
  units_count: number
  order_value: number
  freight_charged: number
  margin: number
  margin_pct: number
  client_name: string
  client_city: string
  client_state: string
  added_at: string
  order: { id: string; bling_number: string; status: string; ordered_at: string }
}

interface Order {
  id: string
  bling_number: string
  client_name: string
  client_city: string
  client_state: string
  total_value: number
  units_count: number
  margin_pct: number
  ordered_at: string
  company: { id: string; fantasia: string; city: string; state: string; distance_km: number }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  forming: { label: 'Em Formação', color: '#1D6FA4', bg: '#EBF4FB' },
  closed: { label: 'Fechada', color: '#2F6F5D', bg: '#EBF5F1' },
  in_transit: { label: 'Em Trânsito', color: '#B45309', bg: '#FEF3C7' },
  delivered: { label: 'Entregue', color: '#6B7280', bg: '#F1F5F9' },
  cancelled: { label: 'Cancelada', color: '#DC2626', bg: '#FEE2E2' },
}

function fmt(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function fmtPct(val: number) {
  return `${(val || 0).toFixed(1)}%`
}

function marginColor(pct: number) {
  if (pct >= 30) return '#2F6F5D'
  if (pct >= 15) return '#B45309'
  return '#DC2626'
}

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min((used / max) * 100, 100)
  const color = pct >= 80 ? '#2F6F5D' : pct >= 50 ? '#B45309' : '#1D6FA4'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>
        {used}/{max}
      </span>
    </div>
  )
}

// ── Modal Nova Carga ───────────────────────────────────────────────────────
function NewLoadModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    route_name: '', destination_city: '', destination_state: '',
    distance_km: '', max_units: '48', transport_type: 'own',
    cost_per_km: '', driver_daily_cost: '', trip_days: '1',
    freight_per_unit: '30', estimated_departure: '', observations: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.route_name || !form.destination_city) return
    setSaving(true)
    try {
      const res = await fetch('/api/cargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          distance_km: parseFloat(form.distance_km) || null,
          max_units: parseFloat(form.max_units) || 48,
          cost_per_km: parseFloat(form.cost_per_km) || null,
          driver_daily_cost: parseFloat(form.driver_daily_cost) || null,
          trip_days: parseInt(form.trip_days) || 1,
          freight_per_unit: parseFloat(form.freight_per_unit) || 30,
        }),
      })
      if (res.ok) { onSave(); onClose() }
    } finally { setSaving(false) }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-600)' }}>{label}</label>
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
        style={{ borderColor: 'rgba(0,0,0,0.1)' }}
      />
    </div>
  )

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--neutral-900)' }}>Nova Carga</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="px-3 py-2 rounded-lg text-[12px] font-mono font-semibold"
            style={{ backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-500)', border: '1px solid rgba(0,0,0,0.06)' }}>
            Código gerado automaticamente: RTA-XXX
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{field('Descrição da Rota *', 'route_name', 'text', 'Ex: Rota Guanambi, Interior Sul')}</div>
            {field('Cidade Destino *', 'destination_city', 'text', 'Ex: Guanambi')}
            {field('Estado', 'destination_state', 'text', 'BA')}
            {field('Distância (km)', 'distance_km', 'number', '280')}
            {field('Capacidade (urnas)', 'max_units', 'number', '48')}
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-600)' }}>Tipo de Transporte</label>
            <select value={form.transport_type} onChange={e => setForm(p => ({ ...p, transport_type: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <option value="own">Caminhão Próprio</option>
              <option value="third_party">Terceirizado</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {field('Custo/km (R$)', 'cost_per_km', 'number', '1.70')}
            {field('Diária motorista', 'driver_daily_cost', 'number', '250')}
            {field('Dias de viagem', 'trip_days', 'number', '2')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Frete/urna (R$)', 'freight_per_unit', 'number', '30')}
            {field('Saída prevista', 'estimated_departure', 'date')}
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-600)' }}>Observações</label>
            <textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
              rows={2} placeholder="Notas sobre a rota, clientes, etc."
              className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none resize-none"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }} />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold rounded-xl border"
            style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--neutral-600)' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !form.route_name || !form.destination_city}
            className="flex-1 py-2 text-[13px] font-semibold rounded-xl text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {saving ? 'Salvando...' : 'Criar Carga'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal Editar Carga ─────────────────────────────────────────────────────
function EditLoadModal({ load, onClose, onSave }: { load: FreightLoad; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    route_name: load.route_name || '',
    destination_city: load.destination_city || '',
    destination_state: load.destination_state || '',
    distance_km: String(load.distance_km || ''),
    max_units: String(load.max_units || '48'),
    transport_type: load.transport_type || 'own',
    cost_per_km: String(load.cost_per_km || ''),
    driver_daily_cost: String(load.driver_daily_cost || ''),
    trip_days: String(load.trip_days || '1'),
    freight_per_unit: String(load.freight_per_unit || '30'),
    estimated_departure: load.estimated_departure ? load.estimated_departure.slice(0, 10) : '',
    observations: load.observations || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.route_name || !form.destination_city) return
    setSaving(true)
    try {
      const res = await fetch(`/api/cargas/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          distance_km: parseFloat(form.distance_km) || null,
          max_units: parseFloat(form.max_units) || 48,
          cost_per_km: parseFloat(form.cost_per_km) || null,
          driver_daily_cost: parseFloat(form.driver_daily_cost) || null,
          trip_days: parseInt(form.trip_days) || 1,
          freight_per_unit: parseFloat(form.freight_per_unit) || 30,
        }),
      })
      if (res.ok) { onSave(); onClose() }
    } finally { setSaving(false) }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-500)' }}>{label}</label>
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
        style={{ borderColor: 'var(--surface-border)' }}
      />
    </div>
  )

  return (
    <Modal onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--surface-border)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--neutral-900)' }}>Editar Carga #{load.load_number}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{field('Descrição da Rota *', 'route_name')}</div>
            {field('Cidade Destino *', 'destination_city')}
            {field('Estado', 'destination_state', 'text', 'BA')}
            {field('Distância (km)', 'distance_km', 'number')}
            {field('Capacidade (urnas)', 'max_units', 'number')}
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-500)' }}>Tipo de Transporte</label>
            <select value={form.transport_type} onChange={e => setForm(p => ({ ...p, transport_type: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
              style={{ borderColor: 'var(--surface-border)' }}>
              <option value="own">Caminhão Próprio</option>
              <option value="third_party">Terceirizado</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {field('Custo/km (R$)', 'cost_per_km', 'number', '1.70')}
            {field('Diária motorista', 'driver_daily_cost', 'number', '250')}
            {field('Dias de viagem', 'trip_days', 'number', '2')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Frete/urna (R$)', 'freight_per_unit', 'number', '30')}
            {field('Saída prevista', 'estimated_departure', 'date')}
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--neutral-500)' }}>Observações</label>
            <textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
              rows={2} placeholder="Notas sobre a rota, clientes, etc."
              className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none resize-none"
              style={{ borderColor: 'var(--surface-border)' }} />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2" style={{ borderColor: 'var(--surface-border)' }}>
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold rounded-xl border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--neutral-500)' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !form.route_name || !form.destination_city}
            className="flex-1 py-2 text-[13px] font-semibold rounded-xl text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function LoadCard({ load, onRefresh }: { load: FreightLoad; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchOrder, setSearchOrder] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const { can } = useUserRole()

  const st = STATUS_CONFIG[load.status] || STATUS_CONFIG.forming
  const freightCostTotal = (load.distance_km || 0) * (load.cost_per_km || 0) +
    (load.driver_daily_cost || 0) * (load.trip_days || 1)
  const freightBalance = (load.total_freight_charged || 0) - freightCostTotal

  const loadAvailableOrders = async (from = dateFrom, to = dateTo) => {
    setLoadingOrders(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('date_from', from)
      if (to) params.set('date_to', to)
      const res = await fetch(`/api/cargas/${load.id}?${params}`)
      const data = await res.json()
      setAvailableOrders(data.suggestions || [])
    } finally { setLoadingOrders(false) }
  }

  const addOrder = async (orderId: string) => {
    setAdding(orderId)
    try {
      await fetch(`/api/cargas/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_order', order_id: orderId, freight_per_unit: load.freight_per_unit }),
      })
      onRefresh()
      loadAvailableOrders()
    } finally { setAdding(null) }
  }

  const removeOrder = async (orderId: string) => {
    setRemoving(orderId)
    try {
      await fetch(`/api/cargas/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_order', order_id: orderId }),
      })
      onRefresh()
    } finally { setRemoving(null) }
  }

  const updateStatus = async (status: string) => {
    await fetch(`/api/cargas/${load.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', status }),
    })
    onRefresh()
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const deleteLoad = async () => {
    try {
      await fetch(`/api/cargas/${load.id}`, { method: 'DELETE' })
      onRefresh()
    } catch { }
  }

  const filteredOrders = availableOrders.filter(o => {
    if (!searchOrder) return true
    const q = searchOrder.toLowerCase()
    return o.client_name?.toLowerCase().includes(q) ||
      o.client_city?.toLowerCase().includes(q) ||
      o.company?.fantasia?.toLowerCase().includes(q) ||
      o.bling_number?.toLowerCase().includes(q)
  })

  return (
    <>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
        {/* Header do card */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--brand-teal-bg)' }}>
                <Truck size={16} style={{ color: 'var(--brand-teal)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--neutral-900)' }}>
                    {(load as any).route_code && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-500)', border: '1px solid rgba(0,0,0,0.06)' }}>
                        {(load as any).route_code}
                      </span>
                    )}
                    #{load.load_number} — {load.route_name}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: st.color, backgroundColor: st.bg }}>
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--neutral-500)' }}>
                    <MapPin size={10} /> {load.destination_city}{load.destination_state ? `/${load.destination_state}` : ''} — {load.distance_km}km
                  </span>
                  {load.estimated_departure && (
                    <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--neutral-500)' }}>
                      <Calendar size={10} /> {new Date(load.estimated_departure).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {load.status === 'forming' && !confirmDelete && (
                <button onClick={() => setShowEdit(true)}
                  title="Editar carga"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--neutral-400)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-teal)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-400)')}>
                  <Edit2 size={13} />
                </button>
              )}
              {load.status === 'forming' && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Excluir carga"
                  style={{ color: 'var(--neutral-400)' }}>
                  <Trash2 size={13} />
                </button>
              )}
              {load.status === 'forming' && confirmDelete && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px]" style={{ color: 'var(--neutral-500)' }}>Excluir?</span>
                  <button onClick={deleteLoad}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors">
                    Sim
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors"
                    style={{ borderColor: 'rgba(128,128,128,0.3)', color: 'var(--neutral-500)' }}>
                    Não
                  </button>
                </div>
              )}
              {load.status === 'forming' && !confirmDelete && (
                <button onClick={() => updateStatus('closed')}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors hover:bg-green-50"
                  style={{ borderColor: '#2F6F5D', color: '#2F6F5D' }}>
                  Fechar Carga
                </button>
              )}
              {load.status === 'closed' && (
                <>
                  <button onClick={() => updateStatus('forming')}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors hover:bg-blue-50"
                    style={{ borderColor: '#1D6FA4', color: '#1D6FA4' }}>
                    ↩ Reabrir
                  </button>
                  <button onClick={() => updateStatus('in_transit')}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors hover:bg-orange-50"
                    style={{ borderColor: '#B45309', color: '#B45309' }}>
                    Em Trânsito
                  </button>
                </>
              )}
              {load.status === 'in_transit' && (
                <>
                  <button onClick={() => updateStatus('forming')}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors hover:bg-blue-50"
                    style={{ borderColor: '#1D6FA4', color: '#1D6FA4' }}>
                    ↩ Reabrir
                  </button>
                  <button onClick={() => updateStatus('delivered')}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors hover:bg-teal-50"
                    style={{ borderColor: 'var(--brand-teal)', color: 'var(--brand-teal)' }}>
                    Marcar Entregue
                  </button>
                </>
              )}
              <button onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

          {/* Métricas resumidas */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>
                Capacidade
              </p>
              <CapacityBar used={load.used_units || 0} max={load.max_units || 48} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>Receita</p>
              <p className="text-[13px] font-bold" style={{ color: 'var(--neutral-900)' }}>{fmt(load.total_revenue)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>Margem</p>
              <MarginDisplay pct={load.total_margin_pct} value={load.total_margin} type="load" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>
                Frete {freightBalance >= 0 ? '✓' : '✗'}
              </p>
              <ProtectedContent permission="view_freight_cost"
                fallback={<span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ color: freightBalance >= 0 ? '#2F6F5D' : '#DC2626', backgroundColor: freightBalance >= 0 ? '#EBF5F1' : '#FEE2E2' }}>{freightBalance >= 0 ? '✓ OK' : '✗ Déficit'}</span>}>
                <p className="text-[13px] font-bold" style={{ color: freightBalance >= 0 ? '#2F6F5D' : '#DC2626' }}>
                  {fmt(freightBalance)}
                </p>
              </ProtectedContent>
            </div>
          </div>

          {/* Custos da viagem */}
          <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--neutral-500)' }}>
            <span className="flex items-center gap-1">
              <Fuel size={10} /> {load.transport_type === 'own' ? 'Próprio' : 'Terceirizado'} —
              R${load.cost_per_km}/km
            </span>
            <span className="flex items-center gap-1">
              <User size={10} /> R${load.driver_daily_cost}/dia × {load.trip_days}d
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {load.distance_km || 0}km totais — {fmt(freightCostTotal)} custo frete
            </span>
          </div>
        </div>

        {/* Pedidos expandidos */}
        {expanded && (
          <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            {/* Lista de pedidos */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>
                  Pedidos ({load.freight_load_orders?.length || 0})
                </p>
                {load.status === 'forming' && (
                  <button
                    onClick={() => { setShowAddOrder(!showAddOrder); if (!showAddOrder) loadAvailableOrders() }}
                    className="text-[11px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--brand-teal)', backgroundColor: 'var(--brand-teal-bg)' }}>
                    <Plus size={10} /> Adicionar Pedido
                  </button>
                )}
              </div>

              {load.freight_load_orders?.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: 'var(--neutral-400)' }}>
                  Nenhum pedido na carga
                </p>
              ) : (
                <div className="space-y-1.5">
                  {/* Header */}
                  <div className="grid gap-2 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-500)',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))'
                    }}>
                    <div className="col-span-4">Cliente</div>
                    <div className="col-span-2">Cidade</div>
                    <div className="col-span-1 text-right">Urnas</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2 text-right">Margem</div>
                    <div className="col-span-1"></div>
                  </div>

                  {load.freight_load_orders.map(lo => (
                    <div key={lo.id} className="grid grid-cols-12 gap-2 px-2 py-2 rounded-lg hover:bg-neutral-50 items-center">
                      <div className="col-span-4">
                        <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>
                          {lo.client_name}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>
                          Ped. #{lo.order?.bling_number}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] truncate" style={{ color: 'var(--neutral-600)' }}>{lo.client_city}</p>
                      </div>
                      <div className="col-span-1 text-right">
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--neutral-900)' }}>{lo.units_count}</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--neutral-900)' }}>{fmt(lo.order_value)}</p>
                        <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>+{fmt(lo.freight_charged)} frete</p>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <MarginDisplay pct={lo.margin_pct} value={lo.margin} type="load" size="sm" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {load.status === 'forming' && (
                          <button onClick={() => removeOrder(lo.order_id)}
                            disabled={removing === lo.order_id}
                            className="p-1 rounded hover:bg-red-50 transition-colors">
                            {removing === lo.order_id
                              ? <RefreshCw size={11} className="animate-spin" style={{ color: '#DC2626' }} />
                              : <X size={11} style={{ color: '#DC2626' }} />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Totais */}
                  <div className="grid grid-cols-12 gap-2 px-2 py-2 rounded-lg mt-1 border-t"
                    style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <div className="col-span-4">
                      <p className="text-[11px] font-bold" style={{ color: 'var(--neutral-700)' }}>TOTAL</p>
                    </div>
                    <div className="col-span-2"></div>
                    <div className="col-span-1 text-right">
                      <p className="text-[12px] font-bold" style={{ color: 'var(--neutral-900)' }}>{load.total_units}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-[12px] font-bold" style={{ color: 'var(--neutral-900)' }}>{fmt(load.total_revenue)}</p>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <MarginDisplay pct={load.total_margin_pct} value={load.total_margin} type="load" size="sm" />
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Painel adicionar pedido */}
            {showAddOrder && load.status === 'forming' && (
              <div className="border-t p-3 bg-[var(--neutral-50)]" style={{ borderColor: 'var(--surface-border)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--neutral-500)' }}>
                  Pedidos disponíveis para adicionar
                </p>

                {/* Filtro de período */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: 'var(--neutral-500)' }}>De</span>
                    <input type="date" value={dateFrom}
                      onChange={e => { setDateFrom(e.target.value); loadAvailableOrders(e.target.value, dateTo) }}
                      className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border outline-none bg-[var(--neutral-100)] text-[var(--neutral-900)]"
                      style={{ borderColor: 'var(--surface-border)' }} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: 'var(--neutral-500)' }}>Até</span>
                    <input type="date" value={dateTo}
                      onChange={e => { setDateTo(e.target.value); loadAvailableOrders(dateFrom, e.target.value) }}
                      className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border outline-none bg-[var(--neutral-100)] text-[var(--neutral-900)]"
                      style={{ borderColor: 'var(--surface-border)' }} />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); loadAvailableOrders('', '') }}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors hover:bg-neutral-100"
                      style={{ color: 'var(--neutral-400)' }}>
                      Limpar
                    </button>
                  )}
                </div>

                {/* Busca por texto */}
                <div className="relative mb-2">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--neutral-400)' }} />
                  <input value={searchOrder} onChange={e => setSearchOrder(e.target.value)}
                    placeholder="Buscar por cliente, cidade ou nº pedido..."
                    className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg border outline-none bg-[var(--neutral-100)] text-[var(--neutral-900)]"
                    style={{ borderColor: 'var(--surface-border)' }} />
                </div>

                {loadingOrders ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--neutral-400)' }} />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <p className="text-[12px] text-center py-3" style={{ color: 'var(--neutral-400)' }}>
                    Nenhum pedido  disponível
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg bg-[var(--neutral-100)] border"
                        style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>
                            {o.company?.fantasia || o.client_name}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--neutral-500)' }}>
                            📍 {o.company?.city || o.client_city}/{o.company?.state || o.client_state}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--neutral-400)' }}>
                            Ped. #{o.bling_number} · {o.units_count} urnas
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[12px] font-bold" style={{ color: 'var(--neutral-900)' }}>
                            {fmt(o.total_value)}
                          </p>
                          <button onClick={() => addOrder(o.id)} disabled={adding === o.id}
                            className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded-lg text-white"
                            style={{ backgroundColor: 'var(--brand-teal)' }}>
                            {adding === o.id ? '...' : '+ Adicionar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {showEdit && (
        <EditLoadModal load={load} onClose={() => setShowEdit(false)} onSave={() => { onRefresh(); setShowEdit(false) }} />
      )}
    </>
  )
}
export default function CargasPage() {
  const { can } = useUserRole()
  const [loads, setLoads] = useState<FreightLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [statusFilter, setStatusFilter] = useState('forming')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cargas?status=${statusFilter}`)
      const data = await res.json()
      setLoads(data.loads || [])
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = loads.filter(l =>
    !search ||
    l.route_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.destination_city?.toLowerCase().includes(search.toLowerCase())
  )

  // Métricas do topo
  const totalLoads = loads.length
  const totalUnits = loads.reduce((s, l) => s + (l.total_units || 0), 0)
  const totalRevenue = loads.reduce((s, l) => s + (l.total_revenue || 0), 0)
  const avgMargin = loads.length > 0
    ? loads.reduce((s, l) => s + (l.total_margin_pct || 0), 0) / loads.length
    : 0

  return (
    <div className="animate-fade-in">
      {/* Header sticky — padrão do sistema */}
      <div>
        <PageHeader
          title="Gerenciador de Cargas"
          subtitle="Formação e controle de cargas para entrega"
        >
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            <Plus size={14} /> Nova Carga
          </button>
        </PageHeader>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Cargas Ativas', value: totalLoads },
          { label: 'Total Urnas', value: totalUnits },
          { label: 'Receita Total', value: fmt(totalRevenue) },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>
              {m.label}
            </p>
            <p className="text-[20px] font-bold" style={{ color: 'var(--neutral-900)' }}>{m.value}</p>
          </div>
        ))}
        <div className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--neutral-500)' }}>
            Margem Média
          </p>
          {can('view_margins')
            ? <p className="text-[20px] font-bold" style={{ color: 'var(--neutral-900)' }}>{fmtPct(avgMargin)}</p>
            : <MarginDisplay pct={avgMargin} value={0} type="load" />
          }
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--neutral-400)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar rota ou cidade..."
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border outline-none"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }} />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'forming', label: 'Em Formação' },
            { key: 'closed', label: 'Fechadas' },
            { key: 'in_transit', label: 'Em Trânsito' },
            { key: 'delivered', label: 'Entregues' },
            { key: 'all', label: 'Todas' },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={cn('px-3 py-1.5 text-[12px] font-semibold rounded-xl transition-colors',
                statusFilter === f.key ? 'text-white' : 'hover:bg-neutral-100')}
              style={{
                backgroundColor: statusFilter === f.key ? 'var(--brand-teal)' : 'transparent',
                color: statusFilter === f.key ? 'white' : 'var(--neutral-600)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-neutral-100 transition-colors">
          <RefreshCw size={14} style={{ color: 'var(--neutral-500)' }} />
        </button>
      </div>

      {/* Lista de cargas */}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--neutral-400)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Truck size={32} style={{ color: 'var(--neutral-300)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--neutral-500)' }}>
            Nenhuma carga encontrada
          </p>
          <button onClick={() => setShowNew(true)}
            className="text-[13px] font-semibold px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            Criar primeira carga
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => (
            <LoadCard key={l.id} load={l} onRefresh={load} />
          ))}
        </div>
      )}

      {showNew && <NewLoadModal onClose={() => setShowNew(false)} onSave={load} />}
    </div>
  )
}
