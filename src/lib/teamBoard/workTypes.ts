export type TeamBoardTask = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  created_by: string
  assigned_to: string | null
  target_positions: string[] | null
  target_individuals: string[] | null
  tags: string[] | null
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
  linked_hub_article_id?: string | null
}

export type TeamBoardAnnouncement = {
  id: string
  title: string
  content: string
  is_pinned: boolean
  recipients: string[] | null
  target_positions: string[] | null
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  tags: string[] | null
  due_by: string | null
  is_archived: boolean | null
  is_deleted: boolean | null
  deleted_at: string | null
  deleted_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  linked_hub_article_id?: string | null
}

export type TeamBoardAcknowledgment = {
  id: string
  announcement_id: string
  ack_by: string
  ack_at: string
}

export type TeamBoardMember = {
  email: string
  name_ko: string | null
  position: string | null
  is_active: boolean
}

export const TB_TASK_COLUMNS =
  'id,title,description,due_date,priority,status,created_by,assigned_to,target_positions,target_individuals,tags,is_deleted,deleted_at,deleted_by,created_at,updated_at,linked_hub_article_id'

export const TB_ANNOUNCEMENT_COLUMNS =
  'id,title,content,is_pinned,recipients,target_positions,priority,tags,due_by,is_archived,is_deleted,deleted_at,deleted_by,created_by,created_at,updated_at,linked_hub_article_id'

export const TB_TASKS_LIMIT = 120
export const TB_ANNOUNCEMENTS_LIMIT = 80
export const TB_ACKS_LIMIT = 4000
export const TB_ISSUES_LIMIT = 120
