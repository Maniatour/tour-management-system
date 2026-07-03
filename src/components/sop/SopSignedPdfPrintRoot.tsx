'use client'

import { forwardRef } from 'react'
import { markdownToHtml } from '@/components/LightRichEditor'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'

export type SopSignedPdfPrintRootProps = {
  title: string
  metaLines: string[]
  doc: SopDocument | null
  bodyMdFallback?: string | null
  viewLang: SopEditLocale
  signatureHeading: string
  nameLabel: string
  emailLabel: string
  signedAtLabel: string
  signerName: string
  signerEmail: string
  signedAt: string
}

/**
 * 서명 PDF 캡처용 오프스크린 루트 — html2canvas가 빈 이미지를 내지 않도록 화면 안(투명)에 둡니다.
 */
const SopSignedPdfPrintRoot = forwardRef<HTMLDivElement, SopSignedPdfPrintRootProps>(
  function SopSignedPdfPrintRoot(
    {
      title,
      metaLines,
      doc,
      bodyMdFallback,
      viewLang,
      signatureHeading,
      nameLabel,
      emailLabel,
      signedAtLabel,
      signerName,
      signerEmail,
      signedAt,
    },
    ref
  ) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[-1] opacity-0"
        style={{ width: '210mm' }}
      >
        <div
          ref={ref}
          className="box-border w-[210mm] bg-white px-[18mm] py-[12mm] text-[12pt] leading-relaxed text-black"
        >
          <div
            className="mb-2 text-xl font-bold prose prose-sm max-w-none text-black [&_p]:my-0"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(title) }}
          />
          {metaLines.map((line) => (
            <p key={line} className="mb-1 text-[10pt] text-gray-600">
              {line}
            </p>
          ))}
          <div className="mt-4">
            {doc ? (
              <SopDocumentReadonly doc={doc} viewLang={viewLang} layout="flat" />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-[11pt] text-gray-900">
                {bodyMdFallback || ''}
              </pre>
            )}
          </div>
          <div className="mt-10 border-t border-gray-400 pt-5">
            <p className="mb-2 text-sm font-bold text-gray-900">{signatureHeading}</p>
            <img
              data-sop-signature-img
              alt=""
              width={220}
              height={70}
              className="mb-3 block h-[70px] w-[220px] border border-gray-300 bg-gray-50 object-contain"
            />
            <p className="text-[11pt] text-gray-800">
              {nameLabel}: {signerName} · {emailLabel}: {signerEmail}
            </p>
            <p className="mt-1 text-[11pt] text-gray-800">
              {signedAtLabel}: <span data-sop-signed-at>{signedAt}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }
)

export default SopSignedPdfPrintRoot
