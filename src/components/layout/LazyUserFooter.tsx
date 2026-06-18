'use client'

import dynamic from 'next/dynamic'

const UserFooter = dynamic(() => import('@/components/UserFooter'), {
  ssr: false,
  loading: () => (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 h-[var(--footer-height)] border-t border-gray-200 bg-white lg:hidden"
      aria-hidden
    />
  ),
})

export default function LazyUserFooter({ locale }: { locale: string }) {
  return <UserFooter locale={locale} />
}
