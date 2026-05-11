'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const TeamBoardPageInner = dynamic(() => import('./TeamBoardPageInner'), {
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden />
    </div>
  ),
})

export default function TeamBoardPage() {
  return <TeamBoardPageInner />
}
