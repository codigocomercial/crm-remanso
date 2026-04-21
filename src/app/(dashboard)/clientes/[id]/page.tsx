'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, MessageCircle, Phone, FileText, Send, Building, MapPin, DollarSign, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Contact {
  id: string
  full_name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  city: string | null
  state: string | null
  source: string | null
  reorder_cycle_days: number | null
  average_order_value: number | null
  next_followup_at: string | null
  notes: string | null
}

interface Interaction {
  id: string
  type: string
  content: string
  created_at: string
}

export default function ClienteDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Contact | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])

  // Interaction Form State
  const [interactLoading, setInteractLoading] = useState(false)
  const [interactionType, setInteractionType] = useState('note')
  const [interactionContent, setInteractionContent] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!id) return
      
      const supabase = createClient()
      const [clientRes, interactRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('id', id).single(),
        supabase.from('interactions').select('*').eq('contact_id', id).order('created_at', { ascending: false })
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (interactRes.data) setInteractions(interactRes.data)
      
      setLoading(false)
    }
    loadData()
  }, [id])

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault()
    if (!interactionContent.trim() || !id) return

    setInteractLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase.from('interactions').insert([{
      contact_id: id,
      type: interactionType,
      content: interactionContent,
      org_id: '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'
    }]).select().single()

    if (error) {
      console.error('Erro ao inserir interação:', error)
    }

    if (!error && data) {
      // Atualiza a lista atual imediatamente e reseta o formulário
      setInteractions(prev => [data, ...prev])
      setInteractionContent('')
      
      // Um side-effect legal é atualizar o next_followup_at do contato pra frente
      // pois se teve interação, ele recomeça o ciclo!
      if (client?.reorder_cycle_days) {
        const nextDate = new Date(Date.now() + client.reorder_cycle_days * 24 * 60 * 60 * 1000).toISOString()
        await supabase.from('contacts').update({ next_followup_at: nextDate }).eq('id', id)
        setClient(prev => prev ? { ...prev, next_followup_at: nextDate } : prev)
      }
    }
    setInteractLoading(false)
  }

  function getWhatsAppUrl(phone: string | null) {
    if (!phone) return '#'
    const num = phone.replace(/\D/g, '')
    return `https://wa.me/${num.length <= 11 ? '55' + num : num}`
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
        <Building className="w-12 h-12 mb-4 opacity-20" />
        <h2 className="text-xl text-foreground font-semibold">Cliente não encontrado</h2>
        <Button className="mt-4" onClick={() => router.push('/clientes')}>Voltar para Listagem</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Link href="/clientes">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
               {client.full_name}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
               {client.source && <span className="uppercase text-[10px] mr-2 bg-muted px-2 py-0.5 rounded text-foreground">{client.source}</span>}
               Cadastrado como cliente ativo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Editar Ciclo</Button>
            <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                disabled={!(client.whatsapp || client.phone)}
            >
              {(client.whatsapp || client.phone) ? (
                <a href={getWhatsAppUrl(client.whatsapp || client.phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
                </a>
              ) : (
                <span><MessageCircle className="w-4 h-4 mr-2" />Sem Contato</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo: Info */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/50">
              <h3 className="font-semibold text-sm">Dados da Funerária</h3>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
               <div>
                 <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center"><Phone className="w-3 h-3 mr-1"/>Contato Base</p>
                 <p className="text-sm font-medium">{client.phone || client.whatsapp || 'Não informado'}</p>
                 {client.email && <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>}
               </div>
               <div>
                 <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/>Endereço</p>
                 <p className="text-sm font-medium">{client.city ? `${client.city} - ${client.state || ''}` : 'Não informado'}</p>
               </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/50">
              <h3 className="font-semibold text-sm">Inteligência Comercial</h3>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
               <div>
                 <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center"><CalendarClock className="w-3 h-3 mr-1"/>Padrão de Recompra</p>
                 <p className="text-sm font-medium flex items-center justify-between">
                    Ciclo de {client.reorder_cycle_days || 90} dias
                 </p>
                 <p className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-1 rounded inline-block mt-2">
                    Previsto: {client.next_followup_at ? formatDate(client.next_followup_at) : 'Sem previsão'}
                 </p>
               </div>
               <div>
                 <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center"><DollarSign className="w-3 h-3 mr-1"/>Ticket Médio</p>
                 <p className="text-lg font-bold text-primary">{client.average_order_value ? formatCurrency(client.average_order_value) : '—'}</p>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Linha do Tempo e Interações */}
        <div className="space-y-6 lg:col-span-2">
           <Card className="border-border shadow-sm flex flex-col h-[calc(100vh-[14rem])] min-h-[500px]">
              <CardHeader className="bg-muted/10 pb-4 border-b border-border/50">
                 <h3 className="font-semibold text-sm">Registro de Interações</h3>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto pt-6 space-y-6">
                {interactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground">
                    <MessageCircle className="w-10 h-10 opacity-20 mb-3" />
                    <p className="text-base font-medium">Nenhum histórico</p>
                    <p className="text-sm">Registre o primeiro contato, ligação ou uma anotação desta empresa abaixo.</p>
                  </div>
                ) : (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {interactions.map((interaction) => (
                      <div key={interaction.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon Marker */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          {interaction.type === 'whatsapp' && <MessageCircle className="w-4 h-4 text-emerald-500" />}
                          {interaction.type === 'call' && <Phone className="w-4 h-4 text-blue-500" />}
                          {interaction.type === 'note' && <FileText className="w-4 h-4 text-amber-500" />}
                        </div>
                        {/* Card Content */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card border border-border p-4 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">{interaction.type === 'note' ? 'Anotação Interna' : (interaction.type === 'whatsapp' ? 'WhatsApp Direct' : 'Ligação Efetuada')}</h4>
                            <span className="text-xs text-muted-foreground font-medium">{formatDate(interaction.created_at)}</span>
                          </div>
                          <p className="text-sm text-foreground/80 mt-2">
                             {interaction.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              {/* Interaction Form Box */}
              <div className="p-4 border-t border-border bg-muted/30 mt-auto rounded-b-xl">
                 <form onSubmit={handleAddInteraction} className="flex items-start gap-3">
                    <Select value={interactionType} onValueChange={(val) => setInteractionType(val || 'note')}>
                      <SelectTrigger className="w-[140px] bg-background">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Anotação Interna</SelectItem>
                        <SelectItem value="whatsapp">Abordagem Whatsapp</SelectItem>
                        <SelectItem value="call">Ligação Fria</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex-1 flex items-end gap-2 relative">
                      <Input 
                        placeholder={interactionType === 'note' ? 'Reuniu diretoria e fechou urna...' : 'Escreva um resumo do que foi dito...'}
                        className="flex-1 bg-background"
                        value={interactionContent}
                        onChange={e => setInteractionContent(e.target.value)}
                        required
                      />
                      <Button type="submit" disabled={interactLoading} size="icon" className="flex-shrink-0">
                         {interactLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/> }
                      </Button>
                    </div>
                 </form>
              </div>
           </Card>
        </div>
      </div>
    </div>
  )
}
