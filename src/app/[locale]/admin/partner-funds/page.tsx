'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./PartnerFundsPageInner'),
  '파트너 자금 관리를 불러오는 중...'
)
