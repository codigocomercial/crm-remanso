'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, MessageCircle, Phone, Search, Loader2, Mail, ArrowRight, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Interaction {
  id: string
  type: string
  content: string
  created_at: string
  contacts: {
    id: string
    full_name: string
  } | null
}

const TYPE_CONFIG: Record<string, { label: string, color: string, icon: React.ElementType }> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: MessageCircle },
  call: { label: 'Ligação', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Phone },
  email: { label: 'E-mail', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Mail },
  note: { label: 'Anotação', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText },
}

export default function AtendimentosPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    async function loadInteractions() {
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('interactions')
        .select(`
          id, type, content, created_at,
          contacts ( id, full_name )
        `)
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.ilike('content', `%${searchTerm}%`)
      }

      if (typeFilter && typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }

      const { data, error } = await query

      if (!error && data) {
        setInteractions(data as any)
      }
      setLoading(false)
    }

    const timeout = setTimeout(loadInteractions, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm, typeFilter])

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Central de Atendimentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Histórico global de contatos, ligações e anotações do sistema.</p>
        </div>
      </div>

      {/* Toolbar / Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar por trechos de conversa ou anotação..." 
            className="pl-9 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[220px]">
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Filtrar por canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas os Canais</SelectItem>
              <SelectItem value="whatsapp">Apenas WhatsApp</SelectItem>
              <SelectItem value="call">Apenas Ligações</SelectItem>
              <SelectItem value="email">Apenas E-mails</SelectItem>
              <SelectItem value="note">Anotações Internas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center h-[400px]">
             <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50 mb-4" />
             <p className="text-muted-foreground text-sm">Carregando histórico unificado...</p>
          </div>
        ) : interactions.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center h-[400px]">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
               <Activity className="w-8 h-8 text-muted-foreground/50" />
             </div>
             <p className="text-lg font-medium text-foreground">Nenhum registro encontrado</p>
             <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                {searchTerm || typeFilter !== 'all' 
                  ? 'Nenhuma interação condiz com os filtros atuais aplicados.'
                  : 'Sua base de histórico de clientes ainda está vazia.'}
             </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {interactions.map(interaction => {
              const config = TYPE_CONFIG[interaction.type] || TYPE_CONFIG.note
              const IconItem = config.icon

              return (
                <div key={interaction.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors flex items-start gap-4">
                  <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${config.color}`}>
                    <IconItem className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        {interaction.contacts ? (
                          <Link href={`/clientes/${interaction.contacts.id}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate">
                            {interaction.contacts.full_name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-muted-foreground">Cliente Desconhecido</span>
                        )}
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${config.color} opacity-80 shrink-0`}>
                          {config.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium shrink-0">
                        {formatDate(interaction.created_at)}
                      </span>
                    </div>

                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                       {interaction.content}
                    </p>
                    
                    {interaction.contacts && (
                      <div className="mt-3">
                         <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-0">
                           <Link href={`/clientes/${interaction.contacts.id}`} className="flex items-center">
                             Ver dossiê do cliente <ArrowRight className="w-3 h-3 ml-1" />
                           </Link>
                         </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
