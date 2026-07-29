import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  opTodoDepartmentFilterToRpc,
} from '@/lib/teamBoard/opTodoDepartmentFilter'
import type { OpTodoDepartment } from '@/lib/opTodoSchedule'
import {
  markOpTodoResetsRan,
  readTeamBoardPrimaryCache,
  shouldRunOpTodoResets,
  type TeamBoardOpTodoRow,
  type TeamBoardPrimarySnapshot,
  type TeamBoardWorkSnapshot,
  writeTeamBoardPrimaryCache,
  writeTeamBoardWorkCache,
} from '@/lib/teamBoard/teamBoardDataCache'
import {
  TB_ANNOUNCEMENT_COLUMNS,
  TB_ANNOUNCEMENTS_LIMIT,
  TB_ISSUES_LIMIT,
  TB_TASK_COLUMNS,
  TB_TASKS_LIMIT,
  type TeamBoardAcknowledgment,
  type TeamBoardAnnouncement,
  type TeamBoardMember,
  type TeamBoardTask,
} from '@/lib/teamBoard/workTypes'

export const TB_OP_TODOS_LIMIT = 400
export const TB_STATUS_LOGS_LIMIT = 250

export const TB_OP_TODO_COLUMNS =
  'id,title,description,scope,category,department,assigned_to,due_date,completed,completed_at,created_by,created_at,updated_at,notify_enabled,notify_time,notify_weekday,notify_day_of_month,notify_month,next_notify_at,action_type,action_config,linked_hub_article_id'

export const TB_ISSUE_COLUMNS =
  'id,title,description,status,priority,reported_by,is_deleted,deleted_at,deleted_by,created_at,updated_at'

export type TeamBoardIssueRow = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reported_by: string
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export type TeamBoardBootstrapSnapshot = {
  primary: TeamBoardPrimarySnapshot
  work: TeamBoardWorkSnapshot
  issues: TeamBoardIssueRow[]
}

type TeamBoardBootstrapRpcOptions = {
  includeOpTodos?: boolean
  includeWork?: boolean
  includeIssues?: boolean
  opTodoDepartments?: OpTodoDepartment[] | null
}

export type TeamBoardFetchOptions = {
  opTodoDepartments?: OpTodoDepartment[] | null
}

type TeamBoardBootstrapRpcPayload = {
  team_members?: TeamBoardMember[]
  op_todos?: TeamBoardOpTodoRow[]
  announcements?: TeamBoardAnnouncement[]
  acknowledgments?: TeamBoardAcknowledgment[]
  tasks?: TeamBoardTask[]
  issues?: TeamBoardIssueRow[]
}

function groupAcks(acks: TeamBoardAcknowledgment[]): Record<string, TeamBoardAcknowledgment[]> {
  const aMap: Record<string, TeamBoardAcknowledgment[]> = {}
  acks.forEach((ack) => {
    const key = ack.announcement_id
    aMap[key] = aMap[key] || []
    aMap[key].push(ack)
  })
  return aMap
}

function parseBootstrapRpcPayload(
  raw: TeamBoardBootstrapRpcPayload,
  options: TeamBoardBootstrapRpcOptions
): TeamBoardBootstrapSnapshot {
  const teamMembers = (raw.team_members || []) as TeamBoardMember[]
  const opTodos = (raw.op_todos || []) as TeamBoardOpTodoRow[]
  const announcements = (raw.announcements || []) as TeamBoardAnnouncement[]
  const acknowledgments = (raw.acknowledgments || []) as TeamBoardAcknowledgment[]
  const tasks = (raw.tasks || []) as TeamBoardTask[]
  const issues = (raw.issues || []) as TeamBoardIssueRow[]

  const primary: TeamBoardPrimarySnapshot = {
    teamMembers,
    opTodos: options.includeOpTodos === false ? [] : opTodos,
  }

  const work: TeamBoardWorkSnapshot = {
    teamMembers,
    announcements: options.includeWork === false ? [] : announcements,
    tasks: options.includeWork === false ? [] : tasks,
    acksByAnnouncement:
      options.includeWork === false ? {} : groupAcks(acknowledgments),
  }

  return {
    primary,
    work,
    issues: options.includeIssues === false ? [] : issues,
  }
}

async function fetchTeamBoardBootstrapViaRpc(
  options: TeamBoardBootstrapRpcOptions = {}
): Promise<TeamBoardBootstrapSnapshot | null> {
  const includeOpTodos = options.includeOpTodos !== false
  const includeWork = options.includeWork !== false
  const includeIssues = options.includeIssues !== false

  const { data, error } = await supabase.rpc('get_team_board_bootstrap', {
    p_op_todos_limit: TB_OP_TODOS_LIMIT,
    p_announcements_limit: TB_ANNOUNCEMENTS_LIMIT,
    p_tasks_limit: TB_TASKS_LIMIT,
    p_issues_limit: TB_ISSUES_LIMIT,
    p_include_op_todos: includeOpTodos,
    p_include_work: includeWork,
    p_include_issues: includeIssues,
    p_op_todo_departments: opTodoDepartmentFilterToRpc(options.opTodoDepartments),
  })

  if (error) {
    console.warn('get_team_board_bootstrap RPC failed, falling back to direct queries:', error)
    return null
  }

  if (!data || typeof data !== 'object') return null

  return parseBootstrapRpcPayload(data as TeamBoardBootstrapRpcPayload, options)
}

async function fetchTeamBoardPrimaryFallback(
  opTodoDepartments?: OpTodoDepartment[] | null
): Promise<TeamBoardPrimarySnapshot> {
  let opTodoQuery = supabase
    .from('op_todos')
    .select(TB_OP_TODO_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(TB_OP_TODOS_LIMIT)

  if (opTodoDepartments && opTodoDepartments.length > 0) {
    opTodoQuery = opTodoQuery.in('department', opTodoDepartments)
  }

  const [{ data: opTodos }, { data: team }] = await Promise.all([
    opTodoQuery,
    supabase
      .from('team')
      .select('email, name_ko, position, is_active')
      .eq('is_active', true)
      .order('name_ko'),
  ])

  return {
    opTodos: (opTodos || []) as unknown as TeamBoardOpTodoRow[],
    teamMembers: (team || []) as TeamBoardMember[],
  }
}

async function fetchTeamBoardWorkFallback(): Promise<TeamBoardWorkSnapshot> {
  const { data: anns, error: annErr } = await fromUntypedTable(supabase, 'team_announcements')
    .select(TB_ANNOUNCEMENT_COLUMNS)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(TB_ANNOUNCEMENTS_LIMIT)

  if (annErr) throw annErr

  const announcements = (anns || []) as TeamBoardAnnouncement[]
  const announcementIds = announcements.map((a) => a.id)

  const ackQuery =
    announcementIds.length > 0
      ? supabase
          .from('team_announcement_acknowledgments')
          .select('id, announcement_id, ack_by, ack_at')
          .in('announcement_id', announcementIds)
      : Promise.resolve({ data: [], error: null })

  const [{ data: team }, { data: acks }, { data: tks }] = await Promise.all([
    supabase
      .from('team')
      .select('email, name_ko, position, is_active')
      .eq('is_active', true)
      .order('name_ko'),
    ackQuery,
    supabase
      .from('tasks')
      .select(TB_TASK_COLUMNS)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(TB_TASKS_LIMIT),
  ])

  return {
    teamMembers: (team || []) as TeamBoardMember[],
    announcements,
    tasks: (tks || []) as unknown as TeamBoardTask[],
    acksByAnnouncement: groupAcks((acks || []) as TeamBoardAcknowledgment[]),
  }
}

async function fetchTeamBoardIssuesFallback(): Promise<TeamBoardIssueRow[]> {
  const { data: iss, error } = await supabase
    .from('issues')
    .select(TB_ISSUE_COLUMNS)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(TB_ISSUES_LIMIT)
  if (error) throw error
  return (iss || []) as unknown as TeamBoardIssueRow[]
}

export async function runOpTodoResetsIfDue(): Promise<void> {
  if (!shouldRunOpTodoResets()) return
  try {
    await supabase.rpc('apply_due_op_todo_resets')
    markOpTodoResetsRan()
  } catch (resetErr) {
    console.warn('apply_due_op_todo_resets skipped:', resetErr)
  }
}

/** 팀보드 페이지 전체 초기 로드 (단일 RPC, 실패 시 다중 쿼리 폴백) */
export async function fetchTeamBoardBootstrap(
  options: TeamBoardFetchOptions = {}
): Promise<TeamBoardBootstrapSnapshot> {
  const rpcOptions: TeamBoardBootstrapRpcOptions = {
    includeOpTodos: true,
    includeWork: true,
    includeIssues: true,
    opTodoDepartments: options.opTodoDepartments ?? null,
  }

  const rpc = await fetchTeamBoardBootstrapViaRpc(rpcOptions)

  if (rpc) {
    writeTeamBoardPrimaryCache(rpc.primary)
    writeTeamBoardWorkCache(rpc.work)
    return rpc
  }

  const [primary, work, issues] = await Promise.all([
    fetchTeamBoardPrimaryFallback(options.opTodoDepartments),
    fetchTeamBoardWorkFallback(),
    fetchTeamBoardIssuesFallback(),
  ])

  writeTeamBoardPrimaryCache(primary)
  writeTeamBoardWorkCache(work)

  return { primary, work, issues }
}

export async function fetchTeamBoardPrimary(
  options: TeamBoardFetchOptions = {}
): Promise<TeamBoardPrimarySnapshot> {
  const rpc = await fetchTeamBoardBootstrapViaRpc({
    includeOpTodos: true,
    includeWork: false,
    includeIssues: false,
    opTodoDepartments: options.opTodoDepartments ?? null,
  })

  if (rpc) {
    writeTeamBoardPrimaryCache(rpc.primary)
    return rpc.primary
  }

  const snapshot = await fetchTeamBoardPrimaryFallback(options.opTodoDepartments)
  writeTeamBoardPrimaryCache(snapshot)
  return snapshot
}

export async function fetchTeamBoardWork(): Promise<TeamBoardWorkSnapshot> {
  const rpc = await fetchTeamBoardBootstrapViaRpc({
    includeOpTodos: false,
    includeWork: true,
    includeIssues: false,
  })

  if (rpc) {
    writeTeamBoardWorkCache(rpc.work)
    return rpc.work
  }

  const snapshot = await fetchTeamBoardWorkFallback()
  writeTeamBoardWorkCache(snapshot)
  return snapshot
}

export async function fetchOpTodosOnly(
  options: TeamBoardFetchOptions = {}
): Promise<TeamBoardOpTodoRow[]> {
  let query = supabase
    .from('op_todos')
    .select(TB_OP_TODO_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(TB_OP_TODOS_LIMIT)

  if (options.opTodoDepartments && options.opTodoDepartments.length > 0) {
    query = query.in('department', options.opTodoDepartments)
  }

  const { data, error } = await query
  if (error) throw error
  const opTodos = (data || []) as unknown as TeamBoardOpTodoRow[]
  const existing = readTeamBoardPrimaryCache()
  writeTeamBoardPrimaryCache({
    opTodos,
    teamMembers: existing?.teamMembers ?? [],
  })
  return opTodos
}

export type TeamBoardWorkBadgeCounts = {
  openTasks: number
  unackedAnnouncements: number
  total: number
}

export async function fetchTeamBoardWorkBadgeCounts(): Promise<TeamBoardWorkBadgeCounts> {
  const { data, error } = await supabase.rpc('get_team_board_work_badge_counts')
  if (error) throw error
  const raw = (data || {}) as {
    open_tasks?: number
    unacked_announcements?: number
    total?: number
  }
  const openTasks = Number(raw.open_tasks ?? 0)
  const unackedAnnouncements = Number(raw.unacked_announcements ?? 0)
  return {
    openTasks,
    unackedAnnouncements,
    total: Number(raw.total ?? openTasks + unackedAnnouncements),
  }
}

export async function fetchOpTodoPendingCount(options: {
  departments?: OpTodoDepartment[] | null
  excludeOnHold?: boolean
}): Promise<number> {
  const { data, error } = await supabase.rpc('get_op_todo_pending_count', {
    p_departments: opTodoDepartmentFilterToRpc(options.departments),
    p_exclude_on_hold: options.excludeOnHold !== false,
  })
  if (error) throw error
  return Number(data ?? 0)
}
