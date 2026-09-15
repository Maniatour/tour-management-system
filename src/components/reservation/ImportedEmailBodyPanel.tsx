'use client'

import { useMemo, useState } from 'react'
import { getImportedEmailPreviewParts } from '@/lib/importedEmailPreview'

type EmailBodyView = 'preview' | 'code'

type ImportedEmailBodyPanelProps = {
  text: string | null | undefined
  html: string | null | undefined
  previewLabel?: string
  codeLabel?: string
  emptyLabel?: string
  heightClassName?: string
}

export function ImportedEmailBodyPanel({
  text,
  html,
  previewLabel = '미리보기',
  codeLabel = '코드',
  emptyLabel = '본문을 표시할 수 없습니다.',
  heightClassName = 'h-[32rem] max-h-[min(60vh,36rem)]',
}: ImportedEmailBodyPanelProps) {
  const [view, setView] = useState<EmailBodyView>('preview')
  const preview = useMemo(() => getImportedEmailPreviewParts(text, html), [text, html])
  const isHtml = Boolean(preview.htmlSrcDoc)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setView('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            view === 'preview'
              ? 'border-b-2 border-primary bg-white text-primary'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {previewLabel}
        </button>
        <button
          type="button"
          onClick={() => setView('code')}
          className={`px-4 py-2 text-sm font-medium ${
            view === 'code'
              ? 'border-b-2 border-primary bg-white text-primary'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {codeLabel}
        </button>
      </div>
      {view === 'preview' ? (
        isHtml && preview.htmlSrcDoc ? (
          <div className={`overflow-auto bg-gray-100 p-4 ${heightClassName}`}>
            <iframe
              title="이메일 미리보기"
              sandbox="allow-same-origin allow-popups"
              srcDoc={preview.htmlSrcDoc}
              className="min-h-full w-full rounded-lg border-0 bg-white shadow-sm"
              onLoad={(e) => {
                const frame = e.currentTarget
                const doc = frame.contentDocument
                if (!doc?.documentElement) return
                const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0)
                if (h > 0) frame.style.height = `${h + 24}px`
              }}
            />
          </div>
        ) : (
          <div className={`overflow-auto bg-white p-5 sm:p-6 ${heightClassName}`}>
            <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800">
              {preview.plainText || emptyLabel}
            </pre>
          </div>
        )
      ) : (
        <div className={`overflow-auto bg-[#1e1e1e] p-0 ${heightClassName}`}>
          <pre className="m-0 block whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-[#d4d4d4]">
            <code className="text-[#d4d4d4]">{preview.sourceCode}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
