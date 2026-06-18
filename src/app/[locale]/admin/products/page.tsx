'use client'

import { createAdminDynamicPage } from '@/components/admin/createAdminDynamicPage'

export default createAdminDynamicPage(
  () => import('./ProductsPageInner'),
  '상품 관리를 불러오는 중...'
)
