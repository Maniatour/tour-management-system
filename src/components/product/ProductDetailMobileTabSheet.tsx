'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

type ProductDetailMobileTabSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  children: ReactNode
}

export default function ProductDetailMobileTabSheet({
  open,
  onOpenChange,
  title,
  icon: Icon,
  iconBg,
  iconColor,
  children,
}: ProductDetailMobileTabSheetProps) {
  const tCommon = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        overlayClassName="bg-black/50 sm:hidden"
        className="fixed inset-x-0 bottom-0 top-auto z-[10050] flex h-[min(88dvh,720px)] max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-0 p-0 shadow-[0_-8px_40px_rgba(15,23,42,0.18)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:hidden"
      >
        <div className="flex shrink-0 flex-col border-b border-slate-100 bg-white px-4 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
            </span>
            <DialogTitle className="min-w-0 flex-1 text-base font-semibold text-slate-900">
              {title}
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
              aria-label={tCommon('close')}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
