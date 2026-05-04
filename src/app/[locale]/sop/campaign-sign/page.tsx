'use client'

import { Suspense } from 'react'
import CompanyStructuredDocCampaignSignClient from '@/components/sop/CompanyStructuredDocCampaignSignClient'

function Fallback() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-gray-600">Loading…</p>
    </div>
  )
}

export default function SopCampaignSignPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CompanyStructuredDocCampaignSignClient />
    </Suspense>
  )
}
