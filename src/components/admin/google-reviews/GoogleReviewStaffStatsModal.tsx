'use client'

import { Users } from 'lucide-react'
import GoogleReviewStaffStatsSection from '@/components/admin/google-reviews/GoogleReviewStaffStatsSection'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
  refreshKey: number
}

export default function GoogleReviewStaffStatsModal({
  locale,
  open,
  onOpenChange,
  refreshKey,
}: Props) {
  const isKo = locale === 'ko'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" aria-hidden />
            {isKo ? '가이드·어시스턴트 리뷰 점수' : 'Guide & assistant review scores'}
          </DialogTitle>
          <DialogDescription>
            {isKo
              ? 'Google·OTA 등 모든 플랫폼 리뷰를 직원별로 집계합니다. OVERALL·월별 보기와 활성/비활성 필터를 사용할 수 있습니다.'
              : 'Staff-level review scores across Google and OTA platforms. Switch between overall and monthly views, and filter by active status.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <GoogleReviewStaffStatsSection
            locale={locale}
            enabled={open}
            refreshKey={refreshKey}
            variant="embedded"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
