'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Calendar, DollarSign, MessageCircle, Phone, RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Contact {
  id: string
  full_name: string
  phone: string | null
  reorder_cycle_days: number | null
  next_followup_at: string | null
  average_order_value: number | null
}

export default function RecompraAlertsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAlerts() {
      setLoading(true)
      const supabase = createClient()
      const today = new Date().toISOString()
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, reorder_cycle_days, next_followup_at, average_order_value')
        .not('next_followup_at', 'is', null)
        .lte('next_followup_at', today)
        .order('next_followup_at', { ascending: true })

      if (!error && data) {
        setContacts(data)
      }
      setLoading(false)
    }

    fetchAlerts()
  }, [])

  function formatWhatsAppLink(phone: string | null) {
    if (!phone) return '#'
    const cleanNumber = phone.replace(/\D/g, '')
    if (!cleanNumber) return '#'
    // Adiciona DDI 55 se o número tiver apenas DDD + Número (10 ou 11 dígitos)
    const finalNumber = cleanNumber.length <= 11 ? `55${cleanNumber}` : cleanNumber
    return `https://wa.me/${finalNumber}`
  }

  function getLateDays(dateString: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const followupDate = new Date(dateString)
    followupDate.setHours(0, 0, 0, 0)
    
    const diffTime = today.getTime() - followupDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-primary" />
            Alertas de Recompra
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clientes que já deveriam ter realizado um novo pedido
          </p>
        </div>
        {!loading && contacts.length > 0 && (
          <div className="bg-amber-100 text-amber-800 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4" />
            {contacts.length} {contacts.length === 1 ? 'cliente precisa' : 'clientes precisam'} de atenção
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="min-h-[88px] bg-muted/20" />
              <CardContent className="h-32 bg-muted/10" />
            </Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm flex-1">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Tudo em dia!</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Nenhum cliente está com previsão de recompra atrasada no momento. Bom trabalho!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contacts.map((contact) => {
            const diffDays = getLateDays(contact.next_followup_at!)
            
            return (
              <Card key={contact.id} className="flex flex-col border border-border/80 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-foreground truncate" title={contact.full_name}>
                        {contact.full_name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="truncate">{contact.phone || 'Sem telefone'}</span>
                      </div>
                    </div>
                    {diffDays >= 0 && (
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${diffDays === 0 ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                          {diffDays === 0 ? 'Para hoje' : `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} atrás`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-primary/10 p-1.5 rounded-lg text-primary">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Ciclo</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {contact.reorder_cycle_days ? `${contact.reorder_cycle_days} dias` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-primary/10 p-1.5 rounded-lg text-primary">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Ticket Méd.</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {contact.average_order_value ? formatCurrency(contact.average_order_value) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                       <Clock className="w-4 h-4 text-muted-foreground" />
                       <span className="text-xs font-medium text-muted-foreground">Data prevista:</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(contact.next_followup_at!)}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 pb-5 px-5 border-t border-border/50 gap-3">
                  <Button variant="outline" className="flex-1">
                     <a href={`/clientes/${contact.id}`}>Ver Perfil</a>
                  </Button>
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" 
                    disabled={!contact.phone}
                  >
                    {contact.phone ? (
                      <a 
                        href={formatWhatsAppLink(contact.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chamar
                      </a>
                    ) : (
                      <span className="opacity-50 cursor-not-allowed flex items-center justify-center w-full">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        S/ Número
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
