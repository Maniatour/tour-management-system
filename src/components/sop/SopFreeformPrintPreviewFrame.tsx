'use client'

import { forwardRef } from 'react'
import { markdownToHtml } from '@/components/LightRichEditor'
import { cn } from '@/lib/utils'

type Props = {
  markdown: string
  caption: string
  signatureNote: string
  scrollMode?: 'default' | 'floating'
}

/** 자유 서식(한 페이지) 본문을 A4 폭으로 미리보기 */
const SopFreeformPrintPreviewFrame = forwardRef<HTMLDivElement, Props>(function SopFreeformPrintPreviewFrame(
  { markdown, caption, signatureNote, scrollMode = 'default' },
  ref
) {
  const floating = scrollMode === 'floating'
  const html = markdownToHtml(markdown || '')
  return (
    <div
      className={cn(
        floating
          ? 'flex min-h-0 max-h-full min-w-0 flex-col rounded-lg border border-slate-300 bg-slate-100/80 p-3 shadow-inner'
          : 'rounded-lg border border-slate-300 bg-slate-100/80 p-3 shadow-inner'
      )}
    >
      <p className="mb-2 shrink-0 text-xs font-medium text-slate-600">{caption}</p>
      <div
        className={cn(
          floating
            ? 'min-h-0 flex-1 rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-auto overscroll-contain'
            : 'rounded border border-slate-200 bg-slate-200/50 shadow-inner overflow-x-auto overflow-y-auto'
        )}
        style={floating ? undefined : { maxHeight: 'min(75vh, 900px)' }}
      >
        <div
          ref={ref}
          className="mx-auto box-border min-h-[260mm] min-w-[210mm] w-[210mm] bg-white px-[18mm] py-[12mm] text-[12pt] leading-relaxed text-black shadow-md print:shadow-none"
        >
          {html ? (
            <div
              className="prose prose-sm max-w-none text-black [&_a]:text-blue-600 [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
          <div className="mt-10 border-t border-dashed border-slate-300 pt-5 text-sm text-slate-500">
            {signatureNote}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SopFreeformPrintPreviewFrame
