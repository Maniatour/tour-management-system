'use client'

import React, { useMemo, useState } from 'react'
import { Mail, FileText } from 'lucide-react'
import { emailHtmlToPlainText } from '@/lib/emailHtmlToPlainText'

export type EmailPreviewBodyView = 'html' | 'text'

export interface EmailPreviewBodyPanelProps {
  html: string
  prepareHtml?: (html: string) => string
  bodyRef?: React.Ref<HTMLDivElement>
  bodyClassName?: string
  bodyStyle?: React.CSSProperties
  toolbar?: React.ReactNode
  title?: string
  defaultView?: EmailPreviewBodyView
  maxHeightClass?: string
  htmlTabLabel?: string
  textTabLabel?: string
}

export default function EmailPreviewBodyPanel({
  html,
  prepareHtml,
  bodyRef,
  bodyClassName = 'email-preview-body-host p-4',
  bodyStyle,
  toolbar,
  title = '이메일 미리보기',
  defaultView = 'html',
  maxHeightClass = 'max-h-[min(55vh,520px)]',
  htmlTabLabel = 'HTML',
  textTabLabel = '텍스트',
}: EmailPreviewBodyPanelProps) {
  const [view, setView] = useState<EmailPreviewBodyView>(defaultView)

  const displayHtml = useMemo(
    () => (prepareHtml ? prepareHtml(html) : html),
    [html, prepareHtml]
  )

  const plainText = useMemo(
    () => emailHtmlToPlainText(displayHtml),
    [displayHtml]
  )

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-gray-100 px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            <span>{title}</span>
          </div>
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
        <div className="-mx-4 mt-2 flex border-b border-gray-200 bg-gray-50/90 px-4">
          <button
            type="button"
            onClick={() => setView('html')}
            className={`shrink-0 px-3 py-2 text-xs font-medium sm:text-sm ${
              view === 'html'
                ? 'border-b-2 border-blue-600 bg-white text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {htmlTabLabel}
          </button>
          <button
            type="button"
            onClick={() => setView('text')}
            className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium sm:text-sm ${
              view === 'text'
                ? 'border-b-2 border-blue-600 bg-white text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {textTabLabel}
          </button>
        </div>
      </div>

      {view === 'html' ? (
        <div
          ref={bodyRef}
          className={`${bodyClassName} ${maxHeightClass} overflow-auto`}
          dangerouslySetInnerHTML={{ __html: displayHtml }}
          style={
            bodyStyle ?? {
              maxWidth: '600px',
              margin: '0 auto',
              backgroundColor: '#ffffff',
            }
          }
        />
      ) : (
        <div
          className={`overflow-auto bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 ${maxHeightClass}`}
        >
          <pre
            className="m-0 whitespace-pre-wrap break-words rounded-lg border border-gray-100 bg-white px-4 py-3.5 text-[13px] leading-[1.65] text-gray-800 shadow-sm sm:text-sm"
            style={{
              fontFamily:
                'system-ui, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
            }}
          >
            {plainText.length > 150000 ? `${plainText.slice(0, 150000)}…` : plainText}
          </pre>
        </div>
      )}
    </div>
  )
}
