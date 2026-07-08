'use client'

import type { TranslationFieldDef, TranslationFormState } from '@/lib/customerPageTranslations'
import { CUSTOMER_PAGE_TRANSLATION_LOCALES } from '@/lib/customerPageTranslations'

type CustomerPageTranslationEditorProps = {
  fields: TranslationFieldDef[]
  values: TranslationFormState
  onChange: (next: TranslationFormState) => void
}

const LOCALE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
}

export default function CustomerPageTranslationEditor({
  fields,
  values,
  onChange,
}: CustomerPageTranslationEditorProps) {
  const setValue = (key: string, locale: string, value: string) => {
    onChange({
      ...values,
      [key]: {
        ...values[key],
        [locale]: value,
      },
    })
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.key} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-900">{field.label}</h4>
            <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{field.key}</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {CUSTOMER_PAGE_TRANSLATION_LOCALES.map((locale) => (
              <div key={`${field.key}-${locale}`}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {LOCALE_LABELS[locale] ?? locale}
                </label>
                {field.multiline ? (
                  <textarea
                    value={values[field.key]?.[locale] ?? ''}
                    onChange={(e) => setValue(field.key, locale, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y min-h-[72px]"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.key]?.[locale] ?? ''}
                    onChange={(e) => setValue(field.key, locale, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
