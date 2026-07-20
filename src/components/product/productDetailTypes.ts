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
  summary_ko: string | null
  summary_en: string | null
  departure_city: string | null
  departure_city_ko?: string | null
  departure_city_en?: string | null
  arrival_city: string | null
  arrival_city_ko?: string | null
  arrival_city_en?: string | null
  departure_country: string | null
  departure_country_ko?: string | null
  departure_country_en?: string | null
  arrival_country: string | null
  arrival_country_ko?: string | null
  arrival_country_en?: string | null
  languages: string[] | null
  group_size: string | null
  adult_age: number | null
  child_age_min: number | null
  child_age_max: number | null
  infant_age: number | null
  use_common_details: boolean
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
  /** 고객 상세 페이지 상품 초이스 표시 방식: list(리스트) | card(사진 카드뷰) */
  choices_display_mode?: string | null
}

/** product_details_multilingual row (상품 상세 페이지용) */
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
  /**
   * per_person: 인당 × 인원
   * per_unit: 차량/선택 단위 고정가 × 수량
   */
  pricing_unit?: 'per_person' | 'per_unit' | string | null
  choice_description: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  option_child_price?: number | null
  option_infant_price?: number | null
  /** 객실/차량 등 옵션당 수용 인원 (choice_options.capacity) */
  capacity?: number | null
  is_default: boolean | null
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_description?: string | null
  option_description_ko?: string | null
  choice_image_url?: string | null
  choice_thumbnail_url?: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
  /** product_choices.content_i18n */
  choice_content_i18n?: import('@/lib/productChoiceLocales').ChoiceContentI18n | null
  /** choice_options.content_i18n */
  option_content_i18n?: import('@/lib/productChoiceLocales').ChoiceContentI18n | null
  /** product_choices.sort_order — 초이스 그룹 표시 순서 */
  choice_sort_order?: number | null
  /** choice_options.sort_order — 그룹 내 옵션 표시 순서 */
  option_sort_order?: number | null
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

export type ProductFieldTranslationRowLite = {
  product_id: string
  field_key: string
  locale: string
  value: string | null
}

export type ProductPageData = {
  product: Product | null
  productDetails: ProductDetails | null
  tourCourses: ProductTourCourse[]
  tourCoursesMap: Map<string, unknown>
  productChoices: ProductChoice[]
  productMedia: ProductMedia[]
  tourCoursePhotos: TourCoursePhoto[]
  /** product_field_translations rows for this product (optional until migration applied) */
  fieldTranslations?: ProductFieldTranslationRowLite[]
  error: string | null
}

export type TourCoursePhoto = {
  id: string
  course_id: string
  photo_url: string
  photo_alt_ko: string | null
  photo_alt_en: string | null
  display_order: number
  is_primary: boolean
  sort_order: number
  thumbnail_url: string | null
  uploaded_by: string | null
}

export type TourCourse = {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  customer_description_ko: string | null
  customer_description_en: string | null
  /** tour_courses.content_i18n — customer-facing name/description per locale */
  content_i18n?: import('@/lib/productTourCourseLocales').TourCourseContentI18n | null
  description: string | null
  duration: string | null
  duration_hours: number | null
  difficulty: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  highlights: string[] | null
  itinerary: Record<string, unknown> | null
  location: string | null
  category: string | null
  level: number | null
  path: string | null
  parent_id: string | null
  point_name: string | null
  sort_order: number | null
  min_participants: number | null
  max_participants: number | null
  parent?: TourCourse
  photos?: Array<{
    id: string
    course_id: string
    photo_url: string
    photo_alt_ko: string | null
    photo_alt_en: string | null
    display_order: number
    is_primary: boolean
    sort_order: number
    thumbnail_url: string | null
  }>
}

export type ProductTourCourse = {
  id: string
  product_id: string
  tour_course_id: string
  tour_course: TourCourse
}

export type ProductDetailsFields = {
  included?: string | null
  not_included?: string | null
  pickup_drop_info?: string | null
  luggage_info?: string | null
  tour_operation_info?: string | null
  preparation_info?: string | null
  small_group_info?: string | null
  companion_recruitment_info?: string | null
  notice_info?: string | null
  important_notes?: string | null
  private_tour_info?: string | null
  cancellation_policy?: string | null
  chat_announcement?: string | null
  tags?: string[] | null
  customer_page_visibility?: Record<string, unknown> | null
}

export type ProductDetailsTabProduct = {
  category: string | null
  sub_category: string | null
  duration: string | null
  max_participants: number | null
  status: string | null
  group_size: string | null
  adult_age: number | null
  child_age_min: number | null
  child_age_max: number | null
  infant_age: number | null
  languages: string[] | null
  departure_city: string | null
  departure_city_ko?: string | null
  departure_city_en?: string | null
  arrival_city: string | null
  arrival_city_ko?: string | null
  arrival_city_en?: string | null
  departure_country: string | null
  departure_country_ko?: string | null
  departure_country_en?: string | null
  arrival_country: string | null
  arrival_country_ko?: string | null
  arrival_country_en?: string | null
  tags: string[] | null
}
