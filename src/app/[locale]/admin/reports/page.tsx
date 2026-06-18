'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./ReportsPageInner'),
  '통계 리포트를 불러오는 중...'
)
