'use client'

import { Suspense } from 'react'
import OperatorsAdmin from '@/components/admin/OperatorsAdmin'

export default function AdminOperatorsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <OperatorsAdmin />
    </Suspense>
  )
}
