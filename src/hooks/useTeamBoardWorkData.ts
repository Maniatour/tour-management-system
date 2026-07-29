'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  readTeamBoardWorkCache,
} from '@/lib/teamBoard/teamBoardDataCache'
import { fetchTeamBoardWork, fetchTeamBoardWorkBadgeCounts } from '@/lib/teamBoard/teamBoardFetch'
import {
  canEditTeamBoardAnnouncement,
  canEditTeamBoardTask,
  isAnnouncementUnackedForUser,
  isTeamBoardAdminUser,
} from '@/lib/teamBoard/teamBoardPermissions'
import {
  type TeamBoardAcknowledgment,
  type TeamBoardAnnouncement,
  type TeamBoardMember,
  type TeamBoardTask,
} from '@/lib/teamBoard/workTypes'

export type TeamBoardTaskFormState = {
  title: string
  description: string
  due_date: string
  priority: TeamBoardTask['priority']
  status: TeamBoardTask['status']
  linked_hub_article_id: string | null
}

export type TeamBoardAnnouncementFormState = {
  title: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  tags: string
  linked_hub_article_id: string | null
}

export const EMPTY_TASK_FORM: TeamBoardTaskFormState = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
  status: 'pending',
  linked_hub_article_id: null,
}

export const EMPTY_ANNOUNCEMENT_FORM: TeamBoardAnnouncementFormState = {
  title: '',
  content: '',
  priority: 'normal',
  tags: '',
  linked_hub_article_id: null,
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function taskToFormState(task: TeamBoardTask): TeamBoardTaskFormState {
  return {
    title: task.title,
    description: task.description || '',
    due_date: task.due_date ? toDatetimeLocalValue(task.due_date) : '',
    priority: task.priority,
    status: task.status,
    linked_hub_article_id: task.linked_hub_article_id ?? null,
  }
}

export function announcementToFormState(announcement: TeamBoardAnnouncement): TeamBoardAnnouncementFormState {
  return {
    title: announcement.title,
    content: announcement.content,
    priority: announcement.priority || 'normal',
    tags: announcement.tags?.join(', ') || '',
    linked_hub_article_id: announcement.linked_hub_article_id ?? null,
  }
}

type UseTeamBoardWorkDataOptions = {
  enabled?: boolean
  /** false면 패널 열기·명시적 refresh 전까지 네트워크 로드 생략 (캐시만 hydrate) */
  loadOnMount?: boolean
}

export function useTeamBoardWorkData({
  enabled = true,
  loadOnMount = true,
}: UseTeamBoardWorkDataOptions = {}) {
  const { authUser, userRole, userPosition } = useAuth()
  const initialWorkCache = enabled ? readTeamBoardWorkCache() : null
  const [tasks, setTasks] = useState<TeamBoardTask[]>(() => initialWorkCache?.tasks ?? [])
  const [announcements, setAnnouncements] = useState<TeamBoardAnnouncement[]>(
    () => initialWorkCache?.announcements ?? []
  )
  const [acksByAnnouncement, setAcksByAnnouncement] = useState<
    Record<string, TeamBoardAcknowledgment[]>
  >(() => initialWorkCache?.acksByAnnouncement ?? {})
  const [teamMembers, setTeamMembers] = useState<TeamBoardMember[]>(
    () => initialWorkCache?.teamMembers ?? []
  )
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rpcBadgeCount, setRpcBadgeCount] = useState<number | null>(null)

  const isAdminUser = useMemo(
    () =>
      isTeamBoardAdminUser({
        email: authUser?.email,
        userRole,
        userPosition,
        permissions: authUser?.permissions,
      }),
    [authUser?.email, authUser?.permissions, userRole, userPosition]
  )

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.is_deleted && task.status !== 'completed' && task.status !== 'cancelled'),
    [tasks]
  )

  const activeAnnouncements = useMemo(
    () =>
      announcements.filter(
        (announcement) => !announcement.is_deleted && !announcement.is_archived
      ),
    [announcements]
  )

  const archivedTasks = useMemo(
    () =>
      tasks.filter(
        (task) => !!task.is_deleted || task.status === 'completed' || task.status === 'cancelled'
      ),
    [tasks]
  )

  const archivedAnnouncements = useMemo(
    () => announcements.filter((announcement) => !!announcement.is_deleted || !!announcement.is_archived),
    [announcements]
  )

  const computedBadgeCount = useMemo(() => {
    const openTasks = activeTasks.length
    const unacked = activeAnnouncements.filter((announcement) => {
      const acks = acksByAnnouncement[announcement.id] || []
      const ackEmails = acks.map((a) => a.ack_by)
      return isAnnouncementUnackedForUser(announcement, ackEmails, authUser?.email)
    }).length
    return openTasks + unacked
  }, [activeAnnouncements, activeTasks.length, acksByAnnouncement, authUser?.email])

  const hasHydratedWorkList = tasks.length > 0 || announcements.length > 0
  const pendingBadgeCount = hasHydratedWorkList ? computedBadgeCount : (rpcBadgeCount ?? computedBadgeCount)

  const applyWorkSnapshot = useCallback((snapshot: {
    tasks: TeamBoardTask[]
    announcements: TeamBoardAnnouncement[]
    acksByAnnouncement: Record<string, TeamBoardAcknowledgment[]>
    teamMembers: TeamBoardMember[]
  }) => {
    setTeamMembers(snapshot.teamMembers)
    setAnnouncements(snapshot.announcements)
    setTasks(snapshot.tasks)
    setAcksByAnnouncement(snapshot.acksByAnnouncement)
  }, [])

  const loadAll = useCallback(
    async (options?: { background?: boolean }) => {
      if (!enabled || !authUser?.email) return
      if (!options?.background) setLoading(true)
      try {
        const snapshot = await fetchTeamBoardWork()
        applyWorkSnapshot(snapshot)
      } catch (e) {
        console.error('useTeamBoardWorkData loadAll', e)
      } finally {
        if (!options?.background) setLoading(false)
      }
    },
    [applyWorkSnapshot, authUser?.email, enabled]
  )

  useEffect(() => {
    if (!enabled || !authUser?.email) return
    const cached = readTeamBoardWorkCache()
    if (cached) applyWorkSnapshot(cached)
    if (loadOnMount) void loadAll({ background: Boolean(cached) })
  }, [applyWorkSnapshot, authUser?.email, enabled, loadAll, loadOnMount])

  useEffect(() => {
    if (!enabled || !authUser?.email) return
    let cancelled = false

    const refreshBadge = async () => {
      try {
        const counts = await fetchTeamBoardWorkBadgeCounts()
        if (!cancelled) setRpcBadgeCount(counts.total)
      } catch (e) {
        console.warn('fetchTeamBoardWorkBadgeCounts', e)
      }
    }

    void refreshBadge()
    const intervalId = window.setInterval(() => void refreshBadge(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [authUser?.email, enabled])

  const createTask = useCallback(
    async (form: TeamBoardTaskFormState) => {
      if (!form.title.trim() || !authUser?.email) return { error: 'invalid' as const }
      setSubmitting(true)
      try {
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: form.due_date || null,
          priority: form.priority,
          assigned_to: null,
          target_positions: null,
          target_individuals: null,
          tags: [],
          created_by: authUser.email,
          linked_hub_article_id: form.linked_hub_article_id,
        }
        const { data, error } = await supabase
          .from('tasks')
          .insert([payload] as never[])
          .select()
          .single()
        if (error) throw error
        setTasks((prev) => [data as unknown as TeamBoardTask, ...prev])
        return { data: data as unknown as TeamBoardTask }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [authUser?.email]
  )

  const updateTask = useCallback(async (taskId: string, form: TeamBoardTaskFormState) => {
    if (!form.title.trim()) return { error: 'invalid' as const }
    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: form.status,
        updated_at: new Date().toISOString(),
        linked_hub_article_id: form.linked_hub_article_id,
      }
      const { data, error } = await supabase
        .from('tasks')
        .update(payload as never)
        .eq('id', Number(taskId))
        .select()
        .single()
      if (error) throw error
      setTasks((prev) => prev.map((task) => (task.id === taskId ? (data as unknown as TeamBoardTask) : task)))
      return { data: data as unknown as TeamBoardTask }
    } catch (e) {
      console.error(e)
      return { error: e }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!isAdminUser) return { error: 'forbidden' as const }
      setSubmitting(true)
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ status: 'completed' } as never)
          .eq('id', Number(taskId))
          .select()
          .single()
        if (error) throw error
        setTasks((prev) => prev.map((task) => (task.id === taskId ? (data as unknown as TeamBoardTask) : task)))
        return { data: data as unknown as TeamBoardTask }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [isAdminUser]
  )

  const setTaskInProgress = useCallback(async (taskId: string) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' } as never)
        .eq('id', Number(taskId))
        .select()
        .single()
      if (error) throw error
      setTasks((prev) => prev.map((task) => (task.id === taskId ? (data as unknown as TeamBoardTask) : task)))
      return { data: data as unknown as TeamBoardTask }
    } catch (e) {
      console.error(e)
      return { error: e }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const deleteTaskSoft = useCallback(
    async (taskId: string) => {
      if (!isAdminUser || !authUser?.email) return { error: 'forbidden' as const }
      setSubmitting(true)
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: authUser.email,
          } as never)
          .eq('id', Number(taskId))
          .select()
          .single()
        if (error) throw error
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? (data as unknown as TeamBoardTask) : task))
        )
        return { data: data as unknown as TeamBoardTask }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [authUser?.email, isAdminUser]
  )

  const restoreTask = useCallback(
    async (taskId: string) => {
      if (!isAdminUser) return { error: 'forbidden' as const }
      setSubmitting(true)
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({
            status: 'pending',
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
          } as never)
          .eq('id', Number(taskId))
          .select()
          .single()
        if (error) throw error
        setTasks((prev) =>
          prev.map((task) => (String(task.id) === String(taskId) ? (data as unknown as TeamBoardTask) : task))
        )
        return { data: data as unknown as TeamBoardTask }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [isAdminUser]
  )

  const restoreAnnouncement = useCallback(
    async (announcementId: string) => {
      if (!isAdminUser) return { error: 'forbidden' as const }
      setSubmitting(true)
      try {
        const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
          .update({
            is_archived: false,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
          } as never)
          .eq('id', announcementId)
          .select()
          .single()
        if (error) throw error
        setAnnouncements((prev) =>
          prev.map((announcement) =>
            announcement.id === announcementId ? (data as TeamBoardAnnouncement) : announcement
          )
        )
        return { data: data as TeamBoardAnnouncement }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [isAdminUser]
  )

  const createAnnouncement = useCallback(
    async (form: TeamBoardAnnouncementFormState) => {
      if (!form.title.trim() || !form.content.trim() || !authUser?.email) {
        return { error: 'invalid' as const }
      }
      setSubmitting(true)
      try {
        const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
          .insert([
            {
              title: form.title.trim(),
              content: form.content.trim(),
              created_by: authUser.email,
              recipients: null,
              target_positions: null,
              priority: form.priority,
              tags: form.tags
                ? form.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [],
              linked_hub_article_id: form.linked_hub_article_id,
            },
          ] as never[])
          .select()
          .single()
        if (error) throw error
        setAnnouncements((prev) => [data as TeamBoardAnnouncement, ...prev])
        return { data: data as TeamBoardAnnouncement }
      } catch (e) {
        console.error(e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [authUser?.email]
  )

  const updateAnnouncement = useCallback(async (announcementId: string, form: TeamBoardAnnouncementFormState) => {
    if (!form.title.trim() || !form.content.trim()) return { error: 'invalid' as const }
    setSubmitting(true)
    try {
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({
          title: form.title.trim(),
          content: form.content.trim(),
          priority: form.priority,
          tags: form.tags
            ? form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          linked_hub_article_id: form.linked_hub_article_id,
        } as never)
        .eq('id', announcementId)
        .select()
        .single()
      if (error) throw error
      setAnnouncements((prev) =>
        prev.map((announcement) =>
          announcement.id === announcementId ? (data as TeamBoardAnnouncement) : announcement
        )
      )
      return { data: data as TeamBoardAnnouncement }
    } catch (e) {
      console.error(e)
      return { error: e }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const ackAnnouncement = useCallback(
    async (announcementId: string) => {
      if (!authUser?.email) return { error: 'invalid' as const }
      try {
        const { data, error } = await supabase
          .from('team_announcement_acknowledgments')
          .insert([{ announcement_id: announcementId, ack_by: authUser.email }] as never[])
          .select()
          .single()
        if (error) throw error
        setAcksByAnnouncement((prev) => ({
          ...prev,
          [announcementId]: [...(prev[announcementId] || []), data as TeamBoardAcknowledgment],
        }))
        return { data: data as TeamBoardAcknowledgment }
      } catch (e) {
        console.error(e)
        return { error: e }
      }
    },
    [authUser?.email]
  )

  const unackAnnouncement = useCallback(
    async (announcementId: string) => {
      if (!authUser?.email) return { error: 'invalid' as const }
      try {
        const { error } = await supabase
          .from('team_announcement_acknowledgments')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('ack_by', authUser.email)
        if (error) throw error
        setAcksByAnnouncement((prev) => ({
          ...prev,
          [announcementId]: (prev[announcementId] || []).filter(
            (ack) => ack.ack_by.toLowerCase() !== authUser.email!.toLowerCase()
          ),
        }))
        return { ok: true as const }
      } catch (e) {
        console.error(e)
        return { error: e }
      }
    },
    [authUser?.email]
  )

  const completeAnnouncement = useCallback(
    async (announcementId: string) => {
      if (!isAdminUser) return { error: 'forbidden' as const }
      try {
        const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
          .update({ is_archived: true } as never)
          .eq('id', announcementId)
          .select()
          .single()
        if (error) throw error
        setAnnouncements((prev) =>
          prev.map((announcement) =>
            announcement.id === announcementId ? (data as TeamBoardAnnouncement) : announcement
          )
        )
        return { data: data as TeamBoardAnnouncement }
      } catch (e) {
        console.error(e)
        return { error: e }
      }
    },
    [isAdminUser]
  )

  const togglePin = useCallback(async (announcement: TeamBoardAnnouncement) => {
    try {
      const { data, error } = await fromUntypedTable(supabase, 'team_announcements')
        .update({ is_pinned: !announcement.is_pinned } as never)
        .eq('id', announcement.id)
        .select()
        .single()
      if (error) throw error
      setAnnouncements((prev) =>
        prev.map((item) => (item.id === announcement.id ? (data as TeamBoardAnnouncement) : item))
      )
      return { data: data as TeamBoardAnnouncement }
    } catch (e) {
      console.error(e)
      return { error: e }
    }
  }, [])

  return {
    authEmail: authUser?.email,
    tasks,
    activeTasks,
    archivedTasks,
    announcements,
    activeAnnouncements,
    archivedAnnouncements,
    acksByAnnouncement,
    teamMembers,
    loading,
    submitting,
    isAdminUser,
    pendingBadgeCount,
    loadAll,
    createTask,
    updateTask,
    completeTask,
    setTaskInProgress,
    deleteTaskSoft,
    restoreTask,
    createAnnouncement,
    updateAnnouncement,
    ackAnnouncement,
    unackAnnouncement,
    completeAnnouncement,
    restoreAnnouncement,
    togglePin,
    canEditTask: (task: TeamBoardTask) => canEditTeamBoardTask(task, authUser?.email, isAdminUser),
    canEditAnnouncement: (announcement: TeamBoardAnnouncement) =>
      canEditTeamBoardAnnouncement(announcement, authUser?.email, isAdminUser),
  }
}
