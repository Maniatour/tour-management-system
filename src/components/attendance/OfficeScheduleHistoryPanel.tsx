'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, RotateCcw, X } from 'lucide-react'
import { OFFICE_SCHEDULE_COPY as C } from '@/lib/officeScheduleCopy'
import {
  formatRevisionTimestamp,
  listOfficeScheduleRevisions,
  restoreOfficeScheduleRevision,
  revisionEditorLabel,
  type OfficeScheduleRevisionRow,
} from '@/lib/officeScheduleHistory'
import { supabase } from '@/lib/supabase'

interface OfficeScheduleHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  scopeMonth: string
  canRestore: boolean
  onRestored: () => void
}

export default function OfficeScheduleHistoryPanel({
  isOpen,
  onClose,
  scopeMonth,
  canRestore,
  onRestored,
}: OfficeScheduleHistoryPanelProps) {
  const [rows, setRows] = useState<OfficeScheduleRevisionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listOfficeScheduleRevisions(supabase, scopeMonth)
      setRows(data)
    } catch (e) {
      console.error(e)
      setError(C.historyLoadError)
    } finally {
      setLoading(false)
    }
  }, [scopeMonth])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  const handleRestore = async (row: OfficeScheduleRevisionRow) => {
    if (!canRestore) return
    const when = formatRevisionTimestamp(row.created_at)
    const who = revisionEditorLabel(row)
    if (!window.confirm(C.historyRestoreConfirm.replace('{who}', who).replace('{when}', when))) {
      return
    }
    setRestoringId(row.id)
    setError(null)
    try {
      await restoreOfficeScheduleRevision(supabase, row.id)
      await load()
      onRestored()
    } catch (e) {
      console.error(e)
      setError(C.historyRestoreError)
    } finally {
      setRestoringId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-gray-200 shadow-xl flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          {C.historyTitle}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label={C.close}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="px-4 py-2 text-[11px] text-gray-500 border-b border-gray-100 shrink-0">
        {C.historyDesc.replace('{month}', scopeMonth)}
      </p>

      {error && <p className="px-4 py-2 text-xs text-red-600 shrink-0">{error}</p>}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {C.loading}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">{C.historyEmpty}</p>
        ) : (
          rows.map((row) => {
            const isRestore = row.action === 'restore'
            const busy = restoringId === row.id
            return (
              <div
                key={row.id}
                className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {revisionEditorLabel(row)}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{row.saved_by_email}</p>
                    <p className="text-[11px] text-gray-700 mt-1">
                      {formatRevisionTimestamp(row.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isRestore
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {isRestore ? C.historyActionRestore : C.historyActionSave}
                  </span>
                </div>

                <div className="mt-2 text-[10px] text-gray-600 space-y-0.5">
                  <p>
                    {C.historyRange}: {row.date_from} – {row.date_to}
                  </p>
                  {row.action === 'save' && (
                    <p>
                      {C.historyChanges}: −{row.deleted_count} / +{row.upserted_count}
                    </p>
                  )}
                  <p>
                    {C.historySlots}: {row.slot_count}
                  </p>
                  {row.restored_from_id && (
                    <p className="text-purple-700">{C.historyRestoredFromPrior}</p>
                  )}
                </div>

                {canRestore && (
                  <button
                    type="button"
                    disabled={busy || restoringId !== null}
                    onClick={() => handleRestore(row)}
                    className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-[11px] font-medium"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    {C.historyRestore}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
