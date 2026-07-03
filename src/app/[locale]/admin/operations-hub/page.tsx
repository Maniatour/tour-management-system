'use client'

import { Suspense } from 'react'
import OperationsHubClient from '@/components/operations/OperationsHubClient'

function HubFallback() {
  return <div className="p-6 text-gray-600">Loading…</div>
}

export default function AdminOperationsHubPage() {
  return (
    <Suspense fallback={<HubFallback />}>
      <OperationsHubClient basePath="admin" enableAdminCrud />
    </Suspense>
  )
}
