/**
 * Phase 5a: create operator tenants + invite members (staff/service role).
 */
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import type { OperatorMemberRole } from '@/lib/operatorConstants'
import { normalizeOperatorSlug, validateOperatorSlug } from '@/lib/operators/slug'

type Db = SupabaseClient<Database>

export type PlanLimits = {
  max_products: number
  max_members: number
  max_channels: number
}

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  max_products: 50,
  max_members: 20,
  max_channels: 30,
}

export type CreateOperatorInput = {
  name: string
  slug: string
  ownerEmail: string
  timezone?: string
  defaultCurrency?: string
  planCode?: string
  planLimits?: Partial<PlanLimits>
  /** commerce-only by default for external suppliers */
  enableOperations?: boolean
  subdomain?: string | null
  status?: 'active' | 'pending'
}

export type CreateOperatorResult = {
  operatorId: string
  slug: string
  subdomain: string
  ownerMemberId: string
}

function defaultPlanLimits(partial?: Partial<PlanLimits>): PlanLimits {
  return {
    max_products: partial?.max_products ?? DEFAULT_PLAN_LIMITS.max_products,
    max_members: partial?.max_members ?? DEFAULT_PLAN_LIMITS.max_members,
    max_channels: partial?.max_channels ?? DEFAULT_PLAN_LIMITS.max_channels,
  }
}

export async function createOperator(
  db: Db,
  input: CreateOperatorInput
): Promise<CreateOperatorResult> {
  const name = input.name.trim()
  if (!name) throw new Error('Operator name is required')

  const slug = normalizeOperatorSlug(input.slug)
  const slugError = validateOperatorSlug(slug)
  if (slugError) throw new Error(slugError)

  const ownerEmail = input.ownerEmail.trim().toLowerCase()
  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw new Error('Valid owner email is required')
  }

  const subdomain = normalizeOperatorSlug(input.subdomain || slug)
  const subdomainError = validateOperatorSlug(subdomain)
  if (subdomainError) throw new Error(`Subdomain: ${subdomainError}`)

  const operatorId = randomUUID()
  const planLimits = defaultPlanLimits(input.planLimits)
  const modules = {
    commerce: true,
    operations: input.enableOperations === true,
  }

  const { error: opErr } = await db.from('operators').insert({
    id: operatorId,
    name,
    slug,
    status: input.status || 'pending',
    timezone: input.timezone || 'America/Los_Angeles',
    default_currency: input.defaultCurrency || 'USD',
    plan_code: input.planCode || 'starter',
    modules: modules as Json,
    subdomain,
    stripe_connect_status: 'not_started',
    plan_limits: planLimits as unknown as Json,
  })

  if (opErr) {
    if (opErr.code === '23505' || opErr.message.includes('duplicate')) {
      throw new Error('Slug or subdomain already exists')
    }
    throw new Error(opErr.message)
  }

  const { data: member, error: memErr } = await db
    .from('operator_members')
    .insert({
      operator_id: operatorId,
      email: ownerEmail,
      role: 'owner',
      status: 'active',
    })
    .select('id')
    .maybeSingle()

  if (memErr || !member) {
    await db.from('operators').delete().eq('id', operatorId)
    throw new Error(memErr?.message || 'Failed to create owner membership')
  }

  return {
    operatorId,
    slug,
    subdomain,
    ownerMemberId: member.id,
  }
}

export async function inviteOperatorMember(
  db: Db,
  params: {
    operatorId: string
    email: string
    role?: OperatorMemberRole
  }
): Promise<{ memberId: string; status: string }> {
  const email = params.email.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('Valid email is required')
  }

  const role = params.role || 'ops'
  const { data: op } = await db
    .from('operators')
    .select('id, plan_limits')
    .eq('id', params.operatorId)
    .maybeSingle()

  if (!op) throw new Error('Operator not found')

  const limits = (op.plan_limits || {}) as Partial<PlanLimits>
  const maxMembers = Number(limits.max_members) || DEFAULT_PLAN_LIMITS.max_members

  const { count } = await db
    .from('operator_members')
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', params.operatorId)
    .neq('status', 'disabled')

  if ((count || 0) >= maxMembers) {
    throw new Error(`Member limit reached (${maxMembers})`)
  }

  const { data: existing } = await db
    .from('operator_members')
    .select('id, status')
    .eq('operator_id', params.operatorId)
    .eq('email', email)
    .maybeSingle()

  if (existing?.id) {
    const nextStatus = existing.status === 'disabled' ? 'invited' : existing.status
    const { data, error } = await db
      .from('operator_members')
      .update({ role, status: nextStatus })
      .eq('id', existing.id)
      .select('id, status')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message || 'Failed to update member')
    return { memberId: data.id, status: data.status }
  }

  const { data, error } = await db
    .from('operator_members')
    .insert({
      operator_id: params.operatorId,
      email,
      role,
      status: 'invited',
    })
    .select('id, status')
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to invite member')
  }

  return { memberId: data.id, status: data.status }
}

export async function listOperators(db: Db, limit = 100) {
  const { data, error } = await db
    .from('operators')
    .select(
      'id, name, slug, status, timezone, default_currency, plan_code, modules, subdomain, custom_domain, stripe_connect_account_id, stripe_connect_status, plan_limits, created_at'
    )
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data || []
}

export async function listOperatorMembers(db: Db, operatorId: string) {
  const { data, error } = await db
    .from('operator_members')
    .select('id, operator_id, email, role, status, user_id, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}
