'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import {
  ADMIN_TODO_LIST_MANUAL_INTRO,
  ADMIN_TODO_LIST_MANUAL_SECTIONS,
  type AdminTodoListManualSection,
} from '@/lib/adminTodoListManual'

type AdminTodoListManualModalProps = {
  open: boolean
  onClose: () => void
  locale: string
}

function ManualSectionCard({
  section,
  isKo,
  expanded,
  onToggle,
}: {
  section: AdminTodoListManualSection
  isKo: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const title = isKo ? section.titleKo : section.titleEn
  const category = isKo ? section.categoryKo : section.categoryEn
  const department = isKo ? section.departmentKo : section.departmentEn
  const filters = isKo ? section.filterLinesKo : section.filterLinesEn
  const workflow = isKo ? section.workflowLinesKo : section.workflowLinesEn
  const complete = isKo ? section.completeKo : section.completeEn

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              {category}
            </span>
            {department ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                {department}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-gray-100 bg-slate-50/60 px-4 py-3 text-sm text-gray-700">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {isKo ? '표시 조건' : 'Queue filters'}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {filters.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          {workflow && workflow.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {isKo ? '워크플로' : 'Workflow'}
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                {workflow.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2">
            <p className="text-xs font-semibold text-emerald-900">{isKo ? '완료 조건' : 'Done when'}</p>
            <p className="mt-0.5 text-sm text-emerald-950">{complete}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AdminTodoListManualModal({ open, onClose, locale }: AdminTodoListManualModalProps) {
  const isKo = locale === 'ko'
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const intro = ADMIN_TODO_LIST_MANUAL_INTRO
  const listFilters = isKo ? intro.listFiltersKo : intro.listFiltersEn

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ADMIN_TODO_LIST_MANUAL_SECTIONS
    return ADMIN_TODO_LIST_MANUAL_SECTIONS.filter((section) => {
      const blob = [
        section.titleKo,
        section.titleEn,
        section.categoryKo,
        section.categoryEn,
        ...(section.filterLinesKo || []),
        ...(section.filterLinesEn || []),
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [query])

  if (!open) return null

  const toggleSection = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    setExpandedIds(new Set(filteredSections.map((s) => s.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white">
          <div className="flex min-w-0 items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 opacity-90" />
            <div>
              <h2 className="text-lg font-bold">{isKo ? intro.titleKo : intro.titleEn}</h2>
              <p className="mt-0.5 text-xs text-white/85">
                {isKo
                  ? '고정 업무 패널별 큐 필터·워크플로·완료 조건'
                  : 'Queue filters, workflow, and completion rules per built-in panel'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/15"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-gray-100 bg-slate-50 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isKo ? '패널 이름·조건 검색…' : 'Search panels or filters…'}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {isKo ? '전체 펼치기' : 'Expand all'}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {isKo ? '전체 접기' : 'Collapse all'}
            </button>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-950">{isKo ? '목록 공통' : 'List-wide rules'}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-950/90">
              {listFilters.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {filteredSections.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              {isKo ? '검색 결과가 없습니다.' : 'No matching panels.'}
            </p>
          ) : (
            filteredSections.map((section) => (
              <ManualSectionCard
                key={section.id}
                section={section}
                isKo={isKo}
                expanded={expandedIds.has(section.id)}
                onToggle={() => toggleSection(section.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminTodoListManualButton({
  locale,
  className = '',
}: {
  locale: string
  className?: string
}) {
  const isKo = locale === 'ko'
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 ${className}`}
        title={isKo ? 'Todo List 매뉴얼' : 'Todo List manual'}
      >
        <BookOpen className="h-3.5 w-3.5" />
        {isKo ? '매뉴얼' : 'Manual'}
      </button>
      <AdminTodoListManualModal open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  )
}
