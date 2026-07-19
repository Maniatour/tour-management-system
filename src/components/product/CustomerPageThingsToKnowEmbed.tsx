'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import LightRichEditor, { markdownToHtml } from '@/components/LightRichEditor'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import { fetchProductDetailsRowForLocale } from '@/lib/fetchProductDetail'
import {
  DETAIL_FIELD_LABELS,
  type DetailFieldKey,
} from '@/lib/customerPageZoneEditMap'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  buildProductTranslationMap,
  fetchProductFieldTranslations,
  upsertProductFieldTranslations,
} from '@/lib/productFieldTranslations'
import { isLegacyColumnLocale } from '@/lib/siteLocales'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

type SectionId = 'basic' | 'included' | 'logistics' | 'policy'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'basic', label: '기본 정보' },
  { id: 'included', label: '포함/불포함' },
  { id: 'logistics', label: '운영 정보' },
  { id: 'policy', label: '정책' },
]

const DETAIL_FIELDS_BY_SECTION: Record<Exclude<SectionId, 'basic'>, DetailFieldKey[]> = {
  included: ['included', 'not_included'],
  logistics: [
    'pickup_drop_info',
    'luggage_info',
    'tour_operation_info',
    'preparation_info',
    'small_group_info',
    'companion_recruitment_info',
    'notice_info',
  ],
  policy: [
    'important_notes',
    'private_tour_info',
    'cancellation_policy',
    'chat_announcement',
  ],
}

const GROUP_SIZE_OPTIONS = [
  { id: 'private', label: 'Private (단독)' },
  { id: 'small', label: 'Small Group (소규모)' },
  { id: 'big', label: 'Big Group (대규모)' },
] as const

type BasicForm = {
  sub_category: string
  max_participants: string
  group_size: string[]
  languages: string
  departure_city: string
  arrival_city: string
  departure_country: string
  arrival_country: string
  adult_age: string
  child_age_min: string
  child_age_max: string
  infant_age: string
  tags: string
}

type CustomerPageThingsToKnowEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function readVisibility(
  row: Record<string, unknown> | null,
  key: DetailFieldKey
): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>)[key] !== false
}

function emptyDetailForm(keys: DetailFieldKey[]): Partial<Record<DetailFieldKey, string>> {
  return Object.fromEntries(keys.map((key) => [key, ''])) as Partial<
    Record<DetailFieldKey, string>
  >
}

export default function CustomerPageThingsToKnowEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageThingsToKnowEmbedProps) {
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [activeSection, setActiveSection] = useState<SectionId>('basic')
  const [activeDetailField, setActiveDetailField] = useState<DetailFieldKey>('included')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)
  const [basicForm, setBasicForm] = useState<BasicForm>({
    sub_category: '',
    max_participants: '',
    group_size: [],
    languages: '',
    departure_city: '',
    arrival_city: '',
    departure_country: '',
    arrival_country: '',
    adult_age: '',
    child_age_min: '',
    child_age_max: '',
    infant_age: '',
    tags: '',
  })
  const [detailForm, setDetailForm] = useState<Partial<Record<DetailFieldKey, string>>>({})
  const [visibility, setVisibility] = useState<Partial<Record<DetailFieldKey, boolean>>>({})
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const sectionDetailFields = useMemo(() => {
    if (activeSection === 'basic') return []
    return DETAIL_FIELDS_BY_SECTION[activeSection]
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'basic' && sectionDetailFields.length > 0) {
      setActiveDetailField(sectionDetailFields[0])
    }
  }, [activeSection, sectionDetailFields])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [row, productResult, translationRows] = await Promise.all([
        fetchProductDetailsRowForLocale(productId, editLocale),
        supabase.from('products').select('*').eq('id', productId).maybeSingle(),
        fetchProductFieldTranslations(productId),
      ])

      if (productResult.error) throw productResult.error

      const productRow = (productResult.data ?? {}) as Record<string, unknown>
      const locationMap = buildProductTranslationMap(productRow, translationRows)
      const allDetailKeys = [
        ...DETAIL_FIELDS_BY_SECTION.included,
        ...DETAIL_FIELDS_BY_SECTION.logistics,
        ...DETAIL_FIELDS_BY_SECTION.policy,
      ]

      const nextDetailForm = emptyDetailForm(allDetailKeys)
      const nextVisibility: Partial<Record<DetailFieldKey, boolean>> = {}
      allDetailKeys.forEach((key) => {
        nextDetailForm[key] = String(row?.[key] ?? '')
        nextVisibility[key] = readVisibility(row, key)
      })

      const tags = Array.isArray(row?.tags)
        ? (row.tags as string[]).join(', ')
        : Array.isArray(productRow.tags)
          ? (productRow.tags as string[]).join(', ')
          : ''

      const nextBasic: BasicForm = {
        sub_category: String(productRow.sub_category ?? ''),
        max_participants: String(productRow.max_participants ?? ''),
        group_size: productRow.group_size
          ? String(productRow.group_size).split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        languages: Array.isArray(productRow.languages)
          ? (productRow.languages as string[]).join(', ')
          : '',
        departure_city: locationMap.departure_city?.[editLocale] ?? '',
        arrival_city: locationMap.arrival_city?.[editLocale] ?? '',
        departure_country: locationMap.departure_country?.[editLocale] ?? '',
        arrival_country: locationMap.arrival_country?.[editLocale] ?? '',
        adult_age: String(productRow.adult_age ?? ''),
        child_age_min: String(productRow.child_age_min ?? ''),
        child_age_max: String(productRow.child_age_max ?? ''),
        infant_age: String(productRow.infant_age ?? ''),
        tags,
      }

      setRowId(row?.id ? String(row.id) : null)
      setBasicForm(nextBasic)
      setDetailForm(nextDetailForm)
      setVisibility(nextVisibility)
      setInitialSnapshot(
        JSON.stringify({
          basic: nextBasic,
          detail: nextDetailForm,
          visibility: nextVisibility,
          locale: editLocale,
        })
      )
    } catch (error) {
      console.error('알아두실 사항 로드 오류:', error)
      setMessage('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({
        basic: basicForm,
        detail: detailForm,
        visibility,
        locale: editLocale,
      }) !== initialSnapshot
    onDirtyChange(dirty)
  }, [basicForm, detailForm, editLocale, initialSnapshot, onDirtyChange, visibility])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const existingVisibility =
        rowId != null
          ? ((
              await fromUntypedTable(supabase, 'product_details_multilingual')
                .select('customer_page_visibility')
                .eq('id', rowId)
                .maybeSingle()
            ).data as { customer_page_visibility?: Record<string, unknown> } | null)
          : null

      const mergedVisibility = {
        ...(existingVisibility?.customer_page_visibility ?? {}),
        ...visibility,
      }

      const allDetailKeys = [
        ...DETAIL_FIELDS_BY_SECTION.included,
        ...DETAIL_FIELDS_BY_SECTION.logistics,
        ...DETAIL_FIELDS_BY_SECTION.policy,
      ]

      const detailPayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        customer_page_visibility: mergedVisibility,
      }
      allDetailKeys.forEach((key) => {
        detailPayload[key] = detailForm[key]?.trim() || null
      })

      const tagList = basicForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      detailPayload.tags = tagList

      if (rowId) {
        const { error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .update(detailPayload)
          .eq('id', rowId)
        if (error) throw error
      } else {
        const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .insert([
            {
              product_id: productId,
              language_code: editLocale,
              channel_id: null,
              variant_key: 'default',
              ...detailPayload,
            },
          ])
          .select('id')
          .single()
        if (error) throw error
        setRowId(String((data as { id: string }).id))
      }

      const locationLegacyPatch = await upsertProductFieldTranslations({
        productId,
        locale: editLocale,
        values: {
          departure_city: basicForm.departure_city,
          arrival_city: basicForm.arrival_city,
          departure_country: basicForm.departure_country,
          arrival_country: basicForm.arrival_country,
        },
      })

      const productUpdate: Record<string, unknown> = {
        sub_category: basicForm.sub_category.trim() || null,
        max_participants: basicForm.max_participants
          ? Number(basicForm.max_participants)
          : null,
        group_size:
          basicForm.group_size.length > 0 ? basicForm.group_size.join(',') : null,
        languages: basicForm.languages
          .split(',')
          .map((lang) => lang.trim())
          .filter(Boolean),
        ...locationLegacyPatch,
        adult_age: basicForm.adult_age ? Number(basicForm.adult_age) : null,
        child_age_min: basicForm.child_age_min ? Number(basicForm.child_age_min) : null,
        child_age_max: basicForm.child_age_max ? Number(basicForm.child_age_max) : null,
        infant_age: basicForm.infant_age ? Number(basicForm.infant_age) : null,
        tags: tagList,
        updated_at: new Date().toISOString(),
      }
      if (isLegacyColumnLocale(editLocale)) {
        if (editLocale === 'ko') {
          productUpdate.departure_city_ko = basicForm.departure_city.trim() || null
          productUpdate.arrival_city_ko = basicForm.arrival_city.trim() || null
          productUpdate.departure_country_ko = basicForm.departure_country.trim() || null
          productUpdate.arrival_country_ko = basicForm.arrival_country.trim() || null
        } else {
          productUpdate.departure_city_en = basicForm.departure_city.trim() || null
          productUpdate.arrival_city_en = basicForm.arrival_city.trim() || null
          productUpdate.departure_country_en = basicForm.departure_country.trim() || null
          productUpdate.arrival_country_en = basicForm.arrival_country.trim() || null
        }
      }

      const { error: productError } = await supabase
        .from('products')
        .update(productUpdate as never)
        .eq('id', productId)
      if (productError) throw productError

      setInitialSnapshot(
        JSON.stringify({
          basic: basicForm,
          detail: detailForm,
          visibility,
          locale: editLocale,
        })
      )
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('알아두실 사항 저장 오류:', error)
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        알아두실 사항 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">product_details_multilingual</code> ·{' '}
          <code className="rounded bg-muted px-1">products</code>
        </p>
        <AdminEditLocaleToggle
          value={editLocale}
          onChange={setEditLocale}
          groupLabel="편집 언어"
          koLabel="한국어"
          enLabel="English"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === section.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-white hover:text-foreground'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'basic' ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground">기본 정보 (products)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">서브 카테고리 (sub_category)</span>
              <input
                value={basicForm.sub_category}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, sub_category: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">최대 인원 (max_participants)</span>
              <input
                type="number"
                value={basicForm.max_participants}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, max_participants: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">그룹 규모 (group_size)</span>
              <div className="flex flex-wrap gap-2">
                {GROUP_SIZE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={basicForm.group_size.includes(option.id)}
                      onChange={(e) => {
                        setBasicForm((prev) => ({
                          ...prev,
                          group_size: e.target.checked
                            ? [...prev.group_size, option.id]
                            : prev.group_size.filter((id) => id !== option.id),
                        }))
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">지원 언어 (languages, 쉼표 구분)</span>
              <input
                value={basicForm.languages}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, languages: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="ko, en, ja"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                출발 도시 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.departure_city}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, departure_city: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                도착 도시 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.arrival_city}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, arrival_city: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                출발 국가 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.departure_country}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, departure_country: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                도착 국가 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.arrival_country}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, arrival_country: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">성인 연령 (adult_age)</span>
              <input
                type="number"
                value={basicForm.adult_age}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, adult_age: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">아동 연령 최소</span>
              <input
                type="number"
                value={basicForm.child_age_min}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, child_age_min: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">아동 연령 최대</span>
              <input
                type="number"
                value={basicForm.child_age_max}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, child_age_max: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">유아 연령 (infant_age)</span>
              <input
                type="number"
                value={basicForm.infant_age}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, infant_age: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">태그 (쉼표 구분)</span>
              <input
                value={basicForm.tags}
                onChange={(e) => setBasicForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            카테고리·소요 시간은 「투어 하이라이트」 영역에서 편집합니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {sectionDetailFields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setActiveDetailField(field)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeDetailField === field
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {DETAIL_FIELD_LABELS[field]}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {DETAIL_FIELD_LABELS[activeDetailField]}
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  컬럼: <code className="rounded bg-muted px-1">{activeDetailField}</code>
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={visibility[activeDetailField] !== false}
                  onChange={(e) =>
                    setVisibility((prev) => ({
                      ...prev,
                      [activeDetailField]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                />
                고객 페이지 표시
              </label>
            </div>

            <LightRichEditor
              value={detailForm[activeDetailField] ?? ''}
              onChange={(value) =>
                setDetailForm((prev) => ({ ...prev, [activeDetailField]: value }))
              }
              height={220}
              placeholder={`${DETAIL_FIELD_LABELS[activeDetailField]} 내용`}
              enableResize
            />

            {detailForm[activeDetailField] ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  미리보기
                </p>
                <div
                  className="prose prose-sm mt-1 max-w-none text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(detailForm[activeDetailField] ?? ''),
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {message ? (
        <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>
    </div>
  )
}
