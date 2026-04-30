'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isAbortLikeError } from '@/lib/supabase'

type PmRow = {
  id: string
  method: string
  method_type: string | null
  display_name: string | null
  user_email: string | null
  status: string | null
}

export type PaymentMethodOption = {
  id: string
  name: string
  method: string
  method_type: string | null
  user_email: string | null
  status: string | null
}

type TeamRow = {
  email: string
  name_ko: string | null
  name_en: string | null
}

/** team(가이드) · 방법명 → «CC 0120 (Joey)» 형식 */
function buildPaymentMethodLabel(
  pm: PmRow,
  teamByEmailLower: Map<string, TeamRow>
): string {
  const method = (pm.method && pm.method.trim()) || ''
  const em = pm.user_email ? String(pm.user_email).toLowerCase() : ''
  let guide = ''
  if (em) {
    const t = teamByEmailLower.get(em)
    if (t) {
      guide = (t.name_ko && t.name_ko.trim()) || (t.name_en && t.name_en.trim()) || ''
    }
  }

  if (!guide && pm.display_name) {
    const d = pm.display_name.trim()
    if (d && d !== method) {
      if (d.includes('(') && d.includes(')')) {
        if (d.startsWith(method) || !method) {
          return d
        }
      }
      if (d.includes(' - ')) {
        const tail = d.split(' - ').pop()!.trim()
        if (tail && tail !== method) {
          guide = tail
        }
      } else if (d !== method) {
        guide = d
      }
    }
  }

  if (method && guide) {
    if (guide === method) {
      return method
    }
    return `${method} (${guide})`
  }
  if (method) {
    return method
  }
  if (pm.display_name?.trim()) {
    return pm.display_name.trim()
  }
  return pm.id
}

/** 예약·투어·회사 지출 폼: `payment_methods` + team(가이드) 표시명 */
export function usePaymentMethodOptions() {
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([])
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, method_type, display_name, user_email, status')
        .order('method')
      if (error) throw error

      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
      if (teamError) {
        console.warn('team 로드(결제방법 표시용):', teamError)
      }
      const teamByEmailLower = new Map<string, TeamRow>()
      teamData?.forEach((r: TeamRow) => {
        const k = String(r.email).toLowerCase()
        teamByEmailLower.set(k, r)
      })

      const map: Record<string, string> = {}
      const options: PaymentMethodOption[] = []
      const rows: PmRow[] = (data || []) as PmRow[]

      rows.forEach((pm) => {
        const name = buildPaymentMethodLabel(pm, teamByEmailLower)
        map[pm.id] = name
        map[pm.method] = name
        options.push({
          id: pm.id,
          name,
          method: pm.method,
          method_type: pm.method_type,
          user_email: pm.user_email,
          status: pm.status
        })
      })
      setPaymentMethodMap(map)
      setPaymentMethodOptions(options)
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('결제 방법 로드 오류:', error)
      }
    }
  }, [])

  useEffect(() => {
    void loadPaymentMethods()
  }, [loadPaymentMethods])

  return { paymentMethodOptions, paymentMethodMap, reloadPaymentMethods: loadPaymentMethods }
}
