'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react'
import CustomerPageTranslationEditor from '@/components/product/CustomerPageTranslationEditor'
import CustomerPageProductSearchSelect, {
  type CustomerPageProductOption,
} from '@/components/product/CustomerPageProductSearchSelect'
import {
  buildEmptyTranslationForm,
  invalidateTranslationCache,
  loadCustomerPageTranslations,
  saveCustomerPageTranslations,
  type TranslationFieldDef,
  type TranslationFormState,
} from '@/lib/customerPageTranslations'
import {
  createEmptyHomeDestination,
  createEmptyHomeAdventure,
  normalizeCustomerPageHomeContent,
  type CustomerPageHomeContent,
  type HomeAdventureContentItem,
  type HomeDestinationContentItem,
} from '@/lib/customerPageHomeContent'
import {
  loadCustomerPageHomeContent,
  persistCustomerPageHomeContent,
} from '@/lib/customerPageHomeContentPersistence'
import { uploadCustomerPageAsset } from '@/lib/uploadCustomerPageAsset'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import { supabase } from '@/lib/supabase'

export type HomeSettingsKind = 'hero' | 'popular' | 'destinations' | 'adventure'

type Props = {
  kind: HomeSettingsKind
  locale: string
  translationNamespace?: string
  translationFields?: TranslationFieldDef[]
  onSaved: () => void
  onDirtyChange?: (dirty: boolean) => void
}

type ProductRow = {
  id: string
  name: string
  customer_name_ko: string | null
  customer_name_en: string | null
  is_favorite: boolean | null
  favorite_order: number | null
}

function rowToOption(row: ProductRow, labelLocale: string): CustomerPageProductOption {
  const label =
    (labelLocale === 'en'
      ? row.customer_name_en || row.name
      : row.customer_name_ko || row.name) || row.name
  const sublabel =
    labelLocale === 'en'
      ? row.customer_name_ko || row.name
      : row.customer_name_en || row.name
  return {
    id: row.id,
    label,
    sublabel: sublabel !== label ? sublabel : null,
  }
}

function ImageUploadField({
  label,
  value,
  onChange,
  folder,
  aspectClass = 'aspect-[16/9]',
}: {
  label: string
  value: string
  onChange: (next: string) => void
  folder: string
  aspectClass?: string
}) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File | null) => {
    if (!file) return
    try {
      setUploading(true)
      const url = await uploadCustomerPageAsset(file, folder)
      onChange(url)
    } catch (error) {
      alert(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      {value ? (
        <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${aspectClass}`}>
          <Image src={value} alt="" fill className="object-cover" sizes="480px" unoptimized />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 ${aspectClass}`}
        >
          이미지 없음
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-slate-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          이미지 업로드
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
          />
        </label>
        <input
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="또는 이미지 URL 입력"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
      </div>
    </div>
  )
}

export default function CustomerPageHomeSettingsPanel({
  kind,
  locale,
  translationNamespace,
  translationFields,
  onSaved,
  onDirtyChange,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [content, setContent] = useState<CustomerPageHomeContent>(() => loadCustomerPageHomeContent())
  const [translationForm, setTranslationForm] = useState<TranslationFormState>({})
  const [productOptions, setProductOptions] = useState<CustomerPageProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [pickerValue, setPickerValue] = useState<string | null>(null)
  const initialSnapshotRef = useRef<string | null>(null)

  const hasTranslations = Boolean(translationNamespace && translationFields?.length)

  const captureSnapshot = useCallback(() => {
    return JSON.stringify({
      content: normalizeCustomerPageHomeContent(content),
      translationForm,
    })
  }, [content, translationForm])

  useEffect(() => {
    initialSnapshotRef.current = null
    onDirtyChange?.(false)
  }, [kind, onDirtyChange])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setMessage(null)
      try {
        setContent(loadCustomerPageHomeContent())
        if (hasTranslations && translationNamespace && translationFields) {
          const form = await loadCustomerPageTranslations(translationNamespace, translationFields)
          if (!cancelled) setTranslationForm(form)
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ text: `불러오기 실패: ${String(error)}`, type: 'error' })
          if (translationFields) setTranslationForm(buildEmptyTranslationForm(translationFields))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [hasTranslations, translationFields, translationNamespace])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, customer_name_ko, customer_name_en, is_favorite, favorite_order')
        .eq('status', 'active')
        .eq('is_published', true)
        .order('is_favorite', { ascending: false })
        .order('favorite_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setProductOptions(((data ?? []) as ProductRow[]).map((row) => rowToOption(row, locale)))
    } catch (error) {
      console.error('Failed to load products for home settings:', error)
    } finally {
      setProductsLoading(false)
    }
  }, [locale])

  useEffect(() => {
    if (kind !== 'popular') return
    void loadProducts()
  }, [kind, loadProducts])

  const selectedPopularProducts = useMemo(() => {
    const map = new Map(productOptions.map((option) => [option.id, option]))
    return content.popularProductIds
      .map((id) => map.get(id))
      .filter((option): option is CustomerPageProductOption => option != null)
  }, [content.popularProductIds, productOptions])

  const updateDestination = (index: number, patch: Partial<HomeDestinationContentItem>) => {
    setContent((prev) => ({
      ...prev,
      destinations: prev.destinations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }))
  }

  const moveDestination = (index: number, direction: 'up' | 'down') => {
    setContent((prev) => {
      const next = [...prev.destinations]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return { ...prev, destinations: next }
    })
  }

  const updateAdventure = (index: number, patch: Partial<HomeAdventureContentItem>) => {
    setContent((prev) => ({
      ...prev,
      adventureCategories: prev.adventureCategories.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }))
  }

  const moveAdventure = (index: number, direction: 'up' | 'down') => {
    setContent((prev) => {
      const next = [...prev.adventureCategories]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return { ...prev, adventureCategories: next }
    })
  }

  const addPopularProduct = (productId: string | null) => {
    if (!productId) return
    setContent((prev) => {
      if (prev.popularProductIds.includes(productId)) return prev
      return {
        ...prev,
        popularProductIds: [...prev.popularProductIds, productId],
      }
    })
    setPickerValue(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const normalized = normalizeCustomerPageHomeContent(content)
      await persistCustomerPageHomeContent(normalized)

      if (hasTranslations && translationNamespace && translationFields) {
        await saveCustomerPageTranslations(translationNamespace, translationForm)
        await invalidateTranslationCache()
      }

      emitCustomerPageBindingsUpdate()
      setMessage({ text: '저장되었습니다.', type: 'success' })
      initialSnapshotRef.current = JSON.stringify({
        content: normalized,
        translationForm,
      })
      onDirtyChange?.(false)
      onSaved()
    } catch (error) {
      setMessage({ text: `저장 실패: ${String(error)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (loading) {
      onDirtyChange?.(false)
      return
    }
    if (initialSnapshotRef.current === null) {
      initialSnapshotRef.current = captureSnapshot()
      onDirtyChange?.(false)
      return
    }
    onDirtyChange?.(captureSnapshot() !== initialSnapshotRef.current)
  }, [loading, captureSnapshot, onDirtyChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {kind === 'hero' ? (
        <ImageUploadField
          label="히어로 배경 이미지"
          value={content.heroImageUrl ?? ''}
          onChange={(heroImageUrl) => setContent((prev) => ({ ...prev, heroImageUrl }))}
          folder="hero"
        />
      ) : null}

      {kind === 'popular' ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700">Most Popular Tours 표시 상품</p>
            <p className="mt-1 text-xs text-gray-500">
              아래에서 상품을 추가하면 선택한 순서대로 표시됩니다. 비워두면 즐겨찾기(favorite) 순서를
              사용합니다.
            </p>
          </div>

          <CustomerPageProductSearchSelect
            value={pickerValue}
            options={productOptions.filter(
              (option) => !content.popularProductIds.includes(option.id)
            )}
            loading={productsLoading}
            placeholder="상품 검색 후 추가"
            emptyLabel="상품 추가"
            onChange={addPopularProduct}
          />

          <div className="space-y-2">
            {selectedPopularProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                선택된 상품이 없습니다. 즐겨찾기 순서가 사용됩니다.
              </p>
            ) : (
              selectedPopularProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="flex-1 text-xs font-medium text-gray-900">{product.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setContent((prev) => {
                          const nextIds = [...prev.popularProductIds]
                          const targetIndex = index - 1
                          const [moved] = nextIds.splice(index, 1)
                          nextIds.splice(targetIndex, 0, moved)
                          return { ...prev, popularProductIds: nextIds }
                        })
                      }
                      className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                      aria-label="위로"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === selectedPopularProducts.length - 1}
                      onClick={() =>
                        setContent((prev) => {
                          const nextIds = [...prev.popularProductIds]
                          const targetIndex = index + 1
                          const [moved] = nextIds.splice(index, 1)
                          nextIds.splice(targetIndex, 0, moved)
                          return { ...prev, popularProductIds: nextIds }
                        })
                      }
                      className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                      aria-label="아래로"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setContent((prev) => ({
                          ...prev,
                          popularProductIds: prev.popularProductIds.filter((id) => id !== product.id),
                        }))
                      }
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      aria-label="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {kind === 'destinations' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-700">Explore Top Destinations 목록</p>
              <p className="mt-1 text-xs text-gray-500">
                이름, 연결 태그, 이미지를 설정합니다. 클릭 시 해당 태그 투어 목록으로 이동합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setContent((prev) => ({
                  ...prev,
                  destinations: [...prev.destinations, createEmptyHomeDestination(prev.destinations.length)],
                }))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              추가
            </button>
          </div>

          {content.destinations.map((destination, index) => (
            <div key={destination.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">목적지 {index + 1}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveDestination(index, 'up')}
                    className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="위로"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === content.destinations.length - 1}
                    onClick={() => moveDestination(index, 'down')}
                    className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="아래로"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setContent((prev) => ({
                        ...prev,
                        destinations: prev.destinations.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={destination.labelKo ?? ''}
                  onChange={(event) => updateDestination(index, { labelKo: event.target.value })}
                  placeholder="이름 (한국어)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={destination.labelEn ?? ''}
                  onChange={(event) => updateDestination(index, { labelEn: event.target.value })}
                  placeholder="Name (English)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <input
                type="text"
                value={destination.tagQuery}
                onChange={(event) => updateDestination(index, { tagQuery: event.target.value })}
                placeholder="연결 태그 (예: 그랜드캐년, 시티)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />

              <ImageUploadField
                label="목적지 이미지"
                value={destination.imageUrl}
                onChange={(imageUrl) => updateDestination(index, { imageUrl })}
                folder={`destinations/${destination.id}`}
              />
            </div>
          ))}
        </div>
      ) : null}

      {kind === 'adventure' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-700">Choose Your Adventure 카테고리</p>
              <p className="mt-1 text-xs text-gray-500">
                이름, 연결 태그, 아이콘 이미지를 설정합니다. 클릭 시 해당 태그 투어 목록으로 이동합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setContent((prev) => ({
                  ...prev,
                  adventureCategories: [
                    ...prev.adventureCategories,
                    createEmptyHomeAdventure(prev.adventureCategories.length),
                  ],
                }))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              추가
            </button>
          </div>

          {content.adventureCategories.map((category, index) => (
            <div key={category.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">카테고리 {index + 1}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveAdventure(index, 'up')}
                    className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="위로"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === content.adventureCategories.length - 1}
                    onClick={() => moveAdventure(index, 'down')}
                    className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="아래로"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setContent((prev) => ({
                        ...prev,
                        adventureCategories: prev.adventureCategories.filter(
                          (_, itemIndex) => itemIndex !== index
                        ),
                      }))
                    }
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={category.labelKo ?? ''}
                  onChange={(event) => updateAdventure(index, { labelKo: event.target.value })}
                  placeholder="이름 (한국어)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={category.labelEn ?? ''}
                  onChange={(event) => updateAdventure(index, { labelEn: event.target.value })}
                  placeholder="Name (English)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <input
                type="text"
                value={category.tagQuery}
                onChange={(event) => updateAdventure(index, { tagQuery: event.target.value })}
                placeholder="연결 태그 (예: 그랜드캐년, 앤텔롭, 시티)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />

              <ImageUploadField
                label="카테고리 아이콘 이미지"
                value={category.imageUrl ?? ''}
                onChange={(imageUrl) => updateAdventure(index, { imageUrl })}
                folder={`adventure/${category.id}`}
                aspectClass="aspect-square max-w-[160px]"
              />
            </div>
          ))}
        </div>
      ) : null}

      {hasTranslations && translationFields ? (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-gray-700">섹션 텍스트</p>
          <CustomerPageTranslationEditor
            fields={translationFields}
            values={translationForm}
            onChange={setTranslationForm}
          />
        </div>
      ) : null}

      {message ? (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            message.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>
    </div>
  )
}
