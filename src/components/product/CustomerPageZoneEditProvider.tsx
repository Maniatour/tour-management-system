'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslations } from 'next-intl'
import { Pencil } from 'lucide-react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'
import { confirmDiscardUnsavedChanges, dispatchCustomerPageSoftReload } from '@/lib/customerPageSoftReload'
import CustomerPageZoneEditPanel from '@/components/product/CustomerPageZoneEditPanel'
import type { SiteLocale } from '@/lib/siteLocales'

type CustomerPageZoneEditContextValue = {
  openZoneEdit: (zone: CustomerPageZone, productId?: string | null) => void
}

const CustomerPageZoneEditContext = createContext<CustomerPageZoneEditContextValue | null>(null)

export function useCustomerPageZoneEdit() {
  return useContext(CustomerPageZoneEditContext)
}

type CustomerPageZoneEditProviderProps = {
  children: ReactNode
  productId: string
  previewLocale: string
  onPreviewLocaleChange?: (locale: SiteLocale) => void
  onNavigateToTab: (tabId: string) => void
}

export function CustomerPageZoneEditProvider({
  children,
  productId,
  previewLocale,
  onPreviewLocaleChange,
  onNavigateToTab,
}: CustomerPageZoneEditProviderProps) {
  const t = useTranslations('products.customerPageEdit')
  const [selectedZone, setSelectedZone] = useState<CustomerPageZone | null>(null)
  const [editProductId, setEditProductId] = useState<string | null>(productId)
  const [editDirty, setEditDirty] = useState(false)

  const selectedConfig = selectedZone ? getZoneEditConfig(selectedZone) : null

  const closeEditModal = useCallback(() => {
    setSelectedZone(null)
    setEditProductId(productId)
    setEditDirty(false)
  }, [productId])

  const requestCloseEditModal = useCallback(() => {
    if (editDirty && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
  }, [editDirty, closeEditModal])

  const openZoneEdit = useCallback(
    (zone: CustomerPageZone, resolvedProductId?: string | null) => {
      if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
      setEditProductId(resolvedProductId?.trim() || productId)
      setEditDirty(false)
      setSelectedZone(zone)
    },
    [editDirty, selectedZone, productId]
  )

  const contextValue = useMemo(() => ({ openZoneEdit }), [openZoneEdit])

  const handleSaved = () => {
    dispatchCustomerPageSoftReload()
  }

  return (
    <CustomerPageZoneEditContext.Provider value={contextValue}>
      {children}

      {selectedZone && selectedConfig ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={requestCloseEditModal}
            aria-hidden
          />
          <div className="relative my-auto flex h-[min(88vh,calc(100dvh-2rem))] min-h-[min(480px,calc(100dvh-2rem))] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <CustomerPageZoneEditPanel
              key={`${selectedZone}-${editProductId ?? productId}`}
              zone={selectedZone}
              productId={editProductId ?? productId}
              locale={previewLocale}
              {...(onPreviewLocaleChange ? { onContentLocaleChange: onPreviewLocaleChange } : {})}
              variant="modal"
              onDirtyChange={setEditDirty}
              onSaved={handleSaved}
              onNavigateToTab={onNavigateToTab}
              onClose={requestCloseEditModal}
            />
          </div>
        </div>
      ) : null}

      {!selectedZone ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] hidden -translate-x-1/2 md:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm">
            <Pencil className="h-3.5 w-3.5 text-primary" />
            {t('editHintBanner')}
          </div>
        </div>
      ) : null}
    </CustomerPageZoneEditContext.Provider>
  )
}
