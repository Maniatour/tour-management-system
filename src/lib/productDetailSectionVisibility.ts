import type { ProductDetailsFields } from '@/components/product/productDetailTypes'
import {
  getThingsToKnowSectionVisibility,
  THINGS_TO_KNOW_OPERATION_FIELD_IDS,
  type ThingsToKnowSectionId,
} from '@/lib/thingsToKnowSections'

export type { ThingsToKnowSectionId }

/** Legacy grouped visibility for older tab layouts */
export function getProductDetailSectionVisibility(productDetails: ProductDetailsFields | null) {
  const visibility = getThingsToKnowSectionVisibility(productDetails)
  return {
    basic: visibility.basic,
    included: visibility.included,
    logistics: THINGS_TO_KNOW_OPERATION_FIELD_IDS.some((field) => visibility[field]),
    policy: visibility.policy,
  }
}

export { getThingsToKnowSectionVisibility }
