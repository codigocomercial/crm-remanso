'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

/* ════════════════════════════
   StatCard — Premium Final
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
      border: 'none',
      boxShadow: '0 8px 20px rgba(62,143,118,0.22)',
      padding: '20px',
    }
    : isGold
      ? {
        background: 'linear-gradient(135deg, #A8842F, #C9A54C)',
        border: 'none',
        boxShadow: '0 8px 20px rgba(184,150,58,0.25)',
        padding: '20px',
      }
      : {
        background: '#FFFFFF',
        border: '1px solid #F1F5F9',
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        padding: '20px',
      }

  const labelColor = isColor ? 'rgba(255,255,255,0.72)' : '#6B7280'
  const valueColor = isColor ? '#FFFFFF' : '#1F2937'
  const iconBg = isColor ? 'rgba(255,255,255,0.15)' : '#F1F5F9'
  const iconColor = isColor ? 'rgba(255,255,255,0.85)' : '#3E8F76'
  const trendColor = isColor
    ? 'rgba(255,255,255,0.82)'
    : trend === 'up' ? '#3E8F76'
      : trend === 'down' ? '#DC2626'
        : '#9CA3AF'

  return (
    <div
      className={cn('rounded-[14px] transition-all hover:-translate-y-0.5 cursor-default', className)}
      style={cardStyle}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Label uppercase refinado */}
        <p style={{
          color: labelColor,
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          {label}
        </p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}>
            <Icon size={14} style={{ color: iconColor, opacity: isColor ? 0.85 : 1 }} />
          </div>
        )}
      </div>

      {/* Número principal — grande e bold */}
      <p style={{
        color: valueColor,
        fontSize: '32px',
        fontWeight: 700,
        letterSpacing: '-1.5px',
        lineHeight: 1,
        marginBottom: '8px',
      }}>
        {value}
      </p>

      {(trendLabel || sub) && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={11} style={{ color: trendColor }} />}
          {trend === 'down' && <TrendingDown size={11} style={{ color: trendColor }} />}
          <p style={{ color: trendColor, fontSize: '11px', fontWeight: 500 }}>
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
        <h1 style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#1F2937',
          letterSpacing: '-0.5px',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px', fontWeight: 400 }}>
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
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>{title}</p>
      {linkHref && linkLabel && (
        <Link href={linkHref}
          className="hover:opacity-70 transition-opacity"
          style={{ fontSize: '11px', fontWeight: 500, color: '#3E8F76' }}>
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
  ok: { bg: '#EBF5F1', color: '#2F6F5D' },
  warn: { bg: '#FAF3E0', color: '#9E7F2E' },
  late: { bg: '#FEF2F2', color: '#DC2626' },
  new: { bg: '#EBF5F1', color: '#2F6F5D' },
  inactive: { bg: '#F9FAFB', color: '#6B7280' },
}

interface StatusBadgeProps {
  status: StatusType
  label: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { bg, color } = STATUS_STYLES[status]
  return (
    <span style={{
      backgroundColor: bg,
      color,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      letterSpacing: '0.05px',
    }}>
      {label}
    </span>
  )
}