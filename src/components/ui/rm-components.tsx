'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

/* ════════════════════════════
   StatCard — Linear/Stripe style
════════════════════════════ */
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  icon?: LucideIcon
  variant?: 'default' | 'teal' | 'gold'
  className?: string
}

export function StatCard({
  label, value, sub, trend, trendLabel, icon: Icon,
  variant = 'default', className,
}: StatCardProps) {
  const isTeal = variant === 'teal'
  const isGold = variant === 'gold'
  const isColor = isTeal || isGold

  const cardStyle = isTeal
    ? {
      background: 'linear-gradient(135deg, #3E8F76, #56AF90)',
      borderColor: 'transparent',
      boxShadow: '0 4px 20px rgba(62,143,118,0.25)',
    }
    : isGold
      ? {
        background: 'linear-gradient(135deg, #B8963A, #C9A54C)',
        borderColor: 'transparent',
        boxShadow: '0 4px 20px rgba(184,150,58,0.25)',
      }
      : {
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }

  const labelColor = isColor ? 'rgba(255,255,255,0.75)' : 'var(--neutral-600)'
  const valueColor = isColor ? '#ffffff' : 'var(--neutral-900)'
  const iconBg = isColor ? 'rgba(255,255,255,0.15)' : 'var(--neutral-100)'
  const iconColor = isColor ? 'rgba(255,255,255,0.85)' : 'var(--brand-teal)'
  const trendColor = isColor
    ? 'rgba(255,255,255,0.85)'
    : trend === 'up' ? 'var(--brand-teal)'
      : trend === 'down' ? 'var(--color-danger)'
        : 'var(--neutral-500)'

  return (
    <div
      className={cn('rm-card transition-all hover:-translate-y-0.5 cursor-default', className)}
      style={cardStyle}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: labelColor }}>
          {label}
        </p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg, opacity: 0.9 }}>
            <Icon size={14} style={{ color: iconColor }} />
          </div>
        )}
      </div>

      <p className="text-[30px] font-bold leading-none mb-2"
        style={{ color: valueColor, letterSpacing: '-1.5px' }}>
        {value}
      </p>

      {(trendLabel || sub) && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={11} style={{ color: trendColor }} />}
          {trend === 'down' && <TrendingDown size={11} style={{ color: trendColor }} />}
          <p className="text-[11px] font-medium" style={{ color: trendColor }}>
            {trendLabel || sub}
          </p>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════
   PageHeader
════════════════════════════ */
interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[22px] font-semibold"
          style={{ color: 'var(--neutral-900)', letterSpacing: '-0.5px' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] mt-0.5 font-normal" style={{ color: 'var(--neutral-600)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

/* ════════════════════════════
   SectionHeader
════════════════════════════ */
interface SectionHeaderProps {
  title: string
  linkHref?: string
  linkLabel?: string
}

export function SectionHeader({ title, linkHref, linkLabel }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--neutral-900)' }}>{title}</p>
      {linkHref && linkLabel && (
        <Link href={linkHref}
          className="text-[11px] font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--brand-teal)' }}>
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}

/* ════════════════════════════
   StatusBadge
════════════════════════════ */
type StatusType = 'ok' | 'warn' | 'late' | 'new' | 'inactive'

const STATUS_STYLES: Record<StatusType, { bg: string; color: string }> = {
  ok: { bg: 'var(--color-success-bg)', color: 'var(--brand-teal-dark)' },
  warn: { bg: 'var(--color-warning-bg)', color: 'var(--brand-gold-dark)' },
  late: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  new: { bg: 'var(--brand-teal-bg)', color: 'var(--brand-teal-dark)' },
  inactive: { bg: 'var(--neutral-100)', color: 'var(--neutral-600)' },
}

interface StatusBadgeProps {
  status: StatusType
  label: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { bg, color } = STATUS_STYLES[status]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  )
}