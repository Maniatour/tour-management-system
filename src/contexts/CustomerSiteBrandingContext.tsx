'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { FALLBACK_SITE_LOGO_URL } from '@/lib/customerSiteBranding'

export type CustomerSiteBrandingContextValue = {
  logoUrl: string
  hasCustomLogo: boolean
}

const CustomerSiteBrandingContext = createContext<CustomerSiteBrandingContextValue>({
  logoUrl: FALLBACK_SITE_LOGO_URL,
  hasCustomLogo: false,
})

export function CustomerSiteBrandingProvider({
  logoUrl,
  hasCustomLogo,
  children,
}: {
  logoUrl: string
  hasCustomLogo: boolean
  children: ReactNode
}) {
  return (
    <CustomerSiteBrandingContext.Provider
      value={{
        logoUrl: logoUrl || FALLBACK_SITE_LOGO_URL,
        hasCustomLogo,
      }}
    >
      {children}
    </CustomerSiteBrandingContext.Provider>
  )
}

export function useCustomerSiteBranding() {
  return useContext(CustomerSiteBrandingContext)
}
