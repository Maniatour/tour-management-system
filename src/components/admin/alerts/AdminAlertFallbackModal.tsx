'use client'

import { X } from 'lucide-react'
import type { AdminAlertInboxItem } from '@/lib/adminAlertInbox'
import { adminAlertKindLabel, formatAdminAlertTime } from '@/lib/adminAlertInbox'

type AdminAlertFallbackModalProps = {
  item: AdminAlertInboxItem
  locale: string
  onClose: () => void
}

export function AdminAlertFallbackModal({ item, locale, onClose }: AdminAlertFallbackModalProps) {
  const isKo = locale.startsWith('ko')

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-alert-fallback-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50 p-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
              {adminAlertKindLabel(item.kind, isKo)}
            </p>
            <h2 id="admin-alert-fallback-title" className="mt-1 text-base font-semibold text-gray-900">
              {item.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{formatAdminAlertTime(item.createdAt, locale)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{item.body}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900"
            >
              {isKo ? '닫기' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
