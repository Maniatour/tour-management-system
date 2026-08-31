import { createHash } from 'crypto'
import type { WaiverDocumentContent } from '@/lib/waiver/types'

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function canonicalWaiverText(content: WaiverDocumentContent): string {
  const parts: string[] = [
    content.code,
    content.version,
    content.operatorName,
    content.title,
    content.subtitle ?? '',
    content.warning,
    ...content.intro,
  ]

  for (const section of content.sections) {
    parts.push(section.number, section.title, ...section.paragraphs, ...(section.bullets ?? []))
  }

  parts.push(...content.closing, content.languageNotice, content.governingLanguage)
  return parts.join('\n').trim()
}

export function hashWaiverContent(content: WaiverDocumentContent): string {
  return sha256Hex(canonicalWaiverText(content))
}
