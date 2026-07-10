'use client'

import { markdownToHtml } from '@/components/LightRichEditor'
import SopManualLinkedArticlePanel from '@/components/sop/SopManualLinkedArticlePanel'
import {
  getLinkedHubArticleIds,
  getManualValue,
  hasChecklistManualContent,
  hasManualLink,
  type SopManualFields,
} from '@/lib/sopQuickEdit'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import type { SopEditLocale } from '@/types/sopStructure'
import { Link2, FileText } from 'lucide-react'

type Props = {
  source: SopManualFields
  viewLang: SopEditLocale
  isEn: boolean
  hubArticles?: HubArticleLinkOption[]
  className?: string
}

export default function SopManualContentPanel({
  source,
  viewLang,
  isEn,
  hubArticles = [],
  className,
}: Props) {
  const inline = getManualValue(source, viewLang)
  const hasInline = hasChecklistManualContent(inline)
  const linkedIds = getLinkedHubArticleIds(source)
  const hasLinked = hasManualLink(source)

  if (!hasInline && !hasLinked) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        {isEn ? 'No manual registered.' : '등록된 메뉴얼이 없습니다.'}
      </div>
    )
  }

  return (
    <div
      className={
        className ??
        'space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4'
      }
    >
      {hasInline ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {isEn ? 'Notes' : '직접 작성'}
          </div>
          <div
            className="prose prose-sm max-w-none break-words text-gray-800 [&_img]:h-auto [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(inline) }}
          />
        </div>
      ) : null}

      {hasLinked ? (
        <div className={hasInline ? 'border-t border-indigo-100 pt-3' : undefined}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {isEn ? 'Linked hub documents' : '허브 문서'}
          </div>
          <SopManualLinkedArticlePanel
            articleIds={linkedIds}
            hubArticles={hubArticles}
            viewLang={viewLang}
            uiLocaleEn={isEn}
            readOnly
            embedded
          />
        </div>
      ) : null}
    </div>
  )
}
