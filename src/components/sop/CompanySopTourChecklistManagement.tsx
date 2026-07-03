'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, LayoutList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { parseSopDocumentJson, sopText, type SopEditLocale } from '@/types/sopStructure'
import CompanySopTourChecklistCompliancePanel from '@/components/sop/CompanySopTourChecklistCompliancePanel'
import {
  labelForChecklistItem,
  sopChecklistAvailableRows,
  type SopProductChecklistAssignmentRow,
} from '@/lib/sopTourChecklist'
import { cn } from '@/lib/utils'

type ProductRow = {
  id: string
  name_ko: string | null
  name_en: string | null
  name: string
  product_code: string | null
}

type SopVersionRow = {
  id: string
  version_number: number
  title: string
  body_structure: unknown
}

export default function CompanySopTourChecklistManagement({
  uiLocaleEn,
  locale,
}: {
  uiLocaleEn: boolean
  locale: string
}) {
  const [panelTab, setPanelTab] = useState<'template' | 'compliance'>('template')
  const viewLang: SopEditLocale = uiLocaleEn ? 'en' : 'ko'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [sopVersion, setSopVersion] = useState<SopVersionRow | null>(null)
  const [assignments, setAssignments] = useState<SopProductChecklistAssignmentRow[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set())

  const structureDoc = useMemo(
    () => (sopVersion ? parseSopDocumentJson(sopVersion.body_structure) : null),
    [sopVersion]
  )

  const availableRows = useMemo(
    () => (structureDoc ? sopChecklistAvailableRows(structureDoc) : []),
    [structureDoc]
  )

  const loadBase = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [{ data: productData, error: productErr }, { data: sopData, error: sopErr }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name_ko, name_en, name, product_code')
          .order('name_ko', { ascending: true })
          .limit(400),
        supabase
          .from('company_sop_versions')
          .select('id, version_number, title, body_structure')
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (productErr) throw productErr
      if (sopErr) throw sopErr

      setProducts((productData || []) as ProductRow[])
      setSopVersion((sopData as SopVersionRow | null) ?? null)
    } catch (e) {
      console.warn('sop tour checklist base load:', e)
      setErrorMsg(uiLocaleEn ? 'Could not load products or SOP.' : '상품·SOP를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [uiLocaleEn])

  const loadAssignments = useCallback(async (productId: string) => {
    if (!productId) {
      setAssignments([])
      setSelectedItemIds(new Set())
      return
    }
    const { data, error } = await supabase
      .from('sop_product_checklist_items')
      .select('id, product_id, sop_version_id, section_id, category_id, item_id, sort_order, is_required')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })

    if (error) {
      setErrorMsg(error.message)
      return
    }
    const rows = (data || []) as SopProductChecklistAssignmentRow[]
    setAssignments(rows)
    setSelectedItemIds(new Set(rows.map((r) => r.item_id)))
  }, [])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    if (!selectedProductId) return
    void loadAssignments(selectedProductId)
  }, [selectedProductId, loadAssignments])

  const productLabel = (p: ProductRow) => {
    const name = uiLocaleEn ? p.name_en || p.name_ko || p.name : p.name_ko || p.name_en || p.name
    return p.product_code ? `${name} (${p.product_code})` : name
  }

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const saveAssignments = async () => {
    if (!selectedProductId || !sopVersion) return
    setSaving(true)
    setErrorMsg(null)
    setToast(null)
    try {
      const { error: delErr } = await supabase
        .from('sop_product_checklist_items')
        .delete()
        .eq('product_id', selectedProductId)
      if (delErr) throw delErr

      const selected = availableRows.filter((r) => selectedItemIds.has(r.item_id))
      if (selected.length > 0) {
        const payload = selected.map((r, idx) => ({
          product_id: selectedProductId,
          sop_version_id: sopVersion.id,
          section_id: r.section_id,
          category_id: r.category_id,
          item_id: r.item_id,
          sort_order: idx,
          is_required: true,
        }))
        const { error: insErr } = await supabase.from('sop_product_checklist_items').insert(payload)
        if (insErr) throw insErr
      }

      await loadAssignments(selectedProductId)
      setToast(
        uiLocaleEn
          ? `Saved ${selectedItemIds.size} checklist line(s) for this product.`
          : `이 상품에 체크 줄 ${selectedItemIds.size}개를 저장했습니다.`
      )
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const groupedAvailable = useMemo(() => {
    const map = new Map<string, typeof availableRows>()
    for (const row of availableRows) {
      const key = `${row.section_id}::${row.category_id}`
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [availableRows])

  const tabs = [
    {
      id: 'template' as const,
      label: uiLocaleEn ? 'Product template' : '상품 템플릿',
      icon: LayoutList,
      desc: uiLocaleEn ? 'Choose checklist lines per product' : '상품별 체크 항목 선택',
    },
    {
      id: 'compliance' as const,
      label: uiLocaleEn ? 'Tour completion' : '투어 이행 현황',
      icon: ClipboardList,
      desc: uiLocaleEn ? 'Track guide progress & send reminders' : '가이드 이행 현황·푸시 알림',
    },
  ]

  return (
    <div className="p-4 lg:p-6" role="tabpanel">
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = panelTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                active
                  ? 'border-indigo-300 bg-indigo-50/80 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
              onClick={() => setPanelTab(tab.id)}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', active ? 'text-indigo-600' : 'text-gray-400')} />
              <div>
                <p className={cn('text-sm font-semibold', active ? 'text-indigo-900' : 'text-gray-900')}>
                  {tab.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">{tab.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {panelTab === 'compliance' ? (
        <CompanySopTourChecklistCompliancePanel uiLocaleEn={uiLocaleEn} locale={locale} />
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">
              {uiLocaleEn ? 'Per-tour SOP checklists' : '투어별 SOP 체크리스트'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {uiLocaleEn
                ? 'Pick a product and choose SOP checklist lines. Guides see them on tour detail for that product.'
                : '상품을 고르고 SOP 체크 줄을 선택합니다. 해당 상품 투어 상세에서 가이드가 체크합니다.'}
            </p>
            {sopVersion ? (
              <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                SOP v{sopVersion.version_number} — {sopVersion.title}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                {uiLocaleEn ? 'No published SOP yet.' : '게시된 SOP가 없습니다.'}
              </p>
            )}
          </div>

          {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
          {toast ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{toast}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-600">{uiLocaleEn ? 'Loading…' : '불러오는 중…'}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
              {/* 좌측: 상품 선택 */}
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    {uiLocaleEn ? 'Product' : '상품'}
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">{uiLocaleEn ? 'Select a product…' : '상품 선택…'}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productLabel(p)}
                      </option>
                    ))}
                  </select>

                  {selectedProductId ? (
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{uiLocaleEn ? 'Selected' : '선택'}</span>
                        <span className="font-medium tabular-nums">{selectedItemIds.size}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{uiLocaleEn ? 'Saved' : '저장됨'}</span>
                        <span className="font-medium tabular-nums">{assignments.length}</span>
                      </div>
                      <div className="flex flex-col gap-2 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedItemIds(new Set(availableRows.map((r) => r.item_id)))}
                        >
                          {uiLocaleEn ? 'Select all' : '전체 선택'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedItemIds(new Set())}>
                          {uiLocaleEn ? 'Clear all' : '전체 해제'}
                        </Button>
                        <Button type="button" disabled={saving || !sopVersion} onClick={() => void saveAssignments()}>
                          {saving
                            ? uiLocaleEn
                              ? 'Saving…'
                              : '저장 중…'
                            : uiLocaleEn
                              ? 'Save template'
                              : '템플릿 저장'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 우측: 체크리스트 목록 */}
              <div className="min-w-0">
                {!selectedProductId ? (
                  <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 text-sm text-gray-500">
                    {uiLocaleEn ? 'Select a product to edit its checklist template.' : '상품을 선택하면 체크리스트 템플릿을 편집할 수 있습니다.'}
                  </div>
                ) : availableRows.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
                    {uiLocaleEn
                      ? 'The latest SOP has no checklist lines. Add checklist items in SOP structure first.'
                      : '최신 SOP에 체크 줄이 없습니다. SOP 구조 편집에서 체크 항목을 먼저 추가하세요.'}
                  </div>
                ) : (
                  <div className="max-h-[min(60vh,640px)] space-y-3 overflow-y-auto pr-1">
                    {groupedAvailable.map(([key, rows]) => {
                      const first = rows[0]
                      const sectionLabel =
                        sopText(first.section_title_ko, first.section_title_en, viewLang).trim() ||
                        (uiLocaleEn ? 'Section' : '섹션')
                      const categoryLabel =
                        sopText(first.category_title_ko, first.category_title_en, viewLang).trim() ||
                        (uiLocaleEn ? 'Category' : '카테고리')
                      const groupSelected = rows.filter((r) => selectedItemIds.has(r.item_id)).length
                      return (
                        <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{sectionLabel}</p>
                              <p className="text-sm font-medium text-gray-900">{categoryLabel}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-700">
                              {groupSelected}/{rows.length}
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {rows.map((row) => {
                              const checked = selectedItemIds.has(row.item_id)
                              const line = labelForChecklistItem(row, viewLang)
                              return (
                                <li key={row.item_id}>
                                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                                      checked={checked}
                                      onChange={() => toggleItem(row.item_id)}
                                    />
                                    <span className="text-sm text-gray-800">{line}</span>
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
