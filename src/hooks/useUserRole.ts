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

// Cache em memória — persiste durante a sessão do browser
let cachedRole: UserRole | null = null
let cachedTargets: MarginTargets | null = null
let loadPromise: Promise<void> | null = null

async function loadUserRole() {
  const supabase = createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { cachedRole = 'seller'; cachedTargets = DEFAULT_TARGETS; return }

    const [{ data: userData }, { data: orgData }] = await Promise.all([
      supabase.from('users').select('role').eq('id', user.id).single(),
      supabase.from('organizations').select('margin_order_good,margin_order_low,margin_load_good,margin_load_low').single(),
    ])

    cachedRole = (userData?.role as UserRole) || 'seller'
    cachedTargets = {
      order_good: orgData?.margin_order_good ?? DEFAULT_TARGETS.order_good,
      order_low:  orgData?.margin_order_low  ?? DEFAULT_TARGETS.order_low,
      load_good:  orgData?.margin_load_good  ?? DEFAULT_TARGETS.load_good,
      load_low:   orgData?.margin_load_low   ?? DEFAULT_TARGETS.load_low,
    }
  } catch {
    cachedRole = 'seller'
    cachedTargets = DEFAULT_TARGETS
  }
}

export function useUserRole(): UserRoleState {
  const [role, setRole] = useState<UserRole | null>(cachedRole)
  const [targets, setTargets] = useState<MarginTargets>(cachedTargets || DEFAULT_TARGETS)
  const [loading, setLoading] = useState(!cachedRole)

  useEffect(() => {
    if (cachedRole && cachedTargets) {
      setRole(cachedRole)
      setTargets(cachedTargets)
      setLoading(false)
      return
    }

    if (!loadPromise) {
      loadPromise = loadUserRole()
    }

    loadPromise.then(() => {
      setRole(cachedRole!)
      setTargets(cachedTargets!)
      setLoading(false)
    })
  }, [])

  // Enquanto carrega, assume admin para não piscar como seller
  const effectiveRole = role ?? 'admin'

  return {
    role: effectiveRole,
    loading,
    targets,
    can: (permission: Permission) => canFn(effectiveRole, permission),
    getMarginLevel: (pct: number, type: 'order' | 'load') =>
      getMarginLevelFn(pct, type, targets),
    getMarginIndicator: (pct: number, type: 'order' | 'load') => {
      const level = getMarginLevelFn(pct, type, targets)
      return { level, ...MARGIN_COLORS[level] }
    },
  }
}
