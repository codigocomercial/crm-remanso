'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, Plus, ArrowRight, User, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Contact {
  id: string
  full_name: string
  whatsapp: string | null
  company: { corporate_name: string; fantasy_name: string | null } | null
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .schema('crm')
        .from('contacts')
        .select('id, full_name, whatsapp, company:crm_companies(corporate_name, fantasy_name)')
        .order('full_name', { ascending: true })
      if (searchTerm) query = query.ilike('full_name', `%${searchTerm}%`)
      const { data } = await query
      setContacts((data as any) ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 pb-2" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{contacts.length} contato(s) cadastrado(s)</p>
          </div>
          <Button onClick={() => window.location.href = '/clientes/novo'} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo contato
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
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
                <th className="px-6 py-4 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Buscando contatos...</p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <User className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-lg font-medium text-foreground">Nenhum contato encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchTerm ? 'Tente buscar com outros termos.' : 'Cadastre o primeiro contato.'}
                    </p>
                  </td>
                </tr>
              ) : contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{contact.full_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-foreground">
                      {(contact.company as any)?.fantasy_name || (contact.company as any)?.corporate_name || '—'}
                    </p>
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
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = `/clientes/${contact.id}`} className="flex items-center gap-1">
                      Ver detalhes
                      <ArrowRight className="w-4 h-4" />
                    </Button>
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