'use client'

import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
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
 * 게시 직전·인쇄 시와 비슷한 폭(A4)으로 본문을 보여 주는 미리보기 프레임.
 */
export default function SopPrintPreviewFrame({
  doc,
  viewLang,
  caption,
  signatureNote,
  scrollMode = 'default',
}: Props) {
  const floating = scrollMode === 'floating'
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100/80 p-3 shadow-inner">
      <p className="text-xs font-medium text-slate-600 mb-2">{caption}</p>
      {/* 가로: A4(210mm) 고정 폭 — 좁은 열에서는 스크롤로 전체 폭 확인 */}
      <div
        className={
          floating
            ? 'rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-visible'
            : 'rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-auto'
        }
        style={floating ? undefined : { maxHeight: 'min(75vh, 900px)' }}
      >
        <div
          className="mx-auto box-border min-w-[210mm] w-[210mm] bg-white px-[18mm] py-[12mm] text-[12pt] leading-relaxed text-black shadow-md print:shadow-none"
        >
          <SopDocumentReadonly doc={doc} viewLang={viewLang} layout="flat" />
          <div className="mt-10 border-t border-dashed border-slate-300 pt-5 text-sm text-slate-500">
            {signatureNote}
          </div>
        </div>
      </div>
    </div>
  )
}
