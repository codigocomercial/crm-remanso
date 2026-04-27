'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

interface Company { id: string; name: string }

export default function NovoContatoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])

  const [formData, setFormData] = useState({
    full_name: '',   // nome do contato (pessoa)
    company_name: '',   // nome da funerária (texto livre se não vincular)
    company_id: '',   // vincular a empresa existente
    phone: '',
    whatsapp: '',
    email: '',
    job_title: '',
    contact_role: 'compras',
    receive_campaigns: true,
    city: '',
    state: 'BA',
    distance_km: '',
    source: 'prospeccao',
    reorder_cycle_days: 90,
    average_order_value: '',
    notes: '',
  })

  // Carregar empresas para vincular
  useEffect(() => {
    supabase.from('companies').select('id, name')
      .eq('org_id', ORG_ID).order('name')
      .then(({ data }) => setCompanies(data ?? []))
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Quando seleciona empresa, preenche cidade/distância automaticamente
  async function handleCompanySelect(companyId: string) {
    setFormData(prev => ({ ...prev, company_id: companyId }))
    if (companyId) {
      const { data } = await supabase.from('companies')
        .select('city, state, distance_km, reorder_cycle_days')
        .eq('id', companyId).single()
      if (data) {
        setFormData(prev => ({
          ...prev,
          company_id: companyId,
          city: data.city ?? prev.city,
          state: data.state ?? prev.state,
          distance_km: data.distance_km ? String(data.distance_km) : prev.distance_km,
          reorder_cycle_days: data.reorder_cycle_days ?? prev.reorder_cycle_days,
        }))
      }
    }
  }

  function handleRoleChange(role: string) {
    setFormData(prev => ({
      ...prev,
      contact_role: role,
      receive_campaigns: role === 'compras',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.full_name.trim()) {
      setError('O nome do contato é obrigatório.')
      setLoading(false)
      return
    }

    const payload: any = {
      org_id: ORG_ID,
      full_name: formData.full_name.trim(),
      phone: formData.phone || null,
      whatsapp: formData.whatsapp || null,
      email: formData.email || null,
      job_title: formData.job_title || null,
      contact_role: formData.contact_role,
      receive_campaigns: formData.receive_campaigns,
      city: formData.city || null,
      state: formData.state || null,
      distance_km: formData.distance_km ? parseInt(formData.distance_km) : null,
      source: formData.source,
      reorder_cycle_days: formData.reorder_cycle_days,
      average_order_value: formData.average_order_value
        ? parseFloat(formData.average_order_value.replace(',', '.')) : null,
      notes: formData.notes || null,
      status: 'active',
      next_followup_at: new Date(
        Date.now() + formData.reorder_cycle_days * 86400000
      ).toISOString(),
    }

    // Vincular empresa se selecionada
    if (formData.company_id) payload.company_id = formData.company_id

    const { error: insertError } = await supabase.from('contacts').insert([payload])

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      router.push('/clientes')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Link href="/clientes"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            Cadastrar Novo Contato
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adicione um contato e vincule-o a uma funerária
          </p>
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

            {/* ── Dados do contato ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Dados do Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Nome do contato */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="full_name">
                    Nome do Contato <span className="text-red-500">*</span>
                  </Label>
                  <Input id="full_name" name="full_name"
                    placeholder="Ex: João Silva"
                    value={formData.full_name} onChange={handleChange} required />
                </div>

                {/* Cargo */}
                <div className="space-y-2">
                  <Label htmlFor="job_title">Cargo</Label>
                  <Input id="job_title" name="job_title"
                    placeholder="Ex: Gerente de Compras"
                    value={formData.job_title} onChange={handleChange} />
                </div>

                {/* Papel na empresa */}
                <div className="space-y-2">
                  <Label>Papel na empresa</Label>
                  <Select value={formData.contact_role} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compras">🛒 Compras — recebe campanhas</SelectItem>
                      <SelectItem value="financeiro">💰 Financeiro</SelectItem>
                      <SelectItem value="diretor">👔 Diretor / Sócio</SelectItem>
                      <SelectItem value="operacional">⚙️ Operacional</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.contact_role === 'compras' && (
                    <p className="text-xs font-medium" style={{ color: 'var(--brand-teal)' }}>
                      ✓ Este contato receberá as campanhas de WhatsApp
                    </p>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" name="phone"
                    placeholder="(77) 0000-0000"
                    value={formData.phone} onChange={handleChange} />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" name="whatsapp"
                    placeholder="(77) 90000-0000"
                    value={formData.whatsapp} onChange={handleChange} />
                </div>

                {/* Email */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email"
                    placeholder="contato@funeraria.com"
                    value={formData.email} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* ── Empresa ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Empresa (Funerária)
              </h3>

              {/* Vincular empresa existente */}
              <div className="space-y-2">
                <Label>Vincular a empresa cadastrada</Label>
                <Select value={formData.company_id} onValueChange={handleCompanySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sem empresa vinculada —</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ao vincular, cidade e distância são preenchidos automaticamente.{' '}
                  <Link href="/empresas/nova" className="underline" style={{ color: 'var(--brand-teal)' }}>
                    Cadastrar nova empresa
                  </Link>
                </p>
              </div>
            </div>

            {/* ── Localização ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Localização e Origem
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" placeholder="Ex: Jequié"
                    value={formData.city} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input id="state" name="state" placeholder="BA" maxLength={2}
                    value={formData.state} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance_km">📍 Distância da Fábrica (km)</Label>
                  <Input id="distance_km" name="distance_km" type="number" placeholder="Ex: 150"
                    value={formData.distance_km} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">
                    Usado para filtrar campanhas por raio.
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Origem</Label>
                  <Select value={formData.source}
                    onValueChange={val => setFormData(p => ({ ...p, source: val }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="prospeccao">Prospecção Ativa</SelectItem>
                      <SelectItem value="instagram">Redes Sociais</SelectItem>
                      <SelectItem value="bling">Bling (importado)</SelectItem>
                      <SelectItem value="manual">Manual / Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Comportamento de compra ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Comportamento de Compra
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reorder_cycle_days">Ciclo de Recompra (dias)</Label>
                  <Input id="reorder_cycle_days" name="reorder_cycle_days" type="number"
                    value={formData.reorder_cycle_days} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">
                    Tempo médio entre uma compra e outra.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="average_order_value">Ticket Médio Estimado (R$)</Label>
                  <Input id="average_order_value" name="average_order_value"
                    type="number" step="0.01" placeholder="Ex: 5500.00"
                    value={formData.average_order_value} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* ── Notas ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Anotações
              </h3>
              <textarea name="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Informações adicionais..."
                value={formData.notes} onChange={handleChange} />
            </div>

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
              <Button type="button" variant="outline">
                <Link href="/clientes">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={loading} className="px-8 font-medium">
                {loading
                  ? <><span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Salvando...</>
                  : <><Save className="w-4 h-4 mr-2" />Salvar Contato</>
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}