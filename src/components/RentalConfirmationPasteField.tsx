'use client'

import { ClipboardPaste } from 'lucide-react'
import type { ClipboardEvent } from 'react'
import FieldHoverHint from '@/components/FieldHoverHint'

type RentalOcrStatus = 'idle' | 'running' | 'ok' | 'fail'

type RentalConfirmationPasteFieldProps = {
  value: string
  onChange: (value: string) => void
  onParse: (text: string) => void
  status: RentalOcrStatus
  summary: string
}

export default function RentalConfirmationPasteField({
  value,
  onChange,
  onParse,
  status,
  summary,
}: RentalConfirmationPasteFieldProps) {
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!pasted.trim()) return
    window.setTimeout(() => onParse(pasted), 0)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="rental-confirmation-paste" className="inline-flex items-center text-sm font-medium text-gray-700">
          확인서 텍스트 붙여넣기
          <FieldHoverHint text="Enterprise 사이트에서 Rental Details를 드래그해 복사한 뒤 붙여넣으면 픽업·반납·예약 가격이 자동으로 채워집니다." />
        </label>
        <button
          type="button"
          onClick={() => onParse(value)}
          disabled={!value.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          파싱
        </button>
      </div>
      <textarea
        id="rental-confirmation-paste"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={handlePaste}
        rows={4}
        className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
        placeholder="확인서 텍스트를 붙여넣으세요"
      />
      {status !== 'idle' ? (
        <p
          className={`mt-1.5 text-xs ${
            status === 'running'
              ? 'text-sky-700'
              : status === 'ok'
                ? 'text-emerald-700'
                : 'text-amber-800'
          }`}
        >
          {status === 'running' ? '확인서 내용을 읽는 중…' : summary}
        </p>
      ) : null}
    </div>
  )
}
