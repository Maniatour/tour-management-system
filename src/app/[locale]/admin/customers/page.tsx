'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./CustomersPageInner'),
  '고객 관리를 불러오는 중...'
)
