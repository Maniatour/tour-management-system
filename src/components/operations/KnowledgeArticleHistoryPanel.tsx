'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatKnowledgeRevisionTimestamp,
  knowledgeRevisionEditorLabel,
  listKnowledgeArticleRevisions,
  restoreKnowledgeArticleRevision,
  type KnowledgeArticleRevisionRow,
} from '@/lib/knowledgeArticleHistory'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  articleId: string
  isEn: boolean
  onRestored: () => void
}

export default function KnowledgeArticleHistoryPanel({
  open,
  onClose,
  articleId,
  isEn,
  onRestored,
}: Props) {
  const [rows, setRows] = useState<KnowledgeArticleRevisionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listKnowledgeArticleRevisions(supabase, articleId)
      setRows(data)
    } catch (e) {
      console.error(e)
      setError(isEn ? 'Failed to load history.' : '이력을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [articleId, isEn])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const handleRestore = async (row: KnowledgeArticleRevisionRow) => {
    const when = formatKnowledgeRevisionTimestamp(row.created_at, isEn ? 'en' : 'ko')
    const who = knowledgeRevisionEditorLabel(row)
    const confirmMsg = isEn
      ? `Restore to the version saved by ${who} on ${when}? The current document will be kept in history.`
      : `${who}님이 ${when}에 저장한 버전으로 복원할까요? 현재 내용은 이력에 남습니다.`
    if (!window.confirm(confirmMsg)) return

    setRestoringId(row.id)
    setError(null)
    try {
      await restoreKnowledgeArticleRevision(supabase, row.id)
      await load()
      onRestored()
    } catch (e) {
      console.error(e)
      setError(isEn ? 'Failed to restore this version.' : '복원에 실패했습니다.')
    } finally {
      setRestoringId(null)
    }
  }

  if (!open) return null

  const actionLabel = (action: KnowledgeArticleRevisionRow['action']) => {
    if (action === 'restore') return isEn ? 'Restore' : '복원'
    if (action === 'seed') return isEn ? 'Baseline' : '기준'
    return isEn ? 'Save' : '저장'
  }

  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <History className="h-4 w-4 text-indigo-600" />
          {isEn ? 'Version history' : '버전 이력'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label={isEn ? 'Close' : '닫기'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="shrink-0 border-b border-gray-100 px-4 py-2 text-[11px] text-gray-500">
        {isEn
          ? 'Each save keeps the previous version. Restore brings that snapshot back.'
          : '저장할 때마다 이전 버전이 남습니다. 복원하면 해당 시점 내용으로 돌아갑니다.'}
      </p>

      {error ? <p className="shrink-0 px-4 py-2 text-xs text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? 'Loading…' : '불러오는 중…'}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {isEn ? 'No saved revisions yet.' : '저장된 이력이 없습니다.'}
          </p>
        ) : (
          rows.map((row) => {
            const busy = restoringId === row.id
            return (
              <div
                key={row.id}
                className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {isEn ? `Rev ${row.revision}` : `${row.revision}차`} ·{' '}
                      {knowledgeRevisionEditorLabel(row)}
                    </p>
                    {row.saved_by_email ? (
                      <p className="truncate text-[10px] text-gray-500">{row.saved_by_email}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-gray-700">
                      {formatKnowledgeRevisionTimestamp(row.created_at, isEn ? 'en' : 'ko')}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      row.action === 'restore'
                        ? 'bg-purple-100 text-purple-800'
                        : row.action === 'seed'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-indigo-100 text-indigo-800'
                    )}
                  >
                    {actionLabel(row.action)}
                  </span>
                </div>

                <div className="mt-2 space-y-0.5 text-[10px] text-gray-600">
                  <p className="truncate">
                    {(isEn ? row.title_en || row.title_ko : row.title_ko || row.title_en) || '—'}
                  </p>
                  <p>
                    {isEn ? 'Body size' : '본문 크기'}: {row.body_chars.toLocaleString()} chars
                  </p>
                  {row.note ? <p className="text-purple-700">{row.note}</p> : null}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || restoringId !== null}
                  onClick={() => void handleRestore(row)}
                  className="mt-2.5 h-8 w-full text-[11px]"
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isEn ? 'Restore this version' : '이 버전으로 복원'}
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
