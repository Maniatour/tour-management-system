import { supabase, supabaseAdmin } from '@/lib/supabase'

/**
 * `payment_methods`는 anon GRANT가 없다.
 * 서버: service_role, 브라우저: 로그인 세션(authenticated).
 */
export function paymentMethodsDb() {
  return supabaseAdmin ?? supabase
}
