'use client'

import { useEffect, useState } from 'react'
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import {
  fetchHubArticleDocumentById,
  hubArticleLinkLabel,
  hubArticleLinkMeta,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import { cn } from '@/lib/utils'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { ExternalLink, Loader2 } from 'lucide-react'

type Props = {
  articleId: string
  onArticleIdChange?: (id: string) => void
  hubArticles: HubArticleLinkOption[]
  viewLang: SopEditLocale
  uiLocaleEn: boolean
  readOnly?: boolean
  className?: string
  /** 직접 작성 영역과 함께 표시할 때 빈 상태·여백 축소 */
  embedded?: boolean
}

export default function SopManualLinkedArticlePanel({
  articleId,
  onArticleIdChange,
  hubArticles,
  viewLang,
  uiLocaleEn,
  readOnly = false,
  className,
  embedded = false,
}: Props) {
  const isEn = uiLocaleEn
  const [loading, setLoading] = useState(false)
  const [linkedDoc, setLinkedDoc] = useState<SopDocument | null>(null)
  const [linkedTitle, setLinkedTitle] = useState('')

  const selected = hubArticles.find((a) => a.id === articleId)

  useEffect(() => {
    const id = articleId.trim()
    if (!id) {
      setLinkedDoc(null)
      setLinkedTitle('')
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchHubArticleDocumentById(id).then((result) => {
      if (cancelled) return
      if (!result) {
        setLinkedDoc(null)
        setLinkedTitle('')
        setLoading(false)
        return
      }
      setLinkedDoc(result.doc)
      setLinkedTitle(hubArticleLinkLabel(result.row, viewLang))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [articleId, viewLang])

  const showPicker = !readOnly && Boolean(onArticleIdChange)

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-3',
        embedded ? 'max-h-[min(48vh,420px)]' : 'flex-1',
        className
      )}
    >
      {showPicker ? (
        <div className="shrink-0 space-y-2">
          {!embedded ? (
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {isEn ? 'Operations Hub document' : '운영 허브 문서'}
            </label>
          ) : null}
          <select
            value={articleId}
            onChange={(e) => onArticleIdChange?.(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">{isEn ? 'None (optional)' : '연결 안 함 (선택)'}</option>
            {hubArticles.map((article) => (
              <option key={article.id} value={article.id}>
                {hubArticleLinkLabel(article, viewLang)} · {hubArticleLinkMeta(article, viewLang)}
              </option>
            ))}
          </select>
          {!embedded ? (
            <p className="text-xs leading-relaxed text-gray-500">
              {isEn
                ? 'Linked documents are edited in Operations Hub. You can also write notes above.'
                : '연결된 문서는 운영 허브에서 수정합니다. 위에서 직접 메모를 추가할 수도 있습니다.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {!articleId.trim() ? (
        embedded ? null : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            {isEn ? 'Select a hub document to link.' : '연결할 운영 허브 문서를 선택하세요.'}
          </div>
        )
      ) : loading ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50',
            embedded ? 'min-h-[10rem] flex-1' : 'flex-1'
          )}
        >
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden />
          <span className="sr-only">{isEn ? 'Loading document…' : '문서 불러오는 중…'}</span>
        </div>
      ) : linkedDoc ? (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white',
            embedded && 'max-h-[min(44vh,380px)]'
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {isEn ? 'Linked document' : '연결된 문서'}
              </p>
              <p className="truncate text-sm font-medium text-gray-900">
                {linkedTitle ||
                  hubArticleLinkLabel(
                    selected ?? {
                      id: articleId,
                      slug: '',
                      title_ko: '',
                      title_en: '',
                    },
                    viewLang
                  )}
              </p>
              {selected ? (
                <p className="text-xs text-gray-500">{hubArticleLinkMeta(selected, viewLang)}</p>
              ) : null}
            </div>
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
            <SopDocumentWithToc
              doc={linkedDoc}
              viewLang={viewLang}
              uiLocaleEn={uiLocaleEn}
              resizableToc={false}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800">
          {isEn
            ? 'Could not load the linked document. It may have been removed.'
            : '연결된 문서를 불러올 수 없습니다. 삭제되었을 수 있습니다.'}
        </div>
      )}
    </div>
  )
}
