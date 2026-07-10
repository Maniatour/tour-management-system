'use client'

import { useMemo, useState } from 'react'
import SopHubArticleReadModal from '@/components/sop/SopHubArticleReadModal'
import {
  hubArticleLinkLabel,
  hubArticleLinkMeta,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import { cn } from '@/lib/utils'
import type { SopEditLocale } from '@/types/sopStructure'
import { FileText, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  articleIds: string[]
  onArticleIdsChange?: (ids: string[]) => void
  hubArticles: HubArticleLinkOption[]
  viewLang: SopEditLocale
  uiLocaleEn: boolean
  readOnly?: boolean
  className?: string
  embedded?: boolean
}

function HubArticleCard({
  article,
  viewLang,
  onOpen,
  onRemove,
  readOnly,
  isEn,
}: {
  article: HubArticleLinkOption
  viewLang: SopEditLocale
  onOpen: () => void
  onRemove?: () => void
  readOnly?: boolean
  isEn: boolean
}) {
  const label = hubArticleLinkLabel(article, viewLang)
  const meta = hubArticleLinkMeta(article, viewLang)

  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {!readOnly && onRemove ? (
        <button
          type="button"
          className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Remove linked document"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        className="flex w-full min-w-0 flex-col items-start gap-2 text-left touch-manipulation"
        onClick={onOpen}
      >
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-gray-900">{label}</p>
            <p className="mt-1 text-xs text-gray-500">{meta}</p>
          </div>
        </div>
        <span className="text-xs font-medium text-indigo-600">
          {isEn ? 'Click to view document' : '클릭하여 문서 보기'}
        </span>
      </button>
    </div>
  )
}

export default function SopManualLinkedArticlePanel({
  articleIds,
  onArticleIdsChange,
  hubArticles,
  viewLang,
  uiLocaleEn,
  readOnly = false,
  className,
  embedded = false,
}: Props) {
  const isEn = uiLocaleEn
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedIds = useMemo(
    () => [...new Set(articleIds.map((id) => id.trim()).filter(Boolean))],
    [articleIds]
  )

  const selectedArticles = useMemo(
    () =>
      selectedIds
        .map((id) => hubArticles.find((a) => a.id === id))
        .filter((a): a is HubArticleLinkOption => Boolean(a)),
    [hubArticles, selectedIds]
  )

  const availableToAdd = useMemo(
    () => hubArticles.filter((a) => !selectedIds.includes(a.id)),
    [hubArticles, selectedIds]
  )

  const showPicker = !readOnly && Boolean(onArticleIdsChange)

  const toggleArticle = (id: string) => {
    if (!onArticleIdsChange) return
    if (selectedIds.includes(id)) {
      onArticleIdsChange(selectedIds.filter((x) => x !== id))
      return
    }
    onArticleIdsChange([...selectedIds, id])
  }

  const removeArticle = (id: string) => {
    onArticleIdsChange?.(selectedIds.filter((x) => x !== id))
  }

  return (
    <>
      <div className={cn('flex min-h-0 flex-col gap-3', className)}>
        {showPicker ? (
          <div className="shrink-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 touch-manipulation"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={availableToAdd.length === 0}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {isEn ? 'Add hub document' : '허브 문서 추가'}
              </Button>
              <span className="text-xs text-gray-500">
                {isEn
                  ? `${selectedIds.length} linked · select multiple documents`
                  : `${selectedIds.length}개 연결 · 여러 문서 선택 가능`}
              </span>
            </div>
            {pickerOpen ? (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/80 p-2">
                {availableToAdd.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-gray-500">
                    {isEn ? 'All available documents are already linked.' : '연결 가능한 문서를 모두 선택했습니다.'}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {availableToAdd.map((article) => (
                      <li key={article.id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white"
                          onClick={() => {
                            toggleArticle(article.id)
                            setPickerOpen(false)
                          }}
                        >
                          <span className="min-w-0 flex-1 font-medium text-gray-900">
                            {hubArticleLinkLabel(article, viewLang)}
                          </span>
                          <span className="shrink-0 text-xs text-gray-500">
                            {hubArticleLinkMeta(article, viewLang)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {!embedded ? (
              <p className="text-xs leading-relaxed text-gray-500">
                {isEn
                  ? 'Linked documents open in a separate viewer. Edit them in Operations Hub.'
                  : '연결된 문서는 별도 창에서 열립니다. 문서 수정은 운영 허브에서 하세요.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {selectedIds.length === 0 ? (
          embedded ? null : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {isEn ? 'Select hub documents to link.' : '연결할 운영 허브 문서를 선택하세요.'}
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedArticles.map((article) => (
              <HubArticleCard
                key={article.id}
                article={article}
                viewLang={viewLang}
                readOnly={readOnly}
                isEn={isEn}
                onOpen={() => setPreviewArticleId(article.id)}
                {...(!readOnly && onArticleIdsChange
                  ? { onRemove: () => removeArticle(article.id) }
                  : {})}
              />
            ))}
            {selectedIds
              .filter((id) => !selectedArticles.some((a) => a.id === id))
              .map((id) => (
                <div
                  key={id}
                  className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800"
                >
                  {isEn ? 'Document no longer available' : '문서를 찾을 수 없습니다'}
                </div>
              ))}
          </div>
        )}
      </div>

      <SopHubArticleReadModal
        open={!!previewArticleId}
        onOpenChange={(open) => !open && setPreviewArticleId(null)}
        articleId={previewArticleId}
        hubArticles={hubArticles}
        viewLang={viewLang}
        uiLocaleEn={uiLocaleEn}
      />
    </>
  )
}
