'use client'

import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'

/** zone 바인딩(DB) 변경 시 표시값 리렌더 */
export function useCustomerPageDisplayBindings() {
  const { ready, revision } = useCustomerPageFieldBindings()
  return { active: ready, revision }
}
