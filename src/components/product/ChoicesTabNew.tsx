'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Copy, Upload, FileText, Info, Share2, ChevronDown, ChevronUp, Settings, Pencil, Check, ImageOff, X, Library } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import LocaleDropdown from '@/components/LocaleDropdown'
import { supabase } from '@/lib/supabase'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { operatorIdInsert, withOperatorId } from '@/lib/operators/scopeQuery'
import ChoiceTemplatePickerModal, {
  type ChoiceTemplatePickResult,
} from '@/components/product/ChoiceTemplatePickerModal'
import {
  getChoiceGroupLocalizedText,
  getChoiceOptionLocalizedText,
  mergeChoiceGroupI18n,
  mergeChoiceOptionI18n,
  type ChoiceContentI18n,
} from '@/lib/productChoiceLocales'
import {
  choiceGroupI18nFromTemplate,
  choiceOptionI18nFromTemplate,
  getOptionTemplateLocalizedText,
  legacyGroupColumnsFromI18n,
  legacyOptionColumnsFromI18n,
  type OptionTemplateContentI18n,
} from '@/lib/optionTemplateLocales'
import { getSiteLocaleMeta, type SiteLocale } from '@/lib/siteLocales'

// 임시 타입 정의 (데이터베이스 타입이 없을 때 사용)
interface DatabaseOptions {
  id: string
  name: string
  name_ko?: string
  description?: string
  description_ko?: string
  description_en?: string
  adult_price?: number
  child_price?: number
  infant_price?: number
  status?: string
  sort_order?: number
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
  template_group?: string
  template_group_ko?: string
  template_group_en?: string
  template_group_description_ko?: string
  template_group_description_en?: string
  content_i18n?: OptionTemplateContentI18n | null
  choice_type?: string
  is_required?: boolean
  min_selections?: number
  max_selections?: number
  is_choice_template?: boolean
}

interface ProductChoiceData {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_group_en?: string
  description_ko?: string
  description_en?: string
  content_i18n?: ChoiceContentI18n | null
  choice_type: 'single' | 'multiple' | 'quantity'
  /** per_person: 인당 / per_unit: 차량·선택 단위 고정가 */
  pricing_unit?: 'per_person' | 'per_unit'
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  options?: ChoiceOptionData[]
}

interface ChoiceOptionData {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  description?: string | undefined
  description_ko?: string | undefined
  content_i18n?: ChoiceContentI18n | null
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  image_url?: string | undefined
  image_alt?: string | undefined
  thumbnail_url?: string | undefined
  /** 예약 카드 뱃지용 내부 짧은 이름 (예: 🏜️ X) */
  internal_name?: string | undefined
  /** 예약 카드 뱃지용 아이콘 이미지 URL */
  badge_icon_url?: string | undefined
}

interface SupabaseError {
  message: string
  details?: string
  hint?: string
  code?: string
}


// 새로운 간결한 초이스 시스템 타입 정의
interface ChoiceOption {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  description?: string | null | undefined
  description_ko?: string | null | undefined
  content_i18n?: ChoiceContentI18n | null | undefined
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  image_url?: string | undefined
  image_alt?: string | undefined
  thumbnail_url?: string | undefined
  /** 예약 카드 뱃지용 내부 짧은 이름 (예: 🏜️ X) */
  internal_name?: string | undefined
  /** 예약 카드 뱃지용 아이콘 이미지 URL */
  badge_icon_url?: string | undefined
}

interface ProductChoice {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_group_en?: string | null | undefined
  description_ko?: string | null | undefined
  description_en?: string | null | undefined
  content_i18n?: ChoiceContentI18n | null | undefined
  choice_type: 'single' | 'multiple' | 'quantity'
  /** per_person: 인당 / per_unit: 차량·선택 단위 고정가 */
  pricing_unit: 'per_person' | 'per_unit'
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  options: ChoiceOption[]
}

interface ChoicesTabProps {
  productId: string
  isNewProduct: boolean
  /** 모달 임베드 시 중복 헤더 숨김 */
  embedded?: boolean
}

export default function ChoicesTab({ productId, isNewProduct, embedded = false }: ChoicesTabProps) {
  const { operatorId } = useOperatorOptional()
  const params = useParams()
  const locale = (params.locale as string) || 'ko'
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showTemplateInfoModal, setShowTemplateInfoModal] = useState(false)
  const [showTypeInfoModal, setShowTypeInfoModal] = useState(false)
  const [showExportTemplateModal, setShowExportTemplateModal] = useState(false)
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Set<string>>(new Set())
  const [uploadingImages, setUploadingImages] = useState<{[key: string]: boolean}>({})
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null)
  const [editingOption, setEditingOption] = useState<{ groupIndex: number; optionId: string } | null>(null)
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [importData, setImportData] = useState('')
  const [homepagePricingType, setHomepagePricingType] = useState<'single' | 'separate'>('separate')

  /** 초이스 템플릿 라이브러리 → 이 상품의 초이스로 복사 */
  const loadFromTemplate = useCallback(async (pick: ChoiceTemplatePickResult) => {
    try {
      const { templateGroup, optionIds } = pick
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true)
        .not('template_group', 'is', null)
        .or(`template_group.eq.${templateGroup},template_group_ko.eq.${templateGroup}`)
        .order('sort_order', { ascending: true }) as { data: DatabaseOptions[] | null, error: SupabaseError | null }

      if (error) {
        console.error('Error loading template:', error)
        return
      }

      let validData = data?.filter(item => {
        if (item.is_choice_template !== true) return false
        if (!item.template_group || (typeof item.template_group === 'string' && item.template_group.trim() === '')) {
          return false
        }
        return true
      }) || []

      if (optionIds && optionIds.length > 0) {
        const allow = new Set(optionIds)
        validData = validData.filter((item) => allow.has(item.id))
      }

      if (validData.length === 0) {
        alert(
          locale === 'en'
            ? 'Could not load template. Check the choice template library.'
            : '템플릿을 불러올 수 없습니다. 초이스 템플릿 라이브러리를 확인해주세요.'
        )
        return
      }

      const firstItem = validData[0] as DatabaseOptions
      const groupContentI18n = choiceGroupI18nFromTemplate(firstItem)
      const groupLegacy = legacyGroupColumnsFromI18n(
        {
          group_name: groupContentI18n.name || {},
          group_description: groupContentI18n.description || {},
        },
        firstItem.template_group || templateGroup
      )
      const templateGroupName =
        groupLegacy.template_group_ko ||
        getOptionTemplateLocalizedText(firstItem, 'group_name', 'ko') ||
        firstItem.template_group ||
        '템플릿'
      const templateGroupNameEn =
        getOptionTemplateLocalizedText(firstItem, 'group_name', 'en') ||
        firstItem.template_group_en ||
        firstItem.template_group ||
        ''
      const choiceType = firstItem.choice_type || 'single'
      const isRequired = firstItem.is_required || false
      const minSelections = firstItem.min_selections || 1
      const maxSelections = firstItem.max_selections || 1
      const descriptionKo =
        groupLegacy.template_group_description_ko ||
        firstItem.template_group_description_ko ||
        ''
      const descriptionEn =
        groupLegacy.template_group_description_en ||
        firstItem.template_group_description_en ||
        ''

      const newChoice: ProductChoice = {
        id: crypto.randomUUID(),
        choice_group: templateGroup,
        choice_group_ko: templateGroupName,
        choice_group_en: templateGroupNameEn,
        description_ko: descriptionKo,
        description_en: descriptionEn,
        content_i18n: groupContentI18n,
        choice_type: choiceType as 'single' | 'multiple' | 'quantity',
        pricing_unit: 'per_person',
        is_required: isRequired,
        min_selections: minSelections,
        max_selections: maxSelections,
        sort_order: productChoices.length,
        options: validData.map((option: DatabaseOptions, idx: number) => {
          const optionI18n = choiceOptionI18nFromTemplate(option)
          const optionLegacy = legacyOptionColumnsFromI18n({
            name: optionI18n.name || {},
            description: optionI18n.description || {},
          })
          return {
            id: crypto.randomUUID(),
            option_key: option.id,
            option_name: optionLegacy.name || option.name,
            option_name_ko: optionLegacy.name_ko || option.name_ko || option.name,
            description:
              optionLegacy.description ||
              option.description_en ||
              option.description ||
              undefined,
            description_ko:
              optionLegacy.description_ko || option.description_ko || undefined,
            content_i18n: optionI18n,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: 1,
            is_default: idx === 0,
            is_active: option.status === 'active',
            sort_order: option.sort_order ?? idx,
            image_url: option.image_url,
            image_alt: option.image_alt,
            thumbnail_url: option.thumbnail_url,
          }
        }),
      }

      setProductChoices(prev => [...prev, newChoice])
      setShowTemplateModal(false)
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }, [productChoices.length, locale])

  // 상품 목록 로드 (같은 운영사만 — 다른 상품에서 가져오기용)
  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await withOperatorId(
        supabase
          .from('products')
          .select('id, name, name_ko')
          .neq('id', productId)
          .order('name', { ascending: true }),
        operatorId
      )

      if (error) throw error
      setProducts((data || []).map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.name_ko != null ? { name_ko: p.name_ko } : {}),
      })))
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
    }
  }, [productId, operatorId])

  // 홈페이지 가격 타입 불러오기
  useEffect(() => {
    const loadHomepagePricingType = async () => {
      if (!productId || isNewProduct) {
        setHomepagePricingType('separate')
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select('homepage_pricing_type')
          .eq('id', productId)
          .single()

        if (error) {
          console.error('홈페이지 가격 타입 로드 오류:', error)
          setHomepagePricingType('separate')
          return
        }

        setHomepagePricingType((data as any)?.homepage_pricing_type || 'separate')
      } catch (error) {
        console.error('홈페이지 가격 타입 로드 오류:', error)
        setHomepagePricingType('separate')
      }
    }

    loadHomepagePricingType()
  }, [productId, isNewProduct])

  // 새로운 간결한 초이스 시스템에서 상품의 choices 정보 로드
  const loadProductChoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          description_ko,
          description_en,
          content_i18n,
          choice_type,
          pricing_unit,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            description,
            description_ko,
            content_i18n,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order,
            image_url,
            image_alt,
            thumbnail_url,
            internal_name,
            badge_icon_url
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('sort_order', { foreignTable: 'choice_options', ascending: true }) as {
          data: ProductChoiceData[] | null
          error: SupabaseError | null
        }

      if (error) {
        console.error('Choices 로드 오류:', error)
        setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
        return
      }

      console.log('ChoicesTab에서 로드된 product choices:', data)
      const convertedChoices: ProductChoice[] = [...(data || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((choice, choiceIndex) => ({
          ...choice,
          sort_order: choice.sort_order ?? choiceIndex,
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
          options: [...(choice.options || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((option, optionIndex) => ({
              ...option,
              sort_order: option.sort_order ?? optionIndex,
              image_url: option.image_url || undefined,
              image_alt: option.image_alt || undefined,
              thumbnail_url: option.thumbnail_url || undefined,
              internal_name: option.internal_name || undefined,
              badge_icon_url: option.badge_icon_url || undefined
            }))
        }))
      setProductChoices(convertedChoices)
    } catch (error) {
      console.error('Choices 로드 오류:', error)
      setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // 초이스 그룹 저장
  const saveChoices = useCallback(async () => {
    if (!productId) return

    setSaving(true)
    setSaveMessage('')

    // 현재 데이터 백업 (저장 실패 시 복구용)
    let backupData: ProductChoice[] = []
    try {
      const backup = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          description_ko,
          description_en,
          content_i18n,
          choice_type,
          pricing_unit,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            description,
            description_ko,
            content_i18n,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order,
            image_url,
            image_alt,
            thumbnail_url,
            internal_name,
            badge_icon_url
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true }) as { data: ProductChoiceData[] | null, error: SupabaseError | null }
      
      if (!backup.error && backup.data) {
        backupData = backup.data.map(choice => ({
          ...choice,
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
          options: (choice.options || []).map(option => ({
            ...option,
            image_url: option.image_url || undefined,
            image_alt: option.image_alt || undefined,
            thumbnail_url: option.thumbnail_url || undefined,
            internal_name: option.internal_name || undefined,
            badge_icon_url: option.badge_icon_url || undefined
          }))
        }))
      }
    } catch (backupError) {
      console.error('백업 데이터 로드 오류:', backupError)
      // 백업 실패해도 계속 진행
    }

    try {
      // choice_group은 안정적인 내부 키.
      // 이미 값이 있으면 유지한다 (choice_group_* 포함 — 저장마다 재생성하면
      // 이후 삭제 로직이 방금 갱신한 행을 지우는 버그가 난다).
      const processedChoices = productChoices.map((choice) => {
        const displayName =
          getChoiceGroupLocalizedText(choice, 'name', 'ko') ||
          getChoiceGroupLocalizedText(choice, 'name', 'en') ||
          getChoiceGroupLocalizedText(choice, 'name', editLocale)
        let generatedGroup = choice.choice_group?.trim() || ''

        if (generatedGroup.length >= 2) {
          return {
            ...choice,
            choice_group: generatedGroup,
          }
        }

        // 키가 비어 있을 때만 표시명 기반 자동 생성
        if (displayName) {
          generatedGroup = displayName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50)
        }

        if (!generatedGroup || generatedGroup.length < 2) {
          generatedGroup = `choice_group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        }

        return {
          ...choice,
          choice_group: generatedGroup,
        }
      })

      // 유효성 검사: 그룹명이 최소 한 언어라도 있는지 확인
      const invalidChoices = processedChoices.filter(
        (choice) =>
          !getChoiceGroupLocalizedText(choice, 'name', 'ko') &&
          !getChoiceGroupLocalizedText(choice, 'name', 'en')
      )

      if (invalidChoices.length > 0) {
        const invalidIndices = invalidChoices.map((invalid) => {
          const index = processedChoices.indexOf(invalid)
          return index + 1
        })
        setSaveMessage(
          `초이스 그룹 ${invalidIndices.join(', ')}번의 이름을 최소 한 언어로 입력해주세요.`
        )
        setSaving(false)
        return
      }

      // 중복 검사: 같은 product_id와 choice_group 조합이 있는지 확인
      const choiceGroups = processedChoices.map(c => c.choice_group.trim().toLowerCase())
      const duplicates = choiceGroups.filter((group, index) => choiceGroups.indexOf(group) !== index)
      
      if (duplicates.length > 0) {
        setSaveMessage('중복된 초이스 그룹명이 있습니다. 각 그룹의 이름은 고유해야 합니다.')
        setSaving(false)
        return
      }

      // 기존 choices 조회 (ID 유지 및 업데이트를 위해)
      const { data: existingChoices } = await supabase
        .from('product_choices')
        .select('id, choice_group')
        .eq('product_id', productId)

      const existingChoiceRows =
        (existingChoices || []) as Array<{ id: string; choice_group: string }>
      const existingChoiceIds = new Set(existingChoiceRows.map((ec) => ec.id))
      const existingChoicesByGroup = new Map(
        existingChoiceRows.map((ec) => [ec.choice_group, ec.id])
      )

      // UI 배열 순서 → sort_order 강제 동기화 (저장 시 순서 누락/null 방지)
      const syncedChoices = processedChoices.map((choice, index) => ({
        ...choice,
        sort_order: index,
        options: [...(choice.options || [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((option, optionIndex) => ({
            ...option,
            sort_order: optionIndex,
          })),
      }))

      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const savedChoiceIds: string[] = []

      // 새로운 choices 저장 (syncedChoices 사용)
      for (let index = 0; index < syncedChoices.length; index++) {
        const choice = syncedChoices[index]
        const trimmedChoiceGroup = choice.choice_group.trim()
        const trimmedChoiceGroupKo =
          choice.choice_group_ko?.trim() ||
          getChoiceGroupLocalizedText(choice, 'name', 'ko') ||
          getChoiceGroupLocalizedText(choice, 'name', 'en')

        if (!trimmedChoiceGroup || !trimmedChoiceGroupKo) {
          throw new Error('초이스 그룹명은 필수입니다.')
        }

        const groupI18nPayload = {
          choice_group: trimmedChoiceGroup,
          choice_group_ko: trimmedChoiceGroupKo,
          choice_group_en: choice.choice_group_en?.trim() || null,
          description_ko: choice.description_ko?.trim() || null,
          description_en: choice.description_en?.trim() || null,
          content_i18n: choice.content_i18n || {},
          choice_type: choice.choice_type,
          pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
          is_required: choice.is_required,
          min_selections: choice.min_selections,
          max_selections: choice.max_selections,
          sort_order: choice.sort_order ?? index,
        }

        // UUID가 있으면 ID로 매칭 (choice_group 문자열 변경과 무관하게 행 유지)
        const isValidId =
          Boolean(choice.id) &&
          !String(choice.id).startsWith('temp_') &&
          uuidRe.test(String(choice.id))
        const updateId =
          (isValidId && existingChoiceIds.has(String(choice.id))
            ? String(choice.id)
            : undefined) ||
          existingChoicesByGroup.get(trimmedChoiceGroup)

        let choiceData: ProductChoiceData

        if (updateId) {
          const { data: updatedChoices, error: updateError } = await supabase
            .from('product_choices')
            .update(groupI18nPayload as never)
            .eq('id', updateId)
            .select() as { data: ProductChoiceData[] | null, error: SupabaseError | null }

          if (!updateError && updatedChoices && updatedChoices.length > 0) {
            choiceData = updatedChoices[0]
          } else {
            console.log(`Update failed or no record found for id ${updateId}, inserting new record`)
            const { data: insertedChoice, error: insertError } = await supabase
              .from('product_choices')
              .insert({
                product_id: productId,
                ...groupI18nPayload,
                ...operatorIdInsert(operatorId),
              } as never)
              .select()
              .single() as { data: ProductChoiceData, error: SupabaseError | null }

            if (insertError) throw insertError
            choiceData = insertedChoice
          }
        } else {
          const { data: insertedChoice, error: insertError } = await supabase
            .from('product_choices')
            .insert({
              product_id: productId,
              ...groupI18nPayload,
              ...operatorIdInsert(operatorId),
            } as never)
            .select()
            .single() as { data: ProductChoiceData, error: SupabaseError | null }

          if (insertError) throw insertError
          choiceData = insertedChoice
        }

        savedChoiceIds.push(choiceData.id)

        // 초이스 옵션 저장 (ID 유지 upsert — 삭제 후 재삽입 시 예약 JSON의 option_id가 orphan 됨)
        if (choice.options && choice.options.length > 0) {
          const keptOptionIds: string[] = []

          for (const option of choice.options) {
            const payload = {
              choice_id: choiceData.id,
              option_key: option.option_key,
              option_name: option.option_name,
              option_name_ko: option.option_name_ko,
              description: option.description,
              description_ko: option.description_ko,
              content_i18n: option.content_i18n || {},
              adult_price: option.adult_price,
              child_price: option.child_price,
              infant_price: option.infant_price,
              capacity: option.capacity,
              is_default: option.is_default,
              is_active: option.is_active,
              sort_order: option.sort_order ?? 0,
              image_url: option.image_url,
              image_alt: option.image_alt,
              thumbnail_url: option.thumbnail_url,
              internal_name: option.internal_name?.trim() || null,
              badge_icon_url: option.badge_icon_url?.trim() || null,
            }

            const hasValidId =
              Boolean(option.id) &&
              !String(option.id).startsWith('temp_') &&
              uuidRe.test(String(option.id))

            if (hasValidId) {
              const { data: updatedOpt, error: optUpdateError } = await supabase
                .from('choice_options')
                .update(payload as never)
                .eq('id', option.id)
                .eq('choice_id', choiceData.id)
                .select('id')

              if (!optUpdateError && updatedOpt && updatedOpt.length > 0) {
                keptOptionIds.push(String(option.id))
                continue
              }
            }

            const { data: insertedOpt, error: optInsertError } = await supabase
              .from('choice_options')
              .insert(payload as never)
              .select('id')
              .single()

            if (optInsertError) throw optInsertError
            if (insertedOpt?.id) keptOptionIds.push(String(insertedOpt.id))
          }

          // UI에서 제거된 옵션만 삭제
          const { data: existingOpts } = await supabase
            .from('choice_options')
            .select('id')
            .eq('choice_id', choiceData.id)

          const toDelete = ((existingOpts || []) as Array<{ id: string }>)
            .map((o) => o.id)
            .filter((id) => !keptOptionIds.includes(id))

          if (toDelete.length > 0) {
            await supabase.from('choice_options').delete().in('id', toDelete)
          }
        } else {
          // 옵션이 모두 비어 있으면 해당 그룹 옵션 삭제
          await supabase.from('choice_options').delete().eq('choice_id', choiceData.id)
        }
      }

      // UI에 없는 기존 그룹만 삭제 (choice_group 문자열이 아니라 저장된 ID 기준)
      const choicesToDelete = existingChoiceRows.filter(
        (ec) => !savedChoiceIds.includes(ec.id)
      )

      if (choicesToDelete.length > 0) {
        const idsToDelete = choicesToDelete.map(c => c.id)
        await supabase
          .from('choice_options')
          .delete()
          .in('choice_id', idsToDelete)
        
        await supabase
          .from('product_choices')
          .delete()
          .in('id', idsToDelete)
      }

      setSaveMessage('초이스가 성공적으로 저장되었습니다.')
      
      // 저장 성공 후 데이터 다시 로드
      try {
        await loadProductChoices()
      } catch (loadError) {
        console.error('Choices 재로드 오류:', loadError)
        // 로드 실패해도 저장은 성공했으므로 경고만 표시
        setSaveMessage('초이스가 저장되었지만 새로고침이 필요할 수 있습니다.')
      }
    } catch (error) {
      console.error('Choices 저장 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '초이스 저장 중 오류가 발생했습니다.'
      setSaveMessage(`초이스 저장 중 오류가 발생했습니다: ${errorMessage}`)
      
      // 저장 실패 시 백업된 데이터로 복구
      if (backupData.length > 0) {
        setProductChoices(backupData)
        setSaveMessage('저장 중 오류가 발생했습니다. 이전 데이터로 복구되었습니다.')
      } else {
        // 백업 데이터가 없으면 서버에서 다시 로드 시도
        try {
          await loadProductChoices()
        } catch (loadError) {
          console.error('Choices 재로드 오류:', loadError)
        }
      }
    } finally {
      setSaving(false)
    }
  }, [productId, productChoices, loadProductChoices, operatorId, editLocale])

  // 초이스 그룹 추가
  const addChoiceGroup = useCallback(() => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const newGroup: ProductChoice = {
      id: `temp_${uniqueSuffix}`,
      // 저장 시에도 유지되는 안정 키 (표시명과 별개)
      choice_group: `choice_group_${uniqueSuffix}`,
      choice_group_ko: '',
      choice_group_en: '',
      description_ko: '',
      description_en: '',
      content_i18n: {},
      choice_type: 'single',
      pricing_unit: 'per_person',
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: productChoices.length,
      options: []
    }
    setProductChoices(prev => [...prev, newGroup])
  }, [productChoices.length])

  // 초이스 그룹 삭제
  const removeChoiceGroup = useCallback((index: number) => {
    setProductChoices(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 초이스 그룹 업데이트
  const updateChoiceGroup = useCallback((index: number, field: keyof ProductChoice, value: string | number | boolean) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === index ? { ...group, [field]: value } : group
    ))
  }, [])

  const updateChoiceGroupLocaleText = useCallback(
    (index: number, name: string, description: string) => {
      setProductChoices((prev) =>
        prev.map((group, i) => {
          if (i !== index) return group
          const merged = mergeChoiceGroupI18n(group, editLocale, name, description)
          return {
            ...group,
            content_i18n: merged.content_i18n,
            choice_group_ko: merged.choice_group_ko,
            choice_group_en: merged.choice_group_en,
            description_ko: merged.description_ko,
            description_en: merged.description_en,
            choice_group: group.choice_group || merged.choice_group,
          }
        })
      )
    },
    [editLocale]
  )

  // 초이스 그룹 순서 변경
  const moveChoiceGroup = useCallback((fromIndex: number, toIndex: number) => {
    setProductChoices(prev => {
      const newChoices = [...prev]
      const [moved] = newChoices.splice(fromIndex, 1)
      newChoices.splice(toIndex, 0, moved)
      // sort_order 업데이트
      return newChoices.map((choice, index) => ({
        ...choice,
        sort_order: index
      }))
    })
  }, [])

  // 초이스 추가
  const addChoiceOption = useCallback((groupIndex: number) => {
    const existingOptions = productChoices[groupIndex]?.options || []
    const nextOptionNumber = existingOptions.length + 1
    const newOption: ChoiceOption = {
      id: `temp_option_${Date.now()}`,
      option_key: `option_${nextOptionNumber}`,
      option_name: '',
      option_name_ko: '',
      description: undefined,
      description_ko: undefined,
      content_i18n: {},
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      capacity: 1,
      is_default: false,
      is_active: true,
      sort_order: existingOptions.length,
      image_url: undefined,
      image_alt: undefined,
      thumbnail_url: undefined,
      internal_name: undefined,
      badge_icon_url: undefined
    }
    
    setProductChoices(prev => prev.map((group, i) =>
      i === groupIndex
        ? { ...group, options: [...group.options, newOption] }
        : group
    ))
    setEditingOption({ groupIndex, optionId: newOption.id })
  }, [productChoices])

  // 초이스 삭제 (정렬 인덱스와 무관하게 option.id로 삭제)
  const removeChoiceOption = useCallback((groupIndex: number, optionId: string) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { ...group, options: group.options.filter((opt) => opt.id !== optionId) }
        : group
    ))
  }, [])

  // 초이스 옵션 복사
  const copyChoiceOption = useCallback((groupIndex: number, optionIndex: number) => {
    setProductChoices(prev => prev.map((group, i) => {
      if (i !== groupIndex) return group
      
      const sortedOptions = [...group.options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const optionToCopy = sortedOptions[optionIndex]
      
      if (!optionToCopy) return group
      
      const newOption: ChoiceOption = {
        ...optionToCopy,
        id: `temp_option_${Date.now()}_${Math.random()}`,
        option_key: `${optionToCopy.option_key}_copy_${Date.now()}`,
        sort_order: sortedOptions.length, // 맨 마지막에 추가
        is_default: false // 복사본은 기본값 해제
      }
      
      return { ...group, options: [...group.options, newOption] }
    }))
  }, [])

  // 초이스 옵션 순서 변경
  const moveChoiceOption = useCallback((groupIndex: number, optionIndex: number, direction: 'up' | 'down') => {
    setProductChoices(prev => prev.map((group, i) => {
      if (i !== groupIndex) return group
      
      const sortedOptions = [...group.options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      
      if (direction === 'up' && optionIndex === 0) return group
      if (direction === 'down' && optionIndex === sortedOptions.length - 1) return group
      
      const targetIndex = direction === 'up' ? optionIndex - 1 : optionIndex + 1
      const [moved] = sortedOptions.splice(optionIndex, 1)
      sortedOptions.splice(targetIndex, 0, moved)
      
      // sort_order 업데이트
      const updatedOptions = sortedOptions.map((opt, idx) => ({
        ...opt,
        sort_order: idx
      }))
      
      return { ...group, options: updatedOptions }
    }))
  }, [])

  // 초이스 업데이트 - optionId로 찾아서 업데이트 (정렬 순서와 무관하게 정확히 업데이트)
  const updateChoiceOption = useCallback((groupIndex: number, optionId: string, field: keyof ChoiceOption, value: string | number | boolean) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { 
            ...group, 
            options: group.options.map((option) => 
              option.id === optionId ? { ...option, [field]: value } : option
            )
          }
        : group
    ))
  }, [])

  const updateChoiceOptionLocaleText = useCallback(
    (groupIndex: number, optionId: string, name: string, description: string) => {
      setProductChoices((prev) =>
        prev.map((group, i) => {
          if (i !== groupIndex) return group
          return {
            ...group,
            options: group.options.map((option) => {
              if (option.id !== optionId) return option
              const merged = mergeChoiceOptionI18n(option, editLocale, name, description)
              return {
                ...option,
                content_i18n: merged.content_i18n,
                option_name_ko: merged.option_name_ko,
                option_name: merged.option_name,
                description_ko: merged.description_ko,
                description: merged.description,
              }
            }),
          }
        })
      )
    },
    [editLocale]
  )

  // 이미지 업로드 처리 함수 - optionId로 찾아서 업데이트
  const handleImageUpload = useCallback(async (
    file: File,
    groupIndex: number,
    optionId: string,
    targetField: 'image_url' | 'badge_icon_url' = 'image_url'
  ) => {
    const uploadKey = targetField === 'badge_icon_url'
      ? `${groupIndex}-${optionId}-badge`
      : `${groupIndex}-${optionId}`
    setUploadingImages(prev => ({ ...prev, [uploadKey]: true }))
    
    try {
      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      // 파일 타입 체크
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }

      // 버킷 확인
      const bucketName = 'product-media'
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        console.error('버킷 목록 조회 오류:', listError)
        alert('저장소를 확인할 수 없습니다. 관리자에게 문의하세요.')
        return
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
      if (!bucketExists) {
        alert(`'${bucketName}' 버킷이 존재하지 않습니다. 관리자에게 문의하여 버킷을 생성해주세요.`)
        return
      }

      // Supabase Storage에 업로드
      const folder = targetField === 'badge_icon_url' ? 'choice-badges' : 'choice-options'
      const fileName = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('이미지 업로드 오류:', error)
        alert(`이미지 업로드 중 오류가 발생했습니다: ${error.message}`)
        return
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      updateChoiceOption(groupIndex, optionId, targetField, urlData.publicUrl)
      if (targetField === 'image_url') {
        updateChoiceOption(groupIndex, optionId, 'image_alt', file.name)
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert(`이미지 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setUploadingImages(prev => ({ ...prev, [uploadKey]: false }))
    }
  }, [updateChoiceOption])


  // 초이스 복사
  const copyChoicesFromProduct = useCallback(async () => {
    if (!selectedProductId) return

    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          choice_group,
          choice_group_ko,
          choice_type,
          pricing_unit,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', selectedProductId)
        .order('sort_order') as { data: ProductChoiceData[] | null, error: SupabaseError | null }

      if (error) throw error

        const copiedChoices: ProductChoice[] = (data || []).map((choice: ProductChoiceData, index: number) => ({
          id: `temp_${Date.now()}_${Math.random()}`,
          choice_group: choice.choice_group,
          choice_group_ko: choice.choice_group_ko,
          ...(choice.choice_group_en !== undefined && { choice_group_en: choice.choice_group_en }),
          ...(choice.description_ko !== undefined && { description_ko: choice.description_ko }),
          ...(choice.description_en !== undefined && { description_en: choice.description_en }),
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
          is_required: choice.is_required,
          min_selections: choice.min_selections,
          max_selections: choice.max_selections,
          sort_order: choice.sort_order ?? index,
          options: [...(choice.options || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((option: ChoiceOptionData, optionIndex: number) => ({
          id: `temp_option_${Date.now()}_${Math.random()}`,
          option_key: option.option_key,
          option_name: option.option_name,
          option_name_ko: option.option_name_ko,
          description: option.description || undefined,
          description_ko: option.description_ko || undefined,
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          capacity: option.capacity,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order ?? optionIndex,
          image_url: option.image_url,
          image_alt: option.image_alt,
          thumbnail_url: option.thumbnail_url
        }))
      }))

      setProductChoices(prev => [...prev, ...copiedChoices])
      setShowCopyModal(false)
      setSelectedProductId('')
    } catch (error) {
      console.error('초이스 복사 오류:', error)
      setSaveMessage('초이스 복사 중 오류가 발생했습니다.')
    }
  }, [selectedProductId])

  // 초이스 가져오기
  const importChoices = useCallback(() => {
    try {
      const data = JSON.parse(importData)
      if (data.choices && Array.isArray(data.choices)) {
        const importedChoices: ProductChoice[] = data.choices.map((choice: ProductChoiceData, index: number) => ({
          id: `temp_${Date.now()}_${index}`,
          choice_group: choice.choice_group || '',
          choice_group_ko: choice.choice_group_ko || '',
          choice_group_en: choice.choice_group_en || '',
          description_ko: choice.description_ko || '',
          description_en: choice.description_en || '',
          choice_type: (choice.choice_type || 'single') as 'single' | 'multiple' | 'quantity',
          pricing_unit: choice.pricing_unit === 'per_unit' ? 'per_unit' : 'per_person',
          is_required: choice.is_required !== false,
          min_selections: choice.min_selections || 1,
          max_selections: choice.max_selections || 1,
          sort_order: choice.sort_order || index,
          options: (choice.options || []).map((option: ChoiceOptionData, optionIndex: number) => ({
            id: `temp_option_${Date.now()}_${index}_${optionIndex}`,
            option_key: option.option_key || '',
            option_name: option.option_name || '',
            option_name_ko: option.option_name_ko || '',
            description: option.description || undefined,
            description_ko: option.description_ko || undefined,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: option.capacity || 1,
            is_default: option.is_default || false,
            is_active: option.is_active !== false,
            sort_order: option.sort_order || optionIndex,
            image_url: option.image_url,
            image_alt: option.image_alt,
            thumbnail_url: option.thumbnail_url
          }))
        }))

        setProductChoices(prev => [...prev, ...importedChoices])
        setShowImportModal(false)
        setImportData('')
      }
    } catch (error) {
      console.error('초이스 가져오기 오류:', error)
      setSaveMessage('초이스 가져오기 중 오류가 발생했습니다.')
    }
  }, [importData])

  // 초이스를 템플릿으로 내보내기
  const exportChoicesAsTemplates = useCallback(async (selectedIds?: Set<string>) => {
    const choicesToExport = selectedIds && selectedIds.size > 0
      ? productChoices.filter(choice => selectedIds.has(choice.id))
      : productChoices

    if (choicesToExport.length === 0) {
      alert('내보낼 초이스가 없습니다.')
      return
    }

    try {
      // 상품 정보 가져오기 (템플릿 그룹명 생성에 사용)
      const { error: productError } = await supabase
        .from('products')
        .select('name, name_ko')
        .eq('id', productId)
        .single()

      if (productError) {
        console.error('Error fetching product:', productError)
        setSaveMessage('상품 정보를 가져오는 중 오류가 발생했습니다.')
        return
      }

      // 각 초이스 그룹을 템플릿으로 변환
      let exportedCount = 0
      for (const choice of choicesToExport) {
        const templateGroupKo = choice.choice_group_ko || choice.choice_group || '템플릿'
        // template_group은 영문 키로 변환 (URL-friendly)
        const templateGroup = choice.choice_group || 
          templateGroupKo
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50) || 'template'

        // 템플릿 그룹이 이미 존재하는지 확인 (template_group 또는 template_group_ko로 검색)
        // 주의: is_choice_template = true AND (template_group = X OR template_group_ko = Y) 조건으로 검색
        const { data: existingByGroup } = await supabase
          .from('options')
          .select('id')
          .eq('is_choice_template', true)
          .eq('template_group', templateGroup)
          .limit(1)

        const { data: existingByGroupKo } = await supabase
          .from('options')
          .select('id')
          .eq('is_choice_template', true)
          .eq('template_group_ko', templateGroupKo)
          .limit(1)

        const existingTemplate = (existingByGroup && existingByGroup.length > 0) || 
                                 (existingByGroupKo && existingByGroupKo.length > 0)

        if (existingTemplate) {
          // 이미 존재하는 경우 업데이트할지 물어보기
          if (!confirm(`템플릿 "${templateGroupKo}"이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
            continue
          }
          // 기존 템플릿 삭제 - template_group으로 삭제
          if (existingByGroup && existingByGroup.length > 0) {
            await supabase
              .from('options')
              .delete()
              .eq('is_choice_template', true)
              .eq('template_group', templateGroup)
          }
          // template_group_ko로도 삭제 (다른 레코드일 수 있음)
          if (existingByGroupKo && existingByGroupKo.length > 0) {
            await supabase
              .from('options')
              .delete()
              .eq('is_choice_template', true)
              .eq('template_group_ko', templateGroupKo)
          }
        }

        // 각 옵션을 템플릿으로 변환
        // 이미지 URL 유효성 검사 함수
        const isValidUrl = (url: string | null | undefined): string | null => {
          if (!url || url.trim() === '') return null
          try {
            new URL(url)
            return url.trim()
          } catch {
            return null
          }
        }

        for (const option of choice.options || []) {
          const newTemplate = {
            id: crypto.randomUUID(),
            name: option.option_name || option.option_name_ko || '템플릿',
            name_ko: option.option_name_ko || option.option_name || '템플릿',
            description: option.description || null,
            description_ko: option.description_ko || null,
            description_en: null,
            category: 'choice_template', // NOT NULL 필드이므로 기본값 설정
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            price_type: 'per_person',
            status: option.is_active ? 'active' : 'inactive',
            tags: [],
            is_choice_template: true,
            choice_type: choice.choice_type,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            template_group: choice.choice_group,
            template_group_ko: templateGroupKo,
            is_required: choice.is_required,
            sort_order: option.sort_order ?? 0,
            image_url: isValidUrl(option.image_url),
            image_alt: option.image_alt || null,
            thumbnail_url: isValidUrl(option.thumbnail_url)
          }

          const { error } = await supabase
            .from('options')
            .insert([newTemplate] as never)

          if (error) {
            console.error('Error exporting template:', error)
            setSaveMessage(`템플릿 내보내기 중 오류가 발생했습니다: ${error.message}`)
            setShowExportTemplateModal(false)
            return
          } else {
            exportedCount++
          }
        }
      }

      setSaveMessage(`${exportedCount}개의 초이스가 템플릿으로 저장되었습니다. 옵션·초이스 템플릿 > 초이스 템플릿에서 확인할 수 있습니다.`)
      setShowExportTemplateModal(false)
      setSelectedChoiceIds(new Set())
    } catch (error) {
      console.error('Error exporting choices as templates:', error)
      setSaveMessage('템플릿 내보내기 중 오류가 발생했습니다.')
    }
  }, [productChoices, productId])

  useEffect(() => {
    if (productId && !isNewProduct) {
      loadProductChoices()
      loadProducts()
    }
  }, [productId, isNewProduct, loadProductChoices, loadProducts])

  // 전역 복사 붙여넣기 이벤트 리스너
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          // 현재 포커스된 드래그 앤 드롭 영역 찾기
          const activeElement = document.activeElement
          if (activeElement && activeElement.getAttribute('data-upload-area')) {
            const uploadKey = activeElement.getAttribute('data-upload-area')
            if (uploadKey) {
              const [groupIndex, optionIndex] = uploadKey.split('-').map(Number)
              e.preventDefault()
              const file = item.getAsFile()
              if (file && productChoices[groupIndex]?.options[optionIndex]?.id) {
                await handleImageUpload(file, groupIndex, productChoices[groupIndex].options[optionIndex].id)
              }
            }
          }
          break
        }
      }
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => {
      document.removeEventListener('paste', handleGlobalPaste)
    }
  }, [handleImageUpload])

  if (isNewProduct) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">이 상품의 초이스</h3>
        <p className="text-gray-600">상품을 먼저 저장한 후 초이스를 설정할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {/* 헤더 */}
      <div className={`flex flex-col sm:flex-row justify-between items-start md:items-center gap-4 ${embedded ? 'gap-2' : ''}`}>
        {!embedded && (
          <div>
            <h3 className="text-lg font-medium text-gray-900">이 상품의 초이스</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              이 상품에만 적용됩니다. 재사용하려면 템플릿 라이브러리를 사용하세요.
            </p>
          </div>
        )}
        <div className={`flex flex-wrap gap-2 items-center ${embedded ? 'w-full' : 'w-full md:w-auto'}`}>
          <LocaleDropdown
            value={editLocale}
            onChange={setEditLocale}
            size="sm"
            showLabel
            ariaLabel="Choices edit language"
          />
          <button
            onClick={addChoiceGroup}
            className="flex items-center px-3 py-1.5 text-xs sm:text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            그룹 추가
          </button>
          <div className="flex items-center">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center px-3 py-1.5 text-xs sm:text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              템플릿에서 불러오기
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateInfoModal(true)}
              className="ml-1 sm:ml-2 inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 text-primary hover:text-primary/80 hover:bg-muted rounded-full transition-colors"
              title="템플릿 설명 보기"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center px-3 py-1.5 text-xs sm:text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            다른 상품에서 가져오기
          </button>
          <button
            onClick={() => setShowExportTemplateModal(true)}
            className="flex items-center px-3 py-1.5 text-xs sm:text-sm text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            템플릿으로 저장
          </button>
          <Link
            href={`/${locale}/admin/options?tab=choices`}
            className="flex items-center px-3 py-1.5 text-xs sm:text-sm text-muted-foreground bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-foreground"
          >
            <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            템플릿 관리
          </Link>
        </div>
      </div>

      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`p-4 rounded-md ${
          saveMessage.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 초이스 그룹 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">초이스를 불러오는 중...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productChoices.map((choice, groupIndex) => (
            <div 
              key={choice.id} 
              className={`border border-gray-200 rounded-lg p-3 sm:p-4 transition-all ${
                draggedGroupIndex === groupIndex ? 'opacity-50' : ''
              } ${draggedGroupIndex !== null && draggedGroupIndex !== groupIndex ? 'hover:border-border' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedGroupIndex !== null && draggedGroupIndex !== groupIndex) {
                  moveChoiceGroup(draggedGroupIndex, groupIndex)
                }
                setDraggedGroupIndex(null)
              }}
            >
              {/* 초이스 그룹 헤더 */}
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="p-1 cursor-move hover:bg-gray-100 rounded transition-colors" 
                      title="드래그하여 순서 변경"
                      draggable
                      onDragStart={(e) => {
                        setDraggedGroupIndex(groupIndex)
                        e.dataTransfer.effectAllowed = 'move'
                        e.stopPropagation()
                      }}
                      onDragEnd={() => {
                        setDraggedGroupIndex(null)
                      }}
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">초이스 그룹 {groupIndex + 1}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={choice.is_required}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'is_required', e.target.checked)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                      />
                      <span className="ml-1.5 text-xs sm:text-sm font-medium text-gray-700">필수</span>
                    </label>
                    <button
                      onClick={() => removeChoiceGroup(groupIndex)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="그룹 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        그룹명 ({getSiteLocaleMeta(editLocale).label})
                        <span className="ml-2 text-[10px] text-gray-400 font-normal hidden sm:inline">
                          (ID: {choice.id.substring(0, 8)}...)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={getChoiceGroupLocalizedText(choice, 'name', editLocale)}
                        onChange={(e) =>
                          updateChoiceGroupLocaleText(
                            groupIndex,
                            e.target.value,
                            getChoiceGroupLocalizedText(choice, 'description', editLocale)
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="예: 숙박 선택 / Accommodation"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        타입
                        <button
                          type="button"
                          onClick={() => setShowTypeInfoModal(true)}
                          className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-primary hover:bg-muted/50 rounded-full transition-colors"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </label>
                      <select
                        value={choice.choice_type}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'choice_type', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="single">단일 선택</option>
                        <option value="multiple">다중 선택</option>
                        <option value="quantity">수량 선택</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        가격 단위
                      </label>
                      <select
                        value={choice.pricing_unit || 'per_person'}
                        onChange={(e) =>
                          updateChoiceGroup(
                            groupIndex,
                            'pricing_unit',
                            e.target.value === 'per_unit' ? 'per_unit' : 'per_person'
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="per_person">인원별 (×인원)</option>
                        <option value="per_unit">차량/단위별 (고정가)</option>
                      </select>
                      {choice.pricing_unit === 'per_unit' ? (
                        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                          예: 미니밴 $80 · 3명이어도 1대면 $80 (수용 인원 이내)
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      설명 ({getSiteLocaleMeta(editLocale).label})
                    </label>
                    <textarea
                      value={getChoiceGroupLocalizedText(choice, 'description', editLocale)}
                      onChange={(e) =>
                        updateChoiceGroupLocaleText(
                          groupIndex,
                          getChoiceGroupLocalizedText(choice, 'name', editLocale),
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      placeholder="그룹 설명을 입력하세요"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* 초이스 목록 */}
              <div className="space-y-3 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    초이스 목록
                  </h4>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => addChoiceOption(groupIndex)}
                      className="flex-1 sm:flex-none flex items-center justify-center px-2 py-1 text-[11px] sm:text-xs text-primary bg-primary/5 hover:bg-muted rounded border border-border/60"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      항목 추가
                    </button>
                  </div>
                </div>

                {/* 고객 미리보기 카드 — 고정 340px, 너비에 따라 열 수 자동 */}
                <div className="flex flex-wrap gap-4">
                 {[...choice.options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((option) => {
                   const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                   const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                   const isFirst = actualIndex === 0
                   const isLast = actualIndex === sortedOptions.length - 1
                   const descLines = (option.description_ko || '')
                     .split('\n')
                     .map((line) => line.replace(new RegExp('^[\\s✓✔✅•\\-*]+'), '').trim())
                     .filter(Boolean)
                   const priceLabel =
                     option.adult_price > 0
                       ? choice.pricing_unit === 'per_unit'
                         ? `$${option.adult_price} / 대`
                         : homepagePricingType === 'single'
                           ? `+$${option.adult_price}`
                           : `성인 $${option.adult_price}`
                       : null
                   return (
                   <div
                     key={option.id}
                     className="w-[340px] max-w-full bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
                   >
                     <div className="relative w-full aspect-[16/10] bg-gray-100">
                       {option.image_url ? (
                         <Image
                           src={option.image_url}
                           alt={option.image_alt || option.option_name_ko || 'choice'}
                           fill
                           sizes="340px"
                           className="object-cover"
                         />
                       ) : (
                         <div className="flex h-full w-full items-center justify-center text-gray-400">
                           <ImageOff className="h-8 w-8" aria-hidden />
                         </div>
                       )}
                       <div className="absolute top-2 left-2 w-7 h-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xs font-bold shadow">
                         {actualIndex + 1}
                       </div>
                       {option.badge_icon_url ? (
                         <div className="absolute top-2 right-2 h-8 w-8 overflow-hidden rounded-full bg-white/95 border border-gray-200 shadow-sm">
                           <Image
                             src={option.badge_icon_url}
                             alt={option.internal_name || 'badge'}
                             fill
                             sizes="32px"
                             className="object-contain"
                           />
                         </div>
                       ) : option.internal_name?.trim() ? (
                         <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/95 border border-gray-200 text-xs font-semibold text-gray-800 shadow-sm">
                           {option.internal_name.trim()}
                         </div>
                       ) : null}
                     </div>

                     <div className="p-4 flex-1 flex flex-col gap-3">
                       <div className="flex items-start justify-between gap-2">
                         <div className="min-w-0 flex-1">
                           <h4 className="text-base font-semibold text-gray-900 leading-snug">
                             {option.option_name_ko || option.option_name || `초이스 ${actualIndex + 1}`}
                           </h4>
                           {option.option_name ? (
                             <p className="mt-0.5 text-xs text-gray-500 truncate">{option.option_name}</p>
                           ) : null}
                         </div>
                         {priceLabel ? (
                           <span className="shrink-0 text-sm font-semibold text-gray-900">{priceLabel}</span>
                         ) : null}
                       </div>

                       {descLines.length > 0 ? (
                         <ul className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                           {descLines.slice(0, 4).map((line, i) => (
                             <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                               <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                               <span className="leading-snug">{line}</span>
                             </li>
                           ))}
                           {descLines.length > 4 ? (
                             <li className="text-[11px] text-gray-400 pl-5">+{descLines.length - 4}개 더보기</li>
                           ) : null}
                         </ul>
                       ) : null}

                       <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
                         <div className="flex flex-col space-y-0.5 mr-0.5">
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation()
                               moveChoiceOption(groupIndex, actualIndex, 'up')
                             }}
                             disabled={isFirst}
                             className={`p-0.5 text-gray-600 hover:text-primary hover:bg-muted/50 rounded ${
                               isFirst ? 'opacity-30 cursor-not-allowed' : ''
                             }`}
                             title="위로 이동"
                           >
                             <ChevronUp size={12} />
                           </button>
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation()
                               moveChoiceOption(groupIndex, actualIndex, 'down')
                             }}
                             disabled={isLast}
                             className={`p-0.5 text-gray-600 hover:text-primary hover:bg-muted/50 rounded ${
                               isLast ? 'opacity-30 cursor-not-allowed' : ''
                             }`}
                             title="아래로 이동"
                           >
                             <ChevronDown size={12} />
                           </button>
                         </div>
                         <label className="flex items-center text-[11px] text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 cursor-pointer">
                           <input
                             type="checkbox"
                             checked={option.is_default}
                             onChange={(e) => updateChoiceOption(groupIndex, option.id, 'is_default', e.target.checked)}
                             className="mr-1 w-3 h-3 text-primary rounded focus:ring-ring"
                           />
                           기본값
                         </label>
                         {!option.is_active ? (
                           <span className="text-[11px] px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-100">비활성</span>
                         ) : null}
                         <div className="ml-auto flex items-center gap-1">
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation()
                               setEditingOption({ groupIndex, optionId: option.id })
                             }}
                             className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg border border-border/60"
                             title="수정"
                           >
                             <Pencil className="w-3.5 h-3.5" />
                             수정
                           </button>
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation()
                               copyChoiceOption(groupIndex, actualIndex)
                             }}
                             className="p-1.5 text-green-600 hover:bg-green-50 rounded-md"
                             title="초이스 복사"
                           >
                             <Copy className="w-4 h-4" />
                           </button>
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation()
                               removeChoiceOption(groupIndex, option.id)
                             }}
                             className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                             title="초이스 삭제"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                     </div>
                   </div>
                   )
                 })}
               </div>
               </div>
              </div>
          ))}

          {productChoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>아직 초이스 그룹이 없습니다.</p>
              <p className="text-sm">&quot;초이스 그룹 추가&quot; 버튼을 클릭하여 첫 번째 초이스를 만들어보세요.</p>
            </div>
          )}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={saveChoices}
          disabled={saving}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '초이스 저장'}
        </button>
      </div>

      {/* 초이스 옵션 수정 모달 */}
      {editingOption && (() => {
        const group = productChoices[editingOption.groupIndex]
        const option = group?.options.find((o) => o.id === editingOption.optionId)
        if (!group || !option) return null
        const groupIndex = editingOption.groupIndex
        const uploadKey = `${groupIndex}-${option.id}`

        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/45" onClick={() => setEditingOption(null)} aria-hidden />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">초이스 수정</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {option.option_name_ko || option.option_name || '새 초이스'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {/* 이미지 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">이미지</label>
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    {option.image_url ? (
                      <>
                        <Image
                          src={option.image_url}
                          alt={option.image_alt || option.option_name_ko || 'choice'}
                          fill
                          sizes="640px"
                          className="object-cover"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingImages[uploadKey]}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                await handleImageUpload(file, groupIndex, option.id)
                                e.target.value = ''
                              }
                            }}
                            className="hidden"
                            id={`edit-file-upload-${uploadKey}`}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`edit-file-upload-${uploadKey}`)?.click()}
                            className="p-2 bg-primary text-primary-foreground rounded-lg shadow-md"
                            title="이미지 변경"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateChoiceOption(groupIndex, option.id, 'image_url', '')
                              updateChoiceOption(groupIndex, option.id, 'image_alt', '')
                            }}
                            className="p-2 bg-red-600 text-white rounded-lg shadow-md"
                            title="이미지 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label
                        htmlFor={`edit-file-upload-${uploadKey}`}
                        className="flex h-full w-full cursor-pointer flex-col items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingImages[uploadKey]}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              await handleImageUpload(file, groupIndex, option.id)
                              e.target.value = ''
                            }
                          }}
                          className="hidden"
                          id={`edit-file-upload-${uploadKey}`}
                        />
                        {uploadingImages[uploadKey] ? (
                          <p className="text-sm text-primary">업로드 중...</p>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 mb-2 text-gray-400" />
                            <p className="text-sm">이미지 업로드</p>
                          </>
                        )}
                      </label>
                    )}
                  </div>
                </div>

                {/* 내부용 이름 · 뱃지 아이콘 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      내부용 이름 (텍스트 뱃지)
                    </label>
                    <input
                      type="text"
                      value={option.internal_name || ''}
                      onChange={(e) => updateChoiceOption(groupIndex, option.id, 'internal_name', e.target.value)}
                      placeholder="예: 🏜️ X, US, INTL"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      아이콘이 없을 때 예약 카드에 이 텍스트가 표시됩니다.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      뱃지 아이콘 (이미지)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                        {option.badge_icon_url ? (
                          <Image
                            src={option.badge_icon_url}
                            alt="badge"
                            fill
                            sizes="48px"
                            className="object-contain"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                            없음
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`badge-icon-upload-${uploadKey}`}
                          disabled={uploadingImages[`${uploadKey}-badge`]}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              await handleImageUpload(file, groupIndex, option.id, 'badge_icon_url')
                              e.target.value = ''
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`badge-icon-upload-${uploadKey}`)?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg border border-border/60"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingImages[`${uploadKey}-badge`] ? '업로드 중...' : '아이콘 업로드'}
                        </button>
                        {option.badge_icon_url ? (
                          <button
                            type="button"
                            onClick={() => updateChoiceOption(groupIndex, option.id, 'badge_icon_url', '')}
                            className="text-[11px] text-red-500 hover:underline text-left"
                          >
                            아이콘 삭제
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      PNG/SVG 원형 아이콘 권장 (US, INTL, PASS 등)
                    </p>
                  </div>
                </div>

                {/* 초이스명 / 설명 (선택 언어) */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      초이스명 ({getSiteLocaleMeta(editLocale).label})
                    </label>
                    <input
                      type="text"
                      value={getChoiceOptionLocalizedText(option, 'name', editLocale)}
                      onChange={(e) =>
                        updateChoiceOptionLocaleText(
                          groupIndex,
                          option.id,
                          e.target.value,
                          getChoiceOptionLocalizedText(option, 'description', editLocale)
                        )
                      }
                      placeholder="초이스명"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      설명 ({getSiteLocaleMeta(editLocale).label})
                    </label>
                    <textarea
                      value={getChoiceOptionLocalizedText(option, 'description', editLocale)}
                      onChange={(e) =>
                        updateChoiceOptionLocaleText(
                          groupIndex,
                          option.id,
                          getChoiceOptionLocalizedText(option, 'name', editLocale),
                          e.target.value
                        )
                      }
                      placeholder="한 줄에 하나씩 입력하면 고객 화면에 체크 목록으로 표시됩니다"
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                {/* 가격 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    가격
                    {group.pricing_unit === 'per_unit' ? (
                      <span className="ml-2 text-xs text-amber-700 font-normal">(차량/단위당 고정가)</span>
                    ) : homepagePricingType === 'single' ? (
                      <span className="ml-2 text-xs text-primary font-normal">(단일 가격)</span>
                    ) : null}
                  </label>
                  {homepagePricingType === 'single' || group.pricing_unit === 'per_unit' ? (
                    <input
                      type="number"
                      value={option.adult_price}
                      onChange={(e) => {
                        const price = parseInt(e.target.value) || 0
                        updateChoiceOption(groupIndex, option.id, 'adult_price', price)
                        updateChoiceOption(groupIndex, option.id, 'child_price', price)
                        updateChoiceOption(groupIndex, option.id, 'infant_price', price)
                      }}
                      placeholder="0"
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">성인</label>
                        <input
                          type="number"
                          value={option.adult_price}
                          onChange={(e) => updateChoiceOption(groupIndex, option.id, 'adult_price', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">아동</label>
                        <input
                          type="number"
                          value={option.child_price}
                          onChange={(e) => updateChoiceOption(groupIndex, option.id, 'child_price', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">유아</label>
                        <input
                          type="number"
                          value={option.infant_price}
                          onChange={(e) => updateChoiceOption(groupIndex, option.id, 'infant_price', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {group.choice_type === 'quantity' || group.pricing_unit === 'per_unit' ? (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {group.pricing_unit === 'per_unit' ? '최대 수용 인원' : '수용'}
                      </label>
                      <input
                        type="number"
                        value={option.capacity}
                        onChange={(e) => updateChoiceOption(groupIndex, option.id, 'capacity', parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-gray-50 focus:bg-white"
                      />
                    </div>
                  ) : null}
                  <label className="flex items-center text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={option.is_default}
                      onChange={(e) => updateChoiceOption(groupIndex, option.id, 'is_default', e.target.checked)}
                      className="mr-2 w-3 h-3 text-primary rounded focus:ring-ring"
                    />
                    기본값
                  </label>
                  <label className="flex items-center text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={option.is_active}
                      onChange={(e) => updateChoiceOption(groupIndex, option.id, 'is_active', e.target.checked)}
                      className="mr-2 w-3 h-3 text-primary rounded focus:ring-ring"
                    />
                    활성
                  </label>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 복사 모달 */}
      {showCopyModal && (
        <CopyToModal
          products={products}
          selectedTargetProductId={selectedProductId}
          setSelectedTargetProductId={setSelectedProductId}
          onCopyTo={copyChoicesFromProduct}
          onClose={() => {
            setShowCopyModal(false)
            setSelectedProductId('')
          }}
        />
      )}

      {/* 가져오기 모달 */}
      {showImportModal && (
        <ImportModal
          importData={importData}
          setImportData={setImportData}
          onImport={importChoices}
          onClose={() => {
            setShowImportModal(false)
            setImportData('')
          }}
        />
      )}

      {/* 템플릿 피커 */}
      {showTemplateModal && (
        <ChoiceTemplatePickerModal
          onSelect={(pick) => void loadFromTemplate(pick)}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* 템플릿 설명 모달 */}
      {showTemplateInfoModal && (
        <TemplateInfoModal
          onClose={() => setShowTemplateInfoModal(false)}
        />
      )}

      {/* 초이스 타입 설명 모달 */}
      {showTypeInfoModal && (
        <ChoiceTypeInfoModal
          onClose={() => setShowTypeInfoModal(false)}
        />
      )}

      {/* 템플릿으로 내보내기 모달 */}
      {showExportTemplateModal && (
        <ExportTemplateModal
          onExport={() => exportChoicesAsTemplates(selectedChoiceIds)}
          onClose={() => {
            setShowExportTemplateModal(false)
            setSelectedChoiceIds(new Set())
          }}
          productChoices={productChoices}
          selectedChoiceIds={selectedChoiceIds}
          setSelectedChoiceIds={setSelectedChoiceIds}
        />
      )}
    </div>
  )
}

// 가져오기 모달 컴포넌트
interface ImportModalProps {
  importData: string
  setImportData: (data: string) => void
  onImport: () => void
  onClose: () => void
}

function ImportModal({ importData, setImportData, onImport, onClose }: ImportModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 가져오기</h3>
        <p className="text-sm text-gray-600 mb-4">
          JSON 형식의 초이스 데이터를 붙여넣으세요.
        </p>
        <textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none"
          placeholder="JSON 데이터를 여기에 붙여넣으세요..."
        />
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onImport}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-primary/90"
          >
            가져오기
          </button>
        </div>
      </div>
    </div>
  )
}

/** 다른 상품 → 현재 상품으로 초이스 가져오기 */
interface CopyToModalProps {
  products: Array<{id: string, name: string, name_ko?: string}>
  selectedTargetProductId: string
  setSelectedTargetProductId: (id: string) => void
  onCopyTo: () => void
  onClose: () => void
}

function CopyToModal({ products, selectedTargetProductId, setSelectedTargetProductId, onCopyTo, onClose }: CopyToModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">다른 상품에서 가져오기</h3>
        <p className="text-sm text-gray-600 mb-4">
          초이스를 가져올 상품을 선택하세요. 선택한 상품의 초이스가 이 상품에 추가됩니다.
        </p>
        <select
          value={selectedTargetProductId}
          onChange={(e) => setSelectedTargetProductId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md"
        >
          <option value="">상품을 선택하세요</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name_ko || product.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onCopyTo}
            disabled={!selectedTargetProductId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            가져오기
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿으로 내보내기 모달 컴포넌트
interface ExportTemplateModalProps {
  onExport: () => void
  onClose: () => void
  productChoices: ProductChoice[]
  selectedChoiceIds: Set<string>
  setSelectedChoiceIds: (ids: Set<string>) => void
}

function ExportTemplateModal({ onExport, onClose, productChoices, selectedChoiceIds, setSelectedChoiceIds }: ExportTemplateModalProps) {
  const handleToggleAll = () => {
    if (selectedChoiceIds.size === productChoices.length) {
      setSelectedChoiceIds(new Set())
    } else {
      setSelectedChoiceIds(new Set(productChoices.map(choice => choice.id)))
    }
  }

  const handleToggleChoice = (choiceId: string) => {
    const newSelected = new Set(selectedChoiceIds)
    if (newSelected.has(choiceId)) {
      newSelected.delete(choiceId)
    } else {
      newSelected.add(choiceId)
    }
    setSelectedChoiceIds(newSelected)
  }

  const selectedCount = selectedChoiceIds.size

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">템플릿으로 저장</h3>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>라이브러리에 저장할 초이스 그룹을 선택하세요.</p>
            <p className="mt-2">저장 후 <strong>옵션·초이스 템플릿 &gt; 초이스 템플릿</strong>에서 확인·재사용할 수 있습니다.</p>
          </div>

          {/* 전체 선택/해제 */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedChoiceIds.size === productChoices.length && productChoices.length > 0}
                onChange={handleToggleAll}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                전체 선택 ({selectedCount}/{productChoices.length})
              </span>
            </label>
          </div>

          {/* 초이스 그룹 목록 */}
          <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            {productChoices.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                내보낼 초이스 그룹이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {productChoices.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex items-start p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChoiceIds.has(choice.id)}
                      onChange={() => handleToggleChoice(choice.id)}
                      className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">
                        {choice.choice_group_ko || choice.choice_group || '이름 없음'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        타입: {choice.choice_type === 'single' ? '단일 선택' : choice.choice_type === 'multiple' ? '다중 선택' : '수량 선택'}
                        {choice.pricing_unit === 'per_unit' ? ' · 차량/단위가' : ' · 인원별'} | 
                        초이스 {choice.options?.length || 0}개
                        {choice.is_required && (
                          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">필수</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>주의:</strong> 같은 이름의 템플릿 그룹이 이미 존재하는 경우 덮어쓰기 여부를 확인합니다.
            </p>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onExport}
            disabled={selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            내보내기 ({selectedCount}개)
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿 설명 모달 컴포넌트
interface TemplateInfoModalProps {
  onClose: () => void
}

function TemplateInfoModal({ onClose }: TemplateInfoModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">템플릿이란?</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 템플릿 개요 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿이란?</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                템플릿은 <strong>재사용 가능한 초이스 그룹</strong>입니다. 한 번 만들어두면 여러 상품에서 동일한 초이스 그룹을 빠르게 불러와 사용할 수 있습니다.
              </p>
              <div className="bg-primary/5 p-3 rounded-md">
                <p className="text-sm text-primary">
                  <strong>예시:</strong> "숙박 선택" 템플릿을 만들어두면, 여러 투어 상품에서 동일한 숙박 옵션을 쉽게 추가할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 템플릿 불러오기 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600 font-semibold text-sm">1</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿 불러오기</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>사용 방법:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>"템플릿에서 불러오기" 버튼을 클릭합니다.</li>
                <li>검색·미리보기로 템플릿을 고르고, 필요하면 옵션만 선택합니다.</li>
                <li>선택한 내용이 <strong>이 상품의 초이스</strong>에 복사되어 추가됩니다.</li>
              </ol>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>주의사항:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 템플릿을 불러온 후에도 가격, 설명 등을 수정할 수 있습니다.</li>
                  <li>• 템플릿을 불러와도 원본 템플릿은 변경되지 않습니다.</li>
                  <li>• 여러 템플릿을 중복으로 불러올 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 템플릿으로 내보내기 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600 font-semibold text-sm">2</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿으로 저장</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>사용 방법:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>만든 초이스 그룹을 선택합니다.</li>
                <li>"템플릿으로 저장" 버튼을 클릭합니다.</li>
                <li>초이스 그룹이 라이브러리 템플릿으로 저장되어 다른 상품에서도 불러올 수 있습니다.</li>
              </ol>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>저장 위치:</strong></p>
                <p className="text-sm text-gray-600">
                  저장한 템플릿은 <strong>옵션·초이스 템플릿 &gt; 초이스 템플릿</strong>에서 확인하고 관리할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 템플릿 관리 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-orange-600 font-semibold text-sm">3</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿 관리</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                템플릿은 <strong>옵션·초이스 템플릿 &gt; 초이스 템플릿</strong> 메뉴에서 관리할 수 있습니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>관리 기능:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 템플릿 추가, 수정, 삭제</li>
                  <li>• 템플릿 그룹별로 관리</li>
                  <li>• 템플릿 활성/비활성 설정</li>
                  <li>• 템플릿 순서 변경</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 활용 팁 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">활용 팁</h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="space-y-1">
                    <li>• 자주 사용하는 초이스 그룹은 템플릿으로 만들어두면 시간을 절약할 수 있습니다.</li>
                    <li>• 템플릿 이름을 명확하게 지으면 나중에 찾기 쉽습니다.</li>
                    <li>• 비슷한 상품들에 공통으로 사용되는 초이스는 템플릿으로 관리하는 것이 좋습니다.</li>
                    <li>• 템플릿을 불러온 후 상품별로 가격이나 설명을 수정하여 맞춤화할 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

// 초이스 타입 설명 모달 컴포넌트
interface ChoiceTypeInfoModalProps {
  onClose: () => void
}

function ChoiceTypeInfoModal({ onClose }: ChoiceTypeInfoModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">초이스 타입 설명</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 가격 단위 */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-amber-700 font-semibold text-sm">$</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">가격 단위</h4>
            </div>
            <div className="ml-11 space-y-3">
              <div className="bg-white p-3 rounded-md border border-gray-100">
                <p className="text-sm font-medium text-gray-900 mb-1">인원별 (×인원)</p>
                <p className="text-sm text-gray-600">
                  단가 × 예약 인원. 예: 성인 $50 × 3명 = $150
                </p>
              </div>
              <div className="bg-white p-3 rounded-md border border-gray-100">
                <p className="text-sm font-medium text-gray-900 mb-1">차량/단위별 (고정가)</p>
                <p className="text-sm text-gray-600">
                  선택한 차량·단위 1개 가격만 청구합니다. 예: 공항픽업 미니밴 $80 · 3명이어도 수용 인원 이내면 $80
                </p>
              </div>
            </div>
          </div>

          {/* 단일 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3">
                <span className="text-primary font-semibold text-sm">1</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">단일 선택 (Single Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 여러 초이스 중 하나만 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 숙박 타입 선택 (호텔, 펜션, 게스트하우스)</li>
                  <li>• 식사 초이스 선택 (조식 포함, 조식 불포함)</li>
                  <li>• 교통편 선택 (버스, 기차, 항공)</li>
                </ul>
              </div>
              <div className="bg-primary/5 p-3 rounded-md">
                <p className="text-sm text-primary">
                  <strong>특징:</strong> 라디오 버튼 형태로 표시되며, 하나의 초이스만 선택 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 다중 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600 font-semibold text-sm">2</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">다중 선택 (Multiple Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 여러 초이스를 동시에 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 추가 서비스 선택 (WiFi, 조식, 픽업 서비스)</li>
                  <li>• 관광지 선택 (여러 관광지를 동시에 선택)</li>
                  <li>• 초이스 추가 (보험, 가이드, 장비 대여)</li>
                </ul>
              </div>
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>특징:</strong> 체크박스 형태로 표시되며, 여러 초이스를 동시에 선택할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 수량 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600 font-semibold text-sm">3</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">수량 선택 (Quantity Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 각 초이스에 대해 수량을 설정할 수 있는 타입입니다. 다중 선택과 유사하지만 각 초이스별로 개수를 지정할 수 있습니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 티켓 수량 선택 (성인 2명, 아동 1명)</li>
                  <li>• 식사 수량 선택 (조식 3인분, 중식 2인분)</li>
                  <li>• 상품 수량 선택 (기념품 5개, 사진 10장)</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-3 rounded-md">
                <p className="text-sm text-purple-800">
                  <strong>특징:</strong> 각 초이스마다 수량 입력 필드가 제공되며, 가격이 수량에 따라 자동 계산됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">추가 설정 초이스</h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="space-y-1">
                    <li>• <strong>필수 선택:</strong> 해당 초이스 그룹을 반드시 선택해야 하는지 설정</li>
                    <li>• <strong>최소/최대 선택:</strong> 선택할 수 있는 초이스의 개수 제한</li>
                    <li>• <strong>기본 초이스:</strong> 미리 선택된 기본값 설정</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
