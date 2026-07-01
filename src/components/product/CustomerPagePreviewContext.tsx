'use client'

import { createContext, useContext, type ReactNode } from 'react'

type CustomerPagePreviewContextValue = {
  productId: string | null
  locale: string
}

const CustomerPagePreviewContext = createContext<CustomerPagePreviewContextValue>({
  productId: null,
  locale: 'ko',
})

export function CustomerPagePreviewProvider({
  productId,
  locale,
  children,
}: {
  productId: string | null
  locale: string
  children: ReactNode
}) {
  return (
    <CustomerPagePreviewContext.Provider value={{ productId, locale }}>
      {children}
    </CustomerPagePreviewContext.Provider>
  )
}

export function useCustomerPagePreviewContext() {
  return useContext(CustomerPagePreviewContext)
}
