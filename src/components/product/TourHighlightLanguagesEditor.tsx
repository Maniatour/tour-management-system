'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import {
  buildTourLanguageHighlightChips,
  COMMON_TOUR_HIGHLIGHT_LANGUAGE_OPTIONS,
  mergeTourLanguageList,
  normalizeTourLanguageToken,
} from '@/lib/tourHighlightLanguages'

type TourHighlightLanguagesEditorProps = {
  value: string[]
  onChange: (next: string[]) => void
  locale?: string
}

export default function TourHighlightLanguagesEditor({
  value,
  onChange,
  locale = 'ko',
}: TourHighlightLanguagesEditorProps) {
  const [draft, setDraft] = useState('')
  const chips = buildTourLanguageHighlightChips(value, locale)

  const addFromDraft = () => {
    const tokens = draft
      .split(/[,，;|/]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (tokens.length === 0) return
    onChange(mergeTourLanguageList(value, tokens))
    setDraft('')
  }

  const removeLanguage = (code: string) => {
    onChange(value.filter((item) => item.toLowerCase() !== code.toLowerCase()))
  }

  const toggleQuickLanguage = (code: string) => {
    const normalized = normalizeTourLanguageToken(code)
    if (value.some((item) => item.toLowerCase() === normalized)) {
      removeLanguage(normalized)
      return
    }
    onChange(mergeTourLanguageList(value, [normalized]))
  }

  return (
    <div className="space-y-3">
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground"
            >
              <ReactCountryFlag
                countryCode={chip.countryCode}
                svg
                className="airbnb-detail-highlight-flag"
                aria-hidden
              />
              {chip.label}
              <button
                type="button"
                onClick={() => removeLanguage(chip.code)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${chip.label} 제거`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">아직 선택된 언어가 없습니다.</p>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">빠른 선택</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_TOUR_HIGHLIGHT_LANGUAGE_OPTIONS.map((option) => {
            const selected = value.some(
              (item) => normalizeTourLanguageToken(item) === normalizeTourLanguageToken(option.code)
            )
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => toggleQuickLanguage(option.code)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">직접 입력</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFromDraft()
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="예: ja, es, french, 일본어"
          />
          <button
            type="button"
            onClick={addFromDraft}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          언어 코드(ja, es), 영문명(spanish), 한글명(일본어) 또는 쉼표로 여러 개 입력할 수 있습니다.
          고객 화면에는 국기 + 언어명(한국어 페이지: 영어·한국어, English page: ENGLISH·KOREAN) 형식으로 표시됩니다.
        </p>
      </div>
    </div>
  )
}
