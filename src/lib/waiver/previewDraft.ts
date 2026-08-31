import type { WaiverDocumentCode, WaiverDocumentContent, WaiverLocale } from '@/lib/waiver/types'

export const WAIVER_PREVIEW_DRAFT_KEY = 'kovegas-waiver-preview-draft'

export type WaiverPreviewDraft = {
  codes: WaiverDocumentCode[]
  contentsByCode: Partial<Record<WaiverDocumentCode, Partial<Record<WaiverLocale, WaiverDocumentContent>>>>
  displayNames: Partial<Record<WaiverDocumentCode, string>>
  operatorNames: Partial<Record<WaiverDocumentCode, string>>
}
