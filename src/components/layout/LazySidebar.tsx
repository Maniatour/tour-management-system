'use client'

import dynamic from 'next/dynamic'

const Sidebar = dynamic(() => import('@/components/Sidebar'), {
  loading: () => (
    <div
      className="hidden w-64 shrink-0 lg:block"
      aria-hidden
    />
  ),
})

export default function LazySidebar() {
  return <Sidebar />
}
