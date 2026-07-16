'use client'

import LightRichEditor, { sopPlainDisplayText } from '@/components/LightRichEditor'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import SopManualLinkedArticlePanel from '@/components/sop/SopManualLinkedArticlePanel'
import {
  SopPrintLinkedManualsProvider,
  usePrintLinkedManuals,
} from '@/components/sop/SopPrintLinkedManualsContext'
import {
  getLinkedHubArticleIds,
  getManualValue,
  hasChecklistManualContent,
  hasManualLink,
  type SopManualFields,
} from '@/lib/sopQuickEdit'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import { markdownToHtml } from '@/lib/markdownToHtml'
import type { SopEditLocale } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'
import { Check, Copy, Link2, FileText } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  source: SopManualFields
  viewLang: SopEditLocale
  isEn: boolean
  hubArticles?: HubArticleLinkOption[]
  className?: string
}

/** 연결 문서 안쪽에선 재귀 확장 끄기 */
function NestedPrintOff({ children }: { children: ReactNode }) {
  return (
    <SopPrintLinkedManualsProvider value={{ byId: {}, expandInline: false }}>
      {children}
    </SopPrintLinkedManualsProvider>
  )
}

export default function SopManualContentPanel({
  source,
  viewLang,
  isEn,
  hubArticles = [],
  className,
}: Props) {
  const printLinked = usePrintLinkedManuals()
  const inline = getManualValue(source, viewLang)
  const hasInline = hasChecklistManualContent(inline)
  const linkedIds = getLinkedHubArticleIds(source)
  const hasLinked = hasManualLink(source)
  const expandLinkedForPrint = Boolean(printLinked?.expandInline && hasLinked)
  const [copied, setCopied] = useState(false)
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current)
    }
  }, [])

  const copyNotes = async () => {
    const text = sopPlainDisplayText(inline).trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current)
      copiedResetRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be unavailable */
    }
  }

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
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {isEn ? 'Notes' : '직접 작성'}
            </div>
            <button
              type="button"
              onClick={() => void copyNotes()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-white hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 print:hidden"
              title={isEn ? 'Copy notes' : '본문 복사'}
              aria-label={isEn ? 'Copy notes to clipboard' : '본문을 클립보드에 복사'}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {isEn ? 'Copied' : '복사됨'}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {isEn ? 'Copy' : '복사'}
                </>
              )}
            </button>
          </div>
          <LightRichEditor
            value={inline}
            onChange={() => {}}
            readOnly
            autoHeight
            showToolbar={false}
            enableImageUpload={false}
            enableResize={false}
            minHeight={80}
            maxHeight={2400}
            height={120}
            uiLocale={isEn ? 'en' : 'ko'}
            className="overflow-hidden rounded-lg border border-indigo-100/80 bg-white print:border-0 [&_[contenteditable]]:!bg-white"
          />
        </div>
      ) : null}

      {hasLinked ? (
        <div className={hasInline ? 'border-t border-indigo-100 pt-3' : undefined}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {isEn ? 'Linked hub documents' : '허브 문서'}
          </div>
          {expandLinkedForPrint ? (
            <div className="space-y-6">
              {printLinked?.loading ? (
                <p className="text-sm text-slate-500">
                  {isEn ? 'Loading linked manuals…' : '연결 메뉴얼 불러오는 중…'}
                </p>
              ) : null}
              {linkedIds.map((id) => {
                const entry = printLinked?.byId[id]
                if (!entry) {
                  return (
                    <p key={id} className="text-sm text-amber-800">
                      {isEn
                        ? 'Linked document could not be loaded.'
                        : '연결 문서를 불러오지 못했습니다.'}
                    </p>
                  )
                }
                const isPlain = entry.bodyLayout === 'plain'
                const plainText = sopText(
                  entry.doc.source_raw_ko || '',
                  entry.doc.source_raw_en || '',
                  viewLang
                )
                return (
                  <div
                    key={id}
                    className="rounded-lg border border-indigo-200/80 bg-white px-3 py-4 break-inside-avoid"
                  >
                    <p className="mb-3 text-sm font-semibold text-indigo-900">{entry.title}</p>
                    <NestedPrintOff>
                      {isPlain ? (
                        plainText.trim() ? (
                          <div
                            className="prose prose-sm max-w-none text-foreground prose-headings:tracking-tight prose-p:leading-7 prose-table:text-sm"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(plainText) }}
                          />
                        ) : (
                          <p className="text-sm text-slate-500">
                            {isEn ? 'No original text for this language yet.' : '이 언어의 원문이 아직 없습니다.'}
                          </p>
                        )
                      ) : (
                        <SopDocumentReadonly doc={entry.doc} viewLang={viewLang} layout="flat" />
                      )}
                    </NestedPrintOff>
                  </div>
                )
              })}
            </div>
          ) : (
            <SopManualLinkedArticlePanel
              articleIds={linkedIds}
              hubArticles={hubArticles}
              viewLang={viewLang}
              uiLocaleEn={isEn}
              readOnly
              embedded
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
