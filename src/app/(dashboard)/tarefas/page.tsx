'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Circle, CheckCircle2, Clock, Check, Loader2, Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface Task {
  id: string
  title: string
  due_at: string | null
  priority: string
  status: string
}

const PRIORITY_BADGE: Record<string, { label: string, classes: string }> = {
  low: { label: 'Baixa', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  medium: { label: 'Média', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  high: { label: 'Alta', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent: { label: 'Urgente', classes: 'bg-red-100 text-red-700 border-red-200' },
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [filter])

  async function fetchTasks() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('tasks')
      .select('*')
      .order('due_at', { ascending: true })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    if (data) setTasks(data)
    setLoading(false)
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending'
    setUpdatingId(id)

    // Optimistic UI update
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    )

    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
    
    // Remove after a small delay if it doesn't match the active filter anymore
    if (filter !== 'all' && filter !== newStatus) {
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== id))
      }, 300)
    }
    
    setUpdatingId(null)
  }

  function getDueStatus(dueDate: string | null, status: string) {
    if (status === 'done') return { isLate: false, color: 'text-muted-foreground' }
    if (!dueDate) return { isLate: false, color: 'text-muted-foreground' }
    
    const isLate = new Date(dueDate) < new Date()
    return { isLate, color: isLate ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium' }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle suas prioridades do dia</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex bg-muted/50 p-1 rounded-lg w-max border border-border">
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === f 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' && 'Todas'}
            {f === 'pending' && 'Pendentes'}
            {f === 'done' && 'Concluídas'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center text-center h-[400px]">
             <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50 mb-4" />
             <p className="text-muted-foreground text-sm">Carregando tarefas...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center h-[400px]">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
               <Check className="w-8 h-8 text-muted-foreground/50" />
             </div>
             <p className="text-lg font-medium text-foreground">Nenhuma tarefa encontrada</p>
             <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                {filter === 'pending' 
                  ? 'Você não tem nenhuma pendência. Aproveite para descansar ou adiantar novos leads.'
                  : 'Nenhuma tarefa corresponde a este filtro.'}
             </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map(task => {
              const { isLate, color: dueColor } = getDueStatus(task.due_at, task.status)
              const badgeConf = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
              const isDone = task.status === 'done'
              
              return (
                <li key={task.id} className={`p-4 sm:px-6 hover:bg-muted/30 transition-colors flex items-start gap-4 ${isDone ? 'opacity-60' : ''}`}>
                  {/* Checkbox Trigger */}
                  <button 
                    onClick={() => toggleStatus(task.id, task.status)}
                    disabled={updatingId === task.id}
                    className="mt-1 w-5 h-5 flex flex-shrink-0 items-center justify-center transition-colors focus:outline-none"
                  >
                    {updatingId === task.id ? (
                       <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : isDone ? (
                       <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                       <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-medium truncate transition-all ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                       <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${badgeConf.classes}`}>
                         {badgeConf.label}
                       </span>
                       
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                         {isLate && !isDone ? (
                           <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                         ) : (
                           <Calendar className="w-3.5 h-3.5" />
                         )}
                         <span className={dueColor}>
                           {task.due_at ? formatDate(task.due_at) : 'Sem data definida'}
                         </span>
                       </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
