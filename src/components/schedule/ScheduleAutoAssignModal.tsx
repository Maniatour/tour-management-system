'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, RefreshCw, Users, X } from 'lucide-react'
import ScheduleAutoAssignGuidePlanModal, {
  persistGuidePlan,
  readStoredGuidePlan,
  type AutoAssignGuideChoice,
} from '@/components/schedule/ScheduleAutoAssignGuidePlanModal'
import { mergeGuidePlan, sameGuidePlan } from '@/lib/schedule/autoAssignGuidePlan'
import {
  assignmentSignature,
  AUTO_ASSIGN_EXISTING_LABEL,
  AUTO_ASSIGN_LATER_LINES,
  AUTO_ASSIGN_PRESET_LABEL,
  AUTO_ASSIGN_RULE_LINES,
  type AutoAssignExistingMode,
  type AutoAssignGuidePlanEntry,
  type AutoAssignPreset,
  type AutoAssignResult,
} from '@/lib/schedule/autoAssignSchedule'
import type { AutoAssignPreviewData } from '@/lib/schedule/autoAssignScheduleInput'

type ModalFrame = { top: number; left: number; width: number; height: number }

const MODAL_SIZE_STORAGE_KEY = 'tms-auto-assign-preview-size'

function readSavedModalSize(): { width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(MODAL_SIZE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown }
    const width = Number(parsed.width)
    const height = Number(parsed.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 640 || height < 420) return null
    return { width, height }
  } catch {
    return null
  }
}

function writeSavedModalSize(width: number, height: number) {
  try {
    localStorage.setItem(MODAL_SIZE_STORAGE_KEY, JSON.stringify({ width, height }))
  } catch {
    // 저장할 수 없어도 이번 창 크기는 유지한다.
  }
}

function readSidebarWidth(): number {
  const nodes = document.querySelectorAll('.app-sidebar-shell, .app-sidebar-shell--collapsed')
  let width = 0
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect()
    if (rect.width > width && rect.left < 40) width = rect.width
  })
  return Math.round(width)
}

function defaultModalFrame(): ModalFrame {
  if (window.innerWidth < 768) {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  }
  const sidebarWidth = readSidebarWidth()
  const headerHeight = 64
  const availableWidth = Math.max(640, window.innerWidth - sidebarWidth - 16)
  const saved = readSavedModalSize()
  const width = Math.round(
    Math.min(availableWidth - 8, Math.max(640, saved?.width ?? Math.max(720, availableWidth * 0.98))),
  )
  const height = Math.round(
    Math.min(
      window.innerHeight - headerHeight - 16,
      Math.max(420, saved?.height ?? Math.max(480, (window.innerHeight - headerHeight) * 0.92)),
    ),
  )
  return {
    top: Math.round(headerHeight + Math.max(8, (window.innerHeight - headerHeight - height) / 2)),
    left: Math.round(sidebarWidth + Math.max(8, (availableWidth - width) / 2)),
    width,
    height,
  }
}

type ScheduleAutoAssignModalProps = {
  open: boolean
  initialStart: string
  initialEnd: string
  onClose: () => void
  onGenerate: (args: {
    startDate: string
    endDate: string
    preset: AutoAssignPreset
    variant?: number
    previousSignature?: string | null
    existingMode?: AutoAssignExistingMode
    guidePlan?: AutoAssignGuidePlanEntry[]
  }) => Promise<AutoAssignPreviewData>
  onApply: (result: AutoAssignResult) => void
  renderPreview: (preview: AutoAssignPreviewData) => ReactNode
  guides: AutoAssignGuideChoice[]
}

export default function ScheduleAutoAssignModal({
  open,
  initialStart,
  initialEnd,
  onClose,
  onGenerate,
  onApply,
  renderPreview,
  guides,
}: ScheduleAutoAssignModalProps) {
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)
  const [preset, setPreset] = useState<AutoAssignPreset>('equal')
  const [existingMode, setExistingMode] = useState<AutoAssignExistingMode>('reset')
  const [helpOpen, setHelpOpen] = useState(false)
  const [guidePlanOpen, setGuidePlanOpen] = useState(false)
  const [guidePlan, setGuidePlan] = useState<AutoAssignGuidePlanEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<AutoAssignPreviewData | null>(null)
  const [frame, setFrame] = useState<ModalFrame>({ top: 16, left: 16, width: 1100, height: 760 })
  const [sidebarWidth, setSidebarWidth] = useState(0)
  const dragRef = useRef<{ mode: 'move' | 'right' | 'bottom' | 'corner'; x: number; y: number; frame: ModalFrame } | null>(null)
  const resizedRef = useRef<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!open) return
    setStartDate(initialStart)
    setEndDate(initialEnd)
    setPreset('equal')
    setExistingMode('reset')
    setPreview(null)
    setError('')
    setHelpOpen(false)
    setSidebarWidth(readSidebarWidth())
    setFrame(defaultModalFrame())
  }, [open, initialStart, initialEnd])

  const guideKey = guides.map((guide) => `${guide.email}\t${guide.name}`).join('\n')
  useEffect(() => {
    if (!guides.length) return
    setGuidePlan((current) => {
      const stored = readStoredGuidePlan()
      const next = mergeGuidePlan(guides, stored.length > 0 ? stored : current)
      return sameGuidePlan(next, current) ? current : next
    })
  }, [guideKey])

  const updateGuidePlan = (next: AutoAssignGuidePlanEntry[]) => {
    setGuidePlan(next)
    persistGuidePlan(next)
  }

  const generate = async (
    nextPreset = preset,
    nextStart = startDate,
    nextEnd = endDate,
    nextVariant = 0,
    previousSignature: string | null = null,
    nextExistingMode: AutoAssignExistingMode = existingMode,
    nextPlan: AutoAssignGuidePlanEntry[] = guidePlan,
  ) => {
    setLoading(true)
    setError('')
    try {
      const data = await onGenerate({
        startDate: nextStart,
        endDate: nextEnd,
        preset: nextPreset,
        variant: nextVariant,
        previousSignature,
        existingMode: nextExistingMode,
        ...(nextPlan.length > 0 ? { guidePlan: nextPlan } : {}),
      })
      setPreview(data)
      if (data.dates[0]) setStartDate(data.dates[0])
      const lastDate = data.dates[data.dates.length - 1]
      if (lastDate) setEndDate(lastDate)
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : '자동 배정을 만들지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const beginDrag = (mode: 'move' | 'right' | 'bottom' | 'corner') => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === 'move') {
      const target = event.target as HTMLElement
      if (target.closest('button, a, input, label, textarea, select')) return
    }
    event.preventDefault()
    dragRef.current = { mode, x: event.clientX, y: event.clientY, frame }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 포인터 캡처를 지원하지 않아도 헤더 위 드래그는 동작한다.
    }
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.mode === 'move') {
      const nextLeft = drag.frame.left + event.clientX - drag.x
      const nextTop = drag.frame.top + event.clientY - drag.y
      setFrame({
        ...drag.frame,
        left: Math.max(8 - drag.frame.width + 160, Math.min(window.innerWidth - 160, nextLeft)),
        top: Math.max(8, Math.min(window.innerHeight - 56, nextTop)),
      })
      return
    }
    const maxWidth = window.innerWidth - drag.frame.left - 8
    const maxHeight = window.innerHeight - drag.frame.top - 8
    const minWidth = window.innerWidth < 768 ? Math.min(320, window.innerWidth) : 640
    const minHeight = window.innerWidth < 768 ? Math.min(360, window.innerHeight) : 420
    const next = {
      ...drag.frame,
      width:
        drag.mode === 'bottom'
          ? drag.frame.width
          : Math.max(minWidth, Math.min(maxWidth, drag.frame.width + event.clientX - drag.x)),
      height:
        drag.mode === 'right'
          ? drag.frame.height
          : Math.max(minHeight, Math.min(maxHeight, drag.frame.height + event.clientY - drag.y)),
    }
    resizedRef.current = { width: next.width, height: next.height }
    setFrame(next)
  }

  const endResize = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag && drag.mode !== 'move' && resizedRef.current) {
      writeSavedModalSize(resizedRef.current.width, resizedRef.current.height)
    }
  }

  if (!open) return null

  const filled = preview?.result.slots.filter((slot) => slot.email && !slot.unfilledReason).length ?? 0
  const unfilled = preview?.result.slots.filter((slot) => slot.unfilledReason).length ?? 0

  const modal = (
    <div className="fixed inset-0 z-[10060]" style={{ left: sidebarWidth, pointerEvents: 'none' }}>
      <div className="absolute inset-0 bg-black/40" style={{ pointerEvents: 'auto' }} />
      <div
        className="fixed flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height, pointerEvents: 'auto' }}
      >
        <div
          className="flex cursor-grab items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 active:cursor-grabbing sm:px-6"
          onPointerDown={beginDrag('move')}
          onPointerMove={moveResize}
          onPointerUp={endResize}
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">자동 배정 미리보기</h2>
              <button
                type="button"
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                aria-label="자동 배정 규칙"
                onClick={() => setHelpOpen((value) => !value)}
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              앞 3일은 이미 배정된 스케줄과 신청·승인된 오프입니다. 시작일부터 종료일만 다시 배정하며, 적용 전에는 현재 스케줄이 바뀌지 않습니다.
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="닫기" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {helpOpen ? (
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 sm:px-6">
            <ul className="space-y-1">
              {AUTO_ASSIGN_RULE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-gray-500">아직 쓰지 않는 조건</p>
            <ul className="mt-1 space-y-1 text-xs text-gray-500">
              {AUTO_ASSIGN_LATER_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-3 py-3 sm:gap-3 sm:px-6">
          <label className="text-xs text-gray-600">
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 block h-10 rounded-xl border border-gray-300 px-3 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 block h-10 rounded-xl border border-gray-300 px-3 text-sm"
            />
          </label>
          <div className="flex rounded-xl border border-gray-200 p-1">
            {(Object.keys(AUTO_ASSIGN_PRESET_LABEL) as AutoAssignPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${preset === key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                onClick={() => {
                  setPreset(key)
                  if (preview) void generate(key, startDate, endDate, 0, null, existingMode)
                }}
              >
                {AUTO_ASSIGN_PRESET_LABEL[key]}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-gray-200 p-1">
            {(Object.keys(AUTO_ASSIGN_EXISTING_LABEL) as AutoAssignExistingMode[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${existingMode === key ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                onClick={() => {
                  setExistingMode(key)
                  if (preview) void generate(preset, startDate, endDate, 0, null, key)
                }}
              >
                {AUTO_ASSIGN_EXISTING_LABEL[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const stored = readStoredGuidePlan()
              setGuidePlan((current) => mergeGuidePlan(guides, stored.length > 0 ? stored : current))
              setGuidePlanOpen(true)
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" />
            가이드 선택
            {guidePlan.some((entry) => entry.rank === 'standby')
              ? ` · 제외 ${guidePlan.filter((entry) => entry.rank === 'standby').length}`
              : ''}
          </button>
          <button
            type="button"
            disabled={loading || !startDate || !endDate}
            onClick={() => void generate(preset, startDate, endDate, 0, null, existingMode)}
            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '생성 중' : '미리보기 생성'}
          </button>
          {preview ? (
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void generate(
                  preset,
                  startDate,
                  endDate,
                  (preview.result.variant ?? 0) + 1,
                  assignmentSignature(preview.result.assignmentsByTourId),
                  existingMode,
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              다른 배정
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-4">
          {error ? <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {preset === 'reviews' ? (
            <p className="mb-3 text-sm text-gray-600">
              후기 순은 지난달 투어의 평점과 인원별 리뷰율을 함께 봅니다. 배정 인원 대비 후기가 적으면 5점이어도 뒤로 갑니다.
            </p>
          ) : null}
          <p className="mb-3 text-sm text-gray-600">
            {existingMode === 'keep'
              ? '기존 배정 유지는 이미 들어간 사람을 두고, 그 사람이 비는 칸만 채웁니다.'
              : '기존 배정 리셋은 잠긴 배정만 남기고 그 날짜의 배정을 비운 뒤, 같은 날짜에 다시 배정합니다.'}
          </p>
          {preview?.result.reviewStatsUnavailable ? (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              후기 통계를 읽지 못해 균등 배정으로 만들었습니다.
            </p>
          ) : null}
          {preview ? (
            <div>
              <p className="mb-3 text-sm text-gray-600">
                배정 {filled}칸 · 비어 있음 {unfilled}칸 · {AUTO_ASSIGN_PRESET_LABEL[preview.result.effectivePreset]} ·{' '}
                {AUTO_ASSIGN_EXISTING_LABEL[existingMode]} · 안 {(preview.result.variant ?? 0) + 1}
                {preview.contextDates.length > 0 ? ' · 앞 3일은 기존 배정·오프' : ''}
              </p>
              {preview.result.alternativeExhausted ? (
                <p className="mb-3 text-sm text-gray-600">이 조건에서는 더 다른 배정이 없습니다. 같은 안을 다시 보여 줍니다.</p>
              ) : null}
              {renderPreview(preview)}
            </div>
          ) : (
            <p className="text-sm text-gray-500">기간은 최대 2주입니다. 미리보기를 만든 뒤 칸에 마우스를 올리면 배정 이유를 볼 수 있습니다.</p>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50">
            닫기
          </button>
          <button
            type="button"
            disabled={!preview || loading}
            onClick={() => preview && onApply(preview.result)}
            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            적용
          </button>
        </div>
        <div
          className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize"
          onPointerDown={beginDrag('right')}
          onPointerMove={moveResize}
          onPointerUp={endResize}
        />
        <div
          className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize"
          onPointerDown={beginDrag('bottom')}
          onPointerMove={moveResize}
          onPointerUp={endResize}
        />
        <div
          role="separator"
          aria-label="미리보기 크기 조절"
          className="absolute bottom-1 right-1 z-30 h-4 w-4 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-gray-400"
          onPointerDown={beginDrag('corner')}
          onPointerMove={moveResize}
          onPointerUp={endResize}
        />
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modal, document.body)}
      <ScheduleAutoAssignGuidePlanModal
        open={guidePlanOpen}
        guides={guides}
        plan={guidePlan}
        onChange={updateGuidePlan}
        onClose={() => {
          persistGuidePlan(guidePlan)
          setGuidePlanOpen(false)
          if (preview) void generate()
        }}
      />
    </>
  )
}
