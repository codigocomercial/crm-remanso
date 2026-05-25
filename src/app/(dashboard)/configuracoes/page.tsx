'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Settings, User, Building2, KanbanSquare, Users,
  GripVertical, Pencil, Check, X, Loader2,
  Lock, Mail, AlertCircle, Plus, Trash2, ShieldCheck, TrendingUp, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserRole } from '@/hooks/useUserRole'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PipelineStage {
  id: string
  name: string
  order_index: number
  color?: string | null
}

interface AppUser {
  id: string
  email: string
  full_name?: string | null
  role?: string | null
  created_at: string
}

interface ContactGroup {
  id: string
  name: string
  color: string
  sort_order: number
  contact_count?: number
}

// ─── Paleta de cores dos grupos ───────────────────────────────────────────────
const GROUP_COLORS = [
  { value: 'emerald', label: 'Verde',    bg: 'bg-emerald-100', text: 'text-emerald-700', hex: '#10b981' },
  { value: 'blue',    label: 'Azul',     bg: 'bg-blue-100',    text: 'text-blue-700',    hex: '#3b82f6' },
  { value: 'yellow',  label: 'Amarelo',  bg: 'bg-yellow-100',  text: 'text-yellow-700',  hex: '#eab308' },
  { value: 'orange',  label: 'Laranja',  bg: 'bg-orange-100',  text: 'text-orange-700',  hex: '#f97316' },
  { value: 'red',     label: 'Vermelho', bg: 'bg-red-100',     text: 'text-red-700',     hex: '#ef4444' },
  { value: 'purple',  label: 'Roxo',     bg: 'bg-purple-100',  text: 'text-purple-700',  hex: '#a855f7' },
  { value: 'gray',    label: 'Cinza',    bg: 'bg-gray-100',    text: 'text-gray-700',    hex: '#6b7280' },
]

function getGroupColor(color: string) {
  return GROUP_COLORS.find(c => c.value === color) ?? GROUP_COLORS[6]
}

function GroupBadge({ name, color }: { name: string; color: string }) {
  const c = getGroupColor(color)
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', c.bg, c.text)}>
      {name}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sortable Stage Row ────────────────────────────────────────────────────────
function SortableStageRow({
  stage, onSave, onDelete,
}: {
  stage: PipelineStage
  onSave: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(stage.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  async function handleSave() {
    setSaving(true)
    await onSave(stage.id, value)
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(stage.id)
    setDeleting(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setValue(stage.name); setEditing(false) }
  }

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl mb-2 group transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/20'
      )}
    >
      <button {...attributes} {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold flex-shrink-0">
        {stage.order_index + 1}
      </span>
      {editing ? (
        <Input value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKey}
          autoFocus className="flex-1 h-8 text-sm" />
      ) : (
        <span className="flex-1 text-sm font-medium text-foreground">{stage.name}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
              onClick={() => { setValue(stage.name); setEditing(false) }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Perfil ──────────────────────────────────────────────────────────────
function TabPerfil() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? '')
        setName(user.user_metadata?.full_name ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveProfile() {
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      ...(email ? { email } : {}),
      data: { full_name: name },
    })
    setSaving(false)
    setMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Perfil atualizado com sucesso!' }
    )
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'As senhas não coincidem.' })
      return
    }
    setSavingPwd(true)
    setPwdMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPwd(false)
    if (error) {
      setPwdMsg({ type: 'error', text: error.message })
    } else {
      setPwdMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
            {name ? initials(name) : <User className="w-6 h-6" />}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-foreground">{name || 'Usuário'}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Dados do perfil
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="email@exemplo.com" />
            </div>
          </div>
        </div>
        {msg && (
          <div className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg', msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{msg.text}
          </div>
        )}
        <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar perfil
        </Button>
      </div>
      <Separator />
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" /> Alterar senha
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pwd">Senha atual</Label>
            <Input id="cur-pwd" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nova senha</Label>
            <Input id="new-pwd" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
            <Input id="confirm-pwd" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        {pwdMsg && (
          <div className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg', pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{pwdMsg.text}
          </div>
        )}
        <Button onClick={handleChangePassword} disabled={savingPwd || !newPassword} variant="outline" className="w-full sm:w-auto">
          {savingPwd && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Alterar senha
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Organização ─────────────────────────────────────────────────────────
function TabOrganizacao() {
  const [companyName, setCompanyName] = useState('Urnas Remanso')
  const [segment, setSegment] = useState('Funerária')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{companyName}</p>
          <p className="text-sm text-muted-foreground">{segment}</p>
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> Informações da empresa
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Nome da empresa</Label>
            <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment">Segmento de atuação</Label>
            <Input id="segment" value={segment} onChange={e => setSegment(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
            : saved ? <><Check className="w-4 h-4 mr-2" />Salvo!</>
            : 'Salvar organização'}
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Pipeline ────────────────────────────────────────────────────────────
function TabPipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [newStageName, setNewStageName] = useState('')
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('pipeline_stages').select('*').order('order_index', { ascending: true })
    setStages(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({ ...s, order_index: i }))
    setStages(reordered)
    const supabase = createClient()
    await Promise.all(reordered.map(s => supabase.from('pipeline_stages').update({ order_index: s.order_index }).eq('id', s.id)))
  }

  async function handleSaveName(id: string, name: string) {
    const supabase = createClient()
    await supabase.from('pipeline_stages').update({ name }).eq('id', id)
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('pipeline_stages').delete().eq('id', id)
    setStages(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order_index: i })))
  }

  async function handleAddStage() {
    if (!newStageName.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('pipeline_stages')
      .insert({ name: newStageName.trim(), order_index: stages.length }).select().single()
    if (!error && data) { setStages(prev => [...prev, data]); setNewStageName('') }
    setAdding(false)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <KanbanSquare className="w-4 h-4 text-primary" /> Etapas do pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Arraste para reordenar. Clique no lápis para renomear.</p>
        </div>
        <Badge variant="secondary">{stages.length} etapas</Badge>
      </div>
      {stages.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <KanbanSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma etapa encontrada. Adicione a primeira!</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {stages.map(stage => (
              <SortableStageRow key={stage.id} stage={stage} onSave={handleSaveName} onDelete={handleDelete} />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <div className="flex gap-2 pt-2">
        <Input value={newStageName} onChange={e => setNewStageName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddStage()}
          placeholder="Nova etapa..." className="flex-1" />
        <Button onClick={handleAddStage} disabled={adding || !newStageName.trim()}>
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="ml-1.5 hidden sm:inline">Adicionar</span>
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Grupos de Clientes ──────────────────────────────────────────────────
function TabGrupos() {
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null)
  const [form, setForm] = useState({ name: '', color: 'emerald' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    // Busca grupos + quantidade de contatos em cada um
    const { data: groupsData } = await supabase
      .from('crm_contact_groups')
      .select('id, name, color, sort_order')
      .eq('org_id', ORG_ID)
      .order('sort_order', { ascending: true })

    if (!groupsData) { setLoading(false); return }

    // Conta contatos por grupo
    const { data: counts } = await supabase
      .from('crm_contacts')
      .select('group_id')
      .eq('org_id', ORG_ID)
      .not('group_id', 'is', null)

    const countMap: Record<string, number> = {}
    counts?.forEach(c => {
      if (c.group_id) countMap[c.group_id] = (countMap[c.group_id] ?? 0) + 1
    })

    setGroups(groupsData.map(g => ({ ...g, contact_count: countMap[g.id] ?? 0 })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingGroup(null)
    setForm({ name: '', color: 'emerald' })
    setError('')
    setShowModal(true)
  }

  function openEdit(group: ContactGroup) {
    setEditingGroup(group)
    setForm({ name: group.name, color: group.color })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (editingGroup) {
      const { error: err } = await supabase
        .from('crm_contact_groups')
        .update({ name: form.name.trim(), color: form.color })
        .eq('id', editingGroup.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const nextOrder = groups.length
      const { error: err } = await supabase
        .from('crm_contact_groups')
        .insert({ org_id: ORG_ID, name: form.name.trim(), color: form.color, sort_order: nextOrder })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(group: ContactGroup) {
    if (!confirm(`Excluir o grupo "${group.name}"?\n\nOs ${group.contact_count ?? 0} clientes nesse grupo ficarão sem grupo — não serão excluídos.`)) return
    setDeleting(group.id)
    const supabase = createClient()
    await supabase.from('crm_contact_groups').delete().eq('id', group.id)
    setDeleting(null)
    load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> Grupos de clientes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Segmente sua base para controlar campanhas e prioridades.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{groups.length} grupos</Badge>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo grupo
          </Button>
        </div>
      </div>

      {/* Lista de grupos */}
      {groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum grupo criado ainda.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar primeiro grupo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const c = getGroupColor(group.color)
            return (
              <div key={group.id}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl group hover:border-primary/30 transition-colors">
                {/* Badge de cor */}
                <div className={cn('w-3 h-3 rounded-full flex-shrink-0', c.bg)}
                  style={{ backgroundColor: c.hex }} />

                {/* Nome + badge */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{group.name}</span>
                  <GroupBadge name={group.name} color={group.color} />
                </div>

                {/* Contador */}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {group.contact_count ?? 0} cliente{(group.contact_count ?? 0) !== 1 ? 's' : ''}
                </span>

                {/* Ações */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(group)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(group)} disabled={deleting === group.id}>
                    {deleting === group.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota informativa */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Como funciona:</strong> cada cliente pertence a um grupo por vez.
          Atribua o grupo na tela de Empresas. Nos Campanhas, filtre por grupo pra selecionar quem vai receber o disparo.
        </p>
      </div>

      {/* Modal criar/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border"
            onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingGroup ? 'Editar grupo' : 'Novo grupo'}
              </h2>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body modal */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="group-name">Nome do grupo</Label>
                <Input id="group-name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Ex: Tipo A, Inadimplentes..." autoFocus />
              </div>

              {/* Cor */}
              <div className="space-y-2">
                <Label>Cor do grupo</Label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map(c => (
                    <button key={c.value}
                      onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                        form.color === c.value
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      )}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {form.name && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <GroupBadge name={form.name} color={form.color} />
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingGroup ? 'Salvar alterações' : 'Criar grupo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Usuários ────────────────────────────────────────────────────────────
function TabUsuarios() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'seller' })
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function invite() {
    if (!form.full_name || !form.email || !form.password) { setError('Preencha todos os campos'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erro ao criar usuário') }
    else { setShowModal(false); setForm({ full_name: '', email: '', password: '', role: 'seller' }); load() }
    setSaving(false)
  }

  async function changeRole(user_id: string, role: string) {
    setEditingRole(user_id)
    await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, role }) })
    setEditingRole(null); load()
  }

  async function deleteUser(user_id: string, name: string) {
    if (!confirm(`Excluir o usuário "${name}"? Esta ação não pode ser desfeita.`)) return
    await fetch(`/api/usuarios?user_id=${user_id}`, { method: 'DELETE' }); load()
  }

  const ROLES = [
    { value: 'admin',   label: 'Administrador', color: '#1D6FA4', bg: '#EBF4FB' },
    { value: 'manager', label: 'Gerente',        color: '#2F6F5D', bg: '#EBF5F1' },
    { value: 'seller',  label: 'Vendedor',       color: '#B45309', bg: '#FEF3C7' },
  ]
  const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) || ROLES[2]

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[15px] flex items-center gap-2" style={{ color: 'var(--neutral-900)' }}>
            <Users className="w-4 h-4" style={{ color: 'var(--brand-teal)' }} /> Usuários do sistema
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--neutral-500)' }}>Somente admins podem criar e alterar usuários</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold text-white"
          style={{ backgroundColor: 'var(--brand-teal)' }}>
          <Plus size={13} /> Novo usuário
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
        {users.map((u, i) => {
          const rc = getRoleConfig(u.role || 'seller')
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
              style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--brand-teal)' }}>
                {(u.full_name || u.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--neutral-900)' }}>{u.full_name || 'Sem nome'}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--neutral-500)' }}>{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editingRole === u.id ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--neutral-400)' }} /> : (
                  <select value={u.role || 'seller'} onChange={e => changeRole(u.id, e.target.value)}
                    className="text-[11px] font-bold px-2 py-1 rounded-full border-0 outline-none cursor-pointer"
                    style={{ color: rc.color, backgroundColor: rc.bg }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                )}
                <button onClick={() => deleteUser(u.id, u.full_name || u.email)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={13} style={{ color: '#EF4444' }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--neutral-900)' }}>Novo Usuário</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X size={16} style={{ color: 'var(--neutral-400)' }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && <div className="px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>{error}</div>}
              {[
                { id: 'fn', label: 'Nome completo *', key: 'full_name', type: 'text', ph: 'Ex: Tadeu Dias Rocha' },
                { id: 'em', label: 'E-mail *', key: 'email', type: 'email', ph: 'vendedor@urnasremanso.com.br' },
                { id: 'pw', label: 'Senha inicial *', key: 'password', type: 'password', ph: 'Mínimo 6 caracteres' },
              ].map(f => (
                <div key={f.id}>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.ph} className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }} />
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-600)' }}>Perfil de acesso *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none" style={{ borderColor: 'rgba(0,0,0,0.12)' }}>
                  <option value="seller">Vendedor — acesso básico, sem dados financeiros</option>
                  <option value="manager">Gerente — acesso completo, sem configurações</option>
                  <option value="admin">Administrador — acesso total</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-semibold rounded-xl border"
                style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--neutral-600)' }}>Cancelar</button>
              <button onClick={invite} disabled={saving}
                className="px-4 py-2 text-[13px] font-semibold rounded-xl text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-teal)' }}>
                {saving ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Margens ─────────────────────────────────────────────────────────────
function TabMargens() {
  const supabase = createClient()
  const [form, setForm] = useState({
    margin_order_good: 30, margin_order_low: 15,
    margin_load_good: 20, margin_load_low: 8,
    active_client_days: 180, tax_rate: 4.5,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('organizations').select('margin_order_good,margin_order_low,margin_load_good,margin_load_low,active_client_days,tax_rate')
      .eq('id', ORG_ID).single()
      .then(({ data }) => {
        if (data) setForm({
          margin_order_good: data.margin_order_good ?? 30, margin_order_low: data.margin_order_low ?? 15,
          margin_load_good: data.margin_load_good ?? 20, margin_load_low: data.margin_load_low ?? 8,
          active_client_days: data.active_client_days ?? 180, tax_rate: data.tax_rate ?? 4.5,
        })
      })
  }, [])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('organizations').update(form).eq('id', ORG_ID)
    if (error) { console.error(error); setSaving(false); return }
    await supabase.rpc('update_companies_active_status', { p_org_id: ORG_ID })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  function field(label: string, key: keyof typeof form, help: string) {
    return (
      <div className="rm-card p-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[13px] font-semibold" style={{ color: "var(--neutral-800)" }}>{label}</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" step="1" value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
              className="w-20 px-3 py-1.5 text-[13px] rounded-lg border outline-none text-right font-bold"
              style={{ borderColor: "rgba(0,0,0,0.12)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--neutral-500)" }}>%</span>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--neutral-400)" }}>{help}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--neutral-900)" }}>Metas de Margem — Pedidos</h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--neutral-500)" }}>Define os indicadores 🟢🟡🔴 exibidos para o vendedor nos pedidos de venda</p>
        <div className="space-y-2">
          {field("🟢 Boa margem — acima de", "margin_order_good", "Pedidos acima desse % aparecem com indicador verde")}
          {field("🟡 Margem baixa — acima de", "margin_order_low", "Pedidos entre esse % e o anterior aparecem em amarelo. Abaixo = vermelho")}
        </div>
      </div>
      <div>
        <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--neutral-900)" }}>Metas de Margem — Cargas</h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--neutral-500)" }}>Define os indicadores exibidos para o vendedor nas cargas</p>
        <div className="space-y-2">
          {field("🟢 Carga viável — acima de", "margin_load_good", "Cargas acima desse % aparecem com indicador verde")}
          {field("🟡 Carga apertada — acima de", "margin_load_low", "Cargas entre esse % e o anterior aparecem em amarelo. Abaixo = vermelho")}
        </div>
      </div>
      <div>
        <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--neutral-900)" }}>Impostos sobre Venda</h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--neutral-500)" }}>Alíquota aplicada sobre o valor total de cada pedido no cálculo da CML</p>
        <div className="rm-card p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[13px] font-semibold" style={{ color: "var(--neutral-800)" }}>Alíquota de imposto</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" step="0.1" value={form.tax_rate}
                onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))}
                className="w-20 px-3 py-1.5 text-[13px] rounded-lg border outline-none text-right font-bold"
                style={{ borderColor: "rgba(0,0,0,0.12)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--neutral-500)" }}>%</span>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--neutral-400)" }}>
            CML = Total Venda − Custo MP − Custo Operacional − (Total Venda × {form.tax_rate}%)
          </p>
        </div>
      </div>
      <div>
        <p className="text-[12px] mb-3" style={{ color: "var(--neutral-500)" }}>Clientes sem compra há mais de esse período são marcados como inativos</p>
        <div className="rm-card p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[13px] font-semibold" style={{ color: "var(--neutral-800)" }}>Considerar inativo após</label>
            <div className="flex items-center gap-2">
              <input type="number" min="30" max="365" step="30" value={form.active_client_days}
                onChange={e => setForm(f => ({ ...f, active_client_days: Number(e.target.value) }))}
                className="w-20 px-3 py-1.5 text-[13px] rounded-lg border outline-none text-right font-bold"
                style={{ borderColor: "rgba(0,0,0,0.12)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--neutral-500)" }}>dias sem compra</span>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--neutral-400)" }}>Padrão: 180 dias. Ao salvar, atualiza o status de todos os clientes.</p>
        </div>
      </div>
      <div className="rm-card p-4" style={{ backgroundColor: "var(--neutral-50)" }}>
        <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--neutral-700)" }}>Preview dos indicadores:</p>
        <div className="flex gap-4 text-[12px]">
          <span className="px-2 py-1 rounded-full font-bold" style={{ color: "#2F6F5D", backgroundColor: "#EBF5F1" }}>🟢 Acima de {form.margin_order_good}%</span>
          <span className="px-2 py-1 rounded-full font-bold" style={{ color: "#B45309", backgroundColor: "#FEF3C7" }}>🟡 Entre {form.margin_order_low}% e {form.margin_order_good}%</span>
          <span className="px-2 py-1 rounded-full font-bold" style={{ color: "#DC2626", backgroundColor: "#FEE2E2" }}>🔴 Abaixo de {form.margin_order_low}%</span>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="btn-remanso flex items-center gap-2">
        <TrendingUp size={13} />
        {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar metas"}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { can } = useUserRole()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu perfil, organização e pipeline</p>
        </div>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="h-10 p-1 flex gap-0.5 bg-muted rounded-xl w-full sm:w-auto sm:inline-flex">
          <TabsTrigger value="perfil" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" /><span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="organizacao" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <Building2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Organização</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <KanbanSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pipeline</span>
          </TabsTrigger>
          {can('manage_users') && (
            <TabsTrigger value="usuarios" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
          )}
          {can('manage_users') && (
            <TabsTrigger value="grupos" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Tag className="w-3.5 h-3.5" /><span className="hidden sm:inline">Grupos</span>
            </TabsTrigger>
          )}
          {can('manage_margin_targets') && (
            <TabsTrigger value="margens" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <TrendingUp className="w-3.5 h-3.5" /><span className="hidden sm:inline">Margens</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="perfil"><TabPerfil /></TabsContent>
        <TabsContent value="organizacao"><TabOrganizacao /></TabsContent>
        <TabsContent value="pipeline"><TabPipeline /></TabsContent>
        <TabsContent value="usuarios"><TabUsuarios /></TabsContent>
        <TabsContent value="grupos"><TabGrupos /></TabsContent>
        <TabsContent value="margens"><TabMargens /></TabsContent>
      </Tabs>
    </div>
  )
}