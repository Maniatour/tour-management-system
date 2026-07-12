import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import type { ProductDetailsFields } from '@/components/product/productDetailTypes'

export function getProductDetailSectionVisibility(productDetails: ProductDetailsFields | null) {
  const showDetail = (field: string) =>
    isProductDetailVisibleOnCustomerPage(productDetails?.customer_page_visibility, field)

  const included = !!(
    productDetails &&
    ((productDetails.included && showDetail('included')) ||
      (productDetails.not_included && showDetail('not_included')))
  )

  const logistics = !!(
    productDetails &&
    ((productDetails.pickup_drop_info && showDetail('pickup_drop_info')) ||
      (productDetails.luggage_info && showDetail('luggage_info')) ||
      (productDetails.tour_operation_info && showDetail('tour_operation_info')) ||
      (productDetails.preparation_info && showDetail('preparation_info')) ||
      (productDetails.small_group_info && showDetail('small_group_info')) ||
      (productDetails.companion_recruitment_info && showDetail('companion_recruitment_info')) ||
      (productDetails.notice_info && showDetail('notice_info')))
  )

  const policy = !!(
    productDetails &&
    ((productDetails.important_notes && showDetail('important_notes')) ||
      (productDetails.private_tour_info && showDetail('private_tour_info')) ||
      (productDetails.cancellation_policy && showDetail('cancellation_policy')) ||
      (productDetails.chat_announcement && showDetail('chat_announcement')))
  )

  return {
    included,
    basic: true,
    logistics,
    policy,
  }
}
