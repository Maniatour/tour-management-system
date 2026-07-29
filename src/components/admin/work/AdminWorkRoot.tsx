'use client'

import AdminWorkFloatingWidget from '@/components/admin/work/AdminWorkFloatingWidget'

type AdminWorkRootProps = {
  locale: string
}

export default function AdminWorkRoot({ locale }: AdminWorkRootProps) {
  return <AdminWorkFloatingWidget locale={locale} />
}
