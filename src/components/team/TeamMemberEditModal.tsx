'use client'

import TeamMemberForm from '@/components/team/TeamMemberForm'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import {
  ensureExclusiveLists,
  normalizeTeamEmailList,
  syncDoNotTeamWithPeers,
  type DoNotTeamPeerUpdate,
} from '@/lib/teamDoNotTeamWith'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']

export type TeamMemberEditModalProps = {
  member: TeamMember
  onClose: () => void
  onSaved: (updated: TeamMember, peerUpdates?: DoNotTeamPeerUpdate[]) => void
  onDelete?: () => void | Promise<void>
}

export default function TeamMemberEditModal({
  member,
  onClose,
  onSaved,
  onDelete,
}: TeamMemberEditModalProps) {
  const handleSubmit = async (data: TeamMemberInsert) => {
    const previousNever = member.do_not_team_with
    const previousAvoid = member.avoid_team_with
    const exclusive = ensureExclusiveLists(
      normalizeTeamEmailList(data.do_not_team_with),
      normalizeTeamEmailList(data.avoid_team_with),
    )
    const payload = {
      ...data,
      do_not_team_with: exclusive.never,
      avoid_team_with: exclusive.avoid,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('team').update(payload).eq('email', member.email)
    if (error) {
      console.error('Error updating team member:', error)
      alert('팀원 정보 수정 중 오류가 발생했습니다.')
      return
    }

    const { error: syncError, peerUpdates } = await syncDoNotTeamWithPeers({
      selfEmail: member.email,
      previousNeverList: previousNever,
      nextNeverList: exclusive.never,
      previousAvoidList: previousAvoid,
      nextAvoidList: exclusive.avoid,
    })
    if (syncError) {
      console.error('Error syncing team pair restrictions:', syncError)
      alert(
        '팀원 정보는 저장되었지만, 상대 가이드 쪽 팀 조합 설정 동기화에 실패했습니다. 상대 팀원 정보를 확인해 주세요.',
      )
    }

    onSaved({ ...member, ...payload } as TeamMember, peerUpdates)
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
