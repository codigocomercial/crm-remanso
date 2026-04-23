'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Zap, Webhook, Link2, Copy, Check, Clock,
  AlertCircle, RefreshCw, Loader2, ChevronRight,
  CheckCircle2, XCircle, Info, Server, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn, timeAgo } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AutomationEvent {
  id: string
  event_type: string
  status: 'success' | 'error' | 'pending' | string
  payload?: Record<string, unknown>
  error_message?: string | null
  created_at: string
  source?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com')

const WEBHOOK_ENDPOINTS = [
  {
    id: 'wh-lead',
    method: 'POST',
    path: '/api/webhooks/lead',
    label: 'Novo Lead',
    description: 'Dispara ao receber um novo lead via WhatsApp ou formulário externo',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: '🎯',
  },
  {
    id: 'wh-interaction',
    method: 'POST',
    path: '/api/webhooks/interaction',
    label: 'Nova Interação',
    description: 'Registra interações recebidas (mensagens, e-mails, chamadas)',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: '💬',
  },
  {
    id: 'wh-task',
    method: 'POST',
    path: '/api/webhooks/task',
    label: 'Nova Tarefa',
    description: 'Cria ou atualiza tarefas automaticamente via automação n8n',
    color: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    icon: '✅',
  },
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  success: {
    label: 'Sucesso',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  error: {
    label: 'Erro',
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  pending: {
    label: 'Pendente',
    icon: <Clock className="w-3.5 h-3.5" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200',
        copied
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {copied
        ? <><Check className="w-3 h-3" /> Copiado!</>
        : <><Copy className="w-3 h-3" /> Copiar</>
      }
    </button>
  )
}

// ─── Section: Webhooks ────────────────────────────────────────────────────────
function SectionWebhooks() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Webhook className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Webhooks para n8n</h2>
          <p className="text-xs text-muted-foreground">URLs que o n8n deve chamar para enviar dados ao CRM</p>
        </div>
      </div>

      {/* Instruction box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <p className="text-xs leading-relaxed">
          Configure um nó <strong>HTTP Request</strong> no n8n apontando para as URLs abaixo.
          Use o método <strong>POST</strong> com o <strong>Body</strong> em formato JSON.
          Opcionalmente, adicione um header <code className="bg-blue-100 px-1 rounded text-[10px]">x-api-key</code> com um token secreto para autenticação.
        </p>
      </div>

      <div className="grid gap-3">
        {WEBHOOK_ENDPOINTS.map(endpoint => {
          const fullUrl = `${BASE_URL}${endpoint.path}`
          return (
            <div key={endpoint.id} id={endpoint.id}
              className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{endpoint.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{endpoint.label}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', endpoint.color)}>
                        {endpoint.method}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{endpoint.description}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2 border border-border">
                  <code className="text-xs text-foreground font-mono truncate block">{fullUrl}</code>
                </div>
                <CopyButton text={fullUrl} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Section: Evolution API ───────────────────────────────────────────────────
function SectionEvolutionAPI() {
  const [apiUrl, setApiUrl] = useState('')
  const [instance, setInstance] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  // Load from localStorage as a simple persistence
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('evolution_api_config')
    if (stored) {
      try {
        const cfg = JSON.parse(stored)
        setApiUrl(cfg.apiUrl ?? '')
        setInstance(cfg.instance ?? '')
        setApiKey(cfg.apiKey ?? '')
      } catch { /* ignore */ }
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    localStorage.setItem('evolution_api_config', JSON.stringify({ apiUrl, instance, apiKey }))
    await new Promise(r => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(5000),
      })
      setTestResult(res.ok ? 'success' : 'error')
    } catch {
      setTestResult('error')
    }
    setTesting(false)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Evolution API</h2>
          <p className="text-xs text-muted-foreground">Conecte o CRM ao seu servidor WhatsApp via Evolution API</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="evo-url" className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              URL do servidor Evolution API
            </Label>
            <Input
              id="evo-url"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="https://evolution.seuservidor.com"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evo-instance" className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
              Nome da instância
            </Label>
            <Input
              id="evo-instance"
              value={instance}
              onChange={e => setInstance(e.target.value)}
              placeholder="Ex: remanso-prod"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evo-key" className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              API Key (Global)
            </Label>
            <Input
              id="evo-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
        </div>

        {testResult && (
          <div className={cn(
            'flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border',
            testResult === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          )}>
            {testResult === 'success'
              ? <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Conexão realizada com sucesso!</>
              : <><XCircle className="w-4 h-4 flex-shrink-0" /> Falha na conexão. Verifique a URL e a API Key.</>
            }
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving || !apiUrl} className="flex-1 sm:flex-none">
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : saved
                ? <><Check className="w-4 h-4 mr-2" />Salvo!</>
                : 'Salvar configuração'
            }
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !apiUrl} className="flex-1 sm:flex-none">
            {testing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testando...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Testar conexão</>
            }
          </Button>
        </div>
      </div>
    </section>
  )
}

// ─── Section: Logs ────────────────────────────────────────────────────────────
function SectionLogs() {
  const [events, setEvents] = useState<AutomationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const supabase = createClient()
    const { data } = await supabase
      .from('automation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setEvents(data ?? [])

    if (isRefresh) setRefreshing(false)
    else setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function getStatusConfig(status: string) {
    return STATUS_CONFIG[status] ?? {
      label: status,
      icon: <Clock className="w-3.5 h-3.5" />,
      className: 'bg-muted text-muted-foreground border-border',
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Logs de Automação</h2>
            <p className="text-xs text-muted-foreground">Últimos 20 eventos da tabela <code className="bg-muted px-1 rounded text-[10px]">automation_events</code></p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}
          className="gap-2 text-xs h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      ) : events.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Nenhum evento registrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Os eventos de automação aparecerão aqui quando o n8n ou a Evolution API acionarem os webhooks.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {events.map(event => {
            const sc = getStatusConfig(event.status)
            const isExpanded = expanded === event.id
            const hasDetails = event.error_message || event.payload

            return (
              <div key={event.id} id={`log-${event.id}`}
                className={cn('bg-card transition-colors', hasDetails && 'cursor-pointer hover:bg-muted/30')}
                onClick={() => hasDetails && setExpanded(isExpanded ? null : event.id)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status */}
                  <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0', sc.className)}>
                    {sc.icon}
                    <span className="hidden sm:inline">{sc.label}</span>
                  </div>

                  {/* Event type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{event.event_type}</span>
                      {event.source && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                          {event.source}
                        </Badge>
                      )}
                    </div>
                    {event.error_message && (
                      <p className="text-xs text-red-600 truncate mt-0.5">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {event.error_message}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">{timeAgo(event.created_at)}</span>
                    {hasDetails && (
                      <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                    )}
                  </div>
                </div>

                {/* Expanded payload */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0" onClick={e => e.stopPropagation()}>
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                      </div>
                      {event.error_message && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-xs font-semibold text-red-700 mb-1">Mensagem de erro:</p>
                          <p className="text-xs text-red-600 font-mono">{event.error_message}</p>
                        </div>
                      )}
                      {event.payload && (
                        <div className="p-3 rounded-lg bg-muted border border-border">
                          <p className="text-xs font-semibold text-foreground mb-1.5">Payload:</p>
                          <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntegracoesPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground">Configure webhooks, Evolution API e monitore automações</p>
        </div>
      </div>

      <SectionWebhooks />
      <Separator />
      <SectionEvolutionAPI />
      <Separator />
      <SectionLogs />
    </div>
  )
}
