'use client'

import { Suspense } from 'react'
import CompanyStructuredDocSignClient from '@/components/sop/CompanyStructuredDocSignClient'

function Fallback() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-gray-600">Loading…</p>
    </div>
  )
}

export default function EmployeeContractSignPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CompanyStructuredDocSignClient documentType="employee_contract" />
    </Suspense>
  )
}
