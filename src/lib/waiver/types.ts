export const WAIVER_LOCALES = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de'] as const
export type WaiverLocale = (typeof WAIVER_LOCALES)[number]

export const WAIVER_DOCUMENT_CODES = [
  'LAS_VEGAS_MANIA',
  'ANTELOPE_CANYON_X',
  'LOWER_ANTELOPE',
] as const
export type WaiverDocumentCode = (typeof WAIVER_DOCUMENT_CODES)[number]

export const WAIVER_DOCUMENT_STATUSES = ['ACTIVE', 'NOT_CONFIGURED'] as const
export type WaiverDocumentStatus = (typeof WAIVER_DOCUMENT_STATUSES)[number]

export const WAIVER_SOURCE_TYPES = ['COMPANY_FORM', 'OFFICIAL_OPERATOR_FORM'] as const
export type WaiverSourceType = (typeof WAIVER_SOURCE_TYPES)[number]

export const WAIVER_SIGNATURE_MODES = [
  'SHARED_SESSION_SIGNATURE',
  'SEPARATE_SIGNATURE_REQUIRED',
] as const
export type WaiverSignatureMode = (typeof WAIVER_SIGNATURE_MODES)[number]

export const WAIVER_PARTICIPANT_TYPES = ['ADULT', 'MINOR'] as const
export type WaiverParticipantType = (typeof WAIVER_PARTICIPANT_TYPES)[number]

export const WAIVER_AUDIT_EVENTS = [
  'WAIVER_CREATED',
  'INVITATION_CREATED',
  'INVITATION_SENT',
  'WAIVER_OPENED',
  'DOCUMENT_VIEWED',
  'DOCUMENT_ACCEPTED',
  'SIGNATURE_CAPTURED',
  'WAIVER_SIGNED',
  'PDF_GENERATED',
  'WAIVER_PRINTED',
  'WAIVER_VOIDED',
  'WAIVER_REISSUED',
  'GUIDE_SIGNATURE_CAPTURED',
  'DOCUMENT_VERSION_PUBLISHED',
] as const
export type WaiverAuditEventType = (typeof WAIVER_AUDIT_EVENTS)[number]

export type WaiverSection = {
  number: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type WaiverDocumentContent = {
  code: WaiverDocumentCode
  version: string
  operatorName: string
  title: string
  subtitle?: string
  warning: string
  intro: string[]
  sections: WaiverSection[]
  closing: string[]
  languageNotice: string
  governingLanguage: 'en'
}

export type WaiverDocumentDefinition = {
  code: WaiverDocumentCode
  operatorName: string
  displayName: string
  governingLanguage: 'en'
  sourceType: WaiverSourceType
  status: WaiverDocumentStatus
  signatureMode: WaiverSignatureMode
  requiresPrintedCopy: boolean
  originalFormTemplate: string | null
  currentVersion: string | null
  contents: Partial<Record<WaiverLocale, WaiverDocumentContent>>
}

export type RequiredWaiverResolution = {
  code: WaiverDocumentCode
  status: WaiverDocumentStatus
  signatureMode: WaiverSignatureMode
  requiredForSigning: boolean
}

export const LAS_VEGAS_MANIA_WAIVER_VERSION = '2026-08-30-v1'
export const ANTELOPE_CANYON_X_WAIVER_VERSION = '2026-08-30-v1'

export function isConfiguredWaiverCode(code: string): code is WaiverDocumentCode {
  return (WAIVER_DOCUMENT_CODES as readonly string[]).includes(code)
}

export const ACKNOWLEDGMENT_KEYS = [
  'readAgreements',
  'inherentRisks',
  'releasesRights',
  'mayRefuseActivity',
  'informationAccurate',
  'electronicSignature',
] as const
export type AcknowledgmentKey = (typeof ACKNOWLEDGMENT_KEYS)[number]

export const MINOR_ACKNOWLEDGMENT_KEY = 'guardianAuthority' as const

export const DOCUMENT_ACCEPTANCE_KEYS = {
  LAS_VEGAS_MANIA: 'acceptLasVegasMania',
  ANTELOPE_CANYON_X: 'acceptAntelopeCanyonX',
  LOWER_ANTELOPE: 'acceptLowerAntelope',
} as const
