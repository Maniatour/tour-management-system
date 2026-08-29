'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import WriteReviewPageContent from '@/components/reviews/WriteReviewPageContent'

export default function WriteReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <WriteReviewPageContent />
    </Suspense>
  )
}
