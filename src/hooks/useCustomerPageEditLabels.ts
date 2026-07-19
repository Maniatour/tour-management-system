'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { BasicFieldKey, DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import {
  BASIC_FIELD_LABELS,
  DETAIL_FIELD_LABELS,
} from '@/lib/customerPageZoneEditMap'
import type { LightRichEditorUiLocale } from '@/lib/lightRichEditorStrings'

export function useCustomerPageEditLabels() {
  const t = useTranslations('products.customerPageEdit')
  const locale = useLocale()
  const editorUiLocale: LightRichEditorUiLocale = locale === 'ko' ? 'ko' : 'en'

  const detailFieldLabel = (field: DetailFieldKey): string =>
    t.has(`detailFields.${field}`) ? t(`detailFields.${field}`) : DETAIL_FIELD_LABELS[field]

  const basicFieldLabel = (field: BasicFieldKey): string =>
    t.has(`basicFields.${field}`) ? t(`basicFields.${field}`) : BASIC_FIELD_LABELS[field]

  const zoneLabel = (zone: string, fallback: string): string =>
    t.has(`zones.${zone}.label`) ? t(`zones.${zone}.label`) : fallback

  const zoneNote = (zone: string, fallback?: string): string | undefined => {
    if (t.has(`zones.${zone}.note`)) return t(`zones.${zone}.note`)
    return fallback
  }

  return {
    t,
    editorUiLocale,
    detailFieldLabel,
    basicFieldLabel,
    zoneLabel,
    zoneNote,
    showOnCustomerPage: t('showOnCustomerPage'),
    preview: t('preview'),
    columnLabel: (column: string) => t('columnLabel', { column }),
    contentPlaceholder: (label: string) => t('contentPlaceholder', { label }),
  }
}
