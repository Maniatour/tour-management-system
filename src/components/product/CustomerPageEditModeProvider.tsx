'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE } from '@/lib/customerPageEditMessaging'

type CustomerPageEditMode = {
  isPreview: boolean
  isEditMode: boolean
}

const defaultMode: CustomerPageEditMode = {
  isPreview: false,
  isEditMode: false,
}

const CustomerPageEditModeContext = createContext<CustomerPageEditMode>(defaultMode)

function readModeFromUrl(): CustomerPageEditMode {
  if (typeof window === 'undefined') return defaultMode
  const qs = new URLSearchParams(window.location.search)
  return {
    isPreview: qs.get('preview') === '1',
    isEditMode: qs.get('editMode') === '1',
  }
}

export function CustomerPageEditModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CustomerPageEditMode>(defaultMode)

  useEffect(() => {
    const syncFromUrl = () => setMode(readModeFromUrl())

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE) return
      setMode({ isPreview: true, isEditMode: true })
    }

    syncFromUrl()
    window.addEventListener('message', onMessage)

    const retryTimers = [0, 100, 400, 1200].map((ms) =>
      window.setTimeout(syncFromUrl, ms)
    )

    return () => {
      window.removeEventListener('message', onMessage)
      retryTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <CustomerPageEditModeContext.Provider value={mode}>
      {children}
    </CustomerPageEditModeContext.Provider>
  )
}

export function useCustomerPageEditMode() {
  return useContext(CustomerPageEditModeContext)
}
