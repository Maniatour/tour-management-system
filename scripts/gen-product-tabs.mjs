import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function stripItineraryWrapper(body) {
  let lines = body.split(/\r?\n/)
  lines = lines.slice(2)
  if (lines[lines.length - 1].trim() === ')}') lines = lines.slice(0, -1)
  if (lines[0].trim() === '<div>') lines = lines.slice(1)
  if (lines[lines.length - 1].trim() === '</div>') lines = lines.slice(0, -1)
  return lines.join('\n')
}

function stripDetailsWrapper(body) {
  let lines = body.split(/\r?\n/)
  lines = lines.slice(2)
  if (lines[lines.length - 1].trim() === ')}') lines = lines.slice(0, -1)
  return lines.join('\n')
}

let itBody = stripItineraryWrapper(fs.readFileSync(path.join(root, 'tmp-itinerary.txt'), 'utf8'))
let detBody = stripDetailsWrapper(fs.readFileSync(path.join(root, 'tmp-details.txt'), 'utf8'))

itBody = itBody
  .replace(/isEnglish \? 'Tour Course Description' : '투어 코스 설명'/g, "t('tourCourseDescription')")
  .replace(
    /isEnglish \? 'No tour course information available\.' : '투어 코스 정보가 없습니다\.'/g,
    "t('noTourCourseInfo')"
  )
  .replace(/'Course image'/g, "t('courseImageAlt')")

detBody = detBody
  .replace(/getCategoryLabel\(product\.category \|\| ''\)/g, 'categoryLabel')
  .replace(/formatDuration\(product\.duration\)/g, 'durationLabel')
  .replace(/\{isEnglish \? 'Detailed Tour Information' : '투어 상세 정보'\}/g, '{t("detailedTourInformation")}')

const itFile = `'use client'

import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import type { ProductTourCourse, TourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'

type ProductDetailItineraryTabProps = {
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  isEnglish: boolean
}

export default function ProductDetailItineraryTab({
  tourCourses,
  tourCoursePhotos,
  isEnglish,
}: ProductDetailItineraryTabProps) {
  const t = useTranslations('productDetail')

  return (
${itBody}
  )
}
`

const detFile = `'use client'

import { useMemo, useState } from 'react'
import {
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Car,
  Luggage,
  Settings,
  Lightbulb,
  Users2,
  AlertTriangle,
  Shield,
  Megaphone,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import type { ProductDetailsFields, ProductDetailsTabProduct } from '@/components/product/productDetailTypes'

type ProductDetailDetailsTabProps = {
  product: ProductDetailsTabProduct
  productDetails: ProductDetailsFields | null
  isEnglish: boolean
  categoryLabel: string
  durationLabel: string
}

export default function ProductDetailDetailsTab({
  product,
  productDetails,
  isEnglish,
  categoryLabel,
  durationLabel,
}: ProductDetailDetailsTabProps) {
  const t = useTranslations('productDetail')
  const [activeDetailTab, setActiveDetailTab] = useState('basic')

  const detailTabs = isEnglish
    ? [
        { id: 'basic', label: t('detailTabBasic') },
        { id: 'included', label: t('detailTabIncluded') },
        { id: 'logistics', label: t('detailTabLogistics') },
        { id: 'policy', label: t('detailTabPolicy') },
      ]
    : [
        { id: 'basic', label: t('detailTabBasic') },
        { id: 'included', label: t('detailTabIncluded') },
        { id: 'logistics', label: t('detailTabLogistics') },
        { id: 'policy', label: t('detailTabPolicy') },
      ]

  const showDetailOnCustomerPage = (field: string) =>
    isProductDetailVisibleOnCustomerPage(productDetails?.customer_page_visibility, field)

  const hasVisibleIncludedDetailCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.included && s('included')) ||
      (productDetails.not_included && s('not_included'))
    )
  }, [productDetails])

  const hasVisibleLogisticsCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.pickup_drop_info && s('pickup_drop_info')) ||
      (productDetails.luggage_info && s('luggage_info')) ||
      (productDetails.tour_operation_info && s('tour_operation_info')) ||
      (productDetails.preparation_info && s('preparation_info')) ||
      (productDetails.small_group_info && s('small_group_info')) ||
      (productDetails.companion_recruitment_info && s('companion_recruitment_info')) ||
      (productDetails.notice_info && s('notice_info'))
    )
  }, [productDetails])

  const hasVisiblePolicyCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.important_notes && s('important_notes')) ||
      (productDetails.private_tour_info && s('private_tour_info')) ||
      (productDetails.cancellation_policy && s('cancellation_policy')) ||
      (productDetails.chat_announcement && s('chat_announcement'))
    )
  }, [productDetails])

  return (
${detBody}
  )
}
`

fs.writeFileSync(path.join(root, 'src/components/product/ProductDetailItineraryTab.tsx'), itFile)
fs.writeFileSync(path.join(root, 'src/components/product/ProductDetailDetailsTab.tsx'), detFile)
console.log('done')
