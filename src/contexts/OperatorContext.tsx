'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  KOVEgAS_OPERATOR_ID,
  KOVEgAS_OPERATOR_SLUG,
  type OperatorMemberRecord,
  type OperatorMemberRole,
  type OperatorRecord,
} from '@/lib/operatorConstants'
import {
  readStoredActiveOperatorId,
  writeStoredActiveOperatorId,
} from '@/lib/operators/activeOperatorStorage'
import { writeActiveOperatorCookie } from '@/lib/operators/activeOperatorCookie'

export type OperatorMembershipOption = {
  operatorId: string
  name: string
  slug: string
  role: OperatorMemberRole
  status: OperatorRecord['status']
}

type OperatorContextValue = {
  /** Active tenant id */
  operatorId: string
  operator: OperatorRecord | null
  membership: OperatorMemberRecord | null
  role: OperatorMemberRole | null
  loading: boolean
  /** Operations Suite (fleet/guide/expense) enabled for this operator */
  operationsEnabled: boolean
  /** All active memberships for the signed-in user (multi-tenant switch) */
  availableOperators: OperatorMembershipOption[]
  setActiveOperatorId: (operatorId: string) => Promise<void>
  refresh: () => Promise<void>
}

const OperatorContext = createContext<OperatorContextValue | undefined>(undefined)

const FALLBACK_OPERATOR: OperatorRecord = {
  id: KOVEgAS_OPERATOR_ID,
  name: 'Kovegas / Las Vegas Mania Tour',
  slug: KOVEgAS_OPERATOR_SLUG,
  status: 'active',
  timezone: 'America/Los_Angeles',
  default_currency: 'USD',
  plan_code: 'internal',
  modules: { commerce: true, operations: true },
}

function mapOperatorRow(opRow: {
  id: string
  name: string
  slug: string
  status: string
  timezone: string
  default_currency: string
  plan_code: string
  modules: unknown
  created_at?: string | null
  updated_at?: string | null
  subdomain?: string | null
  stripe_connect_status?: string | null
}): OperatorRecord {
  const modules =
    opRow.modules && typeof opRow.modules === 'object' && !Array.isArray(opRow.modules)
      ? (opRow.modules as OperatorRecord['modules'])
      : { commerce: true, operations: false }

  return {
    id: String(opRow.id),
    name: String(opRow.name),
    slug: String(opRow.slug),
    status: (opRow.status as OperatorRecord['status']) || 'active',
    timezone: String(opRow.timezone || 'America/Los_Angeles'),
    default_currency: String(opRow.default_currency || 'USD'),
    plan_code: String(opRow.plan_code || 'internal'),
    modules,
    ...(opRow.subdomain ? { subdomain: String(opRow.subdomain) } : {}),
    ...(opRow.stripe_connect_status
      ? { stripe_connect_status: String(opRow.stripe_connect_status) }
      : {}),
    ...(opRow.created_at ? { created_at: String(opRow.created_at) } : {}),
    ...(opRow.updated_at ? { updated_at: String(opRow.updated_at) } : {}),
  }
}

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [operator, setOperator] = useState<OperatorRecord | null>(FALLBACK_OPERATOR)
  const [membership, setMembership] = useState<OperatorMemberRecord | null>(null)
  const [availableOperators, setAvailableOperators] = useState<OperatorMembershipOption[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  const applyOperatorSession = useCallback(async (operatorId: string) => {
    try {
      await supabase.rpc('set_current_operator_id', {
        p_operator_id: operatorId,
      })
    } catch {
      // RPC unavailable until migration applied
    }
    // Phase 6d.0: optional JWT app_metadata.operator_id when SAAS_STAFF_TENANT_LOCK on
    try {
      const res = await fetchApiWithAuth('/api/admin/operators/active-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        lockEnabled?: boolean
        skipped?: boolean
      }
      if (res.ok && json.lockEnabled && !json.skipped) {
        await supabase.auth.refreshSession()
      }
    } catch {
      // lock off or API unavailable — safe no-op
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let memberships: OperatorMemberRecord[] = []

      if (user?.email) {
        const email = user.email.trim().toLowerCase()
        const { data: memberRows, error: memberError } = await supabase
          .from('operator_members')
          .select('*')
          .eq('email', email)
          .in('status', ['active', 'invited'])
          .order('created_at', { ascending: true })
          .limit(50)

        if (memberError) {
          console.warn('[OperatorContext] operator_members:', memberError.message)
        } else if (memberRows?.length) {
          memberships = memberRows as OperatorMemberRecord[]
          // Auto-activate invited → active on first successful resolve
          for (const m of memberships) {
            if (m.status === 'invited') {
              void supabase
                .from('operator_members')
                .update({ status: 'active', user_id: user.id || null })
                .eq('id', m.id)
                .then(() => {
                  m.status = 'active'
                })
            }
          }
        }
      }

      const operatorIds = Array.from(new Set(memberships.map((m) => m.operator_id)))
      let opById = new Map<string, OperatorRecord>()

      if (operatorIds.length > 0) {
        const { data: opRows } = await supabase
          .from('operators')
          .select(
            'id, name, slug, status, timezone, default_currency, plan_code, modules, subdomain, stripe_connect_status, created_at, updated_at'
          )
          .in('id', operatorIds)

        for (const row of opRows || []) {
          opById.set(String(row.id), mapOperatorRow(row))
        }
      }

      // Always ensure Kovegas is loadable for staff without membership row yet
      if (!opById.has(KOVEgAS_OPERATOR_ID)) {
        const { data: kovegas } = await supabase
          .from('operators')
          .select(
            'id, name, slug, status, timezone, default_currency, plan_code, modules, subdomain, stripe_connect_status, created_at, updated_at'
          )
          .eq('id', KOVEgAS_OPERATOR_ID)
          .maybeSingle()
        if (kovegas) opById.set(KOVEgAS_OPERATOR_ID, mapOperatorRow(kovegas))
      }

      const options: OperatorMembershipOption[] = memberships
        .map((m) => {
          const op = opById.get(m.operator_id)
          if (!op) return null
          return {
            operatorId: op.id,
            name: op.name,
            slug: op.slug,
            role: m.role,
            status: op.status,
          }
        })
        .filter((x): x is OperatorMembershipOption => x != null)

      // Deduplicate by operator (prefer higher role)
      const rank = (r: OperatorMemberRole) =>
        r === 'owner' ? 0 : r === 'admin' ? 1 : 2
      const deduped = new Map<string, OperatorMembershipOption>()
      for (const opt of options.sort((a, b) => rank(a.role) - rank(b.role))) {
        if (!deduped.has(opt.operatorId)) deduped.set(opt.operatorId, opt)
      }
      const available = Array.from(deduped.values())
      setAvailableOperators(available)

      const stored = readStoredActiveOperatorId()
      let resolvedOperatorId: string = KOVEgAS_OPERATOR_ID

      if (stored && (available.some((a) => a.operatorId === stored) || stored === KOVEgAS_OPERATOR_ID)) {
        resolvedOperatorId = stored
      } else if (available.length > 0) {
        const ranked = [...available].sort((a, b) => rank(a.role) - rank(b.role))
        resolvedOperatorId = ranked[0]!.operatorId
      }

      const nextMembership =
        memberships
          .filter((m) => m.operator_id === resolvedOperatorId)
          .sort((a, b) => rank(a.role) - rank(b.role))[0] || null

      const opRecord =
        opById.get(resolvedOperatorId) ||
        (resolvedOperatorId === KOVEgAS_OPERATOR_ID
          ? FALLBACK_OPERATOR
          : { ...FALLBACK_OPERATOR, id: resolvedOperatorId })

      setOperator(opRecord)
      setMembership(nextMembership)
      writeStoredActiveOperatorId(resolvedOperatorId)
      writeActiveOperatorCookie(resolvedOperatorId)
      await applyOperatorSession(resolvedOperatorId)
    } finally {
      setLoading(false)
    }
  }, [user?.email, user?.id, applyOperatorSession])

  const setActiveOperatorId = useCallback(
    async (nextId: string) => {
      writeStoredActiveOperatorId(nextId)
      await refresh()
    },
    [refresh]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<OperatorContextValue>(() => {
    const op = operator ?? FALLBACK_OPERATOR
    return {
      operatorId: op.id,
      operator: op,
      membership,
      role: membership?.role ?? null,
      loading,
      operationsEnabled: op.modules?.operations === true,
      availableOperators,
      setActiveOperatorId,
      refresh,
    }
  }, [operator, membership, loading, availableOperators, setActiveOperatorId, refresh])

  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>
}

export function useOperator(): OperatorContextValue {
  const ctx = useContext(OperatorContext)
  if (!ctx) {
    throw new Error('useOperator must be used within OperatorProvider')
  }
  return ctx
}

/** Safe hook when provider may be absent (public pages). Falls back to Kovegas. */
export function useOperatorOptional(): OperatorContextValue {
  const ctx = useContext(OperatorContext)
  if (ctx) return ctx
  return {
    operatorId: KOVEgAS_OPERATOR_ID,
    operator: FALLBACK_OPERATOR,
    membership: null,
    role: null,
    loading: false,
    operationsEnabled: true,
    availableOperators: [],
    setActiveOperatorId: async () => {},
    refresh: async () => {},
  }
}
