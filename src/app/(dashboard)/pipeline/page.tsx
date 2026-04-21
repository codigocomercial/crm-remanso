'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent, 
  closestCorners, 
  useDraggable, 
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { KanbanSquare, Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

// Interfaces
interface Stage {
  id: string
  name: string
  order_index?: number
}

interface Lead {
  id: string
  title: string
  contact_name: string | null
  value: number | null
  source: string | null
  stage_id: string
}

// Components
function KanbanCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { ...lead }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="bg-card p-3.5 rounded-xl border border-border shadow-sm cursor-grab active:cursor-grabbing mb-3 hover:border-primary/50 transition-colors"
    >
      <h4 className="font-semibold text-sm text-foreground mb-1 leading-tight">{lead.title}</h4>
      {lead.contact_name && (
        <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          {lead.value ? formatCurrency(lead.value) : 'R$ 0,00'}
        </span>
        {lead.source && (
           <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-70">
             {lead.source}
           </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ stage, leads }: { stage: Stage, leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  // Calcula o valor total deste stage
  const stageTotalValue = leads.reduce((acc, curr) => acc + (curr.value || 0), 0)

  return (
    <div className="flex flex-col min-w-[320px] w-[320px] h-full flex-shrink-0 bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
      <div className="p-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            {stage.name}
            <span className="bg-background border border-border text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
              {leads.length}
            </span>
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium mt-1">
            {formatCurrency(stageTotalValue)}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
           <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      <div 
        ref={setNodeRef} 
        className={`flex-1 p-3 transition-colors overflow-y-auto min-h-[150px] ${
          isOver ? 'bg-primary/5' : 'bg-transparent'
        }`}
      >
         {leads.map(lead => (
           <KanbanCard key={lead.id} lead={lead} />
         ))}
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  useEffect(() => {
    async function loadBoard() {
      setLoading(true)
      const supabase = createClient()
      
      // Load stages and leads in parallel
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('order_index', { ascending: true }),
        supabase.from('leads').select('*')
      ])

      if (stagesRes.data) setStages(stagesRes.data)
      if (leadsRes.data) setLeads(leadsRes.data)
      
      setLoading(false)
    }
    loadBoard()
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const lead = leads.find(l => l.id === active.id)
    if (lead) setActiveLead(lead)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return

    const activeLeadId = active.id as string
    const targetStageId = over.id as string

    // Find current lead and avoid unnecessary DB updates
    const currentLead = leads.find(l => l.id === activeLeadId)
    if (!currentLead || currentLead.stage_id === targetStageId) return

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === activeLeadId ? { ...l, stage_id: targetStageId } : l))

    // DB Update
    const supabase = createClient()
    await supabase.from('leads').update({ stage_id: targetStageId }).eq('id', activeLeadId)
  }

  const handleDragCancel = () => {
    setActiveLead(null)
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <KanbanSquare className="w-6 h-6 text-primary" />
            Pipeline de Vendas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mova os leads pelas etapas arrastando os cards</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Negócio
        </Button>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : stages.length === 0 ? (
        <div className="flex-1 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-10 bg-card/50">
           <KanbanSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
           <h2 className="text-xl font-semibold text-foreground">Nenhuma etapa encontrada</h2>
           <p className="text-muted-foreground text-sm mt-2 max-w-sm">
             Parece que o seu pipeline ainda não possui etapas configuradas ou a tabela "pipeline_stages" está vazia no Supabase.
           </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <DndContext 
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 h-full">
              {stages.map(stage => (
                <KanbanColumn 
                  key={stage.id} 
                  stage={stage} 
                  leads={leads.filter(l => l.stage_id === stage.id)} 
                />
              ))}

               {/* Botão de adicionar nova etapa visual (desativado/placeholder) */}
               <div className="min-w-[320px] w-[320px] h-[100px] flex-shrink-0 bg-muted/10 border-2 border-dashed border-border rounded-2xl flex flex-col flex-center items-center justify-center text-muted-foreground/60 hover:bg-muted/30 hover:text-muted-foreground cursor-pointer transition-colors">
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="font-medium text-sm">Nova etapa</span>
               </div>
            </div>

            {/* DragOverlay for smooth animation */}
            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
              {activeLead ? (
                <div className="opacity-90 rotate-2 scale-105 transition-transform cursor-grabbing">
                  <KanbanCard lead={activeLead} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}
