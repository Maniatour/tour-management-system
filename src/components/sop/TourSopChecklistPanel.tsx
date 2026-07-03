'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { parseSopDocumentJson, sopText, type SopEditLocale } from '@/types/sopStructure'
import {
  computeTourChecklistProgress,
  groupResolvedChecklistItems,
  labelForChecklistItem,
  resolveProductChecklistItems,
  type SopProductChecklistAssignmentRow,
  type SopTourChecklistCompletionRow,
} from '@/lib/sopTourChecklist'
import { cn } from '@/lib/utils'

export type TourSopChecklistMode = 'guide' | 'admin'

type Props = {
  tourId: string
  productId: string | null | undefined
  tourDate: string
  locale: string
  mode?: TourSopChecklistMode
}

function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export default function TourSopChecklistPanel({
  tourId,
  productId,
  tourDate,
  locale,
  mode = 'guide',
}: Props) {
  const isEn = locale === 'en'
  const viewLang: SopEditLocale = isEn ? 'en' : 'ko'
  const readonly = mode === 'admin'
  const { authUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<SopProductChecklistAssignmentRow[]>([])
  const [completions, setCompletions] = useState<Map<string, SopTourChecklistCompletionRow>>(new Map())
  const [structureDoc, setStructureDoc] = useState<ReturnType<typeof parseSopDocumentJson>>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!productId) {
      setLoading(false)
      setAssignments([])
      setCompletions(new Map())
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      const [{ data: assignData, error: assignErr }, { data: compData, error: compErr }, { data: sopData, error: sopErr }] =
        await Promise.all([
          supabase
            .from('sop_product_checklist_items')
            .select('id, product_id, sop_version_id, section_id, category_id, item_id, sort_order, is_required')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('sop_tour_checklist_completions')
            .select('id, tour_id, item_id, completed_at, completed_by, completed_by_email')
            .eq('tour_id', tourId),
          supabase
            .from('company_sop_versions')
            .select('body_structure')
            .order('published_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

      if (assignErr) throw assignErr
      if (compErr) throw compErr
      if (sopErr) throw sopErr

      setAssignments((assignData || []) as SopProductChecklistAssignmentRow[])
      const compMap = new Map<string, SopTourChecklistCompletionRow>()
      for (const row of (compData || []) as SopTourChecklistCompletionRow[]) {
        compMap.set(row.item_id, row)
      }
      setCompletions(compMap)
      setStructureDoc(parseSopDocumentJson(sopData?.body_structure))
    } catch (e) {
      console.warn('tour sop checklist load:', e)
      setErrorMsg(isEn ? 'Could not load checklist.' : '체크리스트를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [productId, tourId, isEn])

  useEffect(() => {
    void load()
  }, [load])

  const resolved = useMemo(
    () => resolveProductChecklistItems(assignments, structureDoc),
    [assignments, structureDoc]
  )
  const grouped = useMemo(() => groupResolvedChecklistItems(resolved), [resolved])

  const completedIds = useMemo(() => new Set(completions.keys()), [completions])
  const progress = useMemo(
    () => computeTourChecklistProgress(assignments, completedIds),
    [assignments, completedIds]
  )
  const pct = progressPercent(progress.done, progress.total)

  const showIncompleteAlert = useMemo(() => {
    if (progress.total === 0 || progress.isComplete) return false
    const todayStr = new Date().toISOString().slice(0, 10)
    return tourDate <= todayStr
  }, [progress, tourDate])

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const toggleItem = async (itemId: string, checked: boolean) => {
    if (readonly || !authUser?.email) return
    setBusyItemId(itemId)
    setErrorMsg(null)
    try {
      if (checked) {
        const { data, error } = await supabase
          .from('sop_tour_checklist_completions')
          .insert({
            tour_id: tourId,
            item_id: itemId,
            completed_by: authUser.id,
            completed_by_email: authUser.email,
          })
          .select('id, tour_id, item_id, completed_at, completed_by, completed_by_email')
          .single()
        if (error) throw error
        setCompletions((prev) => {
          const next = new Map(prev)
          next.set(itemId, data as SopTourChecklistCompletionRow)
          return next
        })
      } else {
        const { error } = await supabase
          .from('sop_tour_checklist_completions')
          .delete()
          .eq('tour_id', tourId)
          .eq('item_id', itemId)
        if (error) throw error
        setCompletions((prev) => {
          const next = new Map(prev)
          next.delete(itemId)
          return next
        })
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyItemId(null)
    }
  }

  if (!productId) {
    return (
      <p className="text-sm text-gray-500">
        {isEn ? 'This tour has no linked product.' : '연결된 상품이 없어 SOP 체크리스트를 표시할 수 없습니다.'}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-50" />
        <div className="h-24 rounded-lg bg-gray-50" />
      </div>
    )
  }

  if (progress.total === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isEn
          ? 'No SOP checklist is configured for this product.'
          : '이 상품에 연결된 SOP 체크리스트가 없습니다.'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* 진행 요약 */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {isEn ? 'Checklist progress' : '체크리스트 진행'}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {isEn
                ? `${progress.done} of ${progress.total} items · required ${progress.requiredDone}/${progress.required}`
                : `전체 ${progress.done}/${progress.total} · 필수 ${progress.requiredDone}/${progress.required}`}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              progress.isComplete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
            )}
          >
            {progress.isComplete
              ? isEn
                ? 'Complete'
                : '완료'
              : isEn
                ? `${pct}% done`
                : `${pct}% 완료`}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              progress.isComplete ? 'bg-green-500' : 'bg-indigo-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {showIncompleteAlert ? (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            {readonly
              ? isEn
                ? `Guide has not finished required items (${progress.requiredDone}/${progress.required}).`
                : `가이드 필수 체크 미완료 (${progress.requiredDone}/${progress.required}).`
              : isEn
                ? `Required checklist incomplete. Please finish before closing the tour.`
                : `필수 체크리스트가 아직 완료되지 않았습니다. 투어 마무리 전에 체크해 주세요.`}
          </p>
        </div>
      ) : null}

      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

      {/* 섹션별 아코디언 */}
      <div className="space-y-2">
        {grouped.map((sec) => {
          const secLabel =
            sopText(sec.section_title_ko, sec.section_title_en, viewLang).trim() ||
            (isEn ? 'Section' : '섹션')
          const secDone = sec.categories.reduce(
            (n, cat) => n + cat.items.filter((i) => completions.has(i.item_id)).length,
            0
          )
          const secTotal = sec.categories.reduce((n, cat) => n + cat.items.length, 0)
          const isCollapsed = collapsedSections.has(sec.section_id)

          return (
            <div key={sec.section_id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => toggleSection(sec.section_id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-indigo-900">{secLabel}</p>
                  <p className="text-xs text-gray-500">
                    {secDone}/{secTotal} {isEn ? 'checked' : '완료'}
                  </p>
                </div>
                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', isCollapsed && '-rotate-90')}
                />
              </button>

              {!isCollapsed ? (
                <div className="border-t border-gray-100 px-4 pb-3 pt-1">
                  {sec.categories.map((cat) => {
                    const catLabel =
                      sopText(cat.category_title_ko, cat.category_title_en, viewLang).trim() ||
                      (isEn ? 'Category' : '카테고리')
                    return (
                      <div key={cat.category_id} className="mt-3 first:mt-2">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                          {catLabel}
                        </p>
                        <ul className="space-y-0.5">
                          {cat.items.map((item) => {
                            const done = completions.get(item.item_id)
                            const line = labelForChecklistItem(item, viewLang)
                            const busy = busyItemId === item.item_id
                            const isDone = !!done

                            return (
                              <li
                                key={item.item_id}
                                className="rounded-md hover:bg-gray-50/80"
                                style={{ paddingLeft: item.depth * 12 }}
                              >
                                {readonly ? (
                                  <div className="flex items-start gap-2 px-2 py-1.5">
                                    {isDone ? (
                                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                    ) : (
                                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={cn(
                                          'text-sm',
                                          isDone ? 'text-gray-600 line-through' : 'text-gray-900'
                                        )}
                                      >
                                        {line}
                                      </span>
                                      {done ? (
                                        <p className="text-[10px] text-gray-500">
                                          {done.completed_by_email} ·{' '}
                                          {new Date(done.completed_at).toLocaleString(isEn ? 'en-US' : 'ko-KR')}
                                        </p>
                                      ) : item.is_required ? (
                                        <p className="text-[10px] font-medium text-amber-700">
                                          {isEn ? 'Required' : '필수'}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <label
                                      className={cn(
                                        'flex cursor-pointer items-start gap-2 px-2 py-1.5',
                                        busy && 'opacity-60'
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600"
                                        checked={isDone}
                                        disabled={busy}
                                        onChange={(e) => void toggleItem(item.item_id, e.target.checked)}
                                      />
                                      <span
                                        className={cn(
                                          'text-sm',
                                          isDone ? 'text-gray-500 line-through' : 'text-gray-900'
                                        )}
                                      >
                                        {line}
                                        {item.is_required && !isDone ? (
                                          <span className="ml-1 text-[10px] font-medium text-amber-700">
                                            ({isEn ? 'required' : '필수'})
                                          </span>
                                        ) : null}
                                      </span>
                                    </label>
                                    {done ? (
                                      <p className="ml-8 pb-1 text-[10px] text-gray-500">
                                        {new Date(done.completed_at).toLocaleString(isEn ? 'en-US' : 'ko-KR')}
                                      </p>
                                    ) : null}
                                  </>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
