import { isCanyonKey, type CanyonKey } from '@/lib/canyonChoice'
import { WAIVER_DOCUMENT_CATALOG } from '@/lib/waiver/documents/catalog'
import type {
  RequiredWaiverResolution,
  WaiverDocumentCode,
} from '@/lib/waiver/types'

export type ResolveRequiredWaiversInput = {
  productRequiredCodes?: string[] | null
  canyonChoice?: string | null
  productTags?: string[] | null
  productName?: string | null
}

function looksLikeAntelopeX(text: string): boolean {
  return /antelope\s*(canyon\s*)?x|\bcanyon\s*x\b|앤텔롭.*엑스|엑스.*앤텔롭|antelope_x/i.test(text)
}

function looksLikeLowerAntelope(text: string): boolean {
  return /lower\s*antelope|로워\s*앤텔롭|로어\s*앤텔롭|lower_antelope/i.test(text)
}

export function inferCanyonWaiverFromProduct(input: {
  tags?: string[] | null
  name?: string | null
}): WaiverDocumentCode[] {
  const blob = `${(input.tags ?? []).join(' ')} ${input.name ?? ''}`.trim()
  const codes: WaiverDocumentCode[] = []
  if (looksLikeAntelopeX(blob)) codes.push('ANTELOPE_CANYON_X')
  if (looksLikeLowerAntelope(blob)) codes.push('LOWER_ANTELOPE')
  return codes
}

export function canyonChoiceToWaiverCode(choice: string | null | undefined): WaiverDocumentCode | null {
  if (!choice) return null
  if (isCanyonKey(choice)) {
    const map: Record<CanyonKey, WaiverDocumentCode | null> = {
      X: 'ANTELOPE_CANYON_X',
      L: 'LOWER_ANTELOPE',
      U: null,
    }
    return map[choice]
  }
  if (looksLikeAntelopeX(choice) || choice === 'antelope_x') return 'ANTELOPE_CANYON_X'
  if (looksLikeLowerAntelope(choice) || choice === 'lower_antelope') return 'LOWER_ANTELOPE'
  return null
}

/**
 * Product defaults + this booking's canyon choice.
 * LAS_VEGAS_MANIA is always required.
 * LOWER_ANTELOPE is recognized but not required for signing while NOT_CONFIGURED.
 */
export function resolveRequiredWaivers(input: ResolveRequiredWaiversInput): RequiredWaiverResolution[] {
  const codes = new Set<WaiverDocumentCode>(['LAS_VEGAS_MANIA'])

  for (const raw of input.productRequiredCodes ?? []) {
    if (raw === 'LAS_VEGAS_MANIA' || raw === 'ANTELOPE_CANYON_X' || raw === 'LOWER_ANTELOPE') {
      codes.add(raw)
    }
  }

  for (const inferred of inferCanyonWaiverFromProduct({
    tags: input.productTags ?? null,
    name: input.productName ?? null,
  })) {
    codes.add(inferred)
  }

  const fromChoice = canyonChoiceToWaiverCode(input.canyonChoice)
  if (fromChoice) codes.add(fromChoice)

  return [...codes].map((code) => {
    const def = WAIVER_DOCUMENT_CATALOG[code]
    return {
      code,
      status: def.status,
      signatureMode: def.signatureMode,
      requiredForSigning: def.status === 'ACTIVE',
    }
  })
}

export function signingRequiredCodes(rows: RequiredWaiverResolution[]): WaiverDocumentCode[] {
  return rows.filter((row) => row.requiredForSigning).map((row) => row.code)
}
