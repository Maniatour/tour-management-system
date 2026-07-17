'use client'

import dynamic from 'next/dynamic'

const Sidebar = dynamic(() => import('@/components/Sidebar'), {
  loading: () => (
    <div
      className="app-sidebar-shell hidden shrink-0 lg:block"
      aria-hidden
    />
  ),
})

export default function LazySidebar() {
  return <Sidebar />
}
