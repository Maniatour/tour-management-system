'use client'

import dynamic from 'next/dynamic'

const ModalBackdropGuard = dynamic(
  () => import('@/components/ModalBackdropGuard'),
  { ssr: false }
)

export default function LazyModalBackdropGuard() {
  return <ModalBackdropGuard />
}
