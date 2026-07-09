'use client'

import { useEffect } from 'react'
import { CUSTOMER_PAGE_SOFT_RELOAD_EVENT } from '@/lib/customerPageSoftReload'

/** 고객 페이지 편집 저장 후 iframe soft reload 수신 */
export function useCustomerPageSoftReload(onReload: () => void | Promise<void>) {
  useEffect(() => {
    const handler = () => {
      void onReload()
    }
    window.addEventListener(CUSTOMER_PAGE_SOFT_RELOAD_EVENT, handler)
    return () => window.removeEventListener(CUSTOMER_PAGE_SOFT_RELOAD_EVENT, handler)
  }, [onReload])
}
