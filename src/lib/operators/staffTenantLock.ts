/**
 * Opt-in staff tenant lock (Phase 6d.0–6d.3).
 * When enabled, active-session API writes JWT app_metadata.operator_id so
 * staff_can_select_operator_row() scopes ops finance + journal SELECT
 * (expenses/cash/accounts/payments/statement/match/journal).
 *
 * SAAS_STAFF_TENANT_LOCK=
 *   unset/empty/0/false/off → off (default; Kovegas staff SELECT unchanged)
 *   1|true|on|* → on
 */

export function isStaffTenantLockEnabled(
  rawFlag: string | undefined = process.env.SAAS_STAFF_TENANT_LOCK
): boolean {
  const value = (rawFlag || '').trim().toLowerCase()
  if (!value) return false
  return value === '1' || value === 'true' || value === 'on' || value === '*'
}
