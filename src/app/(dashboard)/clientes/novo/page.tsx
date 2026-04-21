'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Save, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    city: '',
    state: '',
    source: 'prospeccao',
    reorder_cycle_days: 90,
    average_order_value: '',
    notes: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (!formData.full_name.trim()) {
      setError('O nome da empresa/parceiro é obrigatório.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    
    // Converte average_order_value pra numérico ou null se vazio
    const parsedAOV = formData.average_order_value 
      ? parseFloat(formData.average_order_value.replace(',', '.')) 
      : null

    const payload = {
      full_name: formData.full_name,
      phone: formData.phone || null,
      whatsapp: formData.whatsapp || null,
      email: formData.email || null,
      city: formData.city || null,
      state: formData.state || null,
      source: formData.source,
      reorder_cycle_days: formData.reorder_cycle_days,
      average_order_value: parsedAOV,
      notes: formData.notes || null,
      org_id: '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2',
      next_followup_at: new Date(Date.now() + formData.reorder_cycle_days * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: insertError } = await supabase.from('contacts').insert([payload])

    if (insertError) {
      console.error(insertError)
      setError(insertError.message || 'Erro ao salvar cliente. Verifique os dados.')
      setLoading(false)
    } else {
      router.push('/clientes')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Link href="/clientes">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            Cadastrar Novo Cliente
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mapeie dados da funerária no CRM Urnas Remanso</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive text-sm font-medium rounded-lg">
                {error}
              </div>
            )}

            {/* Sessão: Dados principais */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">Dados Principais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="full_name">Nome da Empresa / Parceiro <span className="text-red-500">*</span></Label>
                  <Input 
                    id="full_name" name="full_name" 
                    placeholder="Ex: Funerária Nova Vida"
                    value={formData.full_name} onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone de Contato</Label>
                  <Input 
                    id="phone" name="phone" 
                    placeholder="(00) 0000-0000"
                    value={formData.phone} onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Direto</Label>
                  <Input 
                    id="whatsapp" name="whatsapp" 
                    placeholder="(00) 90000-0000"
                    value={formData.whatsapp} onChange={handleChange}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input 
                    id="email" name="email" type="email"
                    placeholder="contato@empresa.com"
                    value={formData.email} onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Sessão: Localização  */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">Localização e Origem</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input 
                    id="city" name="city" 
                    placeholder="Ex: São Paulo"
                    value={formData.city} onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input 
                    id="state" name="state" 
                    placeholder="Ex: SP" maxLength={2}
                    value={formData.state} onChange={handleChange}
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>Modo de Aquisição (Origem)</Label>
                  <Select 
                    value={formData.source} 
                    onValueChange={(val) => setFormData(p => ({ ...p, source: val || '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp Direct</SelectItem>
                      <SelectItem value="indicacao">Indicação Reversa</SelectItem>
                      <SelectItem value="prospeccao">Outbound / Prospecção Ativa</SelectItem>
                      <SelectItem value="instagram">Redes Sociais (Insta/Meta)</SelectItem>
                      <SelectItem value="manual">Manual / Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sessão: Inteligência de Negócio */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">Comportamento de Compra</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reorder_cycle_days">Ciclo de Recompra (Dias)</Label>
                  <Input 
                    id="reorder_cycle_days" name="reorder_cycle_days" type="number"
                    value={formData.reorder_cycle_days} 
                    onChange={handleChange}
                  />
                  <p className="text-xs text-muted-foreground">Tempo médio entre uma compra de urnas e outra.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="average_order_value">Ticket Médio Estimado (R$)</Label>
                  <Input 
                    id="average_order_value" name="average_order_value" type="number" step="0.01"
                    placeholder="Ex: 5500.00"
                    value={formData.average_order_value} onChange={handleChange}
                  />
                  <p className="text-xs text-muted-foreground">Pode ser atualizado conforme faturamento futuro.</p>
                </div>
              </div>
            </div>

            {/* Sessão: Notas */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">Anotações Internas</h3>
              <div className="space-y-2">
                <textarea 
                  name="notes"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Informações adicionais do cliente..."
                  value={formData.notes} onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
              <Button type="button" variant="outline">
                <Link href="/clientes">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={loading} className="px-8 font-medium">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Cliente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
