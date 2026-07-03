export type StructuredDocVersionRow = {
  id: string
  version_number: number
  title: string
  body_md: string | null
  body_structure: unknown
  freeform_markdown?: string | null
  published_at: string
}

type ComplianceSigRow = {
  signer_email: string
  signer_name: string
  signed_at: string
  pdf_storage_path: string
}

type TeamRow = { email: string; name_ko: string | null; name_en: string | null }

export type StructuredDocDualCompliance = {
  team: TeamRow[]
  sopLatest: StructuredDocVersionRow | null
  sopSigs: ComplianceSigRow[]
  contractLatest: StructuredDocVersionRow | null
  contractSigs: ComplianceSigRow[]
  onOpenPdf: (path: string, bucket: 'sop-signatures' | 'employee-contract-signatures') => void
  openingPdf: string | null
  openingPdfBucket: 'sop-signatures' | 'employee-contract-signatures'
}
