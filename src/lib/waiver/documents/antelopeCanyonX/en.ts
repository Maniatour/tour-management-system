import {
  ANTELOPE_CANYON_X_WAIVER_VERSION,
  type WaiverDocumentContent,
} from '@/lib/waiver/types'
import { ANTELOPE_CANYON_X_WAIVER_PRINT } from '@/lib/waiver/documents/antelopeCanyonX/printEn'

/**
 * Official operator document: TAADIDIIN TOURS — WAIVER FORM
 * Matches the printed Taadidiin paper form exactly.
 * Do not paraphrase. If Taadidiin revises the paper, create a new version.
 */
export const ANTELOPE_CANYON_X_WAIVER_EN: WaiverDocumentContent = {
  code: 'ANTELOPE_CANYON_X',
  version: ANTELOPE_CANYON_X_WAIVER_VERSION,
  operatorName: 'Taadidiin Tours L.L.C.',
  title: ANTELOPE_CANYON_X_WAIVER_PRINT.title,
  subtitle: ANTELOPE_CANYON_X_WAIVER_PRINT.subtitle,
  warning: '',
  intro: [ANTELOPE_CANYON_X_WAIVER_PRINT.intro],
  sections: ANTELOPE_CANYON_X_WAIVER_PRINT.clauses.map((paragraph, index) => ({
    number: String(index + 1),
    title: '',
    paragraphs: [paragraph],
  })),
  closing: [ANTELOPE_CANYON_X_WAIVER_PRINT.closing],
  languageNotice:
    'This translation is provided to assist you in understanding the original Taadidiin Tours waiver. The official operator document is the English version.',
  governingLanguage: 'en',
}
