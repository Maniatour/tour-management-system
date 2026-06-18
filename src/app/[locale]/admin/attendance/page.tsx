'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./AttendancePageInner'),
  '출석 관리를 불러오는 중...'
)
