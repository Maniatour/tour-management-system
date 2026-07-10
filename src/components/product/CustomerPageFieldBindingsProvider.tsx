'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT,
  CUSTOMER_PAGE_BINDINGS_UPDATE_MESSAGE,
} from '@/lib/customerPageBindingsSync'
import { CUSTOMER_PAGE_SOFT_RELOAD_EVENT } from '@/lib/customerPageSoftReload'
import { fetchAllCustomerPageBindings } from '@/lib/customerPageBindingPersistence'
import { fetchCustomerPageHomeLayout, fetchAllCustomerPageZoneLayouts, fetchCustomerPageListingCardLayout } from '@/lib/customerPageLayoutPersistence'
import { fetchCustomerPageGlobalTheme } from '@/lib/customerPageGlobalThemePersistence'
import { fetchCustomerPageHomeStructure } from '@/lib/customerPageHomeStructurePersistence'
import { fetchCustomerPageTemplate } from '@/lib/customerPageTemplatePersistence'
import { fetchAllCustomerPageUiStyles } from '@/lib/customerPageUiStylePersistence'

type CustomerPageFieldBindingsContextValue = {
  ready: boolean
  revision: number
  reload: () => Promise<void>
}

const CustomerPageFieldBindingsContext = createContext<CustomerPageFieldBindingsContextValue>({
  ready: false,
  revision: 0,
  reload: async () => {},
})

export function CustomerPageFieldBindingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [revision, setRevision] = useState(0)

  const reload = useCallback(async () => {
    try {
      await Promise.all([
        fetchAllCustomerPageBindings(),
        fetchAllCustomerPageUiStyles(),
        fetchCustomerPageHomeLayout(),
        fetchAllCustomerPageZoneLayouts(),
        fetchCustomerPageListingCardLayout(),
        fetchCustomerPageGlobalTheme(),
        fetchCustomerPageTemplate(),
        fetchCustomerPageHomeStructure(),
      ])
    } catch (err) {
      console.error('Failed to load customer page zone config:', err)
    } finally {
      setReady(true)
      setRevision((v) => v + 1)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const bump = () => {
      void reload()
    }

    window.addEventListener(CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT, bump)
    window.addEventListener(CUSTOMER_PAGE_SOFT_RELOAD_EVENT, bump)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === CUSTOMER_PAGE_BINDINGS_UPDATE_MESSAGE) bump()
    }
    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener(CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT, bump)
      window.removeEventListener(CUSTOMER_PAGE_SOFT_RELOAD_EVENT, bump)
      window.removeEventListener('message', onMessage)
    }
  }, [reload])

  return (
    <CustomerPageFieldBindingsContext.Provider value={{ ready, revision, reload }}>
      {children}
    </CustomerPageFieldBindingsContext.Provider>
  )
}

export function useCustomerPageFieldBindings() {
  return useContext(CustomerPageFieldBindingsContext)
}
