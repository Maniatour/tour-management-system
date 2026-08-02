export type {
  PricingProfileId,
  PricingLedgerLine,
  PricingLayerResult,
  ReservationPricingResult,
  PricingEngineContext,
  LegacyPricingSnapshotFromUi,
  PricingComparisonRow,
  PricingComparisonResult,
} from '@/lib/pricingEngine/types'

export { detectPricingProfile } from '@/lib/pricingEngine/detectProfile'
export {
  computeReservationPricing,
  computeLineFormulaCustomerTotal,
  computeLineFormulaCustomerNet,
} from '@/lib/pricingEngine/compute'
export { comparePricingEngines, runPricingEngineComparison } from '@/lib/pricingEngine/compare'
export {
  analyzeReservationPricingEngine,
  buildEngineContextFromReservation,
  buildReservationPricingEnginePatch,
  buildEngineApplyPreview,
  computeLegacyPricingSnapshot,
  expandEngineApplyFieldKeys,
  fetchReservationPricingDbStoredMap,
  reservationMatchesEngineMismatchCriteria,
  type EngineDbFieldKey,
  type EnginePatchFieldKey,
  type EngineFieldComparison,
  type EngineApplyPreviewRow,
  type LegacyPricingSnapshot,
  type ReservationPricingAnalysis,
} from '@/lib/pricingEngine/analyzeReservation'
export {
  buildPricingEngineContext,
  type BuildPricingEngineContextInput,
} from '@/lib/pricingEngine/buildContext'
