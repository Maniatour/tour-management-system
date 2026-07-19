/**
 * Public (customer-site) operator resolution markers.
 * Distinct from admin active-tenant localStorage (`tms_active_operator_id`).
 */
export const PUBLIC_OPERATOR_ID_HEADER = 'x-operator-id'
export const PUBLIC_OPERATOR_SUBDOMAIN_HEADER = 'x-operator-subdomain'
export const PUBLIC_OPERATOR_SOURCE_HEADER = 'x-operator-source'
export const PUBLIC_OPERATOR_ID_COOKIE = 'tms_public_operator_id'

export type PublicOperatorSource =
  | 'localhost'
  | 'apex'
  | 'subdomain'
  | 'env_map'
  | 'fallback'
