'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Calendar, DollarSign, MessageCircle, Phone, RefreshCw, Clock, CheckCircle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

interface Contact {
  id: string
  full_name: string
  phone: string | null
  whatsapp: string | null
  reorder_cycle_days: number | null
  next_followup_at: string | null
  average_order_value: number | null
  last_order_at: string | null
}

export default function RecompraAlertsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [reprogramando, setReprogramando] = useState<string | null>(null)
  const [diasInput, setDiasInput] = useState('15')
  const [salvando, setSalvando] = useState<string | null>(null)

  async function fetchAlerts() {
    setLoading(true)
    const supabase = createClient()
    const today = new Date().toISOString()

    const { data, error } = await supabase
      .schema('crm')
      .from('contacts')
      .select('id, full_name, phone, whatsapp, reorder_cycle_days, next_followup_at, average_order_value, last_order_at')
      .eq('org_id', ORG_ID)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', today)
      .order('next_followup_at', { ascending: true })

    if (!error && data) setContacts(data)
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  function getPhone(contact: Contact) {
    return contact.whatsapp || contact.phone || null
  }

  function formatWhatsAppLink(contact: Contact) {
    const num = getPhone(contact)
    if (!num) return '#'
    const clean = num.replace(/\D/g, '')
    const final = clean.length <= 11 ? `55${clean}` : clean
    return `https://wa.me/${final}`
  }

  function getLateDays(dateString: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(dateString); d.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  }

  async function reprogramar(contact: Contact) {
    const dias = parseInt(diasInput)
    if (!dias || dias < 1) return
    setSalvando(contact.id)
    const supabase = createClient()
    const novaData = new Date()
    novaData.setDate(novaData.getDate() + dias)

    const { error } = await supabase
      .schema('crm')
      .from('contacts')
      .update({
        next_followup_at: novaData.toISOString(),
        last_contact_at: new Date().toISOString()
      })
      .eq('id', contact.id)

    if (error) { alert(`Erro: ${error.message}`); setSalvando(null); return }
    setContacts(prev => prev.filter(c => c.id !== contact.id))
    setReprogramando(null)
    setSalvando(null)
  }

  async function fecharPedido(contact: Contact) {
    setSalvando(contact.id)
    const supabase = createClient()
    const hoje = new Date()
    const ciclo = contact.reorder_cycle_days || 90
    const proximoFollowup = new Date()
    proximoFollowup.setDate(hoje.getDate() + ciclo)

    const { error } = await supabase
      .schema('crm')
      .from('contacts')
      .update({
        last_order_at: hoje.toISOString(),
        next_followup_at: proximoFollowup.toISOString()
      })
      .eq('id', contact.id)

    if (error) { alert(`Erro: ${error.message}`); setSalvando(null); return }
    setContacts(prev => prev.filter(c => c.id !== contact.id))
    setSalvando(null)
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
          {[1,2,3,4,5,6].map(i => (
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
            Nenhum cliente está com previsão de recompra atrasada no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contacts.map(contact => {
            const diffDays = getLateDays(contact.next_followup_at!)
            const telefone = getPhone(contact)
            const isReprogramando = reprogramando === contact.id
            const isSalvando = salvando === contact.id

            return (
              <Card key={contact.id} className="flex flex-col border border-border/80 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-foreground truncate" title={contact.full_name}>
                        {contact.full_name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {telefone
                            ? telefone.replace(/\D/g, '').replace(/^55/, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
                            : 'Sem telefone'}
                        </span>
                      </div>
                    </div>
                    {diffDays >= 0 && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${diffDays === 0 ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {diffDays === 0 ? 'Hoje' : `${diffDays}d atrás`}
                      </span>
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

                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Previsto:</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(contact.next_followup_at!)}
                    </span>
                  </div>

                  {/* Painel de reprogramação inline */}
                  {isReprogramando && (
                    <div className="bg-muted/60 rounded-lg p-3 border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Ligar em quantos dias?</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={diasInput}
                          onChange={e => setDiasInput(e.target.value)}
                          className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                          placeholder="Ex: 15"
                        />
                        <Button
                          size="sm"
                          onClick={() => reprogramar(contact)}
                          disabled={isSalvando}
                          className="bg-primary text-white"
                        >
                          {isSalvando ? '...' : 'OK'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReprogramando(null)}
                          disabled={isSalvando}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-4 pb-5 px-5 border-t border-border/50 flex flex-col gap-2">
                  {/* Linha 1: WhatsApp + Reprogramar */}
                  <div className="flex gap-2 w-full">
                    {telefone ? (
                      <a
                        href={formatWhatsAppLink(contact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 shadow-sm transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <Button className="flex-1 bg-emerald-600 text-white opacity-50 cursor-not-allowed" disabled>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        S/ Número
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setReprogramando(isReprogramando ? null : contact.id); setDiasInput('15') }}
                      disabled={isSalvando}
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      Reprogramar
                    </Button>
                  </div>
                  {/* Linha 2: Pedido Fechado */}
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => fecharPedido(contact)}
                    disabled={isSalvando}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    {isSalvando ? 'Salvando...' : 'Pedido Fechado'}
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
