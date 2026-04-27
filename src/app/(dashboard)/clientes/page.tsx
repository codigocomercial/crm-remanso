'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, Plus, ArrowRight, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Contact {
  id: string
  full_name: string
  phone: string | null
  city: string | null
  org_id?: string
  contact_role: string | null
  receive_campaigns: boolean
  reorder_cycle_days: number | null
  next_followup_at: string | null
  average_order_value: number | null
  companies?: { name: string }[] | null
}

const ROLE_LABELS: Record<string, string> = {
  compras: 'Compras',
  financeiro: 'Financeiro',
  diretor: 'Diretor',
  operacional: 'Operacional',
  outro: 'Outro',
}

export default function ClientesPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function loadContacts() {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('contacts')
        .select('id, full_name, phone, city, contact_role, receive_campaigns, reorder_cycle_days, next_followup_at, average_order_value, companies(name)')
        .order('full_name', { ascending: true })

      if (searchTerm) {
        query = query.ilike('full_name', `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (!error && data) {
        setContacts(data)
      }
      setLoading(false)
    }

    // Debounce na busca
    const timeout = setTimeout(loadContacts, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  function getReorderStatus(nextFollowupAt: string | null) {
    if (!nextFollowupAt) return { label: 'Não agendado', variant: 'secondary' as const }

    // Zera os horários para comparar apenas os dias
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const followupDate = new Date(nextFollowupAt)
    followupDate.setHours(0, 0, 0, 0)

    const isLate = followupDate < today
    // if today === followup, it's ok, user still has the day to handle

    return {
      label: isLate ? 'Atrasado' : 'OK',
      variant: isLate ? 'destructive' as const : 'default' as const
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus clientes e acompanhe as recompras</p>
        </div>
        <Button>
          <Link href="/clientes/novo" className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Novo cliente
          </Link>
        </Button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes por nome..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Nome / Cidade</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Ciclo / Ticket Médio</th>
                <th className="px-6 py-4 font-medium">Status da Recompra</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Buscando clientes...</p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <User className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-lg font-medium text-foreground">Nenhum cliente encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchTerm ? 'Tente buscar com outros termos.' : 'Comece cadastrando seu primeiro cliente.'}
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const status = getReorderStatus(contact.next_followup_at)
                  return (
                    <tr key={contact.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{contact.full_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{contact.city || 'Sem cidade'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-foreground">{contact.phone || '—'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-foreground">{contact.reorder_cycle_days ? `${contact.reorder_cycle_days} dias` : '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {contact.average_order_value ? formatCurrency(contact.average_order_value) : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                          {contact.next_followup_at && (
                            <span className="text-[11px] text-muted-foreground">
                              Previsto: {formatDate(contact.next_followup_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Link href={`/clientes/${contact.id}`}>
                            Ver detalhes
                            <ArrowRight className="ml-2 w-4 h-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}