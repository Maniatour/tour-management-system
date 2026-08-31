import { LAS_VEGAS_MANIA_WAIVER_EN } from '@/lib/waiver/documents/lasVegasMania/en'
import { LAS_VEGAS_MANIA_WAIVER_KO } from '@/lib/waiver/documents/lasVegasMania/ko'
import { LAS_VEGAS_MANIA_WAIVER_JA } from '@/lib/waiver/documents/lasVegasMania/ja'
import { LAS_VEGAS_MANIA_WAIVER_ZH } from '@/lib/waiver/documents/lasVegasMania/zh'
import { LAS_VEGAS_MANIA_WAIVER_ES } from '@/lib/waiver/documents/lasVegasMania/es'
import { LAS_VEGAS_MANIA_WAIVER_FR } from '@/lib/waiver/documents/lasVegasMania/fr'
import { LAS_VEGAS_MANIA_WAIVER_DE } from '@/lib/waiver/documents/lasVegasMania/de'
import { ANTELOPE_CANYON_X_WAIVER_EN } from '@/lib/waiver/documents/antelopeCanyonX/en'
import {
  ANTELOPE_CANYON_X_WAIVER_JA,
  ANTELOPE_CANYON_X_WAIVER_KO,
  ANTELOPE_CANYON_X_WAIVER_ZH,
} from '@/lib/waiver/documents/antelopeCanyonX/translations.ko-ja-zh'
import {
  ANTELOPE_CANYON_X_WAIVER_DE,
  ANTELOPE_CANYON_X_WAIVER_ES,
  ANTELOPE_CANYON_X_WAIVER_FR,
} from '@/lib/waiver/documents/antelopeCanyonX/translations.es-fr-de'
import type {
  WaiverDocumentCode,
  WaiverDocumentContent,
  WaiverDocumentDefinition,
  WaiverLocale,
} from '@/lib/waiver/types'

export const WAIVER_DOCUMENT_CATALOG: Record<WaiverDocumentCode, WaiverDocumentDefinition> = {
  LAS_VEGAS_MANIA: {
    code: 'LAS_VEGAS_MANIA',
    operatorName: 'LAS VEGAS MANIA TOUR',
    displayName: 'Las Vegas Mania Tour Waiver & Assumption of Risk',
    governingLanguage: 'en',
    sourceType: 'COMPANY_FORM',
    status: 'ACTIVE',
    signatureMode: 'SHARED_SESSION_SIGNATURE',
    requiresPrintedCopy: true,
    originalFormTemplate: 'las_vegas_mania_letter',
    currentVersion: LAS_VEGAS_MANIA_WAIVER_EN.version,
    contents: {
      en: LAS_VEGAS_MANIA_WAIVER_EN,
      ko: LAS_VEGAS_MANIA_WAIVER_KO,
      ja: LAS_VEGAS_MANIA_WAIVER_JA,
      zh: LAS_VEGAS_MANIA_WAIVER_ZH,
      es: LAS_VEGAS_MANIA_WAIVER_ES,
      fr: LAS_VEGAS_MANIA_WAIVER_FR,
      de: LAS_VEGAS_MANIA_WAIVER_DE,
    },
  },
  ANTELOPE_CANYON_X: {
    code: 'ANTELOPE_CANYON_X',
    operatorName: 'Taadidiin Tours L.L.C.',
    displayName: 'Antelope Canyon X / Taadidiin Tours Waiver',
    governingLanguage: 'en',
    sourceType: 'OFFICIAL_OPERATOR_FORM',
    status: 'ACTIVE',
    signatureMode: 'SHARED_SESSION_SIGNATURE',
    requiresPrintedCopy: true,
    originalFormTemplate: 'taadidiin_two_page',
    currentVersion: ANTELOPE_CANYON_X_WAIVER_EN.version,
    contents: {
      en: ANTELOPE_CANYON_X_WAIVER_EN,
      ko: ANTELOPE_CANYON_X_WAIVER_KO,
      ja: ANTELOPE_CANYON_X_WAIVER_JA,
      zh: ANTELOPE_CANYON_X_WAIVER_ZH,
      es: ANTELOPE_CANYON_X_WAIVER_ES,
      fr: ANTELOPE_CANYON_X_WAIVER_FR,
      de: ANTELOPE_CANYON_X_WAIVER_DE,
    },
  },
  LOWER_ANTELOPE: {
    code: 'LOWER_ANTELOPE',
    operatorName: '',
    displayName: 'Lower Antelope Canyon Waiver',
    governingLanguage: 'en',
    sourceType: 'OFFICIAL_OPERATOR_FORM',
    status: 'NOT_CONFIGURED',
    signatureMode: 'SEPARATE_SIGNATURE_REQUIRED',
    requiresPrintedCopy: true,
    originalFormTemplate: null,
    currentVersion: null,
    contents: {},
  },
}

export function getWaiverDefinition(code: WaiverDocumentCode): WaiverDocumentDefinition {
  return WAIVER_DOCUMENT_CATALOG[code]
}

export function getWaiverContent(
  code: WaiverDocumentCode,
  locale: WaiverLocale
): WaiverDocumentContent | null {
  const def = WAIVER_DOCUMENT_CATALOG[code]
  if (def.status === 'NOT_CONFIGURED') return null
  return def.contents[locale] ?? def.contents.en ?? null
}

export function getGoverningWaiverContent(code: WaiverDocumentCode): WaiverDocumentContent | null {
  const def = WAIVER_DOCUMENT_CATALOG[code]
  if (def.status === 'NOT_CONFIGURED') return null
  return def.contents.en ?? null
}

export { isConfiguredWaiverCode } from '@/lib/waiver/types'
