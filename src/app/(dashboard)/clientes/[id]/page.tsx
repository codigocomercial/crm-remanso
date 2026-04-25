'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, Save, Loader2, User, Phone,
  MapPin, RefreshCw, DollarSign, Building2
} from 'lucide-react'

interface Contact {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  job_title: string | null
  city: string | null
  state: string | null
  distance_km: number | null
  status: string
  notes: string | null
  reorder_cycle_days: number | null
  average_order_value: number | null
  customer_type: string | null
}

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadContact() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        setError('Cliente não encontrado')
      } else {
        setContact(data)
      }
      setLoading(false)
    }
    loadContact()
  }, [params.id])

  const handleChange = (field: keyof Contact, value: string | number | null) => {
    if (!contact) return
    setContact({ ...contact, [field]: value })
  }

  const handleSave = async () => {
    if (!contact) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('contacts')
      .update({
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        job_title: contact.job_title,
        city: contact.city,
        state: contact.state,
        distance_km: contact.distance_km,
        status: contact.status,
        notes: contact.notes,
        reorder_cycle_days: contact.reorder_cycle_days,
        average_order_value: contact.average_order_value,
        customer_type: contact.customer_type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)

    if (error) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push(`/clientes/${contact.id}`)
      }, 1000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Cliente não encontrado.
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Cliente</h1>
          <p className="text-sm text-muted-foreground">{contact.full_name}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          ✅ Salvo com sucesso! Redirecionando...
        </div>
      )}

      {/* Dados Básicos */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Dados da Funerária
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Nome completo *</Label>
            <Input
              className="mt-1.5"
              value={contact.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
            />
          </div>
          <div>
            <Label>Cargo / Função</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: Proprietário, Gerente"
              value={contact.job_title || ''}
              onChange={e => handleChange('job_title', e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              className="mt-1.5"
              type="email"
              placeholder="email@funeraria.com.br"
              value={contact.email || ''}
              onChange={e => handleChange('email', e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={contact.status}
              onValueChange={v => handleChange('status', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contato */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" />
          Contato
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Telefone</Label>
            <Input
              className="mt-1.5"
              placeholder="5577999991234"
              value={contact.phone || ''}
              onChange={e => handleChange('phone', e.target.value)}
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              className="mt-1.5"
              placeholder="5577999991234"
              value={contact.whatsapp || ''}
              onChange={e => handleChange('whatsapp', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Formato: 55 + DDD + número (ex: 5577999991234)
            </p>
          </div>
        </div>
      </div>

      {/* Localização */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Localização
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Label>Cidade</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: Vitória da Conquista"
              value={contact.city || ''}
              onChange={e => handleChange('city', e.target.value)}
            />
          </div>
          <div>
            <Label>Estado</Label>
            <Input
              className="mt-1.5"
              placeholder="BA"
              maxLength={2}
              value={contact.state || ''}
              onChange={e => handleChange('state', e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label>Distância da sede (km)</Label>
            <Input
              className="mt-1.5"
              type="number"
              placeholder="Ex: 150"
              value={contact.distance_km || ''}
              onChange={e => handleChange('distance_km', e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
        </div>
      </div>

      {/* Inteligência Comercial */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          Inteligência Comercial
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Ciclo de recompra (dias)</Label>
            <Input
              className="mt-1.5"
              type="number"
              placeholder="Ex: 30"
              value={contact.reorder_cycle_days || ''}
              onChange={e => handleChange('reorder_cycle_days', e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Ticket médio (R$)</Label>
            <Input
              className="mt-1.5"
              type="number"
              placeholder="Ex: 2500"
              value={contact.average_order_value || ''}
              onChange={e => handleChange('average_order_value', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Tipo de cliente</Label>
            <Select
              value={contact.customer_type || ''}
              onValueChange={v => handleChange('customer_type', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="funeraria">Funerária</SelectItem>
                <SelectItem value="plano">Plano Funerário</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Observações
        </h2>
        <Textarea
          placeholder="Informações adicionais sobre o cliente..."
          rows={4}
          value={contact.notes || ''}
          onChange={e => handleChange('notes', e.target.value)}
          className="resize-none"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3 justify-end pb-6">
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving || success}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Salvar alterações</>
          )}
        </Button>
      </div>
    </div>
  )
}