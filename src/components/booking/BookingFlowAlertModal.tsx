'use client'

import { AlertTriangle, X } from 'lucide-react'

type BookingFlowAlertModalProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onClose: () => void
}

export default function BookingFlowAlertModal({
  open,
  title,
  message,
  confirmLabel,
  onClose,
}: BookingFlowAlertModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="booking-flow-alert-title"
        aria-describedby="booking-flow-alert-message"
      >
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <h3 id="booking-flow-alert-title" className="text-lg font-semibold text-foreground">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p id="booking-flow-alert-message" className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>

        <div className="border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
