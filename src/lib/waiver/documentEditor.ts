import { WAIVER_DOCUMENT_CATALOG } from '@/lib/waiver/documents/catalog'
import type {
  WaiverDocumentCode,
  WaiverDocumentContent,
  WaiverLocale,
  WaiverSection,
} from '@/lib/waiver/types'
import { WAIVER_LOCALES } from '@/lib/waiver/types'

export function emptyWaiverSection(number = '1'): WaiverSection {
  return { number, title: '', paragraphs: [''], bullets: [] }
}

export function emptyWaiverContent(code: WaiverDocumentCode, locale: WaiverLocale): WaiverDocumentContent {
  const def = WAIVER_DOCUMENT_CATALOG[code]
  const notice =
    locale === 'en'
      ? def.code === 'ANTELOPE_CANYON_X'
        ? 'This translation is provided to assist you in understanding the original Taadidiin Tours waiver. The official operator document is the English version.'
        : 'This translation is provided for convenience. To the extent permitted by applicable law, if there is any inconsistency between this translation and the English version, the English version shall control.'
      : ''
  return {
    code,
    version: '',
    operatorName: def.operatorName,
    title: '',
    subtitle: '',
    warning: '',
    intro: [''],
    sections: [emptyWaiverSection('1')],
    closing: [''],
    languageNotice: notice,
    governingLanguage: 'en',
  }
}

export function cloneWaiverContent(content: WaiverDocumentContent): WaiverDocumentContent {
  return {
    ...content,
    intro: [...content.intro],
    closing: [...content.closing],
    sections: content.sections.map((section) => ({
      ...section,
      paragraphs: [...section.paragraphs],
      bullets: section.bullets ? [...section.bullets] : [],
    })),
  }
}

function cleanLines(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim()).filter(Boolean)
}

export function normalizeWaiverContent(
  code: WaiverDocumentCode,
  version: string,
  operatorName: string,
  raw: WaiverDocumentContent
): WaiverDocumentContent {
  const subtitle = raw.subtitle?.trim() ?? ''
  const normalized: WaiverDocumentContent = {
    code,
    version: version.trim(),
    operatorName: operatorName.trim() || raw.operatorName.trim(),
    title: raw.title.trim(),
    warning: raw.warning.trim(),
    intro: cleanLines(raw.intro),
    sections: raw.sections
      .map((section, index) => ({
        number: section.number.trim() || String(index + 1),
        title: section.title.trim(),
        paragraphs: cleanLines(section.paragraphs),
        bullets: cleanLines(section.bullets),
      }))
      .filter((section) => section.title || section.paragraphs.length || section.bullets.length),
    closing: cleanLines(raw.closing),
    languageNotice: raw.languageNotice.trim(),
    governingLanguage: 'en',
  }
  if (subtitle) normalized.subtitle = subtitle
  return normalized
}

export function validateGoverningWaiverContent(content: WaiverDocumentContent): string | null {
  if (!content.title) return 'English title is required'
  if (!content.warning) return 'English warning is required'
  if (!content.intro.length) return 'English introduction is required'
  if (!content.sections.length) return 'At least one English section is required'
  if (content.sections.some((s) => !s.title || !s.paragraphs.length)) {
    return 'Each English section needs a title and at least one paragraph'
  }
  if (!content.closing.length) return 'English closing acknowledgment is required'
  return null
}

export function suggestedWaiverVersion(existingVersions: string[], now = new Date()): string {
  const date = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const prefix = `${date}-v`
  let max = 0
  for (const version of existingVersions) {
    if (!version.startsWith(prefix)) continue
    const n = Number(version.slice(prefix.length))
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return `${prefix}${max + 1}`
}

export function editorContentsFromCatalog(
  code: WaiverDocumentCode
): Partial<Record<WaiverLocale, WaiverDocumentContent>> {
  const def = WAIVER_DOCUMENT_CATALOG[code]
  const contents: Partial<Record<WaiverLocale, WaiverDocumentContent>> = {}
  for (const locale of WAIVER_LOCALES) {
    const existing = def.contents[locale]
    contents[locale] = existing ? cloneWaiverContent(existing) : emptyWaiverContent(code, locale)
  }
  return contents
}

export function isValidWaiverVersionLabel(version: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+$/.test(version.trim()) || /^[A-Za-z0-9._-]{3,40}$/.test(version.trim())
}
