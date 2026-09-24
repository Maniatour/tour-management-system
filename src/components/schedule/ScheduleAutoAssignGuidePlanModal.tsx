'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { GripVertical, X } from 'lucide-react'
import { mergeGuidePlan, type AutoAssignGuideChoice } from '@/lib/schedule/autoAssignGuidePlan'
import type { AutoAssignGuidePlanEntry, AutoAssignGuideRank, AutoAssignWeeklyLoad } from '@/lib/schedule/autoAssignSchedule'

const STORAGE_KEY = 'tms-auto-assign-guide-plan'

const RANKS: Array<{ id: AutoAssignGuideRank; title: string; hint: string; className: string }> = [
  { id: 'priority', title: '우선', hint: '횟수가 같을 때만 조금 먼저 받습니다', className: 'border-blue-200 bg-blue-50/70' },
  { id: 'normal', title: '일반', hint: '균등 배정의 기본 몫입니다', className: 'border-gray-200 bg-white' },
  { id: 'low', title: '하위', hint: '횟수가 같을 때만 조금 뒤로 갑니다', className: 'border-amber-200 bg-amber-50/70' },
]

const LOADS: AutoAssignWeeklyLoad[] = [1, 2, 3]

export type { AutoAssignGuideChoice }

export function readStoredGuidePlan(): AutoAssignGuidePlanEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { entries?: AutoAssignGuidePlanEntry[] }
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

function writeStoredPlan(entries: AutoAssignGuidePlanEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }))
  } catch {
    // 저장이 안 되어도 이번 배정에는 현재 선택을 쓴다.
  }
}

function loadLabel(load: AutoAssignWeeklyLoad): string {
  return load >= 3 ? '주 3+' : `주 ${load}`
}

type ScheduleAutoAssignGuidePlanModalProps = {
  open: boolean
  guides: AutoAssignGuideChoice[]
  plan: AutoAssignGuidePlanEntry[]
  onClose: () => void
  onChange: (plan: AutoAssignGuidePlanEntry[]) => void
}

export default function ScheduleAutoAssignGuidePlanModal({
  open,
  guides,
  plan,
  onClose,
  onChange,
}: ScheduleAutoAssignGuidePlanModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const nameByEmail = useMemo(() => {
    const map = new Map<string, string>()
    for (const guide of guides) map.set(guide.email.trim().toLowerCase(), guide.name || guide.email)
    return map
  }, [guides])

  if (!open || !mounted) return null

  const rowsOf = (rank: AutoAssignGuideRank) => plan.filter((entry) => entry.rank === rank)

  const move = (result: DropResult) => {
    const destination = result.destination
    if (!destination) return
    const rank = destination.droppableId as AutoAssignGuideRank
    const sourceRank = result.source.droppableId as AutoAssignGuideRank
    if (sourceRank === rank && result.source.index === destination.index) return
    if (rank !== 'standby' && rank !== 'priority' && rank !== 'normal' && rank !== 'low') return
    const columns: Record<AutoAssignGuideRank, AutoAssignGuidePlanEntry[]> = {
      standby: [...rowsOf('standby')],
      priority: [...rowsOf('priority')],
      normal: [...rowsOf('normal')],
      low: [...rowsOf('low')],
    }
    const sourceItems = columns[sourceRank]
    const [moved] = sourceItems.splice(result.source.index, 1)
    if (!moved) return
    const targetItems = sourceRank === rank ? sourceItems : columns[rank]
    targetItems.splice(destination.index, 0, { ...moved, rank })
    onChange([...columns.standby, ...columns.priority, ...columns.normal, ...columns.low])
  }

  const setLoad = (email: string, weeklyLoad: AutoAssignWeeklyLoad) => {
    onChange(plan.map((entry) => (entry.email === email ? { ...entry, weeklyLoad } : entry)))
  }

  const modal = (
    <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[min(820px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">배정할 가이드</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              이름 뱃지를 끌어 우선, 일반, 하위에 넣습니다. 균등 배정에서는 이 순위가 배정을 가져가지 않고, 이번 구간 횟수가 같을 때만 조금 유리합니다.
              주 1회와 주 2회는 그 주를 넘기지 않습니다. 위쪽 배정 안 함에 둔 가이드는 다른 사람이 불가할 때만 배정합니다.
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="가이드 선택 닫기" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <DragDropContext onDragEnd={move}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <RankColumn
              rank="standby"
              title="배정 안 함"
              hint="Antony처럼 당분간 빼 두고, 정말 사람이 없을 때만 씁니다"
              className="border-dashed border-gray-300 bg-gray-50"
              entries={rowsOf('standby')}
              nameByEmail={nameByEmail}
              onLoad={setLoad}
            />
            <div className="grid gap-3 md:grid-cols-3">
              {RANKS.map((column) => (
                <RankColumn
                  key={column.id}
                  rank={column.id}
                  title={column.title}
                  hint={column.hint}
                  className={column.className}
                  entries={rowsOf(column.id)}
                  nameByEmail={nameByEmail}
                  onLoad={setLoad}
                />
              ))}
            </div>
          </div>
        </DragDropContext>
        <div className="flex justify-end border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
            이 순서로 배정
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function RankColumn({
  rank,
  title,
  hint,
  className,
  entries,
  nameByEmail,
  onLoad,
}: {
  rank: AutoAssignGuideRank
  title: string
  hint: string
  className: string
  entries: AutoAssignGuidePlanEntry[]
  nameByEmail: Map<string, string>
  onLoad: (email: string, load: AutoAssignWeeklyLoad) => void
}) {
  return (
    <section className={`rounded-2xl border p-3 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <span className="text-xs text-gray-500">{entries.length}명</span>
      </div>
      <p className="mb-3 text-xs leading-5 text-gray-500">{hint}</p>
      <Droppable droppableId={rank}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-24 flex-col gap-2 rounded-xl p-1 ${snapshot.isDraggingOver ? 'bg-blue-100/50' : ''}`}
          >
            {entries.map((entry, index) => {
              const name = nameByEmail.get(entry.email.trim().toLowerCase()) || entry.email
              return (
                <Draggable key={entry.email} draggableId={entry.email} index={index}>
                  {(drag, dragSnapshot) => {
                    const { style, ...dragProps } = drag.draggableProps
                    return (
                    <div
                      ref={drag.innerRef}
                      {...dragProps}
                      style={style as CSSProperties | undefined}
                      className={`flex w-fit max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-1.5 shadow-sm ${dragSnapshot.isDragging ? 'shadow-md' : ''}`}
                    >
                      <button type="button" className="rounded-full p-1 text-gray-400 hover:text-gray-700" aria-label={`${name} 이동`} {...drag.dragHandleProps}>
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                      <span className="max-w-36 truncate text-sm font-medium text-gray-900">{name}</span>
                      {rank === 'standby' ? null : (
                        <span className="ml-1 flex rounded-full bg-gray-100 p-0.5">
                          {LOADS.map((load) => (
                            <button
                              key={load}
                              type="button"
                              aria-label={`${name} ${loadLabel(load)}`}
                              aria-pressed={entry.weeklyLoad === load}
                              onClick={() => onLoad(entry.email, load)}
                              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${entry.weeklyLoad === load ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-white'}`}
                            >
                              {loadLabel(load)}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                    )
                  }}
                </Draggable>
              )
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  )
}

export function initialGuidePlan(guides: AutoAssignGuideChoice[]): AutoAssignGuidePlanEntry[] {
  return mergeGuidePlan(guides, readStoredGuidePlan())
}

export function persistGuidePlan(entries: AutoAssignGuidePlanEntry[]) {
  writeStoredPlan(entries)
}
