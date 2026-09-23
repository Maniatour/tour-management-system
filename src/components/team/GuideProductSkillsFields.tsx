'use client'

import { useEffect, useMemo, useState } from 'react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import {
  canGuideProduct,
  GUIDE_LANGUAGE_CODES,
  GUIDE_LANGUAGE_PRIORITY_LABEL,
  guideLanguageCodesForStaff,
  guideLanguagePriority,
  parseGuideProductSkills,
  type GuideLanguageCode,
  type GuideLanguagePriorities,
  type GuideLanguagePriority,
  type GuideProductSkills,
} from '@/lib/guideProductSkills'
import { isMiscTourSelectableProduct } from '@/lib/scheduleMiscTourGroup'

type ProductOption = {
  id: string
  label: string
  group: 'tour' | 'service'
}

const PRODUCT_GROUPS = [
  { id: 'tour' as const, label: '매니아투어' },
  { id: 'service' as const, label: '매니아 서비스' },
]

function guideProductLabel(product: {
  id: string
  name: string | null
  name_ko: string | null
  name_en: string | null
  internal_name_ko: string | null
  product_code: string | null
}): string {
  const candidates = [product.name_ko, product.name, product.internal_name_ko, product.name_en, product.product_code, product.id]
  for (const raw of candidates) {
    const value = String(raw || '').trim()
    if (value && value !== '상품') return value
  }
  return String(product.id)
}

function guideSkillGroup(subCategory: string | null | undefined): ProductOption['group'] | null {
  const normalized = String(subCategory || '').trim().toLowerCase()
  if (normalized === 'mania tour') return 'tour'
  if (normalized === 'mania service') return 'service'
  return null
}

type GuideProductSkillsFieldsProps = {
  skills: GuideProductSkills
  languages: string[] | null | undefined
  onChange: (skills: GuideProductSkills) => void
  showHeading?: boolean
}

let guideProductOptionsRequest: Promise<ProductOption[]> | null = null

function loadGuideProductOptions(): Promise<ProductOption[]> {
  if (!guideProductOptionsRequest) {
    guideProductOptionsRequest = (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, internal_name_ko, product_code, sub_category, status')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .eq('status', 'active')
        .order('name_ko')
      if (error) {
        guideProductOptionsRequest = null
        return []
      }
      return (data || [])
        .filter((product) => isMiscTourSelectableProduct(product) && String(product.status || '').trim().toLowerCase() === 'active')
        .map((product) => {
          const group = guideSkillGroup(product.sub_category)
          if (!group) return null
          return {
            id: String(product.id || '').trim(),
            label: guideProductLabel(product),
            group,
          }
        })
        .filter((product): product is ProductOption => Boolean(product?.id))
    })()
  }
  return guideProductOptionsRequest
}

export function selectedGuideProductCount(skills: unknown): number {
  const parsed = parseGuideProductSkills(skills)
  return Object.keys(parsed).filter((id) => canGuideProduct(parsed, id)).length
}

export function GuideProductSkillBadges({ skills }: { skills: unknown }) {
  const [products, setProducts] = useState<ProductOption[]>([])
  const parsed = parseGuideProductSkills(skills)
  const selectedIds = Object.keys(parsed).filter((id) => canGuideProduct(parsed, id))

  useEffect(() => {
    let cancelled = false
    void loadGuideProductOptions().then((options) => {
      if (!cancelled) setProducts(options)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (selectedIds.length === 0) return null

  const selected = selectedIds.map((id) => products.find((product) => product.id === id) || { id, label: id, group: 'tour' as const })

  return (
    <span className="mt-2 block max-h-14 overflow-y-auto">
      <span className="flex flex-wrap gap-1">
        {selected.map((product) => {
          const ranks = GUIDE_LANGUAGE_CODES.flatMap((code) => {
            const rank = guideLanguagePriority(parsed, product.id, code)
            return rank ? [{ code, rank }] : []
          })
          return (
            <span key={product.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-blue-900">
              <span className="max-w-[9rem] truncate">{product.label}</span>
              {ranks.map((item, index) => (
                <span key={item.code} className="inline-flex shrink-0 items-center gap-0.5">
                  {index > 0 ? <span className="text-gray-400">,</span> : null}
                  <ReactCountryFlag
                    countryCode={BADGE_LANGUAGE_FLAG[item.code]}
                    svg
                    title={BADGE_LANGUAGE_NAME[item.code]}
                    style={{ width: '12px', height: '9px', borderRadius: '1px' }}
                  />
                  <span>{PRIORITY_HANJA[item.rank]}</span>
                </span>
              ))}
            </span>
          )
        })}
      </span>
    </span>
  )
}

const BADGE_LANGUAGE_FLAG: Record<GuideLanguageCode, string> = {
  ko: 'KR',
  en: 'US',
  ja: 'JP',
}

const BADGE_LANGUAGE_NAME: Record<GuideLanguageCode, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
}

const PRIORITY_HANJA: Record<GuideLanguagePriority, string> = {
  1: '上',
  2: '中',
  3: '下',
}

export default function GuideProductSkillsFields({ skills, languages, onChange, showHeading = true }: GuideProductSkillsFieldsProps) {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadGuideProductOptions().then((options) => {
      if (cancelled) return
      setProducts(options)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return products
    return products.filter((product) => product.label.toLowerCase().includes(needle) || product.id.toLowerCase().includes(needle))
  }, [products, query])

  const languageCodes = useMemo(() => guideLanguageCodesForStaff(languages), [languages])

  const writeSkill = (productId: string, eligible: boolean, priorities: GuideLanguagePriorities) => {
    const next = { ...skills }
    const allowed = new Set(languageCodes)
    const cleaned = Object.fromEntries(
      languageCodes.flatMap((code) => (allowed.has(code) && priorities[code] ? [[code, priorities[code]]] : [])),
    ) as GuideLanguagePriorities
    if (!eligible) delete next[productId]
    else next[productId] = { eligible: true, priorities: cleaned }
    onChange(next)
  }

  const currentPriorities = (productId: string): GuideLanguagePriorities => {
    const priorities: GuideLanguagePriorities = {}
    for (const code of languageCodes) {
      const rank = guideLanguagePriority(skills, productId, code)
      if (rank) priorities[code] = rank
    }
    return priorities
  }

  return (
    <div>
      {showHeading ? <label className="mb-2 block text-sm font-medium text-gray-700">투어 가이드로 진행 가능한 상품</label> : null}
      <p className="mb-2 text-xs text-gray-500">
        기본은 선택되어 있지 않습니다. 확인 후 체크한 상품만 가이드로 배정됩니다. 가이드 언어에 해당하는 상·중·하만 보이며, 영어 손님은 영어 상부터 배정합니다. 같은 순위를 다시 누르면 지워집니다.
      </p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="상품 검색"
        className="mb-2 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm"
      />
      {loading ? (
        <p className="text-sm text-gray-400">상품 목록을 불러오는 중입니다.</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-400">매니아투어·매니아 서비스 상품이 없습니다.</p>
      ) : (
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-2">
          {PRODUCT_GROUPS.map((group) => {
            const items = visible.filter((product) => product.group === group.id)
            if (items.length === 0) return null
            return (
              <section key={group.id}>
                <p className="px-2 py-1 text-xs font-semibold text-gray-500">{group.label}</p>
                <ul className="space-y-1">
                  {items.map((product) => {
                    const eligible = canGuideProduct(skills, product.id)
                    const priorities = currentPriorities(product.id)
                    return (
                      <li key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                        <label className="flex min-w-[8rem] flex-1 items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={eligible}
                            onChange={(event) => writeSkill(product.id, event.target.checked, event.target.checked ? priorities : {})}
                          />
                          <span className="truncate">{product.label}</span>
                        </label>
                        <div className={`flex flex-wrap items-center gap-2 ${eligible ? '' : 'opacity-40'}`}>
                          {languageCodes.map((code) => (
                            <LanguagePriorityControl
                              key={code}
                              locale={code}
                              productLabel={product.label}
                              value={priorities[code] ?? null}
                              disabled={!eligible}
                              onChange={(rank) => {
                                const next = { ...priorities }
                                if (rank) next[code] = rank
                                else delete next[code]
                                writeSkill(product.id, true, next)
                              }}
                            />
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const LANGUAGE_CONTROL_LABEL: Record<GuideLanguageCode, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
}

function LanguagePriorityControl({
  locale,
  productLabel,
  value,
  disabled,
  onChange,
}: {
  locale: GuideLanguageCode
  productLabel: string
  value: GuideLanguagePriority | null
  disabled: boolean
  onChange: (rank: GuideLanguagePriority | null) => void
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`${productLabel} ${LANGUAGE_CONTROL_LABEL[locale]} 우선순위`}>
      <span className="w-9 text-[11px] text-gray-500">{LANGUAGE_CONTROL_LABEL[locale]}</span>
      {([1, 2, 3] as const).map((rank) => (
        <button
          key={rank}
          type="button"
          disabled={disabled}
          aria-pressed={value === rank}
          aria-label={`${LANGUAGE_CONTROL_LABEL[locale]} ${GUIDE_LANGUAGE_PRIORITY_LABEL[rank]}`}
          onClick={() => onChange(value === rank ? null : rank)}
          className={`h-7 min-w-7 rounded-md border px-1.5 text-xs disabled:cursor-not-allowed ${
            value === rank ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          {GUIDE_LANGUAGE_PRIORITY_LABEL[rank]}
        </button>
      ))}
    </div>
  )
}

export function showsGuideProductSkills(position: string | null | undefined): boolean {
  const value = String(position || '').trim().toLowerCase()
  if (!value) return true
  return (
    value.includes('guide') ||
    value.includes('가이드') ||
    value.includes('driver') ||
    value.includes('드라이버') ||
    value.includes('assistant') ||
    value.includes('어시')
  )
}
