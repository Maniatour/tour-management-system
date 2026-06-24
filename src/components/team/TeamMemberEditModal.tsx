'use client'

import TeamMemberForm from '@/components/team/TeamMemberForm'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']

export type TeamMemberEditModalProps = {
  member: TeamMember
  onClose: () => void
  onSaved: (updated: TeamMember) => void
  onDelete?: () => void | Promise<void>
}

export default function TeamMemberEditModal({
  member,
  onClose,
  onSaved,
  onDelete,
}: TeamMemberEditModalProps) {
  const handleSubmit = async (data: TeamMemberInsert) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('team').update(data).eq('email', member.email)
    if (error) {
      console.error('Error updating team member:', error)
      alert('팀원 정보 수정 중 오류가 발생했습니다.')
      return
    }
    onSaved({ ...member, ...data } as TeamMember)
    onClose()
  }

  return (
    <TeamMemberForm
      member={member}
      onSubmit={(data) => void handleSubmit(data)}
      onCancel={onClose}
      {...(onDelete ? { onDelete } : {})}
    />
  )
}
