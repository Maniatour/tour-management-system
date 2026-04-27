'use client'

import { Suspense } from 'react'
import SopSignClient from '@/components/sop/SopSignClient'

function Fallback() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-gray-600">Loading…</p>
    </div>
  )
}

export default function SopSignPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SopSignClient />
    </Suspense>
  )
}
