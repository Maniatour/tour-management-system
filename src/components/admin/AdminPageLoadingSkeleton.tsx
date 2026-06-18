'use client'

import { Loader2 } from 'lucide-react'

type AdminPageLoadingSkeletonProps = {
  label?: string
}

export default function AdminPageLoadingSkeleton({
  label = '불러오는 중...',
}: AdminPageLoadingSkeletonProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
