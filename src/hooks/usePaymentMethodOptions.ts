'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

type PmRow = {
  id: string
  method: string
  method_type: string | null
  display_name: string | null
  user_email: string | null
  status: string | null
  card_holder_name: string | null
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
  nick_name: string | null
}

/** 예약·투어·회사 지출 폼: `payment_methods` + team → «CC 0602 (Joey)» */
export function usePaymentMethodOptions() {
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([])
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, method_type, display_name, user_email, status, card_holder_name')
        .order('method')
      if (error) throw error

      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name')
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
        const em = pm.user_email ? String(pm.user_email).toLowerCase() : ''
        const team = em ? teamByEmailLower.get(em) : undefined
        const name = formatPaymentMethodDisplay(
          {
            id: pm.id,
            method: pm.method,
            display_name: pm.display_name,
            user_email: pm.user_email,
            card_holder_name: pm.card_holder_name,
          },
          team
        )
        map[pm.id] = name
        map[pm.method] = name
        options.push({
          id: pm.id,
          name,
          method: pm.method,
          method_type: pm.method_type,
          user_email: pm.user_email,
          status: pm.status,
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
