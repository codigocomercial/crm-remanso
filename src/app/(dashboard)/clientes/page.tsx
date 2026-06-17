'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, Plus, ArrowRight, User, MessageCircle, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Contact {
  id: string
  full_name: string
  whatsapp: string | null
  city: string | null
  state: string | null
  status: string
  company: { corporate_name: string; fantasy_name: string | null } | null
}

type StatusFilter = 'active' | 'inactive' | 'all'

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [inativando, setInativando] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .schema('crm')
      .from('contacts')
      .select('id, full_name, whatsapp, city, state, status, company:companies(corporate_name, fantasy_name)')
      .order('full_name', { ascending: true })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (searchTerm) {
      const { data: matchedCompanies } = await supabase
        .schema('crm')
        .from('companies')
        .select('id')
        .or(`corporate_name.ilike.%${searchTerm}%,fantasy_name.ilike.%${searchTerm}%`)

      const companyIds = matchedCompanies?.map((c: any) => c.id) ?? []

      if (companyIds.length > 0) {
        query = query.or(`full_name.ilike.%${searchTerm}%,company_id.in.(${companyIds.join(',')})`)
      } else {
        query = query.ilike('full_name', `%${searchTerm}%`)
      }
    }

    const { data } = await query
    setContacts((data as any) ?? [])
    setLoading(false)
  }, [searchTerm, statusFilter])

  useEffect(() => {
    const timeout = setTimeout(() => loadContacts(), 300)
    return () => clearTimeout(timeout)
  }, [loadContacts])

  const handleInativar = async (contact: Contact) => {
    if (!confirm(`Inativar "${contact.full_name}"?`)) return
    setInativando(contact.id)
    const supabase = createClient()
    await supabase
      .schema('crm')
      .from('contacts')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', contact.id)
    setInativando(null)
    // Atualiza a lista sem recarregar tudo — remove ou mantém conforme o filtro
    if (statusFilter === 'active') {
      setContacts(prev => prev.filter(c => c.id !== contact.id))
    } else {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: 'inactive' } : c))
    }
  }

  const handleReativar = async (contact: Contact) => {
    setInativando(contact.id)
    const supabase = createClient()
    await supabase
      .schema('crm')
      .from('contacts')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', contact.id)
    setInativando(null)
    if (statusFilter === 'inactive') {
      setContacts(prev => prev.filter(c => c.id !== contact.id))
    } else {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: 'active' } : c))
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    padding: '5px 14px',
    borderRadius: 999,
    border: active ? '1px solid #1D9E75' : '1px solid rgba(0,0,0,0.12)',
    background: active ? '#1D9E75' : 'transparent',
    color: active ? '#fff' : '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.12s',
  })

  const totalLabel = statusFilter === 'active'
    ? `${contacts.length} contato(s) ativo(s)`
    : statusFilter === 'inactive'
    ? `${contacts.length} contato(s) inativo(s)`
    : `${contacts.length} contato(s) no total`

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 pb-2" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{totalLabel}</p>
          </div>
          <Button onClick={() => window.location.href = '/clientes/novo'} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo contato
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Busca */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato ou funerária..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Filtro de status */}
          <div className="flex items-center gap-2">
            <button style={tabStyle(statusFilter === 'active')} onClick={() => setStatusFilter('active')}>Ativos</button>
            <button style={tabStyle(statusFilter === 'inactive')} onClick={() => setStatusFilter('inactive')}>Inativos</button>
            <button style={tabStyle(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>Todos</button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Empresa</th>
                <th className="px-6 py-4 font-medium">WhatsApp</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Buscando contatos...</p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <User className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-lg font-medium text-foreground">Nenhum contato encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchTerm ? 'Tente buscar com outros termos.' : 'Cadastre o primeiro contato.'}
                    </p>
                  </td>
                </tr>
              ) : contacts.map(contact => (
                <tr
                  key={contact.id}
                  className="hover:bg-muted/50 transition-colors"
                  style={contact.status === 'inactive' ? { opacity: 0.55 } : {}}
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{contact.full_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">
                      {(contact.company as any)?.fantasy_name || (contact.company as any)?.corporate_name || '—'}
                    </p>
                    {contact.city && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📍 {contact.city}{contact.state ? `/${contact.state}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {contact.whatsapp ? (
                      <a
                        href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-emerald-600 hover:underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {contact.whatsapp}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {contact.status === 'inactive' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-red-500/15 text-red-400 border-red-500/30">Inativo</span>
                    ) : contact.status === 'prospect' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-blue-500/15 text-blue-400 border-blue-500/30">Prospect</span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {contact.status !== 'inactive' ? (
                        <button
                          onClick={() => handleInativar(contact)}
                          disabled={inativando === contact.id}
                          title="Inativar contato"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          {inativando === contact.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <UserX className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReativar(contact)}
                          disabled={inativando === contact.id}
                          title="Reativar contato"
                          className="text-xs px-2.5 py-1 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-40 font-medium"
                        >
                          {inativando === contact.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reativar'}
                        </button>
                      )}
                      <button
                        onClick={() => window.location.href = `/clientes/${contact.id}`}
                        title="Ver detalhes"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
