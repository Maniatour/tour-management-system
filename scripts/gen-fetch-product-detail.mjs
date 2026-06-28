import fs from 'fs'

const page = fs.readFileSync('src/app/[locale]/products/[id]/page.tsx', 'utf8').split('\n')
let body = page.slice(248, 643).join('\n')

const setToAssign = [
  'product',
  'productDetails',
  'tourCourses',
  'tourCoursesMap',
  'productChoices',
  'productMedia',
  'tourCoursePhotos',
]

for (const name of setToAssign) {
  const re = new RegExp(`set${name.charAt(0).toUpperCase() + name.slice(1)}\\(([^;]+)\\)`, 'g')
  body = body.replace(re, `${name} = $1`)
}

body = body.replace(/setLoading\(true\)\s*\n\s*setError\(null\)\s*\n\s*/g, '')
body = body.replace(/setError\(([^)]+)\)\s*\n\s*return/g, 'return { ...empty, error: $1 }')

body = body
  .split('\n')
  .filter((l) => !l.trim().startsWith('console.log('))
  .join('\n')

const header = `import { supabase } from '@/lib/supabase'
import type { ProductTourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'

export type Product = {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  sub_category: string | null
  category: string | null
  base_price: number | null
  duration: string | null
  max_participants: number | null
  status: string | null
  tags: string[] | null
  created_at: string | null
  updated_at: string | null
  description: string | null
  departure_city: string | null
  arrival_city: string | null
  departure_country: string | null
  arrival_country: string | null
  languages: string[] | null
  group_size: string | null
  adult_age: number | null
  child_age_min: number | null
  child_age_max: number | null
  infant_age: number | null
  use_common_details: boolean
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
}

export type ProductDetails = {
  id: string
  product_id: string
  language_code: string
  slogan1: string | null
  slogan2: string | null
  slogan3: string | null
  description: string | null
  included: string | null
  not_included: string | null
  pickup_drop_info: string | null
  luggage_info: string | null
  tour_operation_info: string | null
  preparation_info: string | null
  small_group_info: string | null
  greeting: string | null
  companion_recruitment_info: string | null
  notice_info: string | null
  important_notes: string | null
  private_tour_info: string | null
  cancellation_policy: string | null
  chat_announcement: string | null
  tags: string[] | null
  channel_id: string | null
  customer_page_visibility?: Record<string, unknown> | null
}

export type ProductChoice = {
  product_id: string
  product_name: string
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  option_child_price?: number | null
  option_infant_price?: number | null
  is_default: boolean | null
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_description?: string | null
  option_description_ko?: string | null
  choice_image_url?: string | null
  choice_thumbnail_url?: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
}

export type ProductMedia = {
  id: string
  product_id: string
  file_name: string
  file_url: string
  file_type: 'image' | 'video' | 'document'
  file_size: number
  mime_type: string
  alt_text: string
  caption: string
  order_index: number
  is_primary: boolean
  is_active: boolean
}

export type ProductPageData = {
  product: Product | null
  productDetails: ProductDetails | null
  tourCourses: ProductTourCourse[]
  tourCoursesMap: Map<string, unknown>
  productChoices: ProductChoice[]
  productMedia: ProductMedia[]
  tourCoursePhotos: TourCoursePhoto[]
  error: string | null
}

const emptyProductPageData = (): ProductPageData => ({
  product: null,
  productDetails: null,
  tourCourses: [],
  tourCoursesMap: new Map(),
  productChoices: [],
  productMedia: [],
  tourCoursePhotos: [],
  error: null,
})

export async function fetchProductPageData(
  productId: string,
  locale: string,
  isEnglish: boolean
): Promise<ProductPageData> {
  const empty = emptyProductPageData()
  let product: Product | null = null
  let productDetails: ProductDetails | null = null
  let tourCourses: ProductTourCourse[] = []
  let tourCoursesMap = new Map<string, unknown>()
  let productChoices: ProductChoice[] = []
  let productMedia: ProductMedia[] = []
  let tourCoursePhotos: TourCoursePhoto[] = []

  try {
`

const footer = `
    return {
      product,
      productDetails,
      tourCourses,
      tourCoursesMap,
      productChoices,
      productMedia,
      tourCoursePhotos,
      error: null,
    }
  } catch (error) {
    console.error('상품 데이터 로드 오류:', error)
    return {
      ...empty,
      error: isEnglish ? 'Failed to load product information.' : '상품 정보를 불러오는데 실패했습니다.',
    }
  }
}
`

// indent body - remove leading 8 spaces from page indentation, add 4 for function body
const indentedBody = body
  .split('\n')
  .map((line) => (line.startsWith('        ') ? line.slice(4) : line))
  .join('\n')

fs.writeFileSync('src/lib/fetchProductDetail.ts', header + indentedBody + footer)
console.log('written fetchProductDetail.ts')
