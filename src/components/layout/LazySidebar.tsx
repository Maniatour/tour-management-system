'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const Sidebar = dynamic(() => import('@/components/Sidebar'), {
  loading: () => (
    <div
      className="app-sidebar-shell hidden shrink-0 lg:block"
      aria-hidden
    />
  ),
})

export default function LazySidebar() {
  const pathname = usePathname()
  if (pathname?.includes('/pay/invoice/')) return null
  return <Sidebar />
}
