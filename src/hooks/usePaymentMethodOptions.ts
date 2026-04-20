'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/** 예약·투어·회사 지출 폼: `payment_methods` 테이블과 동일한 규칙으로 옵션·표시용 맵 */
export function usePaymentMethodOptions() {
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<{ id: string; name: string }[]>([])
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, display_name')
        .order('method')
      if (error) throw error
      const map: Record<string, string> = {}
      const options: { id: string; name: string }[] = []
      data?.forEach((pm: { id: string; method: string; display_name?: string | null }) => {
        const raw = (pm.display_name && pm.display_name.trim()) || pm.method
        const name = raw.includes(' - ') ? raw.split(' - ').pop()!.trim() : raw
        map[pm.id] = name
        map[pm.method] = name
        options.push({ id: pm.id, name })
      })
      setPaymentMethodMap(map)
      setPaymentMethodOptions(options)
    } catch (error) {
      console.error('결제 방법 로드 오류:', error)
    }
  }, [])

  useEffect(() => {
    void loadPaymentMethods()
  }, [loadPaymentMethods])

  return { paymentMethodOptions, paymentMethodMap, reloadPaymentMethods: loadPaymentMethods }
}
