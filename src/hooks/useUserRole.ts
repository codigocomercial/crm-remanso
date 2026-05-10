'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type UserRole,
  type Permission,
  type MarginTargets,
  type MarginLevel,
  DEFAULT_TARGETS,
  can as canFn,
  getMarginLevel as getMarginLevelFn,
  MARGIN_COLORS,
} from '@/lib/permissions'

interface UserRoleState {
  role: UserRole
  loading: boolean
  targets: MarginTargets
  can: (permission: Permission) => boolean
  getMarginLevel: (pct: number, type: 'order' | 'load') => MarginLevel
  getMarginIndicator: (pct: number, type: 'order' | 'load') => {
    level: MarginLevel
    color: string
    bg: string
    label: string
    emoji: string
  }
}

const cache: { role: UserRole | null; targets: MarginTargets | null } = {
  role: null,
  targets: null,
}

export function useUserRole(): UserRoleState {
  const [role, setRole] = useState<UserRole>(cache.role || 'seller')
  const [targets, setTargets] = useState<MarginTargets>(cache.targets || DEFAULT_TARGETS)
  const [loading, setLoading] = useState(!cache.role)

  useEffect(() => {
    if (cache.role && cache.targets) return

    const supabase = createClient()

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Busca role do usuário
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        const userRole = (userData?.role as UserRole) || 'seller'

        // Busca metas de margem da organização
        const { data: orgData } = await supabase
          .from('organizations')
          .select('margin_order_good, margin_order_low, margin_load_good, margin_load_low')
          .single()

        const marginTargets: MarginTargets = {
          order_good: orgData?.margin_order_good ?? DEFAULT_TARGETS.order_good,
          order_low:  orgData?.margin_order_low  ?? DEFAULT_TARGETS.order_low,
          load_good:  orgData?.margin_load_good  ?? DEFAULT_TARGETS.load_good,
          load_low:   orgData?.margin_load_low   ?? DEFAULT_TARGETS.load_low,
        }

        cache.role = userRole
        cache.targets = marginTargets

        setRole(userRole)
        setTargets(marginTargets)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return {
    role,
    loading,
    targets,
    can: (permission: Permission) => canFn(role, permission),
    getMarginLevel: (pct: number, type: 'order' | 'load') =>
      getMarginLevelFn(pct, type, targets),
    getMarginIndicator: (pct: number, type: 'order' | 'load') => {
      const level = getMarginLevelFn(pct, type, targets)
      return { level, ...MARGIN_COLORS[level] }
    },
  }
}
