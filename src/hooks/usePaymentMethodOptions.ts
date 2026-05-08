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
  financial_account_id?: string | null
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
  /** `payment_methods.id` → 연결된 `financial_accounts.name` (없으면 맵에 없음) */
  const [paymentMethodFinancialAccountNameByPmId, setPaymentMethodFinancialAccountNameByPmId] = useState<
    Record<string, string>
  >({})
  /**
   * `payment_methods.method` 코드 → 금융 계정명 (해당 코드를 쓰는 행이 모두 같은 계정일 때만)
   * 원장에 method 문자열이 저장된 레거시용
   */
  const [paymentMethodFinancialAccountNameByMethodKey, setPaymentMethodFinancialAccountNameByMethodKey] = useState<
    Record<string, string>
  >({})

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, method_type, display_name, user_email, status, card_holder_name, financial_account_id')
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
      const faNameByPmId: Record<string, string> = {}
      const options: PaymentMethodOption[] = []
      const rows: PmRow[] = (data || []) as PmRow[]

      const faIds = [...new Set(rows.map((r) => r.financial_account_id).filter(Boolean) as string[])]
      const faNameById = new Map<string, string>()
      if (faIds.length > 0) {
        for (let i = 0; i < faIds.length; i += 80) {
          const chunk = faIds.slice(i, i + 80)
          const { data: faRows, error: faErr } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
          if (faErr) {
            console.warn('financial_accounts 로드(결제방법·계정 표시용):', faErr)
            break
          }
          for (const fa of (faRows || []) as { id: string; name: string }[]) {
            faNameById.set(fa.id, fa.name)
          }
        }
      }

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
        const faId = pm.financial_account_id ? String(pm.financial_account_id).trim() : ''
        if (faId) {
          const faName = faNameById.get(faId)
          if (faName) faNameByPmId[pm.id] = faName
        }
        options.push({
          id: pm.id,
          name,
          method: pm.method,
          method_type: pm.method_type,
          user_email: pm.user_email,
          status: pm.status,
        })
      })

      const methodKeyToFaNames = new Map<string, Set<string>>()
      for (const pm of rows) {
        const faName = faNameByPmId[pm.id]
        if (!faName) continue
        const mk = pm.method
        let set = methodKeyToFaNames.get(mk)
        if (!set) {
          set = new Set<string>()
          methodKeyToFaNames.set(mk, set)
        }
        set.add(faName)
      }
      const faNameByMethodKey: Record<string, string> = {}
      methodKeyToFaNames.forEach((set, mk) => {
        if (set.size === 1) faNameByMethodKey[mk] = [...set][0]!
      })

      setPaymentMethodMap(map)
      setPaymentMethodFinancialAccountNameByPmId(faNameByPmId)
      setPaymentMethodFinancialAccountNameByMethodKey(faNameByMethodKey)
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

  return {
    paymentMethodOptions,
    paymentMethodMap,
    paymentMethodFinancialAccountNameByPmId,
    paymentMethodFinancialAccountNameByMethodKey,
    reloadPaymentMethods: loadPaymentMethods
  }
}
