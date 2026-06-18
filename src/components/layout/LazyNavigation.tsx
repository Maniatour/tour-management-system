'use client'

import dynamic from 'next/dynamic'

const Navigation = dynamic(() => import('@/components/Navigation'), {
  loading: () => (
    <div
      className="h-16 shrink-0 border-b border-gray-200 bg-white"
      aria-hidden
    />
  ),
})

export default function LazyNavigation() {
  return <Navigation />
}
