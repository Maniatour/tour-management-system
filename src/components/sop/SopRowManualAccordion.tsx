'use client'

import SopManualContentPanel from '@/components/sop/SopManualContentPanel'
import type { SopChecklistItem, SopEditLocale } from '@/types/sopStructure'

type Props = {
  item: SopChecklistItem
  viewLang: SopEditLocale
  isEn: boolean
}

export default function SopRowManualAccordion({ item, viewLang, isEn }: Props) {
  return (
    <SopManualContentPanel
      source={item}
      viewLang={viewLang}
      isEn={isEn}
      className="mt-2 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:ml-5 sm:p-4"
    />
  )
}
