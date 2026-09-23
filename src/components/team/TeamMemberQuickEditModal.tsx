'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Download, FileText } from 'lucide-react'
import type { Database } from '@/lib/supabase'
import GuideProductSkillsFields from '@/components/team/GuideProductSkillsFields'
import { parseGuideProductSkills, type GuideProductSkills } from '@/lib/guideProductSkills'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberUpdate = Database['public']['Tables']['team']['Update']

export type TeamQuickField =
  | 'name'
  | 'languages'
  | 'position'
  | 'email'
  | 'phone'
  | 'address'
  | 'credentials'
  | 'payments'
  | 'documents'
  | 'pairing'
  | 'products'

export type TeamQuickPayment = {
  id: string
  label: string
  active: boolean
}

export type TeamQuickDocument = {
  id: string
  name: string
  url: string
  size: number
}

export type TeamQuickPeer = {
  email: string
  name_ko: string
  nick_name: string | null
  position: string | null
}

const POSITION_OPTIONS = [
  { value: 'manager', label: '매니저 (manager)' },
  { value: 'admin', label: '관리자 (admin)' },
  { value: 'tour guide', label: '투어 가이드 (tour guide)' },
  { value: 'driver', label: '운전기사 (driver)' },
  { value: 'op', label: '운영자 (op)' },
]

const LANGUAGE_OPTIONS = [
  { value: 'KR', label: '한국어' },
  { value: 'EN', label: '영어' },
  { value: 'JP', label: '일본어' },
  { value: 'CN', label: '중국어' },
  { value: 'ES', label: '스페인어' },
  { value: 'FR', label: '프랑스어' },
  { value: 'DE', label: '독일어' },
  { value: 'RU', label: '러시아어' },
]

const DOCUMENT_LABELS: Record<string, string> = {
  contract: '계약서',
  id_copy: '신분증 사본',
  bank_info: 'W9',
  other: '기타 문서',
}

function fileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop() || '').toLowerCase() : ''
}

function isImageFile(name: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(fileExtension(name))
}

function isPdfFile(name: string): boolean {
  return fileExtension(name) === 'pdf'
}

const FIELD_TITLE: Record<TeamQuickField, string> = {
  name: '이름',
  languages: '언어',
  position: '직책',
  email: '이메일',
  phone: '전화번호',
  address: '집주소',
  credentials: '자격사항',
  payments: '연결 결제수단',
  documents: '문서',
  pairing: '팀 조합 제한',
  products: '투어 가이드로 진행 가능한 상품',
}

const READ_ONLY_FIELDS = new Set<TeamQuickField>(['payments', 'documents'])

export function TeamCardQuickButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={className}
    >
      {children}
    </button>
  )
}

export default function TeamMemberQuickEditModal({
  member,
  field,
  onClose,
  onSave,
  payments,
  manageHref,
  documents,
  onLoadDocuments,
  peers,
}: {
  member: TeamMember
  field: TeamQuickField
  onClose: () => void
  onSave: (patch: TeamMemberUpdate) => Promise<boolean>
  payments?: TeamQuickPayment[]
  manageHref?: string
  documents?: Record<string, TeamQuickDocument[]> | null
  onLoadDocuments?: () => void
  peers?: TeamQuickPeer[]
}) {
  const readOnly = READ_ONLY_FIELDS.has(field)
  const [saving, setSaving] = useState(false)
  const [nameKo, setNameKo] = useState(member.name_ko || '')
  const [nameEn, setNameEn] = useState(member.name_en || '')
  const [nickName, setNickName] = useState(member.nick_name || '')
  const [languages, setLanguages] = useState<string[]>(member.languages || [])
  const [position, setPosition] = useState(member.position || '')
  const [email, setEmail] = useState(member.email || '')
  const [phone, setPhone] = useState(member.phone || '')
  const [address, setAddress] = useState(member.home_address || '')
  const [cpr, setCpr] = useState(Boolean(member.cpr))
  const [cprAcquired, setCprAcquired] = useState(member.cpr_acquired || '')
  const [cprExpired, setCprExpired] = useState(member.cpr_expired || '')
  const [medical, setMedical] = useState(Boolean(member.medical_report))
  const [medicalAcquired, setMedicalAcquired] = useState(member.medical_acquired || '')
  const [medicalExpired, setMedicalExpired] = useState(member.medical_expired || '')
  const [cdl, setCdl] = useState(Boolean(member.cdl_driver_license))
  const [car, setCar] = useState(member.personal_car_model || '')
  const [neverList, setNeverList] = useState<string[]>(member.do_not_team_with || [])
  const [avoidList, setAvoidList] = useState<string[]>(member.avoid_team_with || [])
  const [productSkills, setProductSkills] = useState<GuideProductSkills>(() => parseGuideProductSkills(member.guide_product_skills))
  const [viewer, setViewer] = useState<{ url: string; name: string; kind: 'image' | 'pdf' } | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (field === 'documents') onLoadDocuments?.()
    // 모달이 열릴 때 한 번만 불러온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, member.email])

  const save = async () => {
    const patch = buildPatch()
    if (!patch) return
    setSaving(true)
    const ok = await onSave(patch)
    setSaving(false)
    if (ok) onClose()
  }

  const buildPatch = (): TeamMemberUpdate | null => {
    if (field === 'name') {
      if (!nameKo.trim()) {
        alert('한국어 이름을 입력해 주세요.')
        return null
      }
      return {
        name_ko: nameKo.trim(),
        name_en: nameEn.trim() || null,
        nick_name: nickName.trim() || null,
      }
    }
    if (field === 'languages') return { languages }
    if (field === 'position') return { position: position || null }
    if (field === 'email') {
      const next = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
        alert('이메일 형식을 확인해 주세요.')
        return null
      }
      return { email: next }
    }
    if (field === 'phone') return { phone: phone.trim() || null }
    if (field === 'address') return { home_address: address.trim() || null }
    if (field === 'credentials') {
      return {
        cpr,
        cpr_acquired: cpr ? cprAcquired || null : null,
        cpr_expired: cpr ? cprExpired || null : null,
        medical_report: medical,
        medical_acquired: medical ? medicalAcquired || null : null,
        medical_expired: medical ? medicalExpired || null : null,
        cdl_driver_license: cdl,
        personal_car_model: car.trim() || null,
      }
    }
    if (field === 'pairing') {
      return { do_not_team_with: neverList, avoid_team_with: avoidList }
    }
    if (field === 'products') {
      return { guide_product_skills: productSkills }
    }
    return null
  }

  const toggleLanguage = (value: string) => {
    setLanguages((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  const cyclePair = (emailNorm: string) => {
    const inNever = neverList.some((item) => item.trim().toLowerCase() === emailNorm)
    const inAvoid = !inNever && avoidList.some((item) => item.trim().toLowerCase() === emailNorm)
    const nextNever = neverList.filter((item) => item.trim().toLowerCase() !== emailNorm)
    const nextAvoid = avoidList.filter((item) => item.trim().toLowerCase() !== emailNorm)
    if (!inNever && !inAvoid) {
      setAvoidList([...nextAvoid, emailNorm])
      setNeverList(nextNever)
      return
    }
    if (inAvoid) {
      setAvoidList(nextAvoid)
      setNeverList([...nextNever, emailNorm])
      return
    }
    setAvoidList(nextAvoid)
    setNeverList(nextNever)
  }

  if (typeof document === 'undefined') return null

  const wide = field === 'payments' || field === 'documents' || field === 'pairing' || field === 'credentials' || field === 'products'

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${FIELD_TITLE[field]} ${readOnly ? '보기' : '수정'}`}
        className={`w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-xl ${field === 'products' ? 'max-w-3xl' : wide ? 'max-w-xl' : 'max-w-md'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">{member.name_ko} · {FIELD_TITLE[field]}</h2>
        <p className="mt-1 text-xs text-gray-500">{readOnly ? '이 항목만 확인합니다.' : '이 항목만 저장합니다.'}</p>
        <div className="mt-4 max-h-[60vh] overflow-y-auto">{renderField()}</div>
        <div className="mt-5 flex justify-end gap-2">
          {field === 'payments' && manageHref ? (
            <Link href={manageHref} className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-primary hover:bg-gray-100">
              관리
            </Link>
          ) : null}
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm text-gray-600 hover:bg-gray-100">
            {readOnly ? '닫기' : '취소'}
          </button>
          {readOnly ? null : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? '저장 중' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )

  function renderField() {
    if (field === 'languages') {
      return (
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((language) => {
            const selected = languages.includes(language.value)
            return (
              <button
                key={language.value}
                type="button"
                onClick={() => toggleLanguage(language.value)}
                className={`rounded-xl border px-3 py-2 text-sm ${selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
              >
                {language.label}
              </button>
            )
          })}
        </div>
      )
    }
    if (field === 'position') {
      return (
        <select value={position} onChange={(event) => setPosition(event.target.value)} className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm">
          <option value="">미지정</option>
          {POSITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
    if (field === 'name') {
      return (
        <div className="space-y-3">
          <Field label="한국어 이름" value={nameKo} onChange={setNameKo} />
          <Field label="닉네임" value={nickName} onChange={setNickName} />
          <Field label="영어 이름" value={nameEn} onChange={setNameEn} />
        </div>
      )
    }
    if (field === 'email') return <Field label="이메일" value={email} onChange={setEmail} type="email" />
    if (field === 'phone') return <Field label="전화번호" value={phone} onChange={setPhone} />
    if (field === 'address') {
      return (
        <textarea
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          placeholder="자택 주소"
        />
      )
    }
    if (field === 'credentials') {
      return (
        <div className="space-y-5">
          <CertFields label="CPR 자격증" checked={cpr} onChecked={setCpr} acquired={cprAcquired} expired={cprExpired} onAcquired={setCprAcquired} onExpired={setCprExpired} />
          <CertFields label="의료 보고서" checked={medical} onChecked={setMedical} acquired={medicalAcquired} expired={medicalExpired} onAcquired={setMedicalAcquired} onExpired={setMedicalExpired} />
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={cdl} onChange={(event) => setCdl(event.target.checked)} />
            CDL 운전면허
          </label>
          <Field label="개인차량 모델" value={car} onChange={setCar} />
        </div>
      )
    }
    if (field === 'payments') {
      const methods = payments || []
      if (methods.length === 0) return <p className="text-sm text-gray-500">등록된 결제수단이 없습니다.</p>
      return (
        <div className="flex flex-wrap gap-1.5">
          {methods.map((method) => (
            <span
              key={method.id}
              className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-xs font-medium ${
                method.active ? 'border-green-300 bg-green-100 text-green-900' : 'border-pink-300 bg-pink-100 text-pink-900'
              }`}
            >
              <span className="truncate">{method.label}</span>
            </span>
          ))}
        </div>
      )
    }
    if (field === 'documents') {
      if (!documents) return <p className="py-6 text-center text-sm text-gray-500">문서를 불러오는 중...</p>
      const items = Object.entries(documents).flatMap(([type, docs]) =>
        docs.map((doc) => ({ ...doc, type, label: DOCUMENT_LABELS[type] || type })),
      )
      if (items.length === 0) return <p className="py-6 text-center text-sm text-gray-500">업로드된 문서가 없습니다.</p>
      const photos = items.filter((doc) => isImageFile(doc.name))
      const files = items.filter((doc) => !isImageFile(doc.name))
      return (
        <div className="space-y-4">
          {viewer ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="truncate text-xs text-gray-600">{viewer.name}</p>
                <button type="button" onClick={() => setViewer(null)} className="text-xs text-gray-500 hover:text-gray-800">
                  목록
                </button>
              </div>
              {viewer.kind === 'image' ? (
                <img src={viewer.url} alt={viewer.name} className="max-h-[50vh] w-full object-contain bg-white" />
              ) : (
                <iframe title={viewer.name} src={viewer.url} className="h-[50vh] w-full bg-white" />
              )}
            </div>
          ) : null}
          {photos.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">사진 {photos.length}개</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setViewer({ url: doc.url, name: `${doc.label} · ${doc.name}`, kind: 'image' })}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left"
                  >
                    <img src={doc.url} alt={doc.name} className="h-24 w-full object-cover" />
                    <span className="block truncate px-2 py-1 text-[11px] text-gray-600">{doc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {files.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">문서 {files.length}개</p>
              {files.map((doc) =>
                isPdfFile(doc.name) ? (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setViewer({ url: doc.url, name: `${doc.label} · ${doc.name}`, kind: 'pdf' })}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-2 text-left hover:bg-gray-100"
                  >
                    <span className="flex min-w-0 items-center">
                      <FileText className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-gray-700">{doc.label}</span>
                        <span className="block text-xs text-gray-400">{(doc.size / 1024).toFixed(1)} KB</span>
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-500">보기</span>
                  </button>
                ) : (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
                  >
                    <span className="flex min-w-0 items-center">
                      <FileText className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-gray-700">{doc.label}</span>
                        <span className="block text-xs text-gray-400">{(doc.size / 1024).toFixed(1)} KB</span>
                      </span>
                    </span>
                    <Download className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  </a>
                ),
              )}
            </div>
          ) : null}
        </div>
      )
    }
    if (field === 'products') {
      return (
        <GuideProductSkillsFields
          skills={productSkills}
          languages={member.languages}
          showHeading={false}
          onChange={setProductSkills}
        />
      )
    }
    const people = peers || []
    if (people.length === 0) return <p className="text-sm text-gray-500">선택할 수 있는 팀원이 없습니다.</p>
    return (
      <div>
        <p className="mb-2 text-xs text-gray-500">클릭할 때마다 전환됩니다: 없음 → 기피(경고) → 절대 금지(배정 불가) → 없음</p>
        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />기피 · 경고</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />절대 금지 · 배정 차단</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {people.map((peer) => {
            const emailNorm = peer.email.trim().toLowerCase()
            const isNever = neverList.some((item) => item.trim().toLowerCase() === emailNorm)
            const isAvoid = !isNever && avoidList.some((item) => item.trim().toLowerCase() === emailNorm)
            const label = peer.nick_name?.trim() || peer.name_ko
            return (
              <button
                key={peer.email}
                type="button"
                title={peer.email}
                onClick={() => cyclePair(emailNorm)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  isNever
                    ? 'border-red-400 bg-red-100 text-red-950'
                    : isAvoid
                      ? 'border-amber-400 bg-amber-100 text-amber-950'
                      : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {label}
                {isNever ? ' · 절대' : isAvoid ? ' · 기피' : ''}
                {peer.position ? <span className="ml-1 text-[10px] text-gray-500">({peer.position})</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="block text-sm text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3"
      />
    </label>
  )
}

function CertFields({
  label,
  checked,
  onChecked,
  acquired,
  expired,
  onAcquired,
  onExpired,
}: {
  label: string
  checked: boolean
  onChecked: (value: boolean) => void
  acquired: string
  expired: string
  onAcquired: (value: string) => void
  onExpired: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} />
        {label}
      </label>
      {checked ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            취득일
            <input type="date" value={acquired || ''} onChange={(event) => onAcquired(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3" />
          </label>
          <label className="text-sm text-gray-700">
            만료일
            <input type="date" value={expired || ''} onChange={(event) => onExpired(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3" />
          </label>
        </div>
      ) : null}
    </div>
  )
}
