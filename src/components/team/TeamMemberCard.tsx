'use client'

import ReactCountryFlag from 'react-country-flag'
import { Car, CreditCard, FileText, Shield, User } from 'lucide-react'
import type { Database } from '@/lib/supabase'
import { extractPaymentMethodCardLabel } from '@/lib/paymentMethodDisplay'
import { TeamCardQuickButton, type TeamQuickField } from '@/components/team/TeamMemberQuickEditModal'
import { GuideProductSkillBadges, selectedGuideProductCount, showsGuideProductSkills } from '@/components/team/GuideProductSkillsFields'
import { isTourGuideOrDriverPosition } from '@/lib/teamDoNotTeamWith'

type TeamMember = Database['public']['Tables']['team']['Row']

export type TeamCardPaymentMethodRow = Pick<
  Database['public']['Tables']['payment_methods']['Row'],
  'id' | 'method' | 'display_name' | 'status' | 'method_type' | 'user_email' | 'card_holder_name'
>

function teamCardPaymentBadgeLabel(method: string | null, displayName: string | null): string {
  const raw = extractPaymentMethodCardLabel(displayName, method).trim()
  return raw.replace(/^([A-Za-z]+)\s+(\d+)\b/, '$1$2') || '결제수단'
}

function teamCardPairingBadges(member: TeamMember, members: TeamMember[]) {
  const byEmail = new Map(members.map((item) => [item.email.trim().toLowerCase(), item]))
  const nickFor = (email: string) => {
    const peer = byEmail.get(email.trim().toLowerCase())
    if (!peer) return null
    if (String(peer.is_active).toLowerCase() !== 'true') return null
    if (!isTourGuideOrDriverPosition(peer.position)) return null
    return peer.nick_name?.trim() || peer.name_ko
  }
  const never = (member.do_not_team_with || []).flatMap((email) => {
    const nick = nickFor(email)
    return nick ? [{ email, nick, level: 'never' as const }] : []
  })
  const neverEmails = new Set(never.map((item) => item.email.trim().toLowerCase()))
  const avoid = (member.avoid_team_with || []).flatMap((email) => {
    if (neverEmails.has(email.trim().toLowerCase())) return []
    const nick = nickFor(email)
    return nick ? [{ email, nick, level: 'avoid' as const }] : []
  })
  return [...never, ...avoid]
}

function languageCountryCode(lang: string): string {
  if (lang === 'KR') return 'KR'
  if (lang === 'EN') return 'US'
  if (lang === 'JP') return 'JP'
  if (lang === 'CN') return 'CN'
  if (lang === 'ES') return 'ES'
  if (lang === 'FR') return 'FR'
  if (lang === 'DE') return 'DE'
  if (lang === 'RU') return 'RU'
  return 'US'
}

export default function TeamMemberCard({
  member,
  teamMembers,
  paymentMethods,
  documentCount,
  onOpenFullEdit,
  onQuickEdit,
  onToggleActive,
}: {
  member: TeamMember
  teamMembers: TeamMember[]
  paymentMethods: TeamCardPaymentMethodRow[]
  documentCount: number | null
  onOpenFullEdit: () => void
  onQuickEdit: (field: TeamQuickField) => void
  onToggleActive: () => void
}) {
  const pairing = teamCardPairingBadges(member, teamMembers)

  return (
    <div
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:shadow-lg"
      onClick={onOpenFullEdit}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex-shrink-0">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name_ko}
                  className="h-14 w-14 rounded-full object-cover ring-4 ring-gray-50"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 ring-4 ring-gray-50">
                  <User size={24} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <TeamCardQuickButton
                label={`${member.name_ko} 이름 수정`}
                onClick={() => onQuickEdit('name')}
                className="block max-w-full truncate rounded-lg text-left text-lg font-semibold tracking-tight text-gray-900 hover:bg-gray-50"
              >
                {member.name_ko}
                {member.nick_name ? (
                  <span className="ml-1.5 text-sm font-normal text-primary">({member.nick_name})</span>
                ) : null}
              </TeamCardQuickButton>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-gray-600">
                <TeamCardQuickButton
                  label="언어 수정"
                  onClick={() => onQuickEdit('languages')}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-gray-100"
                >
                  {member.languages && member.languages.length > 0 ? (
                    member.languages.map((lang: string, index: number) => (
                      <ReactCountryFlag
                        key={index}
                        countryCode={languageCountryCode(lang)}
                        svg
                        style={{
                          width: '16px',
                          height: '12px',
                          borderRadius: '2px',
                        }}
                        title={lang}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">언어</span>
                  )}
                </TeamCardQuickButton>
                <TeamCardQuickButton
                  label="영어 이름 수정"
                  onClick={() => onQuickEdit('name')}
                  className="min-w-0 truncate rounded-lg px-1 text-left text-gray-500 hover:bg-gray-50"
                >
                  {member.name_en || '영문명 없음'}
                </TeamCardQuickButton>
              </div>
              <TeamCardQuickButton
                label="직책 수정"
                onClick={() => onQuickEdit('position')}
                className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-200"
              >
                {member.position || '미지정'}
              </TeamCardQuickButton>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleActive()
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                member.is_active ? 'bg-green-600' : 'bg-gray-200'
              }`}
              aria-label={member.is_active ? '비활성화' : '활성화'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  member.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-1 space-y-1 rounded-xl bg-gray-50 p-1.5">
          <TeamCardQuickButton
            label="이메일 수정"
            onClick={() => onQuickEdit('email')}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white"
          >
            <span className="shrink-0 text-gray-500">이메일</span>
            <span className="truncate font-medium text-primary">{member.email}</span>
          </TeamCardQuickButton>

          <TeamCardQuickButton
            label="전화번호 수정"
            onClick={() => onQuickEdit('phone')}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white"
          >
            <span className="shrink-0 text-gray-500">전화번호</span>
            <span className="font-medium text-gray-900">{member.phone || '미등록'}</span>
          </TeamCardQuickButton>
        </div>

        <div className="mt-3 space-y-2">
          <TeamCardQuickButton
            label={pairing.length === 0 ? '팀 조합 제한 없음' : `팀 조합 제한 ${pairing.map((item) => item.nick).join(' ')}`}
            onClick={() => onQuickEdit('pairing')}
            className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 px-3 py-2.5 text-left text-sm hover:border-gray-200 hover:bg-gray-50"
          >
            <span className="shrink-0 text-gray-500">팀 조합 제한</span>
            {pairing.length === 0 ? (
              <span className="text-xs text-gray-400">없음</span>
            ) : (
              pairing.map((item) => (
                <span
                  key={`${item.level}-${item.email}`}
                  className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${
                    item.level === 'never'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-950'
                  }`}
                >
                  {item.nick}
                </span>
              ))
            )}
          </TeamCardQuickButton>

          {showsGuideProductSkills(member.position) ? (
            <TeamCardQuickButton
              label="투어 가이드로 진행 가능한 상품 수정"
              onClick={() => onQuickEdit('products')}
              className="block w-full rounded-xl border border-gray-100 px-3 py-2.5 text-left hover:border-gray-200 hover:bg-gray-50"
            >
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-gray-500">투어 가이드로 진행 가능한 상품</span>
                <span className="shrink-0 text-xs font-semibold text-gray-800">
                  {selectedGuideProductCount(member.guide_product_skills)}개
                </span>
              </span>
              <GuideProductSkillBadges skills={member.guide_product_skills} />
            </TeamCardQuickButton>
          ) : null}

          <TeamCardQuickButton
            label={paymentMethods.length === 0 ? '연결 결제수단 없음' : `연결 결제수단 ${paymentMethods.map((method) => teamCardPaymentBadgeLabel(method.method, method.display_name)).join(' ')}`}
            onClick={() => onQuickEdit('payments')}
            className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 px-3 py-2.5 text-left text-sm hover:border-gray-200 hover:bg-gray-50"
          >
            <span className="flex shrink-0 items-center gap-1.5 text-gray-500">
              <CreditCard size={14} />
              연결 결제수단
            </span>
            {paymentMethods.length === 0 ? (
              <span className="text-xs text-gray-400">없음</span>
            ) : (
              paymentMethods.map((method) => {
                const active = (method.status || '').trim().toLowerCase() === 'active'
                return (
                  <span
                    key={method.id}
                    className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${
                      active
                        ? 'border-green-200 bg-green-50 text-green-900'
                        : 'border-pink-200 bg-pink-50 text-pink-900'
                    }`}
                  >
                    {teamCardPaymentBadgeLabel(method.method, method.display_name)}
                  </span>
                )
              })
            )}
          </TeamCardQuickButton>

          <TeamCardQuickButton
            label="자격사항 수정"
            onClick={() => onQuickEdit('credentials')}
            className="block w-full rounded-xl border border-gray-100 px-3 py-2.5 text-left hover:border-gray-200 hover:bg-gray-50"
          >
            <span className="mb-2 block text-sm text-gray-500">자격사항</span>
            <span className="flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                member.cpr
                  ? (member.cpr_expired && new Date(member.cpr_expired) < new Date()
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800')
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <Shield size={12} className="mr-1" />
                CPR {member.cpr ? (member.cpr_expired && new Date(member.cpr_expired) < new Date() ? '(만료)' : '') : '(없음)'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                member.medical_report
                  ? (member.medical_expired && new Date(member.medical_expired) < new Date()
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800')
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <FileText size={12} className="mr-1" />
                의료보고서 {member.medical_report ? (member.medical_expired && new Date(member.medical_expired) < new Date() ? '(만료)' : '') : '(없음)'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                member.cdl_driver_license ? 'bg-yellow-100 text-yellow-900' : 'bg-gray-100 text-gray-800'
              }`}>
                <Car size={12} className="mr-1" />
                CDL {member.cdl_driver_license ? '' : '(없음)'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                member.personal_car_model ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                <Car size={12} className="mr-1" />
                {member.personal_car_model ? '개인차량' : '개인차량 (없음)'}
              </span>
            </span>
          </TeamCardQuickButton>

          <TeamCardQuickButton
            label={documentCount === null ? '문서 불러오는 중' : `문서 ${documentCount}개 보기`}
            onClick={() => onQuickEdit('documents')}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-left text-sm text-gray-700 hover:border-gray-200 hover:bg-gray-50"
          >
            <span className="flex items-center">
              <FileText size={14} className="mr-2" />
              문서
            </span>
            <span className="text-xs font-medium text-gray-700">
              {documentCount === null ? '…' : `${documentCount}개`}
            </span>
          </TeamCardQuickButton>
        </div>
      </div>
    </div>
  )
}
