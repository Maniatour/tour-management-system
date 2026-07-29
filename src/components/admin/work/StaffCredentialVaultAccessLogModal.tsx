'use client'

import { Loader2, X } from 'lucide-react'
import {
  credentialVaultAccessActionLabel,
  type StaffCredentialVaultAccessLogRow,
} from '@/lib/staffCredentialVault'

type StaffCredentialVaultAccessLogModalProps = {
  open: boolean
  locale: string
  siteName: string
  logs: StaffCredentialVaultAccessLogRow[]
  loading?: boolean
  onClose: () => void
}

export function StaffCredentialVaultAccessLogModal({
  open,
  locale,
  siteName,
  logs,
  loading = false,
  onClose,
}: StaffCredentialVaultAccessLogModalProps) {
  if (!open) return null
  const isKo = locale === 'ko'

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isKo ? '열람 기록' : 'Access log'}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">{siteName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {isKo ? '열람 기록이 없습니다.' : 'No access history yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {log.accessor_name || log.accessor_email}
                      </p>
                      <p className="text-[10px] text-gray-500">{log.accessor_email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                      {credentialVaultAccessActionLabel(log.action, locale)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    {new Date(log.accessed_at).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                    {log.accessor_position ? ` · ${log.accessor_position}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
