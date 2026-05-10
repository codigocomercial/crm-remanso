'use client'

import { useUserRole } from '@/hooks/useUserRole'
import { type Permission } from '@/lib/permissions'

// ── MarginDisplay ──────────────────────────────────────────────────────────
// Mostra margem real para admin/manager ou indicador visual para vendedor
interface MarginDisplayProps {
  pct: number
  value?: number
  type: 'order' | 'load'
  size?: 'sm' | 'md'
}

export function MarginDisplay({ pct, value, type, size = 'md' }: MarginDisplayProps) {
  const { can, getMarginIndicator } = useUserRole()
  const indicator = getMarginIndicator(pct, type)

  if (can('view_margins')) {
    // Admin/Manager — mostra o número real
    return (
      <div className="text-right">
        <span
          className={size === 'sm' ? 'text-[12px] font-bold' : 'text-[13px] font-bold'}
          style={{ color: indicator.color }}
        >
          {(pct || 0).toFixed(1)}%
        </span>
        {value !== undefined && (
          <p className="text-[10px]" style={{ color: 'var(--neutral-500)' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
          </p>
        )}
      </div>
    )
  }

  // Vendedor — mostra só o indicador visual
  return (
    <div className="flex items-center justify-end gap-1.5">
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ color: indicator.color, backgroundColor: indicator.bg }}
        title={indicator.label}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: indicator.color }}
        />
        {size !== 'sm' && indicator.label}
      </div>
    </div>
  )
}

// ── MarginBar ──────────────────────────────────────────────────────────────
// Barra de progresso colorida sem revelar %
interface MarginBarProps {
  pct: number
  type: 'order' | 'load'
}

export function MarginBar({ pct, type }: MarginBarProps) {
  const { can, getMarginIndicator } = useUserRole()
  const indicator = getMarginIndicator(pct, type)
  const width = Math.min(Math.max(pct, 0), 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: indicator.color }}
        />
      </div>
      {can('view_margins') && (
        <span className="text-[11px] font-bold flex-shrink-0" style={{ color: indicator.color }}>
          {(pct || 0).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

// ── ProtectedContent ───────────────────────────────────────────────────────
// Esconde conteúdo baseado em permissão
interface ProtectedContentProps {
  permission: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedContent({ permission, children, fallback = null }: ProtectedContentProps) {
  const { can } = useUserRole()
  return can(permission) ? <>{children}</> : <>{fallback}</>
}
