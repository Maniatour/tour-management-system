import { supabase } from '@/lib/supabase'
import type {
  Product,
  ProductChoice,
  ProductDetails,
  ProductMedia,
  ProductPageData,
  ProductTourCourse,
  TourCoursePhoto,
} from '@/components/product/productDetailTypes'

export type {
  Product,
  ProductChoice,
  ProductDetails,
  ProductMedia,
  ProductPageData,
} from '@/components/product/productDetailTypes'

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
    // 1. 기본 제품 정보 가져오기
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('status', 'active')
      .single()
    
    if (productError) {
      console.error('Error fetching product:', productError)
      return { ...empty, error: isEnglish ? 'Product not found.' : '상품을 찾을 수 없습니다.' }
    }
    
    product = productData as unknown as Product
    
    // 2. 다국어 상세 정보 가져오기
    // channel_id가 NULL인 공통 정보를 우선적으로 가져오기
    let detailsData: ProductDetails | null = null
    
    // 먼저 channel_id가 NULL인 공통 정보 조회
    const { data: commonDetails, error: commonError } = await supabase
      .from('product_details_multilingual')
      .select('*')
      .eq('product_id', productId)
      .eq('language_code', locale)
      .is('channel_id', null)
      .limit(1)
    
    if (!commonError && commonDetails && commonDetails.length > 0) {
      detailsData = commonDetails[0] as unknown as ProductDetails
    } else {
      // 공통 정보가 없으면 channel_id가 있는 것 중 첫 번째 가져오기
      const { data: channelDetails, error: channelError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', locale)
        .limit(1)
      
      if (!channelError && channelDetails && channelDetails.length > 0) {
        detailsData = channelDetails[0] as unknown as ProductDetails
      }
    }
    
    if (detailsData) {
      productDetails = detailsData
    } else if (locale !== 'ko') {
      // 폴백: 한국어로 시도
      const { data: fallbackDetails } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', 'ko')
        .is('channel_id', null)
        .limit(1)
      
      if (fallbackDetails && fallbackDetails.length > 0) {
        productDetails = fallbackDetails[0] as unknown as ProductDetails
      } else {
        // 한국어 channel_id가 있는 것 중 첫 번째 가져오기
        const { data: koChannelDetails } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', 'ko')
          .limit(1)
        
        if (koChannelDetails && koChannelDetails.length > 0) {
          productDetails = koChannelDetails[0] as unknown as ProductDetails
        }
      }
    }
    
    // 3. 투어 코스 정보 가져오기
    // product_tour_courses에서 tour_course_id를 사용하여 tour_courses 조인
    let tourCoursesData: any[] = []
    try {
      const { data: tourCoursesDataResult, error: tourCoursesError } = await supabase
        .from('product_tour_courses')
        .select(`
          *,
          tour_courses(
            *,
            photos:tour_course_photos(*)
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: true })
      
      if (tourCoursesError) {
        console.error('Error fetching tour courses:', tourCoursesError)
        tourCourses = []
      } else if (tourCoursesDataResult && tourCoursesDataResult.length > 0) {
        tourCoursesData = tourCoursesDataResult
        
        // tour_courses 데이터를 tour_course로 매핑
        const mappedData = tourCoursesData.map(item => {
          // Supabase는 foreign key 조인 시 배열 또는 객체로 반환할 수 있음
          let tourCourse = null
          
          if (item.tour_courses) {
            if (Array.isArray(item.tour_courses)) {
              tourCourse = item.tour_courses[0] || null
            } else {
              tourCourse = item.tour_courses
            }
          }
          
          return {
            ...item,
            tour_course: tourCourse
          }
        }).filter(item => item.tour_course !== null && item.tour_course !== undefined) // tour_course가 없는 항목 제거
        
        // path를 사용해서 부모 정보 가져오기
        const allCourseIds = new Set<string>()
        mappedData.forEach(item => {
          if (item.tour_course?.path) {
            // path는 "id1.id2.id3" 형식
            const pathIds = item.tour_course.path.split('.').filter(Boolean)
            pathIds.forEach((id: string) => allCourseIds.add(id))
          } else if (item.tour_course?.id) {
            allCourseIds.add(item.tour_course.id)
          }
        })
        
        // 모든 관련 코스 정보 가져오기 (부모 포함)
        if (allCourseIds.size > 0) {
          const { data: allCoursesData, error: allCoursesError } = await supabase
            .from('tour_courses')
            .select('id, customer_name_ko, customer_name_en, name_ko, name_en, parent_id, path, level')
            .in('id', Array.from(allCourseIds))
          
          if (allCoursesError) {
            console.error('Error fetching all courses for hierarchy:', allCoursesError)
          }
          
          if (allCoursesData) {
            const courseMap = new Map<string, unknown>()
            allCoursesData.forEach((course) => {
              courseMap.set(course.id, course)
            })

            tourCoursesMap = courseMap

            mappedData.forEach((item) => {
              if (item.tour_course?.path) {
                const pathIds = item.tour_course.path.split('.').filter(Boolean)
                const parents: unknown[] = []

                for (let i = 0; i < pathIds.length - 1; i++) {
                  const parentId = pathIds[i]
                  const parent = courseMap.get(parentId)
                  if (parent) {
                    parents.push(parent)
                  }
                }

                if (parents.length > 0) {
                  let currentParent: unknown = null
                  for (let i = parents.length - 1; i >= 0; i--) {
                    const parent = { ...(parents[i] as Record<string, unknown>), parent: currentParent }
                    currentParent = parent
                  }
                  item.tour_course.parent = currentParent
                }
              } else if (item.tour_course?.parent_id) {
                const parent = courseMap.get(item.tour_course.parent_id)
                if (parent) {
                  item.tour_course.parent = parent
                }
              }
            })
          }
        }
        
        // 계층별로 정렬
        const sortedData = mappedData.sort((a, b) => {
          const courseA = a.tour_course
          const courseB = b.tour_course
          
          // 1. level 순서로 정렬 (낮은 레벨이 먼저)
          const levelA = courseA?.level ?? 999
          const levelB = courseB?.level ?? 999
          if (levelA !== levelB) {
            return levelA - levelB
          }
          
          // 2. 같은 레벨 내에서는 path 순서로 정렬
          const pathA = courseA?.path || ''
          const pathB = courseB?.path || ''
          if (pathA && pathB) {
            // path 길이로 비교 (짧은 path가 먼저 = 부모가 먼저)
            if (pathA.length !== pathB.length) {
              return pathA.length - pathB.length
            }
            // 같은 길이면 문자열 비교
            return pathA.localeCompare(pathB)
          }
          
          // 3. sort_order로 정렬
          const sortOrderA = courseA?.sort_order ?? 999
          const sortOrderB = courseB?.sort_order ?? 999
          if (sortOrderA !== sortOrderB) {
            return sortOrderA - sortOrderB
          }
          
          // 4. 이름으로 정렬
          const nameA = locale === 'en'
            ? (courseA?.customer_name_en || courseA?.name_en || courseA?.name_ko || courseA?.name || '')
            : (courseA?.customer_name_ko || courseA?.name_ko || courseA?.name || '')
          const nameB = locale === 'en'
            ? (courseB?.customer_name_en || courseB?.name_en || courseB?.name_ko || courseB?.name || '')
            : (courseB?.customer_name_ko || courseB?.name_ko || courseB?.name || '')
          
          return nameA.localeCompare(nameB)
        })
        
        tourCourses = sortedData
      } else {
        tourCourses = []
      }
    } catch (error) {
      console.error('Exception while fetching tour courses:', error)
      tourCourses = []
    }
    
    // 4. 선택 옵션 정보 가져오기
    try {
      const { data: fallbackChoices, error: fallbackError } = await supabase
        .from('product_choices')
        .select(`
          id,
          product_id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          description_ko,
          description_en,
          choice_type,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            description,
            description_ko,
            adult_price,
            child_price,
            infant_price,
            is_default,
            is_active,
            sort_order,
            image_url,
            image_alt,
            thumbnail_url
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      if (fallbackError) {
        console.error('product_choices 로드 오류:', fallbackError)
        console.error('에러 상세:', JSON.stringify(fallbackError, null, 2))
        // 에러가 발생해도 빈 배열로 설정
        productChoices = []
      } else if (fallbackChoices) {
        const productName = product!.name || product!.customer_name_ko || ''
        const flattenedChoices: ProductChoice[] = fallbackChoices.flatMap((choice: any) => {
          const choiceNameKo = choice.choice_group_ko || null
          const choiceNameEn = choice.choice_group_en || null
          // choice_name은 나중에 groupedChoices에서 로케일에 맞게 설정되므로, 여기서는 기본값만 설정
          // choice_group이 아이디인지 확인 (한글/영어 이름이 없으면 choice_group 사용)
          const choiceName = choiceNameKo || choiceNameEn || choice.choice_group || ''
          const choiceType = choice.choice_type || 'single'
          const options = Array.isArray(choice.options) ? choice.options.filter((opt: any) => opt.is_active !== false) : []

          return options.map((option: any) => ({
            product_id: choice.product_id,
            product_name: productName,
            choice_id: choice.id,
            choice_name: choiceName, // 기본값 (나중에 groupedChoices에서 로케일에 맞게 재설정됨)
            choice_name_ko: choiceNameKo,
            choice_name_en: choiceNameEn,
            choice_type: choiceType,
            choice_description: choice.description_en || null,
            choice_description_ko: choice.description_ko || null,
            choice_description_en: choice.description_en || null,
            choice_image_url: null, // product_choices 테이블에 image_url 필드가 없을 수 있음
            choice_thumbnail_url: null,
            option_id: option.id,
            option_name: option.option_name || option.option_key || '',
            option_name_ko: option.option_name_ko || null,
            option_price: option.adult_price ?? null,
            option_child_price: option.child_price ?? null,
            option_infant_price: option.infant_price ?? null,
            is_default: option.is_default ?? null,
            option_image_url: option.image_url || null,
            option_thumbnail_url: option.thumbnail_url || null,
            option_description: option.description || null,
            option_description_ko: option.description_ko || null
          }))
        })

        productChoices = flattenedChoices
      } else {
        productChoices = []
      }
    } catch (error) {
      console.error('선택 옵션 로드 중 예외 발생:', error)
      productChoices = []
    }
    
    // 5. 상품 미디어 가져오기
    const { data: mediaData, error: mediaError } = await supabase
      .from('product_media')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
    
    if (!mediaError && mediaData) {
      productMedia = mediaData.map((m) => ({
        id: m.id,
        product_id: m.product_id,
        file_name: m.file_name,
        file_url: m.file_url,
        file_type: (m.file_type === 'video' || m.file_type === 'document' ? m.file_type : 'image') as 'image' | 'video' | 'document',
        file_size: m.file_size ?? 0,
        mime_type: (m as { mime_type?: string }).mime_type ?? '',
        alt_text: m.alt_text ?? '',
        caption: m.caption ?? '',
        order_index: m.order_index ?? 0,
        is_primary: m.is_primary ?? false,
        is_active: m.is_active ?? true,
      }))
    }

    // 6. 투어 코스 사진 가져오기
    // 원본 투어 코스 데이터에서 course_id 추출
    if (tourCoursesData && tourCoursesData.length > 0) {
      const courseIds = tourCoursesData
        .map(tc => {
          // tour_courses가 배열인 경우 첫 번째 요소, 아니면 객체 자체
          const tourCourse = Array.isArray(tc.tour_courses) 
            ? tc.tour_courses[0] 
            : tc.tour_courses
          return tourCourse?.id
        })
        .filter(Boolean) as string[]
      
      if (courseIds.length > 0) {
        const { data: photosData, error: photosError } = await supabase
          .from('tour_course_photos')
          .select('*')
          .in('course_id', courseIds)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })
        
        if (!photosError && photosData) {
          tourCoursePhotos = photosData.map((p) => ({
            id: p.id,
            course_id: p.course_id ?? '',
            photo_url: p.photo_url,
            photo_alt_ko: p.photo_alt_ko,
            photo_alt_en: p.photo_alt_en,
            display_order: p.display_order ?? 0,
            is_primary: p.is_primary ?? false,
            sort_order: p.sort_order ?? 0,
            thumbnail_url: p.thumbnail_url,
            uploaded_by: p.uploaded_by ?? null,
          }))
        }
      }
    }

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

/** 고객 페이지와 동일한 우선순위로 상세정보 행 1건 조회 (편집 모달용) */
export async function fetchProductDetailsRowForLocale(
  productId: string,
  locale: string
): Promise<Record<string, unknown> | null> {
  const { data: commonDetails, error: commonError } = await supabase
    .from('product_details_multilingual')
    .select('*')
    .eq('product_id', productId)
    .eq('language_code', locale)
    .is('channel_id', null)
    .limit(1)

  if (!commonError && commonDetails && commonDetails.length > 0) {
    return commonDetails[0] as Record<string, unknown>
  }

  const { data: channelDetails, error: channelError } = await supabase
    .from('product_details_multilingual')
    .select('*')
    .eq('product_id', productId)
    .eq('language_code', locale)
    .limit(1)

  if (!channelError && channelDetails && channelDetails.length > 0) {
    return channelDetails[0] as Record<string, unknown>
  }

  if (locale !== 'ko') {
    const { data: fallbackDetails } = await supabase
      .from('product_details_multilingual')
      .select('*')
      .eq('product_id', productId)
      .eq('language_code', 'ko')
      .is('channel_id', null)
      .limit(1)

    if (fallbackDetails && fallbackDetails.length > 0) {
      return fallbackDetails[0] as Record<string, unknown>
    }

    const { data: koChannelDetails } = await supabase
      .from('product_details_multilingual')
      .select('*')
      .eq('product_id', productId)
      .eq('language_code', 'ko')
      .limit(1)

    if (koChannelDetails && koChannelDetails.length > 0) {
      return koChannelDetails[0] as Record<string, unknown>
    }
  }

  return null
}

