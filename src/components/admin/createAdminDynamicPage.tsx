'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import AdminPageLoadingSkeleton from '@/components/admin/AdminPageLoadingSkeleton'

/** Admin page.tsx — 무거운 PageInner를 별도 청크로 분리 */
export function createAdminDynamicPage(
  importPageInner: () => Promise<{ default: ComponentType }>,
  loadingLabel: string
) {
  const PageInner = dynamic(importPageInner, {
    ssr: false,
    loading: () => <AdminPageLoadingSkeleton label={loadingLabel} />,
  })

  return function AdminDynamicPage() {
    return <PageInner />
  }
}
