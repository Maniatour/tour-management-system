'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function MarketResearchDialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className={cn(
          'max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto rounded-2xl p-6',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
