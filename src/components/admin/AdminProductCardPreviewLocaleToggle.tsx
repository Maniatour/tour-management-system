'use client'

import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import type { AdminEditLocale } from '@/lib/adminEditLocales'

type AdminProductCardPreviewLocaleToggleProps = {
  value: AdminEditLocale
  onChange: (locale: AdminEditLocale) => void
  koLabel: string
  enLabel: string
  groupLabel: string
}

export default function AdminProductCardPreviewLocaleToggle(
  props: AdminProductCardPreviewLocaleToggleProps
) {
  return <AdminEditLocaleToggle {...props} />
}
