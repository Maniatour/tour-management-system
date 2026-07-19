/** Well-known Kovegas tenant — docs/adr/001-saas-tenancy-and-modules.txt */
export const KOVEgAS_OPERATOR_ID = 'a0000000-0000-4000-8000-000000000001' as const

export const KOVEgAS_OPERATOR_SLUG = 'kovegas' as const

export type OperatorMemberRole =
  | 'owner'
  | 'admin'
  | 'ops'
  | 'finance'
  | 'guide'
  | 'read_only'

export type OperatorStatus = 'active' | 'suspended' | 'pending'

export interface OperatorRecord {
  id: string
  name: string
  slug: string
  status: OperatorStatus
  timezone: string
  default_currency: string
  plan_code: string
  modules: {
    commerce?: boolean
    operations?: boolean
    [key: string]: boolean | undefined
  }
  subdomain?: string
  custom_domain?: string
  stripe_connect_account_id?: string | null
  stripe_connect_status?: string
  created_at?: string
  updated_at?: string
}

export interface OperatorMemberRecord {
  id: string
  operator_id: string
  user_id: string | null
  email: string
  role: OperatorMemberRole
  status: 'active' | 'invited' | 'disabled'
  created_at?: string
  updated_at?: string
}
