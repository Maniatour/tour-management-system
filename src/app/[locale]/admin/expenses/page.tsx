'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./ExpensesPageInner'),
  '입금·지출 관리를 불러오는 중...'
)
