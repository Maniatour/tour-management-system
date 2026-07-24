'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type CustomerPagePreviewViewport = 'desktop' | 'mobile' | null

const CustomerPagePreviewViewportContext = createContext<CustomerPagePreviewViewport>(null)

export function CustomerPagePreviewViewportProvider({
  viewport,
  children,
}: {
  viewport: CustomerPagePreviewViewport
  children: ReactNode
}) {
  return (
    <CustomerPagePreviewViewportContext.Provider value={viewport}>
      {children}
    </CustomerPagePreviewViewportContext.Provider>
  )
}

export function useCustomerPagePreviewViewport() {
  return useContext(CustomerPagePreviewViewportContext)
}
