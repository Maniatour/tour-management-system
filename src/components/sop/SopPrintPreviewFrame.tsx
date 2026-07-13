'use client'

import { forwardRef, useEffect, useMemo, useState } from 'react'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import {
  SopPrintLinkedManualsProvider,
  type PrintLinkedManualEntry,
} from '@/components/sop/SopPrintLinkedManualsContext'
import { fetchHubArticleDocumentsByIds } from '@/lib/hubArticleManualLink'
import { collectLinkedHubArticleIdsFromDocument } from '@/lib/sopQuickEdit'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'

type Props = {
  doc: SopDocument
  /** 미리보기에 쓸 언어(편집 언어와 동일하게 두는 것을 권장) */
  viewLang: SopEditLocale
  /** 상단 안내 문구 */
  caption: string
  /** 서명 안내 (로케일별) */
  signatureNote: string
  /**
   * 플로팅 창처럼 바깥에서 스크롤할 때 — 내부 75vh 제한·세로 스크롤을 줄여 한 곳만 스크롤되게 함.
   */
  scrollMode?: 'default' | 'floating'
}

/**
 * 게시 직전·인쇄 시와 비슷한 폭(US Letter)으로 본문을 보여 주는 미리보기 프레임.
 * 카테고리/줄에 연결된 허브 메뉴얼 본문도 함께 펼쳐 인쇄·PDF에 포함합니다.
 */
const SopPrintPreviewFrame = forwardRef<HTMLDivElement, Props>(function SopPrintPreviewFrame(
  { doc, viewLang, caption, signatureNote, scrollMode = 'default' },
  ref
) {
  const floating = scrollMode === 'floating'
  const isEn = viewLang === 'en'
  const linkedIds = useMemo(() => collectLinkedHubArticleIdsFromDocument(doc), [doc])
  const [linkedById, setLinkedById] = useState<Record<string, PrintLinkedManualEntry>>({})
  const [linkedLoading, setLinkedLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (linkedIds.length === 0) {
      setLinkedById({})
      setLinkedLoading(false)
      return
    }

    setLinkedLoading(true)
    void (async () => {
      const rows = await fetchHubArticleDocumentsByIds(linkedIds, viewLang)
      if (cancelled) return
      const next: Record<string, PrintLinkedManualEntry> = {}
      for (const row of rows) {
        next[row.id] = {
          id: row.id,
          title: row.title,
          doc: row.doc,
        }
      }
      setLinkedById(next)
      setLinkedLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [linkedIds, viewLang])

  const printLinkedValue = useMemo(
    () => ({
      byId: linkedById,
      expandInline: true,
      loading: linkedLoading,
    }),
    [linkedById, linkedLoading]
  )

  return (
    <div
      className={
        floating
          ? 'flex min-h-0 max-h-full min-w-0 flex-col rounded-lg border border-slate-300 bg-slate-100/80 p-3 shadow-inner'
          : 'rounded-lg border border-slate-300 bg-slate-100/80 p-3 shadow-inner'
      }
    >
      <p className="mb-2 shrink-0 text-xs font-medium text-slate-600">{caption}</p>
      {linkedIds.length > 0 ? (
        <p className="mb-2 shrink-0 text-[11px] text-slate-500">
          {linkedLoading
            ? isEn
              ? `Loading ${linkedIds.length} linked manual(s)…`
              : `연결 메뉴얼 ${linkedIds.length}개 불러오는 중…`
            : isEn
              ? `${Object.keys(linkedById).length} linked manual(s) included below.`
              : `연결 메뉴얼 ${Object.keys(linkedById).length}개 본문 포함`}
        </p>
      ) : null}
      {/* 가로: Letter(8.5in) 고정 폭 — 좁은 열에서는 스크롤로 전체 폭 확인 */}
      <div
        className={
          floating
            ? 'min-h-0 flex-1 rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-auto overscroll-contain'
            : 'rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-auto'
        }
        style={floating ? undefined : { maxHeight: 'min(75vh, 900px)' }}
      >
        <div
          ref={ref}
          data-print-linked-pending={linkedLoading ? '1' : undefined}
          className="mx-auto box-border min-w-[8.5in] w-[8.5in] bg-white px-[0.75in] py-[0.5in] text-[12pt] leading-relaxed text-black shadow-md print:shadow-none"
        >
          <SopPrintLinkedManualsProvider value={printLinkedValue}>
            <SopDocumentReadonly doc={doc} viewLang={viewLang} layout="flat" />
          </SopPrintLinkedManualsProvider>
          <div className="mt-10 border-t border-dashed border-slate-300 pt-5 text-sm text-slate-500">
            {signatureNote}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SopPrintPreviewFrame
