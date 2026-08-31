'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { emptyWaiverSection } from '@/lib/waiver/documentEditor'
import type { WaiverDocumentContent } from '@/lib/waiver/types'

function StringList({
  label,
  values,
  onChange,
  rows = 4,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  rows?: number
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {values.map((value, index) => (
        <div key={`${label}-${index}`} className="flex gap-2">
          <Textarea
            className="min-h-[88px] rounded-lg"
            rows={rows}
            value={value}
            onChange={(e) => {
              const next = [...values]
              next[index] = e.target.value
              onChange(next)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            disabled={values.length <= 1}
          >
            −
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => onChange([...values, ''])}>
        + {label}
      </Button>
    </fieldset>
  )
}

export default function WaiverContentLanguageEditor({
  content,
  onChange,
  isKo,
}: {
  content: WaiverDocumentContent
  onChange: (next: WaiverDocumentContent) => void
  isKo: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="waiver-title">
            {isKo ? '제목' : 'Title'}
          </label>
          <Input
            id="waiver-title"
            className="h-11 rounded-lg"
            value={content.title}
            onChange={(e) => onChange({ ...content, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="waiver-subtitle">
            {isKo ? '부제' : 'Subtitle'}
          </label>
          <Input
            id="waiver-subtitle"
            className="h-11 rounded-lg"
            value={content.subtitle ?? ''}
            onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="waiver-warning">
          {isKo ? '경고문' : 'Warning'}
        </label>
        <Textarea
          id="waiver-warning"
          className="min-h-[88px] rounded-lg"
          value={content.warning}
          onChange={(e) => onChange({ ...content, warning: e.target.value })}
        />
      </div>
      <StringList
        label={isKo ? '서문' : 'Introduction'}
        values={content.intro}
        onChange={(intro) => onChange({ ...content, intro })}
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{isKo ? '조항' : 'Sections'}</h3>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg"
            onClick={() =>
              onChange({
                ...content,
                sections: [...content.sections, emptyWaiverSection(String(content.sections.length + 1))],
              })
            }
          >
            {isKo ? '조항 추가' : 'Add section'}
          </Button>
        </div>
        {content.sections.map((section, index) => (
          <article key={`section-${index}`} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-20 space-y-1.5">
                <label className="text-sm font-medium">{isKo ? '번호' : 'No.'}</label>
                <Input
                  className="h-11 rounded-lg"
                  value={section.number}
                  onChange={(e) => {
                    const sections = content.sections.map((s, i) => (i === index ? { ...s, number: e.target.value } : s))
                    onChange({ ...content, sections })
                  }}
                />
              </div>
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <label className="text-sm font-medium">{isKo ? '조항 제목' : 'Section title'}</label>
                <Input
                  className="h-11 rounded-lg"
                  value={section.title}
                  onChange={(e) => {
                    const sections = content.sections.map((s, i) => (i === index ? { ...s, title: e.target.value } : s))
                    onChange({ ...content, sections })
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-6 h-11"
                onClick={() => onChange({ ...content, sections: content.sections.filter((_, i) => i !== index) })}
                disabled={content.sections.length <= 1}
              >
                {isKo ? '삭제' : 'Remove'}
              </Button>
            </div>
            <StringList
              label={isKo ? '본문' : 'Paragraphs'}
              values={section.paragraphs}
              onChange={(paragraphs) => {
                const sections = content.sections.map((s, i) => (i === index ? { ...s, paragraphs } : s))
                onChange({ ...content, sections })
              }}
            />
            <StringList
              label={isKo ? '불릿' : 'Bullets'}
              values={section.bullets?.length ? section.bullets : ['']}
              onChange={(bullets) => {
                const sections = content.sections.map((s, i) => (i === index ? { ...s, bullets } : s))
                onChange({ ...content, sections })
              }}
              rows={2}
            />
          </article>
        ))}
      </div>
      <StringList
        label={isKo ? '맺음말' : 'Closing'}
        values={content.closing}
        onChange={(closing) => onChange({ ...content, closing })}
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="waiver-notice">
          {isKo ? '언어 고지' : 'Language notice'}
        </label>
        <Textarea
          id="waiver-notice"
          className="min-h-[88px] rounded-lg"
          value={content.languageNotice}
          onChange={(e) => onChange({ ...content, languageNotice: e.target.value })}
        />
      </div>
    </div>
  )
}
