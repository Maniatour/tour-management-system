'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  BookOpen,
  Check,
  CheckCircle2,
  Edit,
  ExternalLink,
  Loader2,
  KeyRound,
  Maximize2,
  Megaphone,
  Minimize2,
  Pin,
  PinOff,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'
import {
  clampFloatingPanelPosition,
  clampFloatingPanelSize,
  defaultFloatingPanelPosition,
  fabBottomCss,
  FAB_RIGHT_PX,
  suggestFloatingPanelSize,
  ADMIN_FLOATING_FAB_Z_CLASS,
  type FloatingPanelSize,
} from '@/lib/adminFloatingFabLayout'
import { AdminFloatingPanelShell } from '@/components/admin/AdminFloatingPanelShell'
import { useAdminMobileViewport } from '@/hooks/useAdminMobileViewport'
import {
  announcementPriorityClass,
  getTaskPriorityBadge,
  getTaskPriorityBorderClass,
  getTeamMemberDisplayName,
  taskStatusLabel,
} from '@/lib/teamBoard/taskPresentation'
import { isAnnouncementFullyAcked } from '@/lib/teamBoard/teamBoardPermissions'
import type { TeamBoardAnnouncement, TeamBoardTask } from '@/lib/teamBoard/workTypes'
import {
  announcementToFormState,
  EMPTY_ANNOUNCEMENT_FORM,
  EMPTY_TASK_FORM,
  taskToFormState,
  useTeamBoardWorkData,
  type TeamBoardAnnouncementFormState,
  type TeamBoardTaskFormState,
} from '@/hooks/useTeamBoardWorkData'
import { TeamBoardWorkAnnouncementFormModal } from '@/components/admin/work/TeamBoardWorkAnnouncementFormModal'
import { TeamBoardWorkTaskFormModal } from '@/components/admin/work/TeamBoardWorkTaskFormModal'
import { AdminWorkHubDocumentsPanel } from '@/components/admin/work/AdminWorkHubDocumentsPanel'
import { AdminWorkCredentialVaultPanel } from '@/components/admin/work/AdminWorkCredentialVaultPanel'
import { canAccessStaffCredentialVault } from '@/lib/staffCredentialVault'

const STORAGE_KEY = 'adminWorkWidget'
const HEADER_HEIGHT = 50
const TAB_BAR_HEIGHT = 42
const DEFAULT_SIZE: FloatingPanelSize = { width: 400, height: 560 }
const MIN_SIZE: FloatingPanelSize = { width: 320, height: 400 }
const UPDATE_THROTTLE = 16
const FAB_STACK_INDEX = 1

type WorkTab = 'tasks' | 'announcements' | 'hub' | 'credentials'

function readSavedSize(): FloatingPanelSize {
  if (typeof window === 'undefined') return DEFAULT_SIZE
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}.size`)
    if (saved) {
      const parsed = JSON.parse(saved) as FloatingPanelSize
      if (
        Number.isFinite(parsed.width) &&
        Number.isFinite(parsed.height) &&
        parsed.width >= MIN_SIZE.width &&
        parsed.height >= MIN_SIZE.height
      ) {
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SIZE
}

function readSavedPosition(size: FloatingPanelSize): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}.position`)
    if (saved) {
      const parsed = JSON.parse(saved) as { x: number; y: number }
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        return clampFloatingPanelPosition(parsed.x, parsed.y, size, {
          stackIndex: FAB_STACK_INDEX,
        })
      }
    }
  } catch {
    /* ignore */
  }
  return defaultFloatingPanelPosition(size, { stackIndex: FAB_STACK_INDEX })
}

type AdminWorkFloatingWidgetProps = {
  locale: string
}

export default function AdminWorkFloatingWidget({ locale }: AdminWorkFloatingWidgetProps) {
  const isKo = locale === 'ko'
  const { authUser, hasPermission, userRole, userPosition } = useAuth()
  const manualCtx = useTeamBoardManualOptional()

  const canVault = useMemo(
    () =>
      canAccessStaffCredentialVault({
        userRole,
        userPosition,
        authUserEmail: authUser?.email,
      }),
    [authUser?.email, userPosition, userRole]
  )

  const visible = useMemo(() => {
    if (!authUser?.email) return false
    return hasPermission('canViewAdmin')
  }, [authUser?.email, hasPermission])

  const work = useTeamBoardWorkData({ enabled: visible, loadOnMount: false })
  const isMobile = useAdminMobileViewport()

  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkTab>('announcements')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const lastUpdateRef = useRef(0)

  const [position, setPosition] = useState(() => readSavedPosition(DEFAULT_SIZE))
  const [size, setSize] = useState<FloatingPanelSize>(readSavedSize)

  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit'>('create')
  const [taskForm, setTaskForm] = useState<TeamBoardTaskFormState>({ ...EMPTY_TASK_FORM })
  const [editingTask, setEditingTask] = useState<TeamBoardTask | null>(null)

  const [announcementFormOpen, setAnnouncementFormOpen] = useState(false)
  const [announcementFormMode, setAnnouncementFormMode] = useState<'create' | 'edit'>('create')
  const [announcementForm, setAnnouncementForm] = useState<TeamBoardAnnouncementFormState>({
    ...EMPTY_ANNOUNCEMENT_FORM,
  })
  const [editingAnnouncement, setEditingAnnouncement] = useState<TeamBoardAnnouncement | null>(null)

  const [expandedTaskSections, setExpandedTaskSections] = useState<Record<string, boolean>>({
    pending: true,
    in_progress: true,
  })
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [archivedModalSection, setArchivedModalSection] = useState<'tasks' | 'announcements'>('tasks')

  const openArchivedModal = (section: 'tasks' | 'announcements') => {
    setArchivedModalSection(section)
    setShowArchivedModal(true)
  }

  const taskArchivedStatusLabel = (task: TeamBoardTask) => {
    if (task.is_deleted) return isKo ? '삭제됨' : 'Deleted'
    if (task.status === 'completed') return isKo ? '완료됨' : 'Completed'
    if (task.status === 'cancelled') return isKo ? '취소됨' : 'Cancelled'
    return task.status
  }

  const announcementArchivedStatusLabel = (announcement: TeamBoardAnnouncement) => {
    if (announcement.is_deleted) return isKo ? '삭제됨' : 'Deleted'
    return isKo ? '완료됨' : 'Archived'
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm(isKo ? '정말로 이 업무를 삭제하시겠습니까?' : 'Delete this task?')) return
    const result = await work.deleteTaskSoft(taskId)
    if (result.error) alert(isKo ? '업무 삭제에 실패했습니다.' : 'Failed to delete task.')
  }

  const handleRestoreTask = async (taskId: string) => {
    const result = await work.restoreTask(taskId)
    if (result.error) alert(isKo ? '업무 복구에 실패했습니다.' : 'Failed to restore task.')
  }

  const handleRestoreAnnouncement = async (announcementId: string) => {
    const result = await work.restoreAnnouncement(announcementId)
    if (result.error) alert(isKo ? '전달사항 복구에 실패했습니다.' : 'Failed to restore announcement.')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${STORAGE_KEY}.position`, JSON.stringify(position))
  }, [position])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${STORAGE_KEY}.size`, JSON.stringify(size))
  }, [size])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onViewportChange = () => {
      setSize((prev) => {
        const next = clampFloatingPanelSize(
          prev.width,
          prev.height,
          MIN_SIZE,
          undefined,
          FAB_STACK_INDEX
        )
        setPosition((pos) =>
          clampFloatingPanelPosition(pos.x, pos.y, next, {
            minimized: isMinimized,
            headerHeight: HEADER_HEIGHT,
            stackIndex: FAB_STACK_INDEX,
          })
        )
        return next
      })
    }
    window.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
    }
  }, [isMinimized])

  useEffect(() => {
    setPosition((pos) =>
      clampFloatingPanelPosition(pos.x, pos.y, size, {
        minimized: isMinimized,
        headerHeight: HEADER_HEIGHT,
        stackIndex: FAB_STACK_INDEX,
      })
    )
  }, [size.height, size.width, isMinimized])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('[data-work-resize-handle]')) return
    if (e.target instanceof HTMLElement && e.target.closest('[data-work-drag-handle]')) {
      const rect = e.currentTarget.getBoundingClientRect()
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setIsDragging(true)
      e.preventDefault()
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || typeof window === 'undefined') return
      const now = performance.now()
      if (now - lastUpdateRef.current < UPDATE_THROTTLE) return
      lastUpdateRef.current = now
      const rawX = e.clientX - dragOffsetRef.current.x
      const rawY = e.clientY - dragOffsetRef.current.y
      setPosition(
        clampFloatingPanelPosition(rawX, rawY, size, {
          minimized: isMinimized,
          headerHeight: HEADER_HEIGHT,
          stackIndex: FAB_STACK_INDEX,
        })
      )
    },
    [isDragging, isMinimized, size]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
    setIsResizing(true)
  }

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || typeof window === 'undefined') return
      const now = performance.now()
      if (now - lastUpdateRef.current < UPDATE_THROTTLE) return
      lastUpdateRef.current = now
      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y
      const nextSize = clampFloatingPanelSize(
        resizeStartRef.current.width + deltaX,
        resizeStartRef.current.height + deltaY,
        MIN_SIZE,
        undefined,
        FAB_STACK_INDEX
      )
      setSize(nextSize)
      setPosition((pos) =>
        clampFloatingPanelPosition(pos.x, pos.y, nextSize, {
          stackIndex: FAB_STACK_INDEX,
        })
      )
    },
    [isResizing]
  )

  useEffect(() => {
    if (!isDragging && !isResizing) return
    const onMove = (e: MouseEvent) => {
      if (isResizing) handleResizeMove(e)
      else handleMouseMove(e)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, handleMouseMove, handleResizeMove, handleMouseUp])

  useEffect(() => {
    if (isMobile && isMinimized) setIsMinimized(false)
  }, [isMobile, isMinimized])

  const openWidget = () => {
    setPanelOpen(true)
    setIsMinimized(false)
    const nextSize = suggestFloatingPanelSize(MIN_SIZE, size, FAB_STACK_INDEX)
    setSize(nextSize)
    setPosition(
      defaultFloatingPanelPosition(nextSize, {
        stackIndex: FAB_STACK_INDEX,
        headerHeight: HEADER_HEIGHT,
      })
    )
    void work.loadAll()
  }

  const closeWidget = () => {
    setPanelOpen(false)
    setIsMinimized(false)
    setShowArchivedModal(false)
    setTaskFormOpen(false)
    setAnnouncementFormOpen(false)
    setEditingTask(null)
    setEditingAnnouncement(null)
  }

  const openCreateForm = () => {
    if (activeTab === 'hub' || activeTab === 'credentials') return
    if (activeTab === 'tasks') {
      setTaskFormMode('create')
      setTaskForm({ ...EMPTY_TASK_FORM })
      setEditingTask(null)
      setTaskFormOpen(true)
    } else {
      setAnnouncementFormMode('create')
      setAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM })
      setEditingAnnouncement(null)
      setAnnouncementFormOpen(true)
    }
  }

  const openEditTask = (task: TeamBoardTask) => {
    setTaskFormMode('edit')
    setEditingTask(task)
    setTaskForm(taskToFormState(task))
    setTaskFormOpen(true)
  }

  const openEditAnnouncement = (announcement: TeamBoardAnnouncement) => {
    setAnnouncementFormMode('edit')
    setEditingAnnouncement(announcement)
    setAnnouncementForm(announcementToFormState(announcement))
    setAnnouncementFormOpen(true)
  }

  const saveTaskForm = async () => {
    const result =
      taskFormMode === 'create'
        ? await work.createTask(taskForm)
        : editingTask
          ? await work.updateTask(editingTask.id, taskForm)
          : { error: 'invalid' as const }
    if (result.error) {
      alert(isKo ? '업무 저장에 실패했습니다.' : 'Failed to save task.')
      return
    }
    setTaskFormOpen(false)
    setEditingTask(null)
    setTaskForm({ ...EMPTY_TASK_FORM })
  }

  const saveAnnouncementForm = async () => {
    const result =
      announcementFormMode === 'create'
        ? await work.createAnnouncement(announcementForm)
        : editingAnnouncement
          ? await work.updateAnnouncement(editingAnnouncement.id, announcementForm)
          : { error: 'invalid' as const }
    if (result.error) {
      alert(isKo ? '전달사항 저장에 실패했습니다.' : 'Failed to save announcement.')
      return
    }
    setAnnouncementFormOpen(false)
    setEditingAnnouncement(null)
    setAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM })
  }

  if (!visible) return null

  const headerTitle = isKo ? '업무 관리' : 'Work Management'
  const workTabs = useMemo(() => {
    const tabs = [
      { id: 'announcements' as const, label: isKo ? '전달사항' : 'Notes', icon: Megaphone },
      { id: 'tasks' as const, label: isKo ? '업무' : 'Tasks', icon: Briefcase },
      ...(canVault
        ? [{ id: 'credentials' as const, label: isKo ? '로그인' : 'Logins', icon: KeyRound }]
        : []),
      { id: 'hub' as const, label: isKo ? '운영 허브' : 'Ops hub', icon: BookOpen },
    ]
    return tabs
  }, [canVault, isKo])

  const headerSubtitle = isKo
    ? `업무 ${work.activeTasks.length} · 전달 ${work.activeAnnouncements.length} · 허브 ${manualCtx?.hubArticles.length ?? 0}${canVault ? ' · 로그인 금고' : ''}`
    : `${work.activeTasks.length} tasks · ${work.activeAnnouncements.length} notes · ${manualCtx?.hubArticles.length ?? 0} docs${canVault ? ' · login vault' : ''}`

  const headerChrome = (
    <div
      data-work-drag-handle={isMobile ? undefined : true}
      className={`select-none bg-gradient-to-r from-sky-600 to-blue-700 text-white ${
        isMobile ? '' : `cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`
      } ${isMinimized && !isMobile ? 'rounded-lg' : isMobile ? '' : 'rounded-t-lg'}`}
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="flex h-full items-center justify-between px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {work.pendingBadgeCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {work.pendingBadgeCount > 99 ? '99+' : work.pendingBadgeCount}
            </span>
          )}
          <Briefcase className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{headerTitle}</p>
            <p className="truncate text-[10px] text-white/80">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {activeTab !== 'hub' && activeTab !== 'credentials' && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={openCreateForm}
              className="rounded p-1 transition-colors hover:bg-black/20"
              title={activeTab === 'tasks' ? (isKo ? '새 업무' : 'Add task') : isKo ? '새 전달사항' : 'Add note'}
              aria-label={isKo ? '새 항목 추가' : 'Add item'}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setIsMinimized((v) => !v)}
              className="rounded p-1 transition-colors hover:bg-black/20"
              title={isMinimized ? (isKo ? '펼치기' : 'Expand') : isKo ? '최소화' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={closeWidget}
            className="rounded p-1 transition-colors hover:bg-black/20"
            title={isKo ? '닫기' : 'Close'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  const tabBar = (
    <div
      className="flex shrink-0 border-b border-gray-200 bg-gray-50/90"
      style={{ height: TAB_BAR_HEIGHT }}
    >
      {workTabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveTab(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-medium transition-colors ${
            activeTab === id
              ? 'border-sky-600 bg-white text-sky-700'
              : 'border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )

  const tasksPanel = (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openArchivedModal('tasks')}
          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50"
        >
          {isKo ? '완료/삭제 보기' : 'Completed / deleted'}
        </button>
      </div>
      {(['pending', 'in_progress'] as const).map((status) => {
        const items = work.activeTasks.filter((task) => task.status === status)
        const expanded = expandedTaskSections[status]
        return (
          <div key={status} className="rounded-md border border-gray-200 bg-gray-50/80">
            <button
              type="button"
              onClick={() =>
                setExpandedTaskSections((prev) => ({ ...prev, [status]: !prev[status] }))
              }
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              <span>
                {taskStatusLabel(status, isKo)}{' '}
                <span className="text-gray-400">({items.length})</span>
              </span>
              <span className="text-gray-400">{expanded ? '−' : '+'}</span>
            </button>
            {expanded && (
              <div className="space-y-1.5 px-2 pb-2">
                {items.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-400">
                    {isKo ? '등록된 업무가 없습니다.' : 'No tasks.'}
                  </p>
                ) : (
                  items.map((task) => {
                    const badge = getTaskPriorityBadge(task.priority)
                    const hasManual = !!task.linked_hub_article_id?.trim()
                    return (
                      <div
                        key={task.id}
                        className={`relative rounded-lg border p-2.5 shadow-sm ${getTaskPriorityBorderClass(task.priority)} bg-white`}
                      >
                        <div className="absolute right-1.5 top-1.5 z-10 flex flex-row flex-nowrap items-center gap-0.5 rounded-md bg-white/95 px-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                          {work.canEditTask(task) && (
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary"
                              title={isKo ? '수정' : 'Edit'}
                            >
                              <Edit className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                          {status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void work.setTaskInProgress(task.id)}
                              className="rounded p-1 text-sky-600 hover:bg-sky-50"
                              title={isKo ? '진행' : 'Start'}
                            >
                              <Play className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                          {work.isAdminUser && (
                            <button
                              type="button"
                              onClick={() => void work.completeTask(task.id)}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                              title={isKo ? '완료' : 'Done'}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                          {work.isAdminUser && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteTask(task.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                              title={isKo ? '삭제' : 'Delete'}
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                        </div>

                        <div
                          role={hasManual ? 'button' : undefined}
                          tabIndex={hasManual ? 0 : undefined}
                          onClick={() => {
                            if (!hasManual) return
                            const selected = window.getSelection()?.toString()
                            if (selected) return
                            manualCtx?.openManual(task.linked_hub_article_id)
                          }}
                          onKeyDown={(e) => {
                            if (!hasManual) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              manualCtx?.openManual(task.linked_hub_article_id)
                            }
                          }}
                          className={`w-full min-w-0 select-text text-left ${hasManual ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {hasManual && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                                <BookOpen className="h-2.5 w-2.5" />
                                {isKo ? '메뉴얼' : 'Manual'}
                              </span>
                            )}
                            <h4 className="w-full break-words text-sm font-semibold leading-snug text-gray-900">
                              {task.title}
                            </h4>
                          </div>
                          {task.description && (
                            <p className="mt-1 w-full break-words text-xs text-gray-600 line-clamp-3">
                              {task.description}
                            </p>
                          )}
                          <p className="mt-1 w-full break-words text-[10px] text-gray-400">
                            {getTeamMemberDisplayName(task.created_by, work.teamMembers)}
                            {task.due_date
                              ? ` · ${new Date(task.due_date).toLocaleString(isKo ? 'ko-KR' : 'en-US')}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const announcementsPanel = (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openArchivedModal('announcements')}
          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50"
        >
          {isKo ? '완료/삭제 보기' : 'Completed / deleted'}
        </button>
      </div>
      {work.activeAnnouncements.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {isKo ? '등록된 전달사항이 없습니다.' : 'No announcements.'}
        </p>
      ) : (
        work.activeAnnouncements.map((announcement) => {
          const acks = work.acksByAnnouncement[announcement.id] || []
          const ackEmails = acks.map((a) => a.ack_by)
          const mineAck = ackEmails.some(
            (email) => email.toLowerCase() === (work.authEmail || '').toLowerCase()
          )
          const fullyAcked = isAnnouncementFullyAcked(announcement, ackEmails)
          const hasManual = !!announcement.linked_hub_article_id?.trim()
          return (
            <div
              key={announcement.id}
              className={`relative rounded-lg border p-2.5 ${
                fullyAcked ? 'border-gray-200 bg-gray-50' : 'border-orange-200 bg-white'
              }`}
            >
              <div className="absolute right-1.5 top-1.5 z-10 flex flex-row flex-nowrap items-center gap-0.5 rounded-md bg-white/95 px-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() =>
                    mineAck
                      ? void work.unackAnnouncement(announcement.id)
                      : void work.ackAnnouncement(announcement.id)
                  }
                  className={`rounded p-1 transition-colors ${
                    mineAck ? 'text-sky-600 hover:bg-sky-50' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                  title={mineAck ? (isKo ? '확인 취소' : 'Unack') : isKo ? '확인' : 'Ack'}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void work.togglePin(announcement)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                  title={isKo ? '핀 고정' : 'Pin'}
                >
                  {announcement.is_pinned ? (
                    <PinOff className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Pin className="h-3.5 w-3.5 shrink-0" />
                  )}
                </button>
                {work.canEditAnnouncement(announcement) && (
                  <button
                    type="button"
                    onClick={() => openEditAnnouncement(announcement)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary"
                    title={isKo ? '수정' : 'Edit'}
                  >
                    <Edit className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
                {work.isAdminUser && (
                  <button
                    type="button"
                    onClick={() => void work.completeAnnouncement(announcement.id)}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    title={isKo ? '완료' : 'Done'}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>

              <div
                role={hasManual ? 'button' : undefined}
                tabIndex={hasManual ? 0 : undefined}
                onClick={() => {
                  if (!hasManual) return
                  const selected = window.getSelection()?.toString()
                  if (selected) return
                  manualCtx?.openManual(announcement.linked_hub_article_id)
                }}
                onKeyDown={(e) => {
                  if (!hasManual) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    manualCtx?.openManual(announcement.linked_hub_article_id)
                  }
                }}
                className={`w-full min-w-0 select-text text-left ${hasManual ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
              >
                <div className="flex flex-wrap items-center gap-1">
                  {announcement.is_pinned && (
                    <span className="text-[10px] font-semibold text-amber-600">PIN</span>
                  )}
                  {announcement.priority && announcement.priority !== 'normal' && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${announcementPriorityClass(announcement.priority)}`}
                    >
                      {announcement.priority}
                    </span>
                  )}
                  {hasManual && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                      <BookOpen className="h-2.5 w-2.5" />
                      {isKo ? '메뉴얼' : 'Manual'}
                    </span>
                  )}
                  <h4
                    className={`w-full text-sm font-semibold leading-snug break-words ${fullyAcked ? 'text-gray-600' : 'text-gray-900'}`}
                  >
                    {announcement.title}
                  </h4>
                </div>
                <p className="mt-1 w-full break-words whitespace-pre-wrap text-xs text-gray-600">
                  {announcement.content}
                </p>
                <p className="mt-1 w-full break-words text-[10px] text-gray-400">
                  {getTeamMemberDisplayName(announcement.created_by, work.teamMembers)} ·{' '}
                  {new Date(announcement.created_at).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                </p>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  const formModals = (
    <>
      <TeamBoardWorkTaskFormModal
        open={taskFormOpen}
        mode={taskFormMode}
        locale={locale}
        values={taskForm}
        onChange={setTaskForm}
        onClose={() => {
          setTaskFormOpen(false)
          setEditingTask(null)
          setTaskForm({ ...EMPTY_TASK_FORM })
        }}
        onSave={saveTaskForm}
        saving={work.submitting}
      />
      <TeamBoardWorkAnnouncementFormModal
        open={announcementFormOpen}
        mode={announcementFormMode}
        locale={locale}
        values={announcementForm}
        onChange={setAnnouncementForm}
        onClose={() => {
          setAnnouncementFormOpen(false)
          setEditingAnnouncement(null)
          setAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM })
        }}
        onSave={saveAnnouncementForm}
        saving={work.submitting}
      />
      {showArchivedModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowArchivedModal(false)}
        >
          <div
            className="flex max-h-[min(85vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {archivedModalSection === 'tasks'
                  ? isKo
                    ? '업무 완료/삭제 내역'
                    : 'Completed / deleted tasks'
                  : isKo
                    ? '전달사항 완료/삭제 내역'
                    : 'Completed / deleted notes'}
              </h3>
              <button
                type="button"
                onClick={() => setShowArchivedModal(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label={isKo ? '닫기' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {archivedModalSection === 'tasks' ? (
                work.archivedTasks.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-500">
                    {isKo ? '완료/삭제된 업무가 없습니다.' : 'No completed or deleted tasks.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {work.archivedTasks.map((task) => {
                      const badge = getTaskPriorityBadge(task.priority)
                      return (
                        <li
                          key={`arch-task-${task.id}`}
                          className={`rounded-lg border p-3 ${getTaskPriorityBorderClass(task.priority)}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="text-sm font-medium text-gray-900">{task.title}</span>
                              </div>
                              {task.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-gray-600">{task.description}</p>
                              )}
                              <p className="mt-1 text-[10px] text-gray-500">
                                {isKo ? '상태' : 'Status'}: {taskArchivedStatusLabel(task)} ·{' '}
                                {new Date(task.created_at).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                              </p>
                            </div>
                            {work.isAdminUser && (
                              <button
                                type="button"
                                onClick={() => void handleRestoreTask(task.id)}
                                className="shrink-0 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                              >
                                {isKo ? '복구' : 'Restore'}
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : work.archivedAnnouncements.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">
                  {isKo ? '완료/삭제된 전달사항이 없습니다.' : 'No completed or deleted notes.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {work.archivedAnnouncements.map((announcement) => (
                    <li key={`arch-ann-${announcement.id}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{announcement.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-600">{announcement.content}</p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            {isKo ? '상태' : 'Status'}: {announcementArchivedStatusLabel(announcement)} ·{' '}
                            {new Date(announcement.created_at).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                          </p>
                        </div>
                        {work.isAdminUser && (
                          <button
                            type="button"
                            onClick={() => void handleRestoreAnnouncement(announcement.id)}
                            className="shrink-0 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            {isKo ? '복구' : 'Restore'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (!panelOpen) {
    return (
      <>
        <button
          type="button"
          onClick={openWidget}
          className={`fixed ${ADMIN_FLOATING_FAB_Z_CLASS} flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-2xl ring-2 ring-white/20 transition hover:scale-105 hover:shadow-blue-900/30 active:scale-95`}
          style={{
            right: `${FAB_RIGHT_PX / 16}rem`,
            bottom: fabBottomCss(FAB_STACK_INDEX),
          }}
          aria-label={isKo ? '업무 관리 열기' : 'Open work management'}
          title={headerTitle}
        >
          <Briefcase className="h-6 w-6" />
          {work.pendingBadgeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
              {work.pendingBadgeCount > 99 ? '99+' : work.pendingBadgeCount}
            </span>
          )}
        </button>
        {formModals}
      </>
    )
  }

  const resizeHandle = !isMobile ? (
    <button
      type="button"
      aria-label={isKo ? '크기 조절' : 'Resize panel'}
      data-work-resize-handle
      onMouseDown={handleResizeMouseDown}
      className={`absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-0.5 text-gray-400 transition-colors hover:text-sky-600 ${
        isResizing ? 'text-sky-600' : ''
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path
          d="M11 11L11 6M11 11L6 11M11 11L4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  ) : null

  const panelBody = (
    <>
      {tabBar}

      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
        {activeTab === 'credentials' ? (
          <p className="text-[11px] text-gray-500">
            {isKo ? 'Super·매니저 전용 · 열람 기록 저장' : 'Super & managers only · access logged'}
          </p>
        ) : (
          <Link
            href={
              activeTab === 'hub'
                ? `/${locale}/admin/operations-hub`
                : `/${locale}/admin/team-board`
            }
            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {activeTab === 'hub'
              ? isKo
                ? '운영 허브에서 전체 보기'
                : 'Open operations hub'
              : isKo
                ? '팀보드에서 전체 보기'
                : 'Open team board'}
          </Link>
        )}
        {activeTab !== 'credentials' && (
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'hub') void manualCtx?.refreshHubArticles()
              else void work.loadAll()
            }}
            className="text-[11px] font-medium text-sky-700 hover:underline"
          >
            {isKo ? '새로고침' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {activeTab === 'hub' ? (
          <AdminWorkHubDocumentsPanel
            locale={locale}
            articles={manualCtx?.hubArticles ?? []}
            loading={manualCtx?.hubArticlesLoading ?? false}
            onOpenArticle={(id) => manualCtx?.openManual(id)}
          />
        ) : activeTab === 'credentials' ? (
          <AdminWorkCredentialVaultPanel locale={locale} active={panelOpen && !isMinimized} />
        ) : work.loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : activeTab === 'tasks' ? (
          tasksPanel
        ) : (
          announcementsPanel
        )}
      </div>
    </>
  )

  return (
    <>
      <AdminFloatingPanelShell
        isMobile={isMobile}
        isMinimized={isMinimized}
        panelOpen={panelOpen}
        position={position}
        size={size}
        minSize={MIN_SIZE}
        minimizedHeight={HEADER_HEIGHT}
        onMouseDown={handleMouseDown}
        header={headerChrome}
        resizeHandle={resizeHandle}
      >
        {panelBody}
      </AdminFloatingPanelShell>
      {formModals}
    </>
  )
}
