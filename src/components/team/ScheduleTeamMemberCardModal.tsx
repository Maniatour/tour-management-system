'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { supabase, type Database } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'
import TeamMemberCard, { type TeamCardPaymentMethodRow } from '@/components/team/TeamMemberCard'
import TeamMemberEditModal from '@/components/team/TeamMemberEditModal'
import TeamMemberQuickEditModal, { type TeamQuickField } from '@/components/team/TeamMemberQuickEditModal'
import {
  ensureExclusiveLists,
  isTourGuideOrDriverPosition,
  normalizeTeamEmailList,
  syncDoNotTeamWithPeers,
  type DoNotTeamPeerUpdate,
} from '@/lib/teamDoNotTeamWith'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberUpdate = Database['public']['Tables']['team']['Update']

type MemberDocument = {
  id: string
  name: string
  url: string
  path: string
  size: number
  uploadedAt: string
}

type MemberDocuments = Record<string, MemberDocument[]>

async function fetchMemberDocuments(email: string): Promise<MemberDocuments> {
  const documentTypes = ['contract', 'id_copy', 'bank_info', 'other']
  const listed = await Promise.all(
    documentTypes.map(async (docType) => {
      const prefix = `team-documents/${email}/${docType}/`
      const { data: files, error } = await supabase.storage.from('documents').list(prefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (error) {
        console.error(`${docType} 문서 목록 조회 오류:`, error)
        return [docType, []] as const
      }
      const docs = (files || [])
        .filter((file) => Boolean(file.name) && file.name !== '.emptyFolderPlaceholder' && file.metadata)
        .map((file) => {
          const filePath = `${prefix}${file.name}`
          const {
            data: { publicUrl },
          } = supabase.storage.from('documents').getPublicUrl(filePath)
          return {
            id: file.id || `${docType}-${file.name}`,
            name: file.name,
            url: publicUrl,
            path: filePath,
            size: file.metadata?.size || 0,
            uploadedAt: file.created_at || new Date().toISOString(),
          }
        })
      return [docType, docs] as const
    }),
  )
  const allDocuments: MemberDocuments = {}
  for (const [docType, docs] of listed) allDocuments[docType] = [...docs]
  return allDocuments
}

export default function ScheduleTeamMemberCardModal({
  member,
  teamMembers,
  locale,
  onClose,
  onSaved,
}: {
  member: TeamMember
  teamMembers: TeamMember[]
  locale: string
  onClose: () => void
  onSaved: (updated: TeamMember, peerUpdates?: DoNotTeamPeerUpdate[], previousEmail?: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [quickEdit, setQuickEdit] = useState<TeamQuickField | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<TeamCardPaymentMethodRow[]>([])
  const [documents, setDocuments] = useState<MemberDocuments | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showForm && !quickEdit) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, quickEdit, showForm])

  useEffect(() => {
    let cancelled = false
    const email = member.email.toLowerCase()
    ;(async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, display_name, status, method_type, user_email, card_holder_name')
        .eq('user_email', email)
        .order('method', { ascending: true })
      if (cancelled) return
      if (error) {
        console.error('스케줄 팀원 카드 결제수단 조회 오류:', error)
        setPaymentMethods([])
        return
      }
      setPaymentMethods((data || []) as TeamCardPaymentMethodRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [member.email])

  const loadDocuments = useCallback(async (email: string) => {
    try {
      const next = await fetchMemberDocuments(email)
      setDocuments(next)
    } catch (error) {
      console.error('문서 목록 불러오기 오류:', error)
      setDocuments({})
    }
  }, [])

  useEffect(() => {
    void loadDocuments(member.email)
  }, [loadDocuments, member.email])

  const documentCount = documents
    ? Object.values(documents).reduce((sum, docs) => sum + docs.length, 0)
    : null

  const saveQuickEdit = async (patch: TeamMemberUpdate) => {
    const previousEmail = member.email
    try {
      const hasPair = patch.do_not_team_with !== undefined || patch.avoid_team_with !== undefined
      const exclusive = hasPair
        ? ensureExclusiveLists(
            normalizeTeamEmailList(patch.do_not_team_with ?? member.do_not_team_with),
            normalizeTeamEmailList(patch.avoid_team_with ?? member.avoid_team_with),
          )
        : null
      const payload = exclusive
        ? { ...patch, do_not_team_with: exclusive.never, avoid_team_with: exclusive.avoid }
        : patch

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('team').update(payload).eq('email', previousEmail)
      if (error) {
        console.error('Error updating team member field:', error)
        alert('팀원 정보 수정 중 오류가 발생했습니다.')
        return false
      }

      let peerUpdates: DoNotTeamPeerUpdate[] = []
      if (exclusive) {
        const { error: syncError, peerUpdates: synced } = await syncDoNotTeamWithPeers({
          selfEmail: previousEmail,
          previousNeverList: member.do_not_team_with,
          nextNeverList: exclusive.never,
          previousAvoidList: member.avoid_team_with,
          nextAvoidList: exclusive.avoid,
        })
        peerUpdates = synced
        if (syncError) {
          console.error('Error syncing team pair restrictions:', syncError)
          alert('팀원 정보는 저장되었지만, 상대 가이드 쪽 팀 조합 설정 동기화에 실패했습니다. 상대 팀원 정보를 확인해 주세요.')
        }
      }

      const nextEmail = typeof payload.email === 'string' && payload.email ? payload.email : previousEmail
      onSaved({ ...member, ...payload, email: nextEmail } as TeamMember, peerUpdates, previousEmail)
      return true
    } catch (error) {
      console.error('Error updating team member field:', error)
      alert('팀원 정보 수정 중 오류가 발생했습니다.')
      return false
    }
  }

  const toggleActive = async () => {
    const currentStatus = member.is_active ?? true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .update({ is_active: !currentStatus })
        .eq('email', member.email)
      if (error) {
        console.error('Error toggling team member status:', error)
        alert('팀원 상태 변경 중 오류가 발생했습니다.')
        return
      }
      alert(`팀원이 ${!currentStatus ? '활성화' : '비활성화'}되었습니다!`)
      onSaved({ ...member, is_active: !currentStatus }, undefined, member.email)
    } catch (error) {
      console.error('Error toggling team member status:', error)
      alert('팀원 상태 변경 중 오류가 발생했습니다.')
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10055] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="닫기"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-md">
          <button
            type="button"
            onClick={onClose}
            className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
          <div className="max-h-[90vh] overflow-y-auto rounded-2xl">
            <TeamMemberCard
              member={member}
              teamMembers={teamMembers}
              paymentMethods={paymentMethods}
              documentCount={documentCount}
              onOpenFullEdit={() => setShowForm(true)}
              onQuickEdit={setQuickEdit}
              onToggleActive={() => {
                void toggleActive()
              }}
            />
          </div>
        </div>
      </div>

      {quickEdit ? (
        <TeamMemberQuickEditModal
          member={member}
          field={quickEdit}
          onClose={() => setQuickEdit(null)}
          onSave={saveQuickEdit}
          payments={paymentMethods.map((method) => ({
            id: method.id,
            label: formatPaymentMethodDisplay(
              {
                id: method.id,
                method: method.method,
                display_name: method.display_name,
                user_email: method.user_email,
                card_holder_name: method.card_holder_name,
              },
              {
                nick_name: member.nick_name,
                name_en: member.name_en,
                name_ko: member.name_ko,
              },
            ),
            active: (method.status || '').trim().toLowerCase() === 'active',
          }))}
          manageHref={`/${locale}/admin/payment-methods?user_email=${encodeURIComponent(member.email)}`}
          documents={documents}
          onLoadDocuments={() => {
            void loadDocuments(member.email)
          }}
          peers={teamMembers
            .filter(
              (peer) =>
                peer.email !== member.email &&
                String(peer.is_active).toLowerCase() === 'true' &&
                isTourGuideOrDriverPosition(peer.position),
            )
            .map((peer) => ({
              email: peer.email,
              name_ko: peer.name_ko,
              nick_name: peer.nick_name,
              position: peer.position,
            }))}
        />
      ) : null}

      {showForm ? (
        <TeamMemberEditModal
          member={member}
          onClose={() => setShowForm(false)}
          onSaved={(updated, peerUpdates) => {
            onSaved(updated, peerUpdates, member.email)
            setShowForm(false)
          }}
        />
      ) : null}
    </>,
    document.body,
  )
}
