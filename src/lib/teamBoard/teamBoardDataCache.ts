/**
 * 팀보드 Todo List / Work FAB 공유 메모리·sessionStorage 캐시.
 * 즉시 표시(stale-while-revalidate) 후 백그라운드 갱신.
 */

import type {
  TeamBoardAcknowledgment,
  TeamBoardAnnouncement,
  TeamBoardMember,
  TeamBoardTask,
} from '@/lib/teamBoard/workTypes'

export type TeamBoardOpTodoRow = {
  id: string
  title: string
  description: string | null
  scope: 'common' | 'individual'
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  department: 'office' | 'guide' | 'common'
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
  next_notify_at?: string | null
  action_type?: string | null
  action_config?: Record<string, unknown> | null
  linked_hub_article_id?: string | null
}

export type TeamBoardPrimarySnapshot = {
  opTodos: TeamBoardOpTodoRow[]
  teamMembers: TeamBoardMember[]
}

export type TeamBoardWorkSnapshot = {
  tasks: TeamBoardTask[]
  announcements: TeamBoardAnnouncement[]
  acksByAnnouncement: Record<string, TeamBoardAcknowledgment[]>
  teamMembers: TeamBoardMember[]
}

const CACHE_TTL_MS = 90 * 1000
const RESET_RPC_TTL_MS = 5 * 60 * 1000

const SS_PRIMARY = 'team-board-primary-cache-v1'
const SS_WORK = 'team-board-work-cache-v1'
const SS_RESET_AT = 'team-board-op-todo-reset-at-v1'

let memPrimary: { at: number; data: TeamBoardPrimarySnapshot } | null = null
let memWork: { at: number; data: TeamBoardWorkSnapshot } | null = null

function isFresh(at: number, ttl = CACHE_TTL_MS): boolean {
  return Date.now() - at < ttl
}

function readSession<T>(key: string): { at: number; data: T } | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: T }
    if (!parsed?.at || !isFresh(parsed.at) || !parsed.data) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSession<T>(key: string, data: T): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota */
  }
}

export function readTeamBoardPrimaryCache(): TeamBoardPrimarySnapshot | null {
  if (memPrimary && isFresh(memPrimary.at)) return memPrimary.data
  const fromSs = readSession<TeamBoardPrimarySnapshot>(SS_PRIMARY)
  if (fromSs) {
    memPrimary = fromSs
    return fromSs.data
  }
  return null
}

export function writeTeamBoardPrimaryCache(data: TeamBoardPrimarySnapshot): void {
  const entry = { at: Date.now(), data }
  memPrimary = entry
  writeSession(SS_PRIMARY, data)
}

export function readTeamBoardWorkCache(): TeamBoardWorkSnapshot | null {
  if (memWork && isFresh(memWork.at)) return memWork.data
  const fromSs = readSession<TeamBoardWorkSnapshot>(SS_WORK)
  if (fromSs) {
    memWork = fromSs
    return fromSs.data
  }
  return null
}

export function writeTeamBoardWorkCache(data: TeamBoardWorkSnapshot): void {
  const entry = { at: Date.now(), data }
  memWork = entry
  writeSession(SS_WORK, data)
}

export function invalidateTeamBoardCaches(): void {
  memPrimary = null
  memWork = null
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(SS_PRIMARY)
    sessionStorage.removeItem(SS_WORK)
  } catch {
    /* ignore */
  }
}

export function shouldRunOpTodoResets(): boolean {
  if (typeof sessionStorage === 'undefined') return true
  try {
    const raw = sessionStorage.getItem(SS_RESET_AT)
    if (!raw) return true
    const at = Number(raw)
    return !Number.isFinite(at) || Date.now() - at > RESET_RPC_TTL_MS
  } catch {
    return true
  }
}

export function markOpTodoResetsRan(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SS_RESET_AT, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function isTeamBoardPrimaryCacheFresh(): boolean {
  return Boolean(memPrimary && isFresh(memPrimary.at)) || Boolean(readSession(SS_PRIMARY))
}

export function isTeamBoardWorkCacheFresh(): boolean {
  return Boolean(memWork && isFresh(memWork.at)) || Boolean(readSession(SS_WORK))
}
