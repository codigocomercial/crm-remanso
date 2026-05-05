'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { Building2, Search, Plus, ArrowRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

interface Company {
  id: string
  name: string
  city: string | null
  state: string | null
  segment: string | null
  distance_km: number | null
  reorder_cycle_days: number | null
  contacts_count: number
  compras_count: number
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('companies')
      .select(`id, name, city, state, segment, distance_km, reorder_cycle_days, contacts(id, contact_role)`)
      .eq('org_id', ORG_ID)
      .order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    setCompanies((data ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      city: d.city,
      state: d.state,
      segment: d.segment,
      distance_km: d.distance_km,
      reorder_cycle_days: d.reorder_cycle_days,
      contacts_count: d.contacts?.length ?? 0,
      compras_count: d.contacts?.filter((c: any) => c.contact_role === 'compras').length ?? 0,
    })))
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/bling/sync/empresas', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncResult(`${data.empresas} empresas, ${data.contatos} contatos e ${data.vendedores} vendedores sincronizados!`)
        load()
      } else {
        setSyncResult(`Erro: ${data.error}`)
      }
    } catch {
      setSyncResult('Erro ao sincronizar')
    }
    setSyncing(false)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Empresas" subtitle={`${companies.length} funerárias cadastradas`}>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-remanso-outline mr-2 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Bling'}
        </button>
        <Link href="/empresas/nova" className="btn-remanso">
          <Plus size={13} /> Nova empresa
        </Link>
      </PageHeader>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${syncResult.startsWith('Erro') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {syncResult}
        </div>
      )}

      <div className="rm-card mb-5">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--neutral-300)' }} />
          <input type="text" placeholder="Buscar empresa..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] rounded-lg border outline-none"
            style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand-teal)'; e.currentTarget.style.backgroundColor = 'white' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.backgroundColor = 'var(--neutral-100)' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rm-card animate-pulse h-44" style={{ background: 'var(--neutral-100)' }} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="rm-card flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={40} className="mb-4" style={{ color: 'var(--neutral-300)' }} />
          <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--neutral-700)' }}>
            {search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
          </p>
          <p className="text-[13px] mb-5" style={{ color: 'var(--neutral-500)' }}>
            {search ? 'Tente buscar com outros termos.' : 'Clique em Sincronizar Bling para importar as funerárias.'}
          </p>
          <Link href="/empresas/nova" className="btn-remanso">
            <Plus size={13} /> Cadastrar primeira empresa
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => (
            <Link key={company.id} href={`/empresas/${company.id}`}
              className="rm-card block hover:-translate-y-0.5 transition-all group cursor-pointer">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: 'var(--brand-teal-soft)', color: 'var(--brand-teal-dark)' }}>
                  {initials(company.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>
                    {company.name}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--neutral-500)' }}>
                    {[company.city, company.state].filter(Boolean).join(', ') || 'Sem localização'}
                  </p>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0 mt-1"
                  style={{ color: 'var(--neutral-500)' }} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: 'var(--neutral-200)' }}>
                <div className="text-center">
                  <p className="text-[18px] font-bold" style={{ color: 'var(--neutral-900)', letterSpacing: '-0.5px' }}>
                    {company.contacts_count}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>Contatos</p>
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-bold" style={{ color: 'var(--brand-teal)', letterSpacing: '-0.5px' }}>
                    {company.compras_count}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>Compradores</p>
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-bold" style={{ color: 'var(--brand-gold)', letterSpacing: '-0.5px' }}>
                    {company.distance_km ?? '—'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>km</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}