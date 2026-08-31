import type { WaiverDocumentContent } from '@/lib/waiver/types'
import { canonicalWaiverText } from '@/lib/waiver/hash'

export function serializeWaiverSnapshot(content: WaiverDocumentContent): string {
  return JSON.stringify({
    code: content.code,
    version: content.version,
    operatorName: content.operatorName,
    title: content.title,
    subtitle: content.subtitle ?? null,
    warning: content.warning,
    intro: content.intro,
    sections: content.sections,
    closing: content.closing,
    languageNotice: content.languageNotice,
    governingLanguage: content.governingLanguage,
    canonicalText: canonicalWaiverText(content),
  })
}

export function parseWaiverSnapshot(raw: string | null | undefined): WaiverDocumentContent | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WaiverDocumentContent
    if (!parsed?.code || !parsed.version || !Array.isArray(parsed.sections)) return null
    return parsed
  } catch {
    return null
  }
}
