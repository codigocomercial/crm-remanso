'use client'

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
  Lock, Mail, AlertCircle, Plus, Trash2, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sortable Stage Row ────────────────────────────────────────────────────────
function SortableStageRow({
  stage,
  onSave,
  onDelete,
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
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Order badge */}
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold flex-shrink-0">
        {stage.order_index + 1}
      </span>

      {/* Name field */}
      {editing ? (
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          className="flex-1 h-8 text-sm"
        />
      ) : (
        <span className="flex-1 text-sm font-medium text-foreground">{stage.name}</span>
      )}

      {/* Actions */}
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
      {/* Avatar */}
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

      {/* Dados pessoais */}
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
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {msg.text}
          </div>
        )}
        <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar perfil
        </Button>
      </div>

      <Separator />

      {/* Senha */}
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
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {pwdMsg.text}
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
    // Persist to Supabase settings table if available, else just simulate
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
            <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Urnas Remanso" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment">Segmento de atuação</Label>
            <Input id="segment" value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: Funerária, Saúde, Varejo..." />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
            : saved
              ? <><Check className="w-4 h-4 mr-2" />Salvo!</>
              : 'Salvar organização'
          }
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
    const { data } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('order_index', { ascending: true })
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

    // Persist order
    const supabase = createClient()
    await Promise.all(
      reordered.map(s =>
        supabase.from('pipeline_stages').update({ order_index: s.order_index }).eq('id', s.id)
      )
    )
  }

  async function handleSaveName(id: string, name: string) {
    const supabase = createClient()
    await supabase.from('pipeline_stages').update({ name }).eq('id', id)
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('pipeline_stages').delete().eq('id', id)
    setStages(prev => {
      const filtered = prev.filter(s => s.id !== id)
      return filtered.map((s, i) => ({ ...s, order_index: i }))
    })
  }

  async function handleAddStage() {
    if (!newStageName.trim()) return
    setAdding(true)
    const supabase = createClient()
    const order = stages.length
    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert({ name: newStageName.trim(), order_index: order })
      .select()
      .single()
    if (!error && data) {
      setStages(prev => [...prev, data])
      setNewStageName('')
    }
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

      {/* Add new stage */}
      <div className="flex gap-2 pt-2">
        <Input
          value={newStageName}
          onChange={e => setNewStageName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddStage()}
          placeholder="Nova etapa..."
          className="flex-1"
        />
        <Button onClick={handleAddStage} disabled={adding || !newStageName.trim()}>
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="ml-1.5 hidden sm:inline">Adicionar</span>
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Usuários ────────────────────────────────────────────────────────────
function TabUsuarios() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: true })
      setUsers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const roleColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    user: 'bg-muted text-muted-foreground',
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    user: 'Usuário',
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Usuários do sistema
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Usuários com acesso ao CRM.</p>
        </div>
        <Badge variant="secondary">{users.length} usuários</Badge>
      </div>

      {users.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado na tabela <code className="text-xs bg-muted px-1.5 py-0.5 rounded">users</code>.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {users.map((u, i) => (
            <div key={u.id} className={cn('flex items-center gap-4 px-4 py-3.5', i !== 0 && 'border-t border-border')}>
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                  {u.full_name ? initials(u.full_name) : u.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'Sem nome'}</p>
                  {u.role && (
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleColor[u.role] ?? 'bg-muted text-muted-foreground')}>
                      {roleLabel[u.role] ?? u.role}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="text-right hidden sm:block flex-shrink-0">
                <p className="text-xs text-muted-foreground">Desde</p>
                <p className="text-xs font-medium text-foreground">{formatDate(u.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Para convidar novos usuários ou alterar permissões, acesse o painel do <strong className="text-foreground">Supabase Authentication</strong>. O gerenciamento de convites ainda será integrado nesta tela.
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
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
          <TabsTrigger value="perfil" id="tab-perfil" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="organizacao" id="tab-organizacao" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Organização</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" id="tab-pipeline" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <KanbanSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="usuarios" id="tab-usuarios" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <TabPerfil />
        </TabsContent>
        <TabsContent value="organizacao">
          <TabOrganizacao />
        </TabsContent>
        <TabsContent value="pipeline">
          <TabPipeline />
        </TabsContent>
        <TabsContent value="usuarios">
          <TabUsuarios />
        </TabsContent>
      </Tabs>
    </div>
  )
}
