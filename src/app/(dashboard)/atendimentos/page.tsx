'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Headset, MessageCircle, Phone, Mail, Plus, Search, X,
  CheckCircle, Clock, Loader2, ListChecks, PencilLine, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface FilaItem {
  key: string
  source: 'manual' | 'recompra'
  fila_id?: string
  contact_id: string
  company_id?: string | null
  nome: string
  company_name?: string | null
  telefone: string | null
  motivo?: string | null
  next_followup_at?: string | null
  last_order_at?: string | null
  reorder_cycle_days?: number | null
}

interface AtendimentoHoje {
  id: string
  contact_name: string | null
  company_name: string | null
  canal: string
  resultado: string
  anotacao: string | null
  created_at: string
}

interface ContatoBusca {
  id: string
  full_name: string
  whatsapp: string | null
  phone: string | null
  company_id: string | null
  reorder_cycle_days: number | null
}

const RESULTADOS = [
  { value: 'interessado',    label: 'Interessado' },
  { value: 'pedido_fechado', label: 'Pedido fechado' },
  { value: 'retornar',       label: 'Retornar depois' },
  { value: 'sem_resposta',   label: 'Sem resposta' },
  { value: 'sem_interesse',  label: 'Sem interesse' },
]

const RESULTADO_LABEL: Record<string, string> = Object.fromEntries(
  RESULTADOS.map(r => [r.value, r.label])
)

const CANAIS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'ligacao',  label: 'Ligação',  icon: Phone },
  { value: 'email',    label: 'E-mail',   icon: Mail },
]

export default function AtendimentosPage() {
  const [fila, setFila] = useState<FilaItem[]>([])
  const [hoje, setHoje] = useState<AtendimentoHoje[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [diaAtual, setDiaAtual] = useState(() => new Date().toISOString().slice(0, 10))

  // Registro
  const [selecionado, setSelecionado] = useState<FilaItem | null>(null)
  const [canal, setCanal] = useState('whatsapp')
  const [resultado, setResultado] = useState('interessado')
  const [anotacao, setAnotacao] = useState('')
  const [diasProximo, setDiasProximo] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Adicionar à fila
  const [modalFila, setModalFila] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<ContatoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [contatoEscolhido, setContatoEscolhido] = useState<ContatoBusca | null>(null)
  const [motivoFila, setMotivoFila] = useState('')
  const [salvandoFila, setSalvandoFila] = useState(false)

  // ── Carregamento ──────────────────────────────────────────────────────────
  async function carregar() {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const agora = new Date().toISOString()
    const hojeStr = new Date().toISOString().slice(0, 10)

    const inicioDia = new Date(diaAtual); inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(diaAtual); fimDia.setHours(23, 59, 59, 999)

    const [filaManualRes, recompraRes, hojeRes] = await Promise.all([
      supabase
        .from('crm_atendimento_fila')
        .select('id, contact_id, company_id, motivo, contact_name, contact_whatsapp, contact_phone, next_followup_at, last_order_at, company_name')
        .eq('concluido', false)
        .lte('data_alvo', hojeStr)
        .order('created_at', { ascending: true }),
      supabase
        .schema('crm')
        .from('contacts')
        .select('id, company_id, full_name, phone, whatsapp, next_followup_at, last_order_at, reorder_cycle_days, companies(fantasy_name, corporate_name)')
        .eq('org_id', ORG_ID)
        .not('next_followup_at', 'is', null)
        .lte('next_followup_at', agora)
        .order('next_followup_at', { ascending: true }),
      supabase
        .from('crm_atendimentos')
        .select('id, contact_name, company_name, canal, resultado, anotacao, created_at')
        .gte('created_at', inicioDia.toISOString())
        .lte('created_at', fimDia.toISOString())
        .order('created_at', { ascending: false }),
    ])

    const manuais: FilaItem[] = (filaManualRes.data || []).map((f: any) => ({
      key: `m-${f.id}`,
      source: 'manual',
      fila_id: f.id,
      contact_id: f.contact_id,
      company_id: f.company_id,
      nome: f.contact_name || 'Sem nome',
      company_name: f.company_name || null,
      telefone: f.contact_whatsapp || f.contact_phone || null,
      motivo: f.motivo,
      next_followup_at: f.next_followup_at,
      last_order_at: f.last_order_at,
    }))

    const idsManuais = new Set(manuais.map(m => m.contact_id))

    const recompra: FilaItem[] = (recompraRes.data || [])
      .filter((c: any) => !idsManuais.has(c.id))
      .map((c: any) => ({
        key: `r-${c.id}`,
        source: 'recompra',
        contact_id: c.id,
        company_id: c.company_id,
        nome: c.full_name || 'Sem nome',
        company_name: c.companies
          ? (c.companies.fantasy_name || c.companies.corporate_name || null)
          : null,
        telefone: c.whatsapp || c.phone || null,
        next_followup_at: c.next_followup_at,
        last_order_at: c.last_order_at,
        reorder_cycle_days: c.reorder_cycle_days,
      }))

    setFila([...manuais, ...recompra])
    setHoje((hojeRes.data as AtendimentoHoje[]) || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [diaAtual])

  // ── Busca de contatos (modal fila) ───────────────────────────────────────
  useEffect(() => {
    if (!modalFila || busca.trim().length < 2) { setResultadosBusca([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase
        .schema('crm')
        .from('contacts')
        .select('id, full_name, whatsapp, phone, company_id, reorder_cycle_days')
        .eq('org_id', ORG_ID)
        .ilike('full_name', `%${busca.trim()}%`)
        .limit(8)
      setResultadosBusca((data as ContatoBusca[]) || [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, modalFila])

  // ── Ações ─────────────────────────────────────────────────────────────────
  function selecionar(item: FilaItem) {
    setSelecionado(item)
    setCanal('whatsapp')
    setResultado('interessado')
    setAnotacao('')
    setDiasProximo('')
  }

  async function salvarAtendimento() {
    if (!selecionado || !userId) return
    setSalvando(true)
    const supabase = createClient()

    const dias = parseInt(diasProximo)
    let proximoContato: Date | null = null
    if (dias && dias > 0) {
      proximoContato = new Date()
      proximoContato.setDate(proximoContato.getDate() + dias)
    } else if (resultado === 'pedido_fechado') {
      proximoContato = new Date()
      proximoContato.setDate(proximoContato.getDate() + (selecionado.reorder_cycle_days || 90))
    }

    const { error } = await supabase
      .schema('crm')
      .from('atendimentos')
      .insert({
        org_id: ORG_ID,
        contact_id: selecionado.contact_id,
        company_id: selecionado.company_id || null,
        user_id: userId,
        canal,
        resultado,
        anotacao: anotacao.trim() || null,
        proximo_contato: proximoContato ? proximoContato.toISOString().slice(0, 10) : null,
      })

    if (error) { alert(`Erro: ${error.message}`); setSalvando(false); return }

    // Atualiza o contato (alimenta o Recompra)
    const updateContato: Record<string, any> = { last_contact_at: new Date().toISOString() }
    if (proximoContato) updateContato.next_followup_at = proximoContato.toISOString()
    if (resultado === 'pedido_fechado') updateContato.last_order_at = new Date().toISOString()

    await supabase
      .schema('crm')
      .from('contacts')
      .update(updateContato)
      .eq('id', selecionado.contact_id)

    // Conclui item manual da fila
    if (selecionado.source === 'manual' && selecionado.fila_id) {
      await supabase
        .schema('crm')
        .from('atendimento_fila')
        .update({ concluido: true })
        .eq('id', selecionado.fila_id)
    }

    setFila(prev => prev.filter(i => i.key !== selecionado.key))
    setHoje(prev => [{
      id: crypto.randomUUID(),
      contact_name: selecionado.nome,
      company_name: selecionado.company_name || null,
      canal,
      resultado,
      anotacao: anotacao.trim() || null,
      created_at: new Date().toISOString(),
    }, ...prev])
    setSelecionado(null)
    setSalvando(false)
  }

  async function adicionarFila() {
    if (!contatoEscolhido || !userId) return
    setSalvandoFila(true)
    const supabase = createClient()

    const { error } = await supabase
      .schema('crm')
      .from('atendimento_fila')
      .insert({
        org_id: ORG_ID,
        contact_id: contatoEscolhido.id,
        company_id: contatoEscolhido.company_id || null,
        motivo: motivoFila.trim() || null,
        created_by: userId,
      })

    if (error) { alert(`Erro: ${error.message}`); setSalvandoFila(false); return }

    setModalFila(false)
    setBusca('')
    setContatoEscolhido(null)
    setMotivoFila('')
    setSalvandoFila(false)
    carregar()
  }

  async function removerDaFila(item: FilaItem) {
    if (item.source !== 'manual' || !item.fila_id) return
    const supabase = createClient()
    await supabase.schema('crm').from('atendimento_fila').delete().eq('id', item.fila_id)
    setFila(prev => prev.filter(i => i.key !== item.key))
    if (selecionado?.key === item.key) setSelecionado(null)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatTelefone(num: string | null) {
    if (!num) return 'Sem telefone'
    return num.replace(/\D/g, '').replace(/^55/, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
  }

  function whatsappLink(num: string | null) {
    if (!num) return '#'
    const clean = num.replace(/\D/g, '')
    return `https://wa.me/${clean.length <= 11 ? `55${clean}` : clean}`
  }

  function diasAtraso(dateString?: string | null) {
    if (!dateString) return null
    const t = new Date(); t.setHours(0, 0, 0, 0)
    const d = new Date(dateString); d.setHours(0, 0, 0, 0)
    return Math.floor((t.getTime() - d.getTime()) / 86400000)
  }

  const responderam = hoje.filter(a => a.resultado !== 'sem_resposta').length
  const pedidos = hoje.filter(a => a.resultado === 'pedido_fechado').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Headset className="w-6 h-6 text-primary" />
            Central de Atendimentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fila do dia e diário de contatos com clientes
          </p>
        </div>
        <Button onClick={() => setModalFila(true)} className="bg-primary text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Adicionar à fila
        </Button>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Contatos hoje</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{hoje.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Responderam</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{responderam}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Pedidos gerados</p>
          <p className="text-2xl font-semibold text-emerald-500 mt-1">{pedidos}</p>
        </div>
      </div>

      {/* Fila + Registro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Fila do dia */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              Fila do dia
            </p>
            {!loading && (
              <span className="text-xs text-muted-foreground">{fila.length} na fila</span>
            )}
          </div>

          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
            </div>
          ) : fila.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Fila vazia — tudo em dia!</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {fila.map(item => {
                const atraso = diasAtraso(item.next_followup_at)
                const ativo = selecionado?.key === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => selecionar(item)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${ativo ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.company_name || item.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.source === 'manual' && item.motivo
                          ? item.motivo
                          : item.last_order_at
                            ? `Último pedido: ${formatDate(item.last_order_at)}`
                            : formatTelefone(item.telefone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.source === 'manual' ? (
                        <>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            manual
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); removerDaFila(item) }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                            title="Remover da fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        </>
                      ) : atraso !== null && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${atraso === 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {atraso === 0 ? 'hoje' : `${atraso}d atrás`}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Registro rápido */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PencilLine className="w-4 h-4 text-primary" />
              Registrar atendimento
            </p>
          </div>

          {!selecionado ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Selecione um cliente na fila para registrar o atendimento
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{selecionado.company_name || selecionado.nome}</p>
                  {selecionado.company_name && (
                    <p className="text-xs text-muted-foreground truncate">{selecionado.nome}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatTelefone(selecionado.telefone)}</p>
                </div>
                {selecionado.telefone && (
                  <a
                    href={whatsappLink(selecionado.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Abrir WhatsApp
                  </a>
                )}
              </div>

              {/* Canal */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Canal</p>
                <div className="flex gap-2">
                  {CANAIS.map(c => {
                    const Icon = c.icon
                    return (
                      <button
                        key={c.value}
                        onClick={() => setCanal(c.value)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border transition-colors ${canal === c.value ? 'bg-primary/15 border-primary/50 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30'}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resultado */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Resultado</p>
                <div className="flex flex-wrap gap-2">
                  {RESULTADOS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setResultado(r.value)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${resultado === r.value ? 'bg-primary/15 border-primary/50 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anotação */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Anotação</p>
                <textarea
                  value={anotacao}
                  onChange={e => setAnotacao(e.target.value)}
                  placeholder="O que foi conversado..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Próximo contato */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Próximo contato em
                </div>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={diasProximo}
                  onChange={e => setDiasProximo(e.target.value)}
                  placeholder={resultado === 'pedido_fechado' ? `${selecionado.reorder_cycle_days || 90}` : 'dias'}
                  className="w-20 bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground text-center"
                />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-primary text-white"
                  onClick={salvarAtendimento}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : 'Salvar atendimento'}
                </Button>
                <Button variant="ghost" onClick={() => setSelecionado(null)} disabled={salvando}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diário */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Diário de atendimentos</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(diaAtual); d.setDate(d.getDate() - 1)
                setDiaAtual(d.toISOString().slice(0, 10))
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-foreground font-medium min-w-[110px] text-center">
              {diaAtual === new Date().toISOString().slice(0, 10)
                ? 'Hoje'
                : new Date(diaAtual + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const d = new Date(diaAtual); d.setDate(d.getDate() + 1)
                const amanha = d.toISOString().slice(0, 10)
                if (amanha <= new Date().toISOString().slice(0, 10)) setDiaAtual(amanha)
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
              disabled={diaAtual >= new Date().toISOString().slice(0, 10)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {hoje.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum atendimento registrado neste dia.</p>
        ) : (
          <div className="divide-y divide-border">
            {hoje.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5 w-12">
                  {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{a.company_name || a.contact_name || 'Sem nome'}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${a.resultado === 'pedido_fechado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : a.resultado === 'sem_resposta' || a.resultado === 'sem_interesse' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {RESULTADO_LABEL[a.resultado] || a.resultado}
                    </span>
                  </div>
                  {a.anotacao && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.anotacao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal adicionar à fila */}
      {modalFila && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setModalFila(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Adicionar à fila</p>
              <button onClick={() => setModalFila(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!contatoEscolhido ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Buscar cliente pelo nome..."
                    className="pl-9 bg-background"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                </div>
                {buscando ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary opacity-50" />
                  </div>
                ) : resultadosBusca.length > 0 ? (
                  <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                    {resultadosBusca.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setContatoEscolhido(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{formatTelefone(c.whatsapp || c.phone)}</p>
                      </button>
                    ))}
                  </div>
                ) : busca.trim().length >= 2 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Nenhum contato encontrado.</p>
                ) : null}
              </>
            ) : (
              <>
                <div className="bg-muted/30 border border-border rounded-md px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{contatoEscolhido.full_name}</p>
                    <p className="text-xs text-muted-foreground">{formatTelefone(contatoEscolhido.whatsapp || contatoEscolhido.phone)}</p>
                  </div>
                  <button onClick={() => setContatoEscolhido(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  placeholder="Motivo (opcional) — ex: Campanha região sudoeste"
                  className="bg-background"
                  value={motivoFila}
                  onChange={e => setMotivoFila(e.target.value)}
                />
                <Button
                  className="w-full bg-primary text-white"
                  onClick={adicionarFila}
                  disabled={salvandoFila}
                >
                  {salvandoFila ? 'Adicionando...' : 'Adicionar à fila'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
