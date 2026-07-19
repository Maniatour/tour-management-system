'use client'

import { Suspense } from 'react'
import OperatorBManual from '@/components/admin/OperatorBManual'

export default function OperatorBManualPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <OperatorBManual />
    </Suspense>
  )
}
