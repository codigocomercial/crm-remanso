'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Search, Send, RefreshCw, X,
  Bot, UserCheck, Phone, MapPin, Calendar, TrendingUp,
  ChevronRight, Clock, CheckCheck, Check, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Contact {
  id: string
  full_name: string
  whatsapp: string
  email?: string
  city?: string
  state?: string
  customer_type?: string
  reorder_cycle_days?: number
  last_order_at?: string
  average_order_value?: number
}

interface Company {
  id: string
  name: string
  fantasia: string
  city?: string
  state?: string
}

interface Conversation {
  id: string
  whatsapp_number: string
  status: string
  unread_count: number
  last_message_at: string
  last_message_preview: string
  handled_by_bot: boolean
  bot_paused_at?: string
  assigned_to?: string
  created_at: string
  contact: Contact
  company?: Company
  assigned_user?: { id: string; full_name: string }
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  media_url?: string
  message_type: string
  status: string
  sent_at: string
  sent_by_user?: { id: string; full_name: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatCurrency(val?: number) {
  if (!val) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function getInitials(name: string) {
  return name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md', online }: { name: string; size?: 'sm' | 'md' | 'lg'; online?: boolean }) {
  const sizes = { sm: 'w-8 h-8 text-[10px]', md: 'w-10 h-10 text-[12px]', lg: 'w-12 h-12 text-[14px]' }
  return (
    <div className="relative flex-shrink-0">
      <div className={cn('rounded-full flex items-center justify-center font-bold text-white', sizes[size])}
        style={{ backgroundColor: 'var(--brand-teal)' }}>
        {getInitials(name)}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ backgroundColor: '#22c55e' }} />
      )}
    </div>
  )
}

// ── Status da mensagem ─────────────────────────────────────────────────────
function MessageStatus({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck size={12} style={{ color: '#3E8F76' }} />
  if (status === 'delivered') return <CheckCheck size={12} style={{ color: '#9CA3AF' }} />
  return <Check size={12} style={{ color: '#9CA3AF' }} />
}

// ── Item da lista de conversas ─────────────────────────────────────────────
function ConversationItem({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const name = conv.contact?.full_name || conv.whatsapp_number
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-3 hover:bg-neutral-50 transition-colors border-b text-left',
        active && 'bg-teal-50 border-l-2 border-l-teal-500'
      )}
      style={{ borderBottomColor: 'rgba(0,0,0,0.05)' }}
    >
      <Avatar name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={cn('text-[13px] truncate', active ? 'font-bold' : 'font-semibold')}
            style={{ color: 'var(--neutral-900)' }}>
            {name}
          </span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--neutral-500)' }}>
            {formatTime(conv.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-[12px] truncate" style={{ color: 'var(--neutral-600)' }}>
            {conv.last_message_preview || 'Sem mensagens'}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {conv.handled_by_bot && (
              <Bot size={10} style={{ color: 'var(--brand-teal)' }} />
            )}
            {conv.unread_count > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: 'var(--brand-teal)' }}>
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </div>
        </div>
        {conv.company && (
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--neutral-500)' }}>
            {conv.company.fantasia || conv.company.name}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Bolha de mensagem ──────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound'
  return (
    <div className={cn('flex mb-2', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-sm', isOut ? 'rounded-tr-sm' : 'rounded-tl-sm')}
        style={{
          backgroundColor: isOut ? 'var(--brand-teal)' : 'white',
          color: isOut ? 'white' : 'var(--neutral-900)',
        }}>
        {msg.message_type !== 'text' && (
          <p className="text-[11px] italic mb-1 opacity-70">[{msg.message_type}]</p>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content || '—'}</p>
        <div className={cn('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] opacity-60">{formatTime(msg.sent_at)}</span>
          {isOut && <MessageStatus status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

// ── Painel lateral do contato ──────────────────────────────────────────────
function ContactPanel({ conv, onPauseBot, onResumeBot }: {
  conv: Conversation
  onPauseBot: () => void
  onResumeBot: () => void
}) {
  const c = conv.contact
  const company = conv.company

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Cabeçalho */}
      <div className="p-4 border-b text-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <Avatar name={c?.full_name || '?'} size="lg" />
        <h3 className="text-[14px] font-bold mt-2" style={{ color: 'var(--neutral-900)' }}>
          {c?.full_name}
        </h3>
        {company && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--neutral-500)' }}>
            {company.fantasia || company.name}
          </p>
        )}
        <p className="text-[11px] mt-1 font-mono" style={{ color: 'var(--neutral-500)' }}>
          {conv.whatsapp_number}
        </p>
      </div>

      {/* Bot status */}
      <div className="p-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>
            Laura IA
          </span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
            conv.handled_by_bot ? 'text-green-700 bg-green-100' : 'text-orange-700 bg-orange-100'
          )}>
            {conv.handled_by_bot ? 'Ativa' : 'Pausada'}
          </span>
        </div>
        {conv.handled_by_bot ? (
          <button
            onClick={onPauseBot}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors hover:bg-orange-50"
            style={{ borderColor: '#f97316', color: '#f97316' }}
          >
            <UserCheck size={12} />
            Assumir conversa
          </button>
        ) : (
          <button
            onClick={onResumeBot}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors hover:bg-teal-50"
            style={{ borderColor: 'var(--brand-teal)', color: 'var(--brand-teal)' }}
          >
            <Bot size={12} />
            Devolver para Laura
          </button>
        )}
      </div>

      {/* Dados do contato */}
      <div className="p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--neutral-500)' }}>
          Dados
        </p>

        {c?.city && (
          <div className="flex items-center gap-2">
            <MapPin size={12} style={{ color: 'var(--neutral-400)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-700)' }}>
              {c.city}{c.state ? `, ${c.state}` : ''}
            </span>
          </div>
        )}

        {c?.reorder_cycle_days && (
          <div className="flex items-center gap-2">
            <RefreshCw size={12} style={{ color: 'var(--neutral-400)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-700)' }}>
              Ciclo: {c.reorder_cycle_days} dias
            </span>
          </div>
        )}

        {c?.last_order_at && (
          <div className="flex items-center gap-2">
            <Calendar size={12} style={{ color: 'var(--neutral-400)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-700)' }}>
              Último pedido: {new Date(c.last_order_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}

        {c?.average_order_value && (
          <div className="flex items-center gap-2">
            <TrendingUp size={12} style={{ color: 'var(--neutral-400)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-700)' }}>
              Ticket médio: {formatCurrency(c.average_order_value)}
            </span>
          </div>
        )}

        {company && (
          <div className="flex items-center gap-2">
            <Building2 size={12} style={{ color: 'var(--neutral-400)' }} />
            <span className="text-[12px]" style={{ color: 'var(--neutral-700)' }}>
              {company.fantasia || company.name}
            </span>
          </div>
        )}
      </div>

      {/* Link para o cliente */}
      {c?.id && (
        <div className="p-3 mt-auto border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <a
            href={`/clientes/${c.id}`}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold transition-colors"
            style={{ backgroundColor: 'var(--brand-teal-bg)', color: 'var(--brand-teal)' }}
          >
            Ver dossiê completo
            <ChevronRight size={12} />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export function WhatsAppInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const msgPollingRef = useRef<NodeJS.Timeout | null>(null)

  const selectedConv = conversations.find(c => c.id === selectedId) || null

  // ── Carrega conversas ──────────────────────────────────────────────────
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter, search, limit: '50' })
      const res = await fetch(`/api/whatsapp/conversations?${params}`)
      const data = await res.json()
      if (data.conversations) setConversations(data.conversations)
    } catch (e) {
      console.error('Erro ao carregar conversas:', e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  // ── Carrega mensagens ──────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId: string, silent = false) => {
    try {
      const res = await fetch(`/api/whatsapp/conversations/${convId}/messages`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
        // Atualiza unread na lista
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, unread_count: 0 } : c
        ))
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    }
  }, [])

  // ── Polling conversas (5s) ─────────────────────────────────────────────
  useEffect(() => {
    loadConversations()
    pollingRef.current = setInterval(() => loadConversations(true), 5000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [loadConversations])

  // ── Polling mensagens (3s quando conversa aberta) ──────────────────────
  useEffect(() => {
    if (msgPollingRef.current) clearInterval(msgPollingRef.current)
    if (!selectedId) return
    loadMessages(selectedId)
    msgPollingRef.current = setInterval(() => loadMessages(selectedId, true), 3000)
    return () => { if (msgPollingRef.current) clearInterval(msgPollingRef.current) }
  }, [selectedId, loadMessages])

  // ── Scroll para baixo ──────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Envia mensagem ─────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!text.trim() || !selectedId || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    try {
      const res = await fetch(`/api/whatsapp/conversations/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        await loadMessages(selectedId, true)
        await loadConversations(true)
      }
    } catch (e) {
      console.error('Erro ao enviar:', e)
      setText(content)
    } finally {
      setSending(false)
    }
  }

  // ── Ações na conversa ──────────────────────────────────────────────────
  const conversationAction = async (action: string) => {
    if (!selectedId) return
    await fetch('/api/whatsapp/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: selectedId, action }),
    })
    await loadConversations(true)
  }

  // ── Seleciona conversa ─────────────────────────────────────────────────
  const selectConversation = (id: string) => {
    setSelectedId(id)
    setMessages([])
  }

  // ── Total não lidas ────────────────────────────────────────────────────
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <div className="flex h-[calc(100vh-60px)] -m-6 overflow-hidden">

      {/* ── Coluna 1: Lista de conversas ─────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col bg-white border-r"
        style={{ borderColor: 'rgba(0,0,0,0.07)' }}>

        {/* Header */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} style={{ color: 'var(--brand-teal)' }} />
              <h2 className="text-[14px] font-bold" style={{ color: 'var(--neutral-900)' }}>
                WhatsApp
              </h2>
              {totalUnread > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: 'var(--brand-teal)' }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <button onClick={() => loadConversations()}
              className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
              <RefreshCw size={13} style={{ color: 'var(--neutral-500)' }} />
            </button>
          </div>

          {/* Busca */}
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--neutral-400)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contato..."
              className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'var(--neutral-100)' }}
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-1">
            {['open', 'closed', 'all'].map(s => (
              <button key={s}
                onClick={() => setStatusFilter(s)}
                className={cn('flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors',
                  statusFilter === s ? 'text-white' : 'hover:bg-neutral-100'
                )}
                style={{
                  backgroundColor: statusFilter === s ? 'var(--brand-teal)' : 'transparent',
                  color: statusFilter === s ? 'white' : 'var(--neutral-600)',
                }}>
                {s === 'open' ? 'Abertas' : s === 'closed' ? 'Fechadas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--neutral-400)' }} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <MessageSquare size={24} style={{ color: 'var(--neutral-300)' }} />
              <p className="text-[12px]" style={{ color: 'var(--neutral-500)' }}>Nenhuma conversa</p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                active={conv.id === selectedId}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Coluna 2: Mensagens ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#f0f2f5' }}>
        {!selectedConv ? (
          // Empty state
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--brand-teal-bg)' }}>
              <MessageSquare size={28} style={{ color: 'var(--brand-teal)' }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--neutral-700)' }}>
              Selecione uma conversa
            </p>
            <p className="text-[12px]" style={{ color: 'var(--neutral-500)' }}>
              Escolha um contato na lista ao lado
            </p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="flex-shrink-0 bg-white border-b flex items-center gap-3 px-4 py-2.5"
              style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              <Avatar name={selectedConv.contact?.full_name || '?'} size="sm" />
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-bold truncate" style={{ color: 'var(--neutral-900)' }}>
                  {selectedConv.contact?.full_name || selectedConv.whatsapp_number}
                </h3>
                <p className="text-[11px] truncate" style={{ color: 'var(--neutral-500)' }}>
                  {selectedConv.company?.fantasia || selectedConv.whatsapp_number}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedConv.handled_by_bot ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-green-700 bg-green-100 flex items-center gap-1">
                    <Bot size={9} /> Laura ativa
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-orange-700 bg-orange-100 flex items-center gap-1">
                    <UserCheck size={9} /> Você
                  </span>
                )}
                <button
                  onClick={() => setShowPanel(p => !p)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                  style={{ color: showPanel ? 'var(--brand-teal)' : 'var(--neutral-500)' }}>
                  <ChevronRight size={14} className={cn('transition-transform', showPanel ? 'rotate-0' : 'rotate-180')} />
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[12px]" style={{ color: 'var(--neutral-500)' }}>Sem mensagens ainda</p>
                </div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de resposta */}
            <div className="flex-shrink-0 bg-white border-t p-3" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              {selectedConv.handled_by_bot && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'var(--brand-teal-bg)' }}>
                  <Bot size={12} style={{ color: 'var(--brand-teal)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--brand-teal)' }}>
                    Laura está respondendo. Ao digitar, você assume a conversa automaticamente.
                  </p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border px-3 py-2 text-[13px] outline-none transition-all max-h-32"
                  style={{
                    borderColor: 'rgba(0,0,0,0.1)',
                    color: 'var(--neutral-900)',
                    lineHeight: '1.5',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                  style={{ backgroundColor: 'var(--brand-teal)' }}
                >
                  {sending
                    ? <RefreshCw size={14} className="animate-spin text-white" />
                    : <Send size={14} className="text-white" />
                  }
                </button>
              </div>
              <p className="text-[10px] mt-1 px-1" style={{ color: 'var(--neutral-400)' }}>
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Coluna 3: Painel do contato ───────────────────────────────── */}
      {selectedConv && showPanel && (
        <div className="w-[240px] flex-shrink-0 bg-white border-l"
          style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <ContactPanel
            conv={selectedConv}
            onPauseBot={() => conversationAction('pause_bot')}
            onResumeBot={() => conversationAction('resume_bot')}
          />
        </div>
      )}
    </div>
  )
}
