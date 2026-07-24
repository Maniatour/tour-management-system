import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bus,
  Car,
  CheckCircle2,
  Info,
  Lightbulb,
  Luggage,
  Settings,
  Shield,
  Users2,
} from 'lucide-react'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import type { DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import type { ProductDetailsFields } from '@/components/product/productDetailTypes'

export type ThingsToKnowCoreSectionId = 'basic' | 'audience' | 'included' | 'policy'

/** customer_page_visibility keys for grouped 알아두실 사항 sections */
export const THINGS_TO_KNOW_CORE_SECTION_VISIBILITY_KEYS: Record<
  ThingsToKnowCoreSectionId,
  string
> = {
  basic: 'things_to_know_basic',
  audience: 'things_to_know_audience',
  included: 'things_to_know_included',
  policy: 'things_to_know_policy',
}

export const THINGS_TO_KNOW_OPERATION_FIELD_IDS = [
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'companion_recruitment_info',
  'notice_info',
  'vehicle_info',
] as const satisfies readonly DetailFieldKey[]

export type ThingsToKnowOperationFieldId = (typeof THINGS_TO_KNOW_OPERATION_FIELD_IDS)[number]

export type ThingsToKnowSectionId = ThingsToKnowCoreSectionId | ThingsToKnowOperationFieldId

export type ThingsToKnowSectionConfig = {
  id: ThingsToKnowSectionId
  labelKey: string
  icon: LucideIcon
  iconClassName: string
  iconBgClassName: string
  detailField?: DetailFieldKey
}

export const THINGS_TO_KNOW_SECTION_CONFIGS: ThingsToKnowSectionConfig[] = [
  {
    id: 'basic',
    labelKey: 'detailTabBasic',
    icon: Info,
    iconClassName: 'text-indigo-600',
    iconBgClassName: 'bg-indigo-50',
  },
  {
    id: 'audience',
    labelKey: 'tourAudienceTitle',
    icon: Users2,
    iconClassName: 'text-sky-600',
    iconBgClassName: 'bg-sky-50',
  },
  {
    id: 'included',
    labelKey: 'detailTabIncluded',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-600',
    iconBgClassName: 'bg-emerald-50',
  },
  {
    id: 'pickup_drop_info',
    labelKey: 'pickupDropInfo',
    icon: Car,
    iconClassName: 'text-booking',
    iconBgClassName: 'bg-blue-50',
    detailField: 'pickup_drop_info',
  },
  {
    id: 'luggage_info',
    labelKey: 'luggageInfo',
    icon: Luggage,
    iconClassName: 'text-amber-600',
    iconBgClassName: 'bg-amber-50',
    detailField: 'luggage_info',
  },
  {
    id: 'tour_operation_info',
    labelKey: 'tourOperations',
    icon: Settings,
    iconClassName: 'text-purple-600',
    iconBgClassName: 'bg-purple-50',
    detailField: 'tour_operation_info',
  },
  {
    id: 'preparation_info',
    labelKey: 'preparationTips',
    icon: Lightbulb,
    iconClassName: 'text-orange-600',
    iconBgClassName: 'bg-orange-50',
    detailField: 'preparation_info',
  },
  {
    id: 'small_group_info',
    labelKey: 'smallGroupInfo',
    icon: Users2,
    iconClassName: 'text-indigo-600',
    iconBgClassName: 'bg-indigo-50',
    detailField: 'small_group_info',
  },
  {
    id: 'companion_recruitment_info',
    labelKey: 'companionRecruitment',
    icon: Users2,
    iconClassName: 'text-teal-600',
    iconBgClassName: 'bg-teal-50',
    detailField: 'companion_recruitment_info',
  },
  {
    id: 'notice_info',
    labelKey: 'importantNotes',
    icon: AlertTriangle,
    iconClassName: 'text-red-600',
    iconBgClassName: 'bg-red-50',
    detailField: 'notice_info',
  },
  {
    id: 'vehicle_info',
    labelKey: 'vehicleInfo',
    icon: Bus,
    iconClassName: 'text-slate-700',
    iconBgClassName: 'bg-slate-100',
    detailField: 'vehicle_info',
  },
  {
    id: 'policy',
    labelKey: 'detailTabPolicy',
    icon: Shield,
    iconClassName: 'text-rose-600',
    iconBgClassName: 'bg-rose-50',
  },
]

function showDetail(
  productDetails: ProductDetailsFields | null,
  field: string
): boolean {
  return isProductDetailVisibleOnCustomerPage(productDetails?.customer_page_visibility, field)
}

function hasDetailFieldContent(
  productDetails: ProductDetailsFields | null,
  field: DetailFieldKey
): boolean {
  if (!productDetails) return false
  const value = productDetails[field as keyof ProductDetailsFields]
  return typeof value === 'string' && value.trim().length > 0 && showDetail(productDetails, field)
}

export function isThingsToKnowOperationField(
  id: ThingsToKnowSectionId
): id is ThingsToKnowOperationFieldId {
  return (THINGS_TO_KNOW_OPERATION_FIELD_IDS as readonly string[]).includes(id)
}

export function getThingsToKnowCustomerPageVisibilityKey(
  sectionId: ThingsToKnowSectionId
): string {
  if (isThingsToKnowOperationField(sectionId)) return sectionId
  return THINGS_TO_KNOW_CORE_SECTION_VISIBILITY_KEYS[sectionId as ThingsToKnowCoreSectionId]
}

export function isThingsToKnowSectionEnabledOnCustomerPage(
  productDetails: ProductDetailsFields | null,
  sectionId: ThingsToKnowSectionId
): boolean {
  const key = getThingsToKnowCustomerPageVisibilityKey(sectionId)
  return isProductDetailVisibleOnCustomerPage(productDetails?.customer_page_visibility, key)
}

export function getThingsToKnowSectionVisibility(
  productDetails: ProductDetailsFields | null,
  opts?: { includeEmptyInEditMode?: boolean }
): Record<ThingsToKnowSectionId, boolean> {
  const includeEmpty = opts?.includeEmptyInEditMode === true

  const sectionVisible = (
    sectionId: ThingsToKnowSectionId,
    contentVisible: boolean
  ): boolean => {
    if (includeEmpty) return true
    return (
      isThingsToKnowSectionEnabledOnCustomerPage(productDetails, sectionId) && contentVisible
    )
  }

  const included = !!(
    productDetails &&
    ((productDetails.included && showDetail(productDetails, 'included')) ||
      (productDetails.not_included && showDetail(productDetails, 'not_included')))
  )

  const policy = !!(
    productDetails &&
    ((productDetails.important_notes && showDetail(productDetails, 'important_notes')) ||
      (productDetails.private_tour_info && showDetail(productDetails, 'private_tour_info')) ||
      (productDetails.cancellation_policy && showDetail(productDetails, 'cancellation_policy')) ||
      (productDetails.chat_announcement && showDetail(productDetails, 'chat_announcement')))
  )

  const operationVisibility = Object.fromEntries(
    THINGS_TO_KNOW_OPERATION_FIELD_IDS.map((field) => [
      field,
      sectionVisible(field, hasDetailFieldContent(productDetails, field)),
    ])
  ) as Record<ThingsToKnowOperationFieldId, boolean>

  return {
    basic: sectionVisible('basic', !!productDetails),
    audience: sectionVisible('audience', false),
    included: sectionVisible('included', included),
    policy: sectionVisible('policy', policy),
    ...operationVisibility,
  }
}

export function getVisibleThingsToKnowSections(
  productDetails: ProductDetailsFields | null,
  opts?: { includeEmptyInEditMode?: boolean }
): ThingsToKnowSectionConfig[] {
  const visibility = getThingsToKnowSectionVisibility(productDetails, opts)
  return THINGS_TO_KNOW_SECTION_CONFIGS.filter((section) => visibility[section.id])
}

export const THINGS_TO_KNOW_ADMIN_SECTION_IDS: ThingsToKnowSectionId[] =
  THINGS_TO_KNOW_SECTION_CONFIGS.map((section) => section.id)

export const THINGS_TO_KNOW_DETAIL_FIELDS_BY_GROUP: Record<
  'included' | 'policy',
  DetailFieldKey[]
> = {
  included: ['included', 'not_included'],
  policy: [
    'important_notes',
    'private_tour_info',
    'cancellation_policy',
    'chat_announcement',
  ],
}
