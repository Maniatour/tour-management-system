'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  DollarSign, 
  Calendar, 
  User, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Download,
  Upload,
  LayoutGrid,
  Table2,
  ArrowUp,
  ArrowDown,
  GitMerge,
  ChevronDown
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import PaymentMethodUsageModal from '@/components/PaymentMethodUsageModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

/** /api/admin/payment-methods/merge 참조 테이블 표시용 */
const MERGE_REF_TABLE_LABELS: Record<string, string> = {
  payment_records: '결제 기록',
  company_expenses: '회사 지출',
  reservation_expenses: '예약 지출',
  tour_expenses: '투어 지출',
  ticket_bookings: '티켓 부킹',
  tour_hotel_bookings: '투어 호텔 부킹',
}

function paymentMethodFinancialLabel(m: PaymentMethod): string {
  const n = m.financial_account?.name?.trim()
  if (n) return n
  if (m.financial_account_id) return m.financial_account_id
  return '—'
}

/** API 참조 건수 → 표시는 구간(0 / 1~10 / 10+). 정렬은 raw number 유지 */
function formatPaymentMethodReferenceBand(count: number, t: (k: string) => string): string {
  if (count === 0) return t('referenceCountBand0')
  if (count <= 10) return t('referenceCountBandLow')
  return t('referenceCountBandHigh')
}

function paymentMethodReferenceBandClass(count: number): string {
  if (count === 0) return 'text-amber-700 font-medium'
  return ''
}

/** 결제 방법 통합 모달 — 방법/ID · 가이드 · 사용자 · 금융 · 메모 열 (체크·라디오 열은 부모에서) */
function MergeMethodDetailCells({
  method,
  userLabel,
}: {
  method: PaymentMethod
  userLabel: string
}) {
  const guidePrimary =
    method.team?.name_ko?.trim() || method.team?.name_en?.trim() || ''
  const guideSub =
    method.team?.name_ko &&
    method.team?.name_en &&
    method.team.name_ko !== method.team.name_en
      ? method.team.name_en
      : ''
  const fin = paymentMethodFinancialLabel(method)
  const memo = method.notes?.trim() || ''
  return (
    <>
      <td className="px-2 py-1.5 align-top text-gray-900 max-w-[11rem] border-b border-gray-100">
        <div className="font-medium truncate" title={method.method}>
          {method.method}
        </div>
        <div className="text-[11px] font-mono text-gray-500 truncate" title={method.id}>
          {method.id}
        </div>
      </td>
      <td className="px-2 py-1.5 align-top text-gray-800 text-xs max-w-[9rem] border-b border-gray-100">
        {guidePrimary ? (
          <>
            <div className="font-medium truncate" title={guidePrimary}>
              {guidePrimary}
            </div>
            {guideSub ? (
              <div className="text-gray-600 truncate" title={guideSub}>
                {guideSub}
              </div>
            ) : null}
          </>
        ) : method.user_email ? (
          <div className="text-gray-600 truncate" title={method.user_email}>
            {method.user_email}
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 align-top text-gray-700 text-xs max-w-[12rem] border-b border-gray-100">
        <span className="line-clamp-3 break-words" title={userLabel}>
          {userLabel}
        </span>
      </td>
      <td className="px-2 py-1.5 align-top text-gray-700 text-xs max-w-[10rem] border-b border-gray-100">
        <span className="line-clamp-3 break-words" title={fin}>
          {fin}
        </span>
      </td>
      <td className="px-2 py-1.5 align-top text-gray-600 text-xs max-w-[12rem] border-b border-gray-100">
        <span
          className="line-clamp-3 break-words whitespace-pre-wrap"
          title={memo || undefined}
        >
          {memo || '—'}
        </span>
      </td>
    </>
  )
}

/** 일괄 수정 모달 — 금융 계정 드롭다운용 (/api/financial/accounts) */
interface FinancialAccountOption {
  id: string
  name: string
  account_type?: string
}

interface PaymentMethod {
  id: string
  method: string
  method_type: string
  user_email: string
  limit_amount: number | null
  status: string
  card_number_last4: string | null
  card_type: string | null
  card_holder_name: string | null
  expiry_date: string | null
  monthly_limit: number | null
  daily_limit: number | null
  current_month_usage: number
  current_day_usage: number
  assigned_date: string
  last_used_date: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  display_name?: string | null
  deduct_card_fee_for_tips?: boolean | null
  financial_account_id?: string | null
  financial_account?: { id: string; name: string } | null
  /** 지출·결제·부킹 등에서 이 ID(trim 일치)로 저장된 행 수. 서버에 service_role 없으면 null */
  reference_count?: number | null
  team?: {
    email: string
    name_ko: string
    name_en: string
  } | null
}

interface PaymentMethodManagerProps {
  userEmail?: string
  userRole?: 'admin' | 'team_member'
  onMethodUpdated?: () => void
}

/** 팀 멤버 목록(결제 방법 폼·벌크 사용자 선택 등) */
interface TeamMemberWithStatus {
  email: string
  name_ko: string
  name_en: string | null
  nick_name: string | null
  is_active: boolean
}

function teamMemberMatchesSearchQuery(member: TeamMemberWithStatus, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const parts: string[] = [member.email, member.name_ko]
  if (member.name_en) parts.push(member.name_en)
  if (member.nick_name) parts.push(member.nick_name)
  return parts.some((p) => p.toLowerCase().includes(q))
}

export default function PaymentMethodManager({ 
  userEmail, 
  userRole = 'team_member',
  onMethodUpdated 
}: PaymentMethodManagerProps) {
  
  const t = useTranslations('paymentMethod')
  const locale = useLocale()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [teamMembersWithStatus, setTeamMembersWithStatus] = useState<TeamMemberWithStatus[]>([])
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [showBulkEditForm, setShowBulkEditForm] = useState(false)
  const [listViewMode, setListViewMode] = useState<'cards' | 'table'>('table')
  /** 테이블 뷰: 방법명(method) 정렬 — 중복 확인용 */
  const [tableMethodNameSort, setTableMethodNameSort] = useState<'asc' | 'desc'>('asc')
  /** null: 방법명만 정렬. asc: 참조 적은 순(0건 먼저), desc: 많은 순 */
  const [tableReferenceSort, setTableReferenceSort] = useState<'asc' | 'desc' | null>(null)
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([])
  /** 중복 결제 방법 → 하나로 통합 (전역 참조 테이블 마이그레이션) */
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeSourceIds, setMergeSourceIds] = useState<Set<string>>(() => new Set())
  const [mergeDeleteSources, setMergeDeleteSources] = useState(true)
  const [mergePreview, setMergePreview] = useState<{
    perSource: Record<string, Record<string, number>>
    total: number
  } | null>(null)
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false)
  const [mergeSubmitting, setMergeSubmitting] = useState(false)
  /** 방법명 클릭 시 — 해당 ID를 참조하는 지출·부킹·입금 행 조회·수정 */
  const [usageModalMethod, setUsageModalMethod] = useState<PaymentMethod | null>(null)
  const [bulkEditRows, setBulkEditRows] = useState<Array<{
    id: string
    method: string
    method_type: string
    user_email: string
    status: string
    notes: string
    financial_account_id: string
  }>>([{
    id: '',
    method: '',
    method_type: 'card',
    user_email: '',
    status: 'active',
    notes: '',
    financial_account_id: ''
  }])
  const [bulkEditUserSelectIndex, setBulkEditUserSelectIndex] = useState<number | null>(null)
  const [bulkEditUserMemberSearch, setBulkEditUserMemberSearch] = useState('')
  /** 일괄 수정 모달: 전체 목록 API 로딩 */
  const [bulkEditLoading, setBulkEditLoading] = useState(false)
  const [bulkEditFinancialAccounts, setBulkEditFinancialAccounts] = useState<FinancialAccountOption[]>([])
  const [bulkEditFinancialAccountsError, setBulkEditFinancialAccountsError] = useState<string | null>(null)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [bulkRows, setBulkRows] = useState<Array<{
    id: string
    method: string
    method_type: string
    user_emails: string[]
    status: string
    notes: string
  }>>([{
    id: '',
    method: '',
    method_type: 'card',
    user_emails: [],
    status: 'active',
    notes: ''
  }])
  const [bulkUserSelectIndex, setBulkUserSelectIndex] = useState<number | null>(null)
  const [bulkUserMemberSearch, setBulkUserMemberSearch] = useState('')
  const [formTeamMemberSearch, setFormTeamMemberSearch] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    method_type: '',
    search: ''
  })

  const paymentMethodSelectOptions = useMemo(
    () => methods.map((m) => ({ id: m.id, method: m.method })),
    [methods]
  )

  // 폼 데이터
  const [formData, setFormData] = useState({
    id: '',
    method: '',
    method_type: 'card',
    user_emails: userEmail ? [userEmail] : [] as string[],
    limit_amount: '',
    status: 'active',
    card_number_last4: '',
    card_type: '',
    card_holder_name: '',
    expiry_month: '',
    expiry_year: '',
    monthly_limit: '',
    daily_limit: '',
    notes: '',
    deduct_card_fee_for_tips: false
  })
  
  // 만료일을 YYYY-MM-01 형식으로 변환
  const getExpiryDate = () => {
    if (formData.expiry_month && formData.expiry_year) {
      return `${formData.expiry_year}-${formData.expiry_month.padStart(2, '0')}-01`
    }
    return null
  }
  
  // 만료일에서 월과 연도 추출
  const parseExpiryDate = (dateString: string | null) => {
    if (!dateString) return { month: '', year: '' }
    const parts = dateString.split('-')
    if (parts.length >= 2) {
      return { month: parts[1], year: parts[0] }
    }
    return { month: '', year: '' }
  }

  // 데이터 로드
  useEffect(() => {
    loadMethods()
    loadTeamMembers()
  }, [userEmail])

  useEffect(() => {
    if (bulkUserSelectIndex === null) {
      setBulkUserMemberSearch('')
    }
  }, [bulkUserSelectIndex])

  useEffect(() => {
    if (bulkEditUserSelectIndex === null) {
      setBulkEditUserMemberSearch('')
    }
  }, [bulkEditUserSelectIndex])

  const bulkUserSelectActiveMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => m.is_active && teamMemberMatchesSearchQuery(m, bulkUserMemberSearch)
      ),
    [teamMembersWithStatus, bulkUserMemberSearch]
  )

  const bulkUserSelectInactiveMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => !m.is_active && teamMemberMatchesSearchQuery(m, bulkUserMemberSearch)
      ),
    [teamMembersWithStatus, bulkUserMemberSearch]
  )

  const formActiveTeamMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => m.is_active && teamMemberMatchesSearchQuery(m, formTeamMemberSearch)
      ),
    [teamMembersWithStatus, formTeamMemberSearch]
  )

  const formInactiveTeamMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => !m.is_active && teamMemberMatchesSearchQuery(m, formTeamMemberSearch)
      ),
    [teamMembersWithStatus, formTeamMemberSearch]
  )

  const bulkEditUserSelectActiveMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => m.is_active && teamMemberMatchesSearchQuery(m, bulkEditUserMemberSearch)
      ),
    [teamMembersWithStatus, bulkEditUserMemberSearch]
  )

  const bulkEditUserSelectInactiveMembers = useMemo(
    () =>
      teamMembersWithStatus.filter(
        (m) => !m.is_active && teamMemberMatchesSearchQuery(m, bulkEditUserMemberSearch)
      ),
    [teamMembersWithStatus, bulkEditUserMemberSearch]
  )

  useEffect(() => {
    if (!showAddForm) {
      setFormTeamMemberSearch('')
    }
  }, [showAddForm])

  const loadMethods = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('limit', '5000')
      if (userEmail) params.append('user_email', userEmail)
      if (filters.status) params.append('status', filters.status)
      if (filters.method_type) params.append('method_type', filters.method_type)

      const response = await fetch(`/api/payment-methods?${params}`)
      const result = await response.json()
      
      if (result.success) {
        let filteredData = result.data
        
        // 검색 필터 적용
        if (filters.search) {
          const q = filters.search.toLowerCase()
          filteredData = filteredData.filter((method: PaymentMethod) =>
            method.method.toLowerCase().includes(q) ||
            method.id.toLowerCase().includes(q) ||
            (method.team?.name_ko && method.team.name_ko.toLowerCase().includes(q)) ||
            (method.team?.name_en && method.team.name_en.toLowerCase().includes(q)) ||
            (method.notes && method.notes.toLowerCase().includes(q)) ||
            (method.financial_account?.name &&
              method.financial_account.name.toLowerCase().includes(q))
          )
        }
        
        setMethods(filteredData)
      }
    } catch (error) {
      console.error('Error loading payment methods:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko', { ascending: true })

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      const membersWithStatus: TeamMemberWithStatus[] = []
      
      data?.forEach((member) => {
        membersMap[String(member.email).toLowerCase()] =
          member.name_ko || member.name_en || member.email
        membersWithStatus.push({
          email: member.email,
          name_ko: member.name_ko,
          name_en: member.name_en ?? null,
          nick_name: member.nick_name ?? null,
          is_active: member.is_active ?? true
        })
      })
      
      setTeamMembers(membersMap)
      setTeamMembersWithStatus(membersWithStatus)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  // 결제 방법 추가
  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingMethod) {
      await handleUpdateMethod(e)
      return
    }
    
    // ID 필수 검증
    if (!formData.id || formData.id.trim() === '') {
      alert('ID를 입력해주세요.')
      return
    }
    
    try {
      const createdMethods: PaymentMethod[] = []
      const inputId = formData.id.trim() // 사용자가 입력한 ID
      
      console.log('결제 방법 추가 시도:', {
        inputId: inputId,
        method: formData.method,
        userEmails: formData.user_emails
      })
      
      // 방법명에서 공백과 특수문자 제거하여 ID 생성에 사용 (자동 생성 시에만 사용)
      const methodSlug = formData.method.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
      
      // 사용자가 선택된 경우 각 사용자마다 레코드 생성, 없으면 하나만 생성
      if (formData.user_emails.length > 0) {
        // 선택한 각 사용자마다 결제 방법 레코드 생성
        for (let i = 0; i < formData.user_emails.length; i++) {
          const userEmail = formData.user_emails[i]
          // 이메일에서 사용자명 부분 추출 (예: user@example.com -> user)
          const emailPrefix = userEmail.split('@')[0]
          
          // ID 생성: 사용자가 입력한 ID가 있으면 그대로 사용, 없으면 자동 생성
          let id: string
          if (inputId) {
            // 사용자가 ID를 입력한 경우, 여러 사용자일 때는 사용자별로 구분
            if (formData.user_emails.length > 1) {
              id = `${inputId}-${emailPrefix}`
            } else {
              // 단일 사용자이면 입력한 ID 그대로 사용
              id = inputId
            }
          } else {
            // ID가 없으면 자동 생성
            const baseId = `PAYM${Date.now().toString().slice(-6)}`
            id = `${baseId}-${methodSlug}-${emailPrefix}`
          }
          
          console.log('생성할 ID:', id, '입력한 ID:', inputId)
        
        let retryCount = 0
        const maxRetries = 5
        
        while (retryCount < maxRetries) {
          const response = await fetch('/api/payment-methods', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id,
              method: formData.method,
              method_type: formData.method_type,
              user_email: userEmail,
              limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
              status: formData.status,
              card_number_last4: formData.card_number_last4,
              card_type: formData.card_type,
              card_holder_name: formData.card_holder_name,
              expiry_date: getExpiryDate(),
              monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
              daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
              notes: formData.notes,
              created_by: userEmail,
              deduct_card_fee_for_tips: formData.deduct_card_fee_for_tips
            })
          })
          
          console.log('API 요청 전송:', { id, method: formData.method })

          const result = await response.json()
          
        // ID 중복 오류인 경우
        if (!result.success && result.message?.includes('already exists')) {
          // 사용자가 명시적으로 ID를 입력한 경우, 기존 레코드를 불러와서 수정 모드로 전환
          if (inputId) {
            try {
              const existingResponse = await fetch(`/api/payment-methods/${id}`)
              const existingResult = await existingResponse.json()
              
              if (existingResult.success && existingResult.data) {
                // 기존 레코드를 수정 모드로 전환
                const existingMethod = existingResult.data
                setEditingMethod(existingMethod)
                // 폼 데이터를 기존 레코드로 채우되, 사용자가 입력한 새 정보로 업데이트
                setFormData({
                  id: existingMethod.id,
                  method: formData.method || existingMethod.method,
                  method_type: formData.method_type || existingMethod.method_type || 'card',
                  user_emails: existingMethod.user_email ? [existingMethod.user_email] : [],
                  limit_amount: formData.limit_amount || existingMethod.limit_amount?.toString() || '',
                  status: formData.status || existingMethod.status || 'active',
                  card_number_last4: formData.card_number_last4 || existingMethod.card_number_last4 || '',
                  card_type: formData.card_type || existingMethod.card_type || '',
                  card_holder_name: formData.card_holder_name || existingMethod.card_holder_name || '',
                  expiry_month: existingMethod.expiry_date ? existingMethod.expiry_date.split('-')[1] : '',
                  expiry_year: existingMethod.expiry_date ? existingMethod.expiry_date.split('-')[0] : '',
                  monthly_limit: formData.monthly_limit || existingMethod.monthly_limit?.toString() || '',
                  daily_limit: formData.daily_limit || existingMethod.daily_limit?.toString() || '',
                  notes: formData.notes || existingMethod.notes || '',
                  deduct_card_fee_for_tips: !!(existingMethod as any).deduct_card_fee_for_tips
                })
                alert(`ID "${inputId}"가 이미 존재합니다. 기존 레코드를 수정 모드로 불러왔습니다.`)
                return // 추가 대신 수정 모드로 전환
              }
            } catch (fetchError) {
              console.error('기존 레코드 조회 실패:', fetchError)
            }
            throw new Error(`ID "${inputId}"가 이미 존재합니다. 다른 ID를 사용해주세요.`)
          }
          // 자동 생성된 ID가 중복된 경우에만 재시도
          retryCount++
          if (retryCount < maxRetries) {
            id = `PAYM${Date.now().toString().slice(-6)}${i}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
            continue
          }
        }
          
          if (!result.success) {
            const errorMessage = result.error || result.message || '알 수 없는 오류'
            console.error('API Error:', result)
            throw new Error(errorMessage)
          }
          
          createdMethods.push(result.data)
          break
        }
        }
      } else {
        // 사용자가 선택되지 않은 경우 하나의 레코드만 생성
        const id = inputId // 사용자가 입력한 ID 그대로 사용
        
        console.log('사용자 없이 생성할 ID:', id, '입력한 ID:', inputId)
        
        const response = await fetch('/api/payment-methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id,
            method: formData.method,
            method_type: formData.method_type,
            user_email: null, // 사용자 없음
            limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
            status: formData.status,
            card_number_last4: formData.card_number_last4,
            card_type: formData.card_type,
            card_holder_name: formData.card_holder_name,
            expiry_date: getExpiryDate(),
            monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
            daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
            notes: formData.notes,
            created_by: userEmail || null,
            deduct_card_fee_for_tips: formData.deduct_card_fee_for_tips
          })
        })
        
        console.log('API 요청 전송 (사용자 없음):', { id, method: formData.method })

        const result = await response.json()
        
        // ID 중복 오류인 경우
        if (!result.success && result.message?.includes('already exists')) {
          // 기존 레코드를 불러와서 수정 모드로 전환
          try {
            const existingResponse = await fetch(`/api/payment-methods/${id}`)
            const existingResult = await existingResponse.json()
            
            if (existingResult.success && existingResult.data) {
              // 기존 레코드를 수정 모드로 전환
              const existingMethod = existingResult.data
              setEditingMethod(existingMethod)
              // 폼 데이터를 기존 레코드로 채우되, 사용자가 입력한 새 정보로 업데이트
              setFormData({
                id: existingMethod.id,
                method: formData.method || existingMethod.method,
                method_type: formData.method_type || existingMethod.method_type || 'card',
                user_emails: existingMethod.user_email ? [existingMethod.user_email] : [],
                limit_amount: formData.limit_amount || existingMethod.limit_amount?.toString() || '',
                status: formData.status || existingMethod.status || 'active',
                card_number_last4: formData.card_number_last4 || existingMethod.card_number_last4 || '',
                card_type: formData.card_type || existingMethod.card_type || '',
                card_holder_name: formData.card_holder_name || existingMethod.card_holder_name || '',
                expiry_month: existingMethod.expiry_date ? existingMethod.expiry_date.split('-')[1] : '',
                expiry_year: existingMethod.expiry_date ? existingMethod.expiry_date.split('-')[0] : '',
                monthly_limit: formData.monthly_limit || existingMethod.monthly_limit?.toString() || '',
                daily_limit: formData.daily_limit || existingMethod.daily_limit?.toString() || '',
                notes: formData.notes || existingMethod.notes || '',
                deduct_card_fee_for_tips: !!(existingMethod as any).deduct_card_fee_for_tips
              })
              alert(`ID "${inputId}"가 이미 존재합니다. 기존 레코드를 수정 모드로 불러왔습니다.`)
              return // 추가 대신 수정 모드로 전환
            }
          } catch (fetchError) {
            console.error('기존 레코드 조회 실패:', fetchError)
          }
          throw new Error(`ID "${inputId}"가 이미 존재합니다. 다른 ID를 사용해주세요.`)
        }
        
        if (!result.success) {
          const errorMessage = result.error || result.message || '알 수 없는 오류'
          console.error('API Error:', result)
          throw new Error(errorMessage)
        }
        
        createdMethods.push(result.data)
      }

      setMethods(prev => [...createdMethods, ...prev])
      setShowAddForm(false)
      resetForm()
      onMethodUpdated?.()
      alert(`결제 방법이 ${createdMethods.length}개 등록되었습니다.`)
    } catch (error) {
      console.error('Error adding payment method:', error)
      alert(`결제 방법 등록에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 수정
  const handleUpdateMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingMethod) return
    
    try {
      // 수정 시에는 첫 번째 선택된 사용자만 사용 (기존 레코드 업데이트)
      // 사용자가 선택되지 않은 경우 null로 설정
      const response = await fetch(`/api/payment-methods/${editingMethod.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: formData.method,
          method_type: formData.method_type,
          user_email: formData.user_emails.length > 0 ? formData.user_emails[0] : null,
          limit_amount: formData.limit_amount && formData.limit_amount.trim() !== '' ? parseFloat(formData.limit_amount) : null,
          monthly_limit: formData.monthly_limit && formData.monthly_limit.trim() !== '' ? parseFloat(formData.monthly_limit) : null,
          daily_limit: formData.daily_limit && formData.daily_limit.trim() !== '' ? parseFloat(formData.daily_limit) : null,
          status: formData.status,
          card_number_last4: formData.card_number_last4 && formData.card_number_last4.trim() !== '' ? formData.card_number_last4 : null,
          card_type: formData.card_type && formData.card_type.trim() !== '' ? formData.card_type : null,
          card_holder_name: formData.card_holder_name && formData.card_holder_name.trim() !== '' ? formData.card_holder_name : null,
          expiry_date: getExpiryDate(),
          notes: formData.notes && formData.notes.trim() !== '' ? formData.notes : null,
          updated_by: userEmail || null,
          deduct_card_fee_for_tips: formData.deduct_card_fee_for_tips
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || '수정에 실패했습니다.')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || result.error || '수정에 실패했습니다.')
      }

      // 데이터 새로고침
      await loadMethods()
      
      setEditingMethod(null)
      setShowAddForm(false)
      resetForm()
      onMethodUpdated?.()
      alert('결제 방법이 수정되었습니다.')
    } catch (error) {
      console.error('Error updating payment method:', error)
      console.error('Error details:', {
        editingMethod: editingMethod?.id,
        formData: formData,
        error: error
      })
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`결제 방법 수정에 실패했습니다: ${errorMessage}`)
    }
  }

  // 결제 방법 삭제
  const handleDeleteMethod = async (id: string) => {
    if (!confirm('정말로 이 결제 방법을 삭제하시겠습니까?')) return
    const normalizedId = String(id ?? '').trim()
    if (!normalizedId) {
      alert('유효한 결제 방법 ID가 없습니다.')
      return
    }
    
    try {
      const response = await fetch(`/api/payment-methods/${encodeURIComponent(normalizedId)}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      await loadMethods()
      onMethodUpdated?.()
      alert('결제 방법이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting payment method:', error)
      alert(`결제 방법 삭제에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 상태 토글 (활성/비활성)
  const handleToggleStatus = async (method: PaymentMethod) => {
    const newStatus = method.status === 'active' ? 'inactive' : 'active'
    
    try {
      const response = await fetch(`/api/payment-methods/${method.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          updated_by: userEmail
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      // 로컬 상태 업데이트
      setMethods(prev => prev.map(m => 
        m.id === method.id ? { ...m, status: newStatus } : m
      ))
      onMethodUpdated?.()
    } catch (error) {
      console.error('Error toggling payment method status:', error)
      alert(`상태 변경에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 수정 모드로 전환
  const handleEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method)
    const { month, year } = parseExpiryDate(method.expiry_date)
    setFormData({
      id: method.id,
      method: method.method,
      method_type: method.method_type,
      user_emails: method.user_email ? [method.user_email] : [],
      limit_amount: method.limit_amount?.toString() || '',
      status: method.status,
      card_number_last4: method.card_number_last4 || '',
      card_type: method.card_type || '',
      card_holder_name: method.card_holder_name || '',
      expiry_month: month,
      expiry_year: year,
      monthly_limit: method.monthly_limit?.toString() || '',
      daily_limit: method.daily_limit?.toString() || '',
      notes: method.notes || '',
      deduct_card_fee_for_tips: !!(method as any).deduct_card_fee_for_tips
    })
    setShowAddForm(true)
    setShowAllUsers(false)
  }

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      id: '',
      method: '',
      method_type: 'card',
      user_emails: userEmail ? [userEmail] : [],
      limit_amount: '',
      status: 'active',
      card_number_last4: '',
      card_type: '',
      card_holder_name: '',
      expiry_month: '',
      expiry_year: '',
      monthly_limit: '',
      daily_limit: '',
      notes: '',
      deduct_card_fee_for_tips: false
    })
    setShowAllUsers(false)
  }
  
  // 사용자 선택 토글
  const toggleUserSelection = (email: string) => {
    setFormData(prev => {
      const isSelected = prev.user_emails.includes(email)
      if (isSelected) {
        return {
          ...prev,
          user_emails: prev.user_emails.filter(e => e !== email)
        }
      } else {
        return {
          ...prev,
          user_emails: [...prev.user_emails, email]
        }
      }
    })
  }

  // 벌크 행 추가
  const addBulkRow = () => {
    setBulkRows(prev => [...prev, {
      id: '',
      method: '',
      method_type: 'card',
      user_emails: [],
      status: 'active',
      notes: ''
    }])
  }

  // 벌크 행 삭제
  const removeBulkRow = (index: number) => {
    setBulkRows(prev => prev.filter((_, i) => i !== index))
  }

  // 벌크 행 업데이트
  const updateBulkRow = (index: number, field: string, value: string | string[]) => {
    setBulkRows(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ))
  }

  // 벌크 행 사용자 선택 토글
  const toggleBulkUserSelection = (rowIndex: number, email: string) => {
    setBulkRows(prev => prev.map((row, i) => {
      if (i === rowIndex) {
        const emails = row.user_emails ?? []
        const isSelected = emails.includes(email)
        return {
          ...row,
          user_emails: isSelected
            ? emails.filter(e => e !== email)
            : [...emails, email]
        }
      }
      return row
    }))
  }

  // 벌크 업로드 처리
  const handleBulkSubmit = async () => {
    try {
      setLoading(true)
      
      // 필수 필드 검증
      const invalidRows: number[] = []
      bulkRows.forEach((row, index) => {
        if (!row.id.trim() || !row.method.trim()) {
          invalidRows.push(index + 1)
        }
      })

      if (invalidRows.length > 0) {
        alert(`다음 행에 ID와 방법명이 필요합니다: ${invalidRows.join(', ')}`)
        setLoading(false)
        return
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      }

      // 각 행을 결제 방법으로 변환하여 생성
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i]
        
        try {
          // 여러 사용자가 선택된 경우 각 사용자마다 레코드 생성
          const userEmails = (row.user_emails && row.user_emails.length > 0) ? row.user_emails : [null]
          
          for (let j = 0; j < userEmails.length; j++) {
            const userEmailValue = userEmails[j]
            
            // ID 생성: 여러 사용자일 때는 사용자별로 구분
            let finalId = row.id.trim()
            if (userEmails.length > 1 && userEmailValue) {
              const emailPrefix = userEmailValue.split('@')[0]
              finalId = `${row.id.trim()}-${emailPrefix}`
            }

            // API 호출
            const response = await fetch('/api/payment-methods', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                id: finalId,
                method: row.method.trim(),
                method_type: row.method_type,
                user_email: userEmailValue || null,
                status: row.status,
                notes: row.notes || null,
                created_by: userEmailValue || userEmail || null
              })
            })

            const result = await response.json()
            
            if (result.success) {
              results.success++
            } else {
              results.failed++
              results.errors.push(`행 ${i + 1}${userEmails.length > 1 ? ` (${userEmailValue})` : ''}: ${result.message || result.error || '알 수 없는 오류'}`)
            }
          }
        } catch (error) {
          results.failed++
          results.errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        }
      }

      // 결과 표시
      await loadMethods()
      onMethodUpdated?.()
      
      let message = `등록 완료: 성공 ${results.success}개, 실패 ${results.failed}개`
      if (results.errors.length > 0) {
        message += `\n\n오류 상세:\n${results.errors.slice(0, 10).join('\n')}`
        if (results.errors.length > 10) {
          message += `\n... 외 ${results.errors.length - 10}개 오류`
        }
      }
      alert(message)
      
      if (results.success > 0) {
        setShowBulkForm(false)
        setBulkRows([{
          id: '',
          method: '',
          method_type: 'card',
          user_emails: [],
          status: 'active',
          notes: ''
        }])
        setBulkUserSelectIndex(null)
      }
    } catch (error) {
      console.error('Error in bulk upload:', error)
      alert(`벌크 업로드에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const emptyBulkEditRow = () => ({
    id: '',
    method: '',
    method_type: 'card',
    user_email: '',
    status: 'active',
    notes: '',
    financial_account_id: ''
  })

  const fetchFinancialAccountsForBulkEdit = async (): Promise<{
    list: FinancialAccountOption[]
    error: string | null
  }> => {
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('sb-access-token')?.trim() : null
      if (!token) {
        return { list: [], error: '금융 계정 목록을 불러오려면 로그인이 필요합니다.' }
      }
      const res = await fetch('/api/financial/accounts', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin'
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: FinancialAccountOption[]
        error?: string
      }
      if (!res.ok || json.success === false) {
        return {
          list: [],
          error: json.error || `금융 계정 목록을 불러오지 못했습니다. (${res.status})`
        }
      }
      return { list: json.data || [], error: null }
    } catch (e) {
      return {
        list: [],
        error: e instanceof Error ? e.message : '금융 계정 목록을 불러오지 못했습니다.'
      }
    }
  }

  const paymentMethodsToBulkEditRows = (list: PaymentMethod[]) =>
    list.map((m) => ({
      id: m.id,
      method: m.method,
      method_type: m.method_type,
      user_email: m.user_email || '',
      status: m.status,
      notes: m.notes || '',
      financial_account_id: m.financial_account_id ?? ''
    }))

  /** 상태/유형/검색 필터 없이 전부 로드 (페이지네이션). 관리자 단일 사용자 뷰(userEmail)는 유지 */
  const fetchAllPaymentMethodsForBulkEdit = async (): Promise<PaymentMethod[]> => {
    const pageSize = 500
    const all: PaymentMethod[] = []
    let offset = 0
    for (;;) {
      const params = new URLSearchParams()
      if (userEmail) params.append('user_email', userEmail)
      params.append('limit', String(pageSize))
      params.append('offset', String(offset))

      const response = await fetch(`/api/payment-methods?${params}`)
      const result = await response.json()

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || '결제 방법 목록을 불러오지 못했습니다.')
      }

      const chunk = result.data as PaymentMethod[]
      all.push(...chunk)
      if (chunk.length < pageSize) break
      offset += pageSize
      if (offset > 200000) break
    }
    return all
  }

  const openBulkEditWithAllMethods = async () => {
    setShowBulkEditForm(true)
    setBulkEditUserSelectIndex(null)
    setBulkEditRows([])
    setBulkEditLoading(true)
    try {
      const [faRes, fetched] = await Promise.all([
        fetchFinancialAccountsForBulkEdit(),
        fetchAllPaymentMethodsForBulkEdit()
      ])
      setBulkEditFinancialAccounts(faRes.list)
      setBulkEditFinancialAccountsError(faRes.error)
      setBulkEditRows(
        fetched.length > 0 ? paymentMethodsToBulkEditRows(fetched) : [emptyBulkEditRow()]
      )
    } catch (error) {
      console.error('openBulkEditWithAllMethods:', error)
      alert(
        `전체 목록을 불러오지 못했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      )
      setShowBulkEditForm(false)
    } finally {
      setBulkEditLoading(false)
    }
  }

  const resetBulkEditRows = () => {
    setBulkEditRows([emptyBulkEditRow()])
    setBulkEditUserSelectIndex(null)
    setBulkEditLoading(false)
    setBulkEditFinancialAccounts([])
    setBulkEditFinancialAccountsError(null)
  }

  const addBulkEditRow = () => {
    setBulkEditRows(prev => [...prev, emptyBulkEditRow()])
  }

  const removeBulkEditRow = (index: number) => {
    setBulkEditRows(prev => prev.filter((_, i) => i !== index))
  }

  const updateBulkEditRow = (index: number, field: string, value: string) => {
    setBulkEditRows(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    ))
  }

  const toggleBulkEditUserSelection = (rowIndex: number, email: string) => {
    setBulkEditRows(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row
      return {
        ...row,
        user_email: row.user_email === email ? '' : email
      }
    }))
  }

  const handleBulkEditSubmit = async () => {
    try {
      setLoading(true)

      const invalidRows: number[] = []
      bulkEditRows.forEach((row, index) => {
        if (!row.id.trim() || !row.method.trim()) {
          invalidRows.push(index + 1)
        }
      })

      if (invalidRows.length > 0) {
        alert(`다음 행에 ID와 방법명이 필요합니다: ${invalidRows.join(', ')}`)
        setLoading(false)
        return
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      }

      for (let i = 0; i < bulkEditRows.length; i++) {
        const row = bulkEditRows[i]
        const id = row.id.trim()
        try {
          const response = await fetch(`/api/payment-methods/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              method: row.method.trim(),
              method_type: row.method_type,
              user_email: row.user_email.trim() || null,
              status: row.status,
              notes: row.notes.trim() || null,
              financial_account_id: row.financial_account_id.trim() || null,
              updated_by: userEmail || null
            })
          })

          const result = await response.json()

          if (result.success) {
            results.success++
          } else {
            results.failed++
            results.errors.push(`행 ${i + 1} (${id}): ${result.message || result.error || '알 수 없는 오류'}`)
          }
        } catch (error) {
          results.failed++
          results.errors.push(`행 ${i + 1} (${id}): ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        }
      }

      await loadMethods()
      onMethodUpdated?.()

      let message = `수정 완료: 성공 ${results.success}개, 실패 ${results.failed}개`
      if (results.errors.length > 0) {
        message += `\n\n오류 상세:\n${results.errors.slice(0, 10).join('\n')}`
        if (results.errors.length > 10) {
          message += `\n... 외 ${results.errors.length - 10}개 오류`
        }
      }
      alert(message)

      if (results.success > 0) {
        setShowBulkEditForm(false)
        resetBulkEditRows()
        setSelectedMethodIds([])
      }
    } catch (error) {
      console.error('Error in bulk edit:', error)
      alert(`일괄 수정에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const openBulkEditFromSelection = async () => {
    if (selectedMethodIds.length === 0) {
      alert('테이블에서 수정할 결제 방법을 선택해주세요.')
      return
    }

    setShowBulkEditForm(true)
    setBulkEditUserSelectIndex(null)
    setBulkEditRows([])
    setBulkEditLoading(true)
    try {
      const [faRes, all] = await Promise.all([
        fetchFinancialAccountsForBulkEdit(),
        fetchAllPaymentMethodsForBulkEdit()
      ])
      setBulkEditFinancialAccounts(faRes.list)
      setBulkEditFinancialAccountsError(faRes.error)
      const idSet = new Set(selectedMethodIds)
      const picked = all.filter((m) => idSet.has(m.id))
      const rows = paymentMethodsToBulkEditRows(picked)

      if (rows.length === 0) {
        alert('선택한 항목을 전체 목록에서 찾을 수 없습니다.')
        setShowBulkEditForm(false)
        return
      }

      setBulkEditRows(rows)
    } catch (error) {
      console.error('openBulkEditFromSelection:', error)
      alert(
        `목록을 불러오지 못했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      )
      setShowBulkEditForm(false)
    } finally {
      setBulkEditLoading(false)
    }
  }

  const toggleMethodSelected = (id: string) => {
    setSelectedMethodIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const allVisibleSelected =
    methods.length > 0 && methods.every((m) => selectedMethodIds.includes(m.id))

  const toggleSelectAllVisible = () => {
    const visibleIds = methods.map((m) => m.id)
    if (allVisibleSelected) {
      setSelectedMethodIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedMethodIds((prev) => [...new Set([...prev, ...visibleIds])])
    }
  }

  /** 테이블/카드: 직원명 + 이메일 (API team 조인 + 대소문자 무시 teamMembers 맵) */
  const displayPaymentMethodUser = (method: PaymentMethod) => {
    if (!method.user_email?.trim()) return '미할당'
    const e = method.user_email.trim()
    const el = e.toLowerCase()
    const name = method.team?.name_ko || method.team?.name_en || teamMembers[el]
    if (name) return `${name} · ${e}`
    return e
  }

  /** 테이블 뷰: 참조 건수 정렬이 켜져 있으면 1차 참조 수, 2차 방법명. 아니면 방법명만 */
  const tableSortedMethods = useMemo(() => {
    if (listViewMode !== 'table') return methods
    return [...methods].sort((a, b) => {
      if (tableReferenceSort) {
        const sentinel = (v: number | null | undefined) =>
          v == null ? Number.POSITIVE_INFINITY : v
        const ac = sentinel(a.reference_count)
        const bc = sentinel(b.reference_count)
        if (ac !== bc) {
          return tableReferenceSort === 'asc' ? ac - bc : bc - ac
        }
      }
      const cmp = a.method.localeCompare(b.method, undefined, {
        sensitivity: 'base',
        numeric: true,
      })
      return tableMethodNameSort === 'asc' ? cmp : -cmp
    })
  }, [methods, listViewMode, tableMethodNameSort, tableReferenceSort])

  /** 방법명 정규화(공백·대소문자) 기준 동일 문자열이 2행 이상인 그룹 — 중복 의심 (아코디언 목록용) */
  const duplicateMethodNameGroupList = useMemo(() => {
    const byKey = new Map<string, PaymentMethod[]>()
    for (const m of methods) {
      const k = m.method.trim().toLowerCase()
      if (!k) continue
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k)!.push(m)
    }
    const groups: { key: string; label: string; items: PaymentMethod[] }[] = []
    for (const [k, arr] of byKey) {
      if (arr.length <= 1) continue
      const label = arr[0].method.trim() || k
      groups.push({
        key: k,
        label,
        items: [...arr].sort((a, b) => a.id.localeCompare(b.id)),
      })
    }
    groups.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
    )
    return groups
  }, [methods])

  const openMergeModal = (presetSourceIds?: string[]) => {
    setMergeTargetId('')
    setMergeDeleteSources(true)
    setMergePreview(null)
    if (presetSourceIds && presetSourceIds.length >= 1) {
      setMergeSourceIds(new Set(presetSourceIds))
    } else {
      setMergeSourceIds(new Set())
    }
    setMergeModalOpen(true)
  }

  const toggleMergeSource = (id: string) => {
    if (id === mergeTargetId) return
    setMergeSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runMergePaymentMethods = async () => {
    if (!mergeTargetId.trim()) {
      alert('유지할 결제 방법을 선택하세요.')
      return
    }
    const sources = [...mergeSourceIds].filter((id) => id !== mergeTargetId)
    if (sources.length === 0) {
      alert('통합할 결제 방법을 하나 이상 선택하세요.')
      return
    }
    const total = mergePreview?.total ?? 0
    const msg1 = `모든 참조 테이블에서 ${sources.length}개 ID → "${mergeTargetId}"(으)로 바꿉니다.\n(미리보기 참조 약 ${total}건)`
    if (!confirm(`${msg1}\n\n계속할까요?`)) return
    if (mergeDeleteSources) {
      if (
        !confirm(
          '선택한 원본 결제 방법 행을 payment_methods에서 삭제합니다.\n복구되지 않을 수 있습니다. 정말 삭제할까요?'
        )
      ) {
        return
      }
    }
    setMergeSubmitting(true)
    try {
      const res = await fetch('/api/admin/payment-methods/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: mergeTargetId.trim(),
          sourceIds: sources,
          deleteSources: mergeDeleteSources,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        alert(json.message || '통합에 실패했습니다.')
        return
      }
      const t = json.totalUpdated ?? 0
      const del = json.deletedSourceRows ?? 0
      alert(
        `통합 완료.\n참조 업데이트: ${t}건\n원본 삭제: ${mergeDeleteSources ? `${del}건` : '안 함'}`
      )
      setMergeModalOpen(false)
      setMergeSourceIds(new Set())
      setMergeTargetId('')
      await loadMethods()
      onMethodUpdated?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : '통합에 실패했습니다.')
    } finally {
      setMergeSubmitting(false)
    }
  }

  useEffect(() => {
    if (!mergeTargetId) return
    setMergeSourceIds((prev) => {
      if (!prev.has(mergeTargetId)) return prev
      const next = new Set(prev)
      next.delete(mergeTargetId)
      return next
    })
  }, [mergeTargetId])

  useEffect(() => {
    if (!mergeModalOpen) return
    const ids = [...mergeSourceIds].filter(Boolean)
    if (ids.length === 0) {
      setMergePreview(null)
      return
    }
    const ac = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        setMergePreviewLoading(true)
        try {
          const res = await fetch(
            `/api/admin/payment-methods/merge?sources=${encodeURIComponent(ids.join(','))}`,
            { signal: ac.signal }
          )
          const j = await res.json()
          if (j.success)
            setMergePreview({ perSource: j.perSource, total: j.total })
          else setMergePreview(null)
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
          setMergePreview(null)
        } finally {
          setMergePreviewLoading(false)
        }
      })()
    }, 400)
    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [mergeModalOpen, mergeSourceIds])

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} />
      case 'inactive': return <XCircle size={16} />
      case 'suspended': return <AlertTriangle size={16} />
      case 'expired': return <Clock size={16} />
      default: return <Clock size={16} />
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '활성'
      case 'inactive': return '비활성'
      case 'suspended': return '정지'
      case 'expired': return '만료'
      default: return status
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  // 사용량 비율 계산
  const getUsagePercentage = (current: number, limit: number | null) => {
    if (!limit || limit === 0) return 0
    return Math.min((current / limit) * 100, 100)
  }

  // 사용량 색상
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    loadMethods()
  }, [filters.status, filters.method_type, filters.search])

  useEffect(() => {
    if (listViewMode !== 'table') {
      setSelectedMethodIds([])
    }
  }, [listViewMode])

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 헤더 - 모바일 컴팩트 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">결제 방법 관리</h3>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0 justify-end">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setListViewMode('cards')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:px-3 text-sm transition-colors ${
                  listViewMode === 'cards'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="카드 보기"
              >
                <LayoutGrid size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">카드</span>
              </button>
              <button
                type="button"
                onClick={() => setListViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:px-3 text-sm border-l border-gray-200 transition-colors ${
                  listViewMode === 'table'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="테이블 보기"
              >
                <Table2 size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">테이블</span>
              </button>
            </div>
            <button
              onClick={() => {
                setShowAddForm(true)
                setEditingMethod(null)
                resetForm()
                setShowAllUsers(false)
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} className="sm:w-4 sm:h-4" />
              <span>추가</span>
            </button>
            <button
              onClick={() => {
                setShowBulkForm(true)
                setBulkRows([{
                  id: '',
                  method: '',
                  method_type: 'card',
                  user_emails: [],
                  status: 'active',
                  notes: ''
                }])
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">벌크 업로드</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void openBulkEditWithAllMethods()
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:pointer-events-none"
              disabled={bulkEditLoading}
            >
              <Edit size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">일괄 수정</span>
            </button>
            {listViewMode === 'table' && (
              <button
                type="button"
                disabled={selectedMethodIds.length === 0 || bulkEditLoading}
                onClick={() => {
                  void openBulkEditFromSelection()
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Edit size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  선택 수정{selectedMethodIds.length > 0 ? ` (${selectedMethodIds.length})` : ''}
                </span>
              </button>
            )}
            {methods.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => openMergeModal()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm border border-violet-400 bg-violet-50 text-violet-900 rounded-lg hover:bg-violet-100 transition-colors"
                  title="여러 ID를 하나로 합치기"
                >
                  <GitMerge size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">통합</span>
                </button>
                {listViewMode === 'table' && selectedMethodIds.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => openMergeModal(selectedMethodIds)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    <GitMerge size={14} className="sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">선택 통합 ({selectedMethodIds.length})</span>
                  </button>
                )}
              </>
            )}
        </div>
      </div>

      {/* 필터 - 모바일 컴팩트 */}
      <div className="bg-white border rounded-lg p-3 sm:p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">상태</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="suspended">정지</option>
              <option value="expired">만료</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">유형</label>
            <select
              value={filters.method_type}
              onChange={(e) => setFilters(prev => ({ ...prev, method_type: e.target.value }))}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체</option>
              <option value="card">카드</option>
              <option value="cash">현금</option>
              <option value="transfer">계좌이체</option>
              <option value="mobile">모바일</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">검색</label>
            <div className="relative">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="방법명, ID, 사용자 검색"
                className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 flex md:items-end">
            <button
              onClick={() => setFilters({ status: '', method_type: '', search: '' })}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 결제 방법 추가/수정 모달 */}
      <Dialog open={showAddForm} onOpenChange={(open) => {
        if (!open) {
          setShowAddForm(false)
          setEditingMethod(null)
          resetForm()
          setShowAllUsers(false)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? '결제 방법 수정' : '결제 방법 추가'}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2">
            <form onSubmit={handleAddMethod} className="space-y-4" id="payment-method-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value.trim() }))}
                  placeholder="PAYM033"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.user_emails.length > 1 
                    ? `여러 사용자 선택 시: "${formData.id || 'PAYM033'}-사용자명" 형식으로 저장됩니다.`
                    : `입력한 ID가 그대로 저장됩니다. (예: ${formData.id || 'PAYM033'})`
                  }
                </p>
              </div>

              {/* 방법명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  방법명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.method}
                  onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                  placeholder="CC 4052"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  유형 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.method_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, method_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="card">카드</option>
                  <option value="cash">현금</option>
                  <option value="transfer">계좌이체</option>
                  <option value="mobile">모바일</option>
                  <option value="other">기타</option>
                </select>
              </div>

              {/* 사용자 (다중 선택) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자
                  {formData.user_emails.length > 0 && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({formData.user_emails.length}명 선택됨)
                    </span>
                  )}
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
                  <input
                    type="search"
                    value={formTeamMemberSearch}
                    onChange={(e) => setFormTeamMemberSearch(e.target.value)}
                    placeholder="이름, 영문명, 닉네임, 이메일로 검색…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {teamMembersWithStatus.length === 0 ? (
                    <p className="text-sm text-gray-500">팀 멤버를 불러오는 중...</p>
                  ) : formTeamMemberSearch.trim() &&
                    formActiveTeamMembers.length === 0 &&
                    formInactiveTeamMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">검색 결과가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {/* 활성 사용자 먼저 표시 */}
                      {formActiveTeamMembers.map(({ email, name_ko, name_en, nick_name }) => {
                        const isSelected = formData.user_emails.includes(email)
                        return (
                          <label
                            key={email}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUserSelection(email)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              <span className="font-medium">{name_ko}</span>
                              {(nick_name || name_en) && (
                                <span className="text-gray-500">
                                  {' · '}
                                  {[nick_name, name_en].filter(Boolean).join(' · ')}
                                </span>
                              )}
                              <span className="text-gray-500"> ({email})</span>
                            </span>
                          </label>
                        )
                      })}

                      {/* 비활성 사용자 (더보기 버튼으로 표시) */}
                      {formInactiveTeamMembers.length > 0 && (
                        <>
                          {!showAllUsers && (
                            <button
                              type="button"
                              onClick={() => setShowAllUsers(true)}
                              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-2 px-2 rounded hover:bg-blue-50 transition-colors"
                            >
                              더보기 ({formInactiveTeamMembers.length}명)
                            </button>
                          )}

                          {showAllUsers && (
                            <>
                              {formInactiveTeamMembers.map(({ email, name_ko, name_en, nick_name }) => {
                                const isSelected = formData.user_emails.includes(email)
                                return (
                                  <label
                                    key={email}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded opacity-75"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleUserSelection(email)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-600">
                                      <span className="font-medium">{name_ko}</span>
                                      {(nick_name || name_en) && (
                                        <span className="text-gray-500">
                                          {' · '}
                                          {[nick_name, name_en].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                      <span className="text-gray-500"> ({email})</span>
                                    </span>
                                  </label>
                                )
                              })}
                              <button
                                type="button"
                                onClick={() => setShowAllUsers(false)}
                                className="w-full text-left text-sm text-gray-600 hover:text-gray-800 py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                              >
                                접기
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                  <option value="suspended">정지</option>
                  <option value="expired">만료</option>
                </select>
              </div>

              {/* Tips 쉐어 시 카드 수수료 공제 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="deduct_card_fee_for_tips"
                  checked={formData.deduct_card_fee_for_tips}
                  onChange={(e) => setFormData(prev => ({ ...prev, deduct_card_fee_for_tips: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="deduct_card_fee_for_tips" className="text-sm text-gray-700">
                  Tips 쉐어 시 카드 수수료 공제 (Wix Website, Square Invoice 등 온라인 결제 시 체크)
                </label>
              </div>
            </div>

            {/* 카드 관련 필드 (카드 유형일 때만 표시) */}
            {formData.method_type === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                {/* 한도 금액 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">한도 금액</label>
                  <input
                    type="number"
                    value={formData.limit_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, limit_amount: e.target.value }))}
                    placeholder="5000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 카드 번호 마지막 4자리 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카드 번호 마지막 4자리</label>
                  <input
                    type="text"
                    value={formData.card_number_last4}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_number_last4: e.target.value }))}
                    placeholder="4052"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 카드 타입 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카드 타입</label>
                  <select
                    value={formData.card_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">선택해주세요</option>
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">American Express</option>
                    <option value="discover">Discover</option>
                    <option value="jcb">JCB</option>
                    <option value="other">기타</option>
                  </select>
                </div>

                {/* 카드 소유자명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카드 소유자명</label>
                  <input
                    type="text"
                    value={formData.card_holder_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_holder_name: e.target.value }))}
                    placeholder="홍길동"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 만료일 (월/년) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.expiry_month}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiry_month: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">월 선택</option>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = (i + 1).toString().padStart(2, '0')
                        return (
                          <option key={month} value={month}>
                            {month}월
                          </option>
                        )
                      })}
                    </select>
                    <select
                      value={formData.expiry_year}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiry_year: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">년 선택</option>
                      {Array.from({ length: 20 }, (_, i) => {
                        const year = (new Date().getFullYear() + i).toString()
                        return (
                          <option key={year} value={year}>
                            {year}년
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                {/* 월 한도 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">월 한도</label>
                  <input
                    type="number"
                    value={formData.monthly_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_limit: e.target.value }))}
                    placeholder="100000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 일 한도 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">일 한도</label>
                  <input
                    type="number"
                    value={formData.daily_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, daily_limit: e.target.value }))}
                    placeholder="10000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="메모를 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            </form>
          </div>
          
          {/* 버튼 */}
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setEditingMethod(null)
                resetForm()
                setShowAllUsers(false)
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              form="payment-method-form"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingMethod ? '수정' : '등록'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 벌크 업로드 모달 */}
      <Dialog open={showBulkForm} onOpenChange={(open) => {
        if (!open) {
          setShowBulkForm(false)
          setBulkRows([{
            id: '',
            method: '',
            method_type: 'card',
            user_emails: [],
            status: 'active',
            notes: ''
          }])
          setBulkUserSelectIndex(null)
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>벌크 업로드 - 결제 방법 일괄 등록</DialogTitle>
            <DialogDescription>
              여러 결제 방법을 한번에 등록할 수 있습니다. 행 추가 버튼을 눌러 더 많은 행을 추가하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2" onClick={() => setBulkUserSelectIndex(null)}>
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">여러 결제 방법을 한번에 등록할 수 있습니다. 행 추가 버튼을 눌러 더 많은 행을 추가하세요.</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  addBulkRow()
                }}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>행 추가</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">삭제</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      ID <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      방법명 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      유형 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">사용자 이메일</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">상태</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => removeBulkRow(index)}
                          className="text-red-600 hover:text-red-800"
                          disabled={bulkRows.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.id}
                          onChange={(e) => updateBulkRow(index, 'id', e.target.value)}
                          placeholder="PAYM001"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.method}
                          onChange={(e) => updateBulkRow(index, 'method', e.target.value)}
                          placeholder="CC 4052"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={row.method_type}
                          onChange={(e) => updateBulkRow(index, 'method_type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="card">카드</option>
                          <option value="cash">현금</option>
                          <option value="transfer">계좌이체</option>
                          <option value="mobile">모바일</option>
                          <option value="other">기타</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setBulkUserSelectIndex(index)
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs cursor-pointer bg-white hover:bg-gray-50 min-h-[28px] flex items-center"
                        >
                          {(row.user_emails?.length || 0) > 0 ? (
                            <span className="text-xs text-gray-700">
                              {row.user_emails?.length || 0}명 선택됨
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">클릭하여 선택</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={row.status}
                          onChange={(e) => updateBulkRow(index, 'status', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="active">활성</option>
                          <option value="inactive">비활성</option>
                          <option value="suspended">정지</option>
                          <option value="expired">만료</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateBulkRow(index, 'notes', e.target.value)}
                          placeholder="메모"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowBulkForm(false)
                setBulkRows([{
                  id: '',
                  method: '',
                  method_type: 'card',
                  user_emails: [],
                  status: 'active',
                  notes: ''
                }])
                setBulkUserSelectIndex(null)
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleBulkSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              일괄 등록 ({bulkRows.length}개)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일괄 수정 모달 */}
      <Dialog open={showBulkEditForm} onOpenChange={(open) => {
        if (!open) {
          setShowBulkEditForm(false)
          resetBulkEditRows()
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>일괄 수정 - 결제 방법 테이블 편집</DialogTitle>
            <DialogDescription>
              열면 서버에서 결제 방법 전체 목록을 불러와 표에 채웁니다(목록 화면의 상태·유형·검색 필터와 무관). ID는 기존 레코드를 가리키며, 저장 시 반영됩니다. 명세 대조용 금융 계정 연결도 여기서 바꿀 수 있습니다. 행 추가로 신규 행을 넣을 수도 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2" onClick={() => setBulkEditUserSelectIndex(null)}>
            <div className="mb-4 flex justify-between items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-600">
                테이블 뷰에서 &quot;선택 수정&quot;을 쓰면 전체 목록 중 선택한 행만 이 모달에 불러옵니다.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  addBulkEditRow()
                }}
                disabled={bulkEditLoading}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus size={16} />
                <span>행 추가</span>
              </button>
            </div>

            {bulkEditFinancialAccountsError ? (
              <div
                className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                role="status"
              >
                {bulkEditFinancialAccountsError}{' '}
                <span className="text-amber-800/90">
                  (금융 계정 열은 비어 있을 수 있습니다. Super 권한·로그인 상태를 확인하세요.)
                </span>
              </div>
            ) : null}

            {bulkEditLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-3" />
                <p className="text-sm">전체 결제 방법 목록을 불러오는 중입니다…</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">삭제</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      ID <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      방법명 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                      유형 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">사용자</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700 min-w-[10rem]">
                      금융 계정
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">상태</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkEditRows.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => removeBulkEditRow(index)}
                          className="text-red-600 hover:text-red-800"
                          disabled={bulkEditRows.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.id}
                          onChange={(e) => updateBulkEditRow(index, 'id', e.target.value)}
                          placeholder="기존 ID"
                          className="w-full min-w-[120px] px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.method}
                          onChange={(e) => updateBulkEditRow(index, 'method', e.target.value)}
                          placeholder="CC 4052"
                          className="w-full min-w-[100px] px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={row.method_type}
                          onChange={(e) => updateBulkEditRow(index, 'method_type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="card">카드</option>
                          <option value="cash">현금</option>
                          <option value="transfer">계좌이체</option>
                          <option value="mobile">모바일</option>
                          <option value="other">기타</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setBulkEditUserSelectIndex(index)
                          }}
                          className="w-full min-w-[120px] px-2 py-1 border border-gray-300 rounded text-xs cursor-pointer bg-white hover:bg-gray-50 min-h-[28px] flex items-center"
                        >
                          {row.user_email ? (
                            <span className="text-xs text-gray-700 truncate" title={row.user_email}>
                              {teamMembers[row.user_email.toLowerCase()] || row.user_email}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">클릭하여 1명 선택</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={row.financial_account_id}
                          onChange={(e) =>
                            updateBulkEditRow(index, 'financial_account_id', e.target.value)
                          }
                          className="w-full min-w-[10rem] max-w-[18rem] px-2 py-1 border border-gray-300 rounded text-xs"
                          title="명세 대조용 금융 계정"
                          aria-label="금융 계정"
                        >
                          <option value="">없음</option>
                          {row.financial_account_id &&
                          !bulkEditFinancialAccounts.some((a) => a.id === row.financial_account_id) ? (
                            <option value={row.financial_account_id} title={row.financial_account_id}>
                              기존 연결 (목록에 없음)
                            </option>
                          ) : null}
                          {bulkEditFinancialAccounts.map((a) => (
                            <option key={a.id} value={a.id} title={a.name}>
                              {a.name}
                              {a.account_type ? ` (${a.account_type})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={row.status}
                          onChange={(e) => updateBulkEditRow(index, 'status', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="active">활성</option>
                          <option value="inactive">비활성</option>
                          <option value="suspended">정지</option>
                          <option value="expired">만료</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateBulkEditRow(index, 'notes', e.target.value)}
                          placeholder="메모"
                          className="w-full min-w-[100px] px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowBulkEditForm(false)
                resetBulkEditRows()
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleBulkEditSubmit}
              disabled={bulkEditLoading || bulkEditRows.length === 0}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              일괄 저장 ({bulkEditRows.length}개)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 벌크 업로드 사용자 선택 모달 */}
      <Dialog open={bulkUserSelectIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setBulkUserSelectIndex(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>사용자 선택</DialogTitle>
            <DialogDescription className="sr-only">
              이름, 영문명, 닉네임, 이메일로 검색한 뒤 사용자를 선택할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 pr-2">
            {bulkUserSelectIndex !== null && (
              <div className="space-y-4">
                {!teamMembersWithStatus || teamMembersWithStatus.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">팀 멤버를 불러오는 중...</p>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
                      <input
                        type="search"
                        value={bulkUserMemberSearch}
                        onChange={(e) => setBulkUserMemberSearch(e.target.value)}
                        placeholder="이름, 영문명, 닉네임, 이메일로 검색…"
                        autoComplete="off"
                        autoFocus
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {bulkUserMemberSearch.trim() &&
                    bulkUserSelectActiveMembers.length === 0 &&
                    bulkUserSelectInactiveMembers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">검색 결과가 없습니다.</p>
                    ) : (
                      <>
                        {/* 활성 사용자 */}
                        {bulkUserSelectActiveMembers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">활성 사용자</h3>
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                              {bulkUserSelectActiveMembers.map(({ email, name_ko, name_en, nick_name }) => {
                                const row = bulkRows[bulkUserSelectIndex]
                                const isSelected = (row?.user_emails || []).includes(email)
                                return (
                                  <label
                                    key={email}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (bulkUserSelectIndex !== null) {
                                          toggleBulkUserSelection(bulkUserSelectIndex, email)
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      <span className="font-medium">{name_ko}</span>
                                      {(nick_name || name_en) && (
                                        <span className="text-gray-500">
                                          {' · '}
                                          {[nick_name, name_en].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                      <span className="text-gray-500"> ({email})</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* 비활성 사용자 */}
                        {bulkUserSelectInactiveMembers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">비활성 사용자</h3>
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                              {bulkUserSelectInactiveMembers.map(({ email, name_ko, name_en, nick_name }) => {
                                const row = bulkRows[bulkUserSelectIndex]
                                const isSelected = (row?.user_emails || []).includes(email)
                                return (
                                  <label
                                    key={email}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded opacity-75"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (bulkUserSelectIndex !== null) {
                                          toggleBulkUserSelection(bulkUserSelectIndex, email)
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-600">
                                      <span className="font-medium">{name_ko}</span>
                                      {(nick_name || name_en) && (
                                        <span className="text-gray-500">
                                          {' · '}
                                          {[nick_name, name_en].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                      <span className="text-gray-500"> ({email})</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBulkUserSelectIndex(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              확인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일괄 수정 사용자 선택 모달 (행당 1명) */}
      <Dialog open={bulkEditUserSelectIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setBulkEditUserSelectIndex(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>사용자 선택 (1명)</DialogTitle>
            <DialogDescription className="sr-only">
              한 행당 한 명만 지정됩니다. 다시 클릭하면 선택이 해제됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2">
            {bulkEditUserSelectIndex !== null && (
              <div className="space-y-4">
                {!teamMembersWithStatus || teamMembersWithStatus.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">팀 멤버를 불러오는 중...</p>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
                      <input
                        type="search"
                        value={bulkEditUserMemberSearch}
                        onChange={(e) => setBulkEditUserMemberSearch(e.target.value)}
                        placeholder="이름, 영문명, 닉네임, 이메일로 검색…"
                        autoComplete="off"
                        autoFocus
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {bulkEditUserMemberSearch.trim() &&
                    bulkEditUserSelectActiveMembers.length === 0 &&
                    bulkEditUserSelectInactiveMembers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">검색 결과가 없습니다.</p>
                    ) : (
                      <>
                        {bulkEditUserSelectActiveMembers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">활성 사용자</h3>
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                              {bulkEditUserSelectActiveMembers.map(({ email, name_ko, name_en, nick_name }) => {
                                const row = bulkEditRows[bulkEditUserSelectIndex]
                                const isSelected = row?.user_email === email
                                return (
                                  <label
                                    key={email}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (bulkEditUserSelectIndex !== null) {
                                          toggleBulkEditUserSelection(bulkEditUserSelectIndex, email)
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      <span className="font-medium">{name_ko}</span>
                                      {(nick_name || name_en) && (
                                        <span className="text-gray-500">
                                          {' · '}
                                          {[nick_name, name_en].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                      <span className="text-gray-500"> ({email})</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {bulkEditUserSelectInactiveMembers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">비활성 사용자</h3>
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                              {bulkEditUserSelectInactiveMembers.map(({ email, name_ko, name_en, nick_name }) => {
                                const row = bulkEditRows[bulkEditUserSelectIndex]
                                const isSelected = row?.user_email === email
                                return (
                                  <label
                                    key={email}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded opacity-75"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (bulkEditUserSelectIndex !== null) {
                                          toggleBulkEditUserSelection(bulkEditUserSelectIndex, email)
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-600">
                                      <span className="font-medium">{name_ko}</span>
                                      {(nick_name || name_en) && (
                                        <span className="text-gray-500">
                                          {' · '}
                                          {[nick_name, name_en].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                      <span className="text-gray-500"> ({email})</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBulkEditUserSelectIndex(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              확인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 결제 방법 목록 - 모바일 컴팩트 */}
      {loading ? (
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2 text-sm">로딩중...</p>
        </div>
      ) : methods.length > 0 ? (
        listViewMode === 'table' ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-gray-100 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>현재 목록 전체 선택 ({methods.length}개)</span>
                </label>
                <span className="text-xs text-gray-500">
                  선택됨 {selectedMethodIds.length}개 · &quot;선택 수정&quot;으로 일괄 수정 모달에 불러오기
                </span>
              </div>
              {duplicateMethodNameGroupList.length > 0 && (
                <details className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md overflow-hidden open:[&_summary_svg]:rotate-180">
                  <summary className="cursor-pointer list-none px-2 py-1.5 flex items-start gap-2 [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 transition-transform"
                      aria-hidden
                    />
                    <span>
                      방법명이 같은(앞뒤 공백·대소문자 무시) 행이{' '}
                      <strong>{duplicateMethodNameGroupList.length}</strong>개 그룹 있습니다. 아래{' '}
                      <strong>방법명</strong> 헤더를 눌러 정렬하면 나란히 확인할 수 있습니다.
                      <span className="block mt-1 text-amber-900/90">
                        이 박스를 펼치면 그룹별 행 목록(아코디언)을 볼 수 있습니다.
                      </span>
                    </span>
                  </summary>
                  <div className="px-2 pb-2 pt-0 border-t border-amber-200/90 max-h-[min(60vh,28rem)] overflow-y-auto space-y-1.5">
                    {duplicateMethodNameGroupList.map((g) => (
                      <details
                        key={g.key}
                        className="rounded-md border border-amber-100 bg-white/95 shadow-sm open:[&_summary_svg]:rotate-180"
                      >
                        <summary
                          className="cursor-pointer list-none px-2 py-1.5 text-left flex flex-wrap items-baseline gap-x-2 gap-y-0.5 [&::-webkit-details-marker]:hidden"
                          title={g.key}
                        >
                          <ChevronDown
                            className="h-3.5 w-3.5 shrink-0 text-amber-700 transition-transform"
                            aria-hidden
                          />
                          <span className="font-semibold text-amber-950">{g.label}</span>
                          <span className="text-gray-600">({g.items.length}행)</span>
                        </summary>
                        <div className="px-2 pb-2 overflow-x-auto border-t border-amber-50/90">
                          <table className="w-full min-w-[720px] text-[11px] text-left">
                            <thead>
                              <tr className="text-gray-600 border-b border-gray-100 bg-gray-50/80">
                                <th className="py-1 px-1 font-medium whitespace-nowrap">ID</th>
                                <th className="py-1 px-1 font-medium min-w-[6rem]">방법명(저장값)</th>
                                <th className="py-1 px-1 font-medium min-w-[5rem]">가이드(이름)</th>
                                <th className="py-1 px-1 font-medium min-w-[6rem]">사용자</th>
                                <th className="py-1 px-1 font-medium min-w-[5rem]">금융 계정</th>
                                <th className="py-1 px-1 font-medium min-w-[6rem]">메모</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((m) => {
                                const guidePrimary =
                                  m.team?.name_ko?.trim() || m.team?.name_en?.trim() || ''
                                const guideSub =
                                  m.team?.name_ko &&
                                  m.team?.name_en &&
                                  m.team.name_ko !== m.team.name_en
                                    ? m.team.name_en
                                    : ''
                                return (
                                  <tr key={m.id} className="border-b border-gray-50 align-top last:border-0">
                                    <td className="py-1 px-1 font-mono text-gray-700 whitespace-nowrap">
                                      {m.id}
                                    </td>
                                    <td
                                      className="py-1 px-1 text-gray-900 max-w-[10rem] break-words"
                                      title={m.method}
                                    >
                                      {m.method}
                                    </td>
                                    <td className="py-1 px-1 text-gray-800">
                                      {guidePrimary ? (
                                        <>
                                          <div className="font-medium">{guidePrimary}</div>
                                          {guideSub ? (
                                            <div className="text-gray-600">{guideSub}</div>
                                          ) : null}
                                        </>
                                      ) : m.user_email ? (
                                        <span className="text-gray-600">{m.user_email}</span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="py-1 px-1 text-gray-700 max-w-[11rem] break-words">
                                      {displayPaymentMethodUser(m)}
                                    </td>
                                    <td className="py-1 px-1 text-gray-700 max-w-[9rem] break-words">
                                      {paymentMethodFinancialLabel(m)}
                                    </td>
                                    <td
                                      className="py-1 px-1 text-gray-600 max-w-[14rem] whitespace-pre-wrap break-words"
                                      title={m.notes || undefined}
                                    >
                                      {m.notes?.trim() || '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openMergeModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  결제 방법 통합
                </button>
                {selectedMethodIds.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => openMergeModal(selectedMethodIds)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400 bg-violet-100 px-2.5 py-1.5 text-xs font-medium text-violet-950 hover:bg-violet-200"
                  >
                    <GitMerge className="h-3.5 w-3.5" />
                    선택 {selectedMethodIds.length}건 통합
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-700">
                    <th className="w-10 px-2 py-2 sm:px-3"></th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap">ID</th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setTableReferenceSort(null)
                          setTableMethodNameSort((d) => (d === 'asc' ? 'desc' : 'asc'))
                        }}
                        className="inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 -mx-1 hover:border-gray-300 hover:bg-gray-100 text-gray-800"
                        title="방법명 기준 정렬 (오름차순 ↔ 내림차순)"
                      >
                        방법명
                        {tableMethodNameSort === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                        )}
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setTableReferenceSort((prev) =>
                            prev === null ? 'asc' : prev === 'asc' ? 'desc' : null
                          )
                        }
                        className="inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 -mx-1 hover:border-gray-300 hover:bg-gray-100 text-gray-800"
                        title={t('referenceCountHint')}
                      >
                        {t('referenceCount')}
                        {tableReferenceSort === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                        ) : tableReferenceSort === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                        ) : null}
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap">유형</th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap min-w-[7rem]">
                      가이드(이름)
                    </th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap">사용자</th>
                    <th className="px-2 py-2 sm:px-3 font-medium min-w-[8rem] max-w-[14rem]">
                      금융 계정
                    </th>
                    <th className="px-2 py-2 sm:px-3 font-medium min-w-[140px] max-w-[220px]">메모</th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap">상태</th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap text-right">한도</th>
                    <th className="px-2 py-2 sm:px-3 font-medium whitespace-nowrap text-right">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {tableSortedMethods.map((method) => (
                    <tr
                      key={method.id}
                      className="border-b border-gray-100 hover:bg-gray-50/80"
                    >
                      <td className="px-2 py-2 sm:px-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedMethodIds.includes(method.id)}
                          onChange={() => toggleMethodSelected(method.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`선택 ${method.id}`}
                        />
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle font-mono text-xs text-gray-600 max-w-[140px] truncate" title={method.id}>
                        {method.id}
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle max-w-[160px] truncate" title={method.method}>
                        <button
                          type="button"
                          onClick={() => setUsageModalMethod(method)}
                          className="font-medium text-left text-blue-700 hover:text-blue-900 hover:underline truncate max-w-full"
                        >
                          {method.method}
                        </button>
                      </td>
                      <td
                        className="px-2 py-2 sm:px-3 align-middle text-right tabular-nums text-gray-800 whitespace-nowrap"
                        title={t('referenceCountHint')}
                      >
                        {method.reference_count != null ? (
                          <span
                            className={paymentMethodReferenceBandClass(method.reference_count)}
                          >
                            {formatPaymentMethodReferenceBand(method.reference_count, t)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle capitalize text-gray-700 whitespace-nowrap">
                        {method.method_type}
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle text-gray-800 text-xs max-w-[14rem]">
                        {(() => {
                          const guidePrimary =
                            method.team?.name_ko?.trim() || method.team?.name_en?.trim() || ''
                          const guideSub =
                            method.team?.name_ko &&
                            method.team?.name_en &&
                            method.team.name_ko !== method.team.name_en
                              ? method.team.name_en
                              : ''
                          return guidePrimary ? (
                            <>
                              <div className="font-medium text-gray-900">{guidePrimary}</div>
                              {guideSub ? (
                                <div className="text-gray-600">{guideSub}</div>
                              ) : null}
                            </>
                          ) : method.user_email ? (
                            <div className="text-gray-600">{method.user_email}</div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )
                        })()}
                      </td>
                      <td
                        className="px-2 py-2 sm:px-3 align-middle text-gray-700 max-w-[200px] truncate"
                        title={method.user_email ? displayPaymentMethodUser(method) : ''}
                      >
                        {displayPaymentMethodUser(method)}
                      </td>
                      <td
                        className="px-2 py-2 sm:px-3 align-middle text-gray-700 max-w-[14rem] text-xs"
                        title={method.financial_account?.name || method.financial_account_id || ''}
                      >
                        <span className="line-clamp-2 break-words">
                          {method.financial_account?.name?.trim() ||
                            (method.financial_account_id ? (
                              <span className="text-amber-700" title="계정을 찾을 수 없습니다">
                                {method.financial_account_id}
                              </span>
                            ) : (
                              '—'
                            ))}
                        </span>
                      </td>
                      <td
                        className="px-2 py-2 sm:px-3 align-middle text-gray-600 max-w-[220px] text-xs"
                        title={method.notes || ''}
                      >
                        <span className="line-clamp-2 break-words">{method.notes?.trim() || '—'}</span>
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getStatusColor(method.status)}`}>
                          {getStatusIcon(method.status)}
                          <span>{getStatusText(method.status)}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle text-right text-gray-700 whitespace-nowrap">
                        {method.limit_amount != null ? formatCurrency(method.limit_amount) : '—'}
                      </td>
                      <td className="px-2 py-2 sm:px-3 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleEditMethod(method)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="수정"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMethod(method.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {methods.map((method) => (
            <div key={method.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-3 hover:shadow-md transition-shadow relative shadow-sm">
              {/* 상단: 방법명, 상태, 수정/삭제 버튼 */}
              <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => setUsageModalMethod(method)}
                      className="font-semibold text-xs sm:text-sm text-left text-blue-700 hover:text-blue-900 hover:underline truncate"
                    >
                      {method.method}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getStatusColor(method.status)}`}>
                      {getStatusIcon(method.status)}
                      <span>{getStatusText(method.status)}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleStatus(method)
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0 ${
                        method.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={method.status === 'active' ? '비활성화' : '활성화'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          method.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditMethod(method)
                    }}
                    className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="수정"
                  >
                    <Edit size={16} className="sm:w-3 sm:h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteMethod(method.id)
                    }}
                    className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={16} className="sm:w-3 sm:h-3" />
                  </button>
                </div>
              </div>
              
              {/* ID / 사용자 / 유형·한도 - 모바일에서 라벨 없이 한 줄씩 */}
              <div className="text-xs text-gray-500 mb-1 sm:mb-2 truncate" title={method.id}>
                {method.id}
              </div>
              <div className="text-xs tabular-nums text-gray-600 mb-1 sm:mb-2" title={t('referenceCountHint')}>
                {method.reference_count != null ? (
                  <>
                    {t('referenceCountShort')}{' '}
                    <span
                      className={
                        method.reference_count === 0
                          ? 'text-amber-700 font-medium'
                          : 'font-medium text-gray-800'
                      }
                    >
                      {formatPaymentMethodReferenceBand(method.reference_count, t)}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">{t('referenceCountUnavailable')}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-600 mb-1 sm:mb-2">
                <User size={12} className="flex-shrink-0" />
                <span className="truncate" title={displayPaymentMethodUser(method)}>
                  {displayPaymentMethodUser(method)}
                </span>
              </div>
              {(method.financial_account?.name || method.financial_account_id) && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1 sm:mb-2">
                  <DollarSign size={12} className="flex-shrink-0 text-emerald-600" />
                  <span
                    className="truncate"
                    title={
                      method.financial_account?.name ||
                      method.financial_account_id ||
                      ''
                    }
                  >
                    {method.financial_account?.name?.trim() ||
                      (method.financial_account_id
                        ? `계정 ID: ${method.financial_account_id}`
                        : '')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5 sm:mb-2">
                <span className="capitalize">{method.method_type}</span>
                <span className="font-medium truncate ml-1">{method.limit_amount ? formatCurrency(method.limit_amount) : '제한없음'}</span>
              </div>

              {/* 사용량 바 - 컴팩트 */}
              {method.monthly_limit && (
                <div className="mb-1.5 sm:mb-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>월</span>
                    <span>{Math.round((method.current_month_usage / method.monthly_limit) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5">
                    <div 
                      className={`h-1 sm:h-1.5 rounded-full ${getUsageColor(getUsagePercentage(method.current_month_usage, method.monthly_limit))}`}
                      style={{ width: `${getUsagePercentage(method.current_month_usage, method.monthly_limit)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {method.daily_limit && (
                <div className="mb-1.5 sm:mb-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>일</span>
                    <span>{Math.round((method.current_day_usage / method.daily_limit) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5">
                    <div 
                      className={`h-1 sm:h-1.5 rounded-full ${getUsageColor(getUsagePercentage(method.current_day_usage, method.daily_limit))}`}
                      style={{ width: `${getUsagePercentage(method.current_day_usage, method.daily_limit)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 카드 정보 */}
              {(method.card_number_last4 || method.expiry_date) && (
                <div className="text-xs text-gray-500 space-y-0.5 pt-1.5 sm:pt-2 border-t border-gray-100">
                  {method.card_number_last4 && <div className="truncate">****{method.card_number_last4}</div>}
                  {method.expiry_date && (() => {
                    const { month, year } = parseExpiryDate(method.expiry_date)
                    return month && year ? <div>{year}/{month}</div> : null
                  })()}
                </div>
              )}
              {method.notes && (
                <div className="mt-1.5 sm:mt-2 text-xs text-gray-500 truncate" title={method.notes}>
                  💬 {method.notes}
                </div>
              )}
            </div>
          ))}
        </div>
        )
      ) : (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">
          <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2" />
          <p>등록된 결제 방법이 없습니다.</p>
        </div>
      )}

      <Dialog
        open={mergeModalOpen}
        onOpenChange={(o) => {
          setMergeModalOpen(o)
          if (!o) setMergePreview(null)
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-violet-700" />
              결제 방법 통합
            </DialogTitle>
            <DialogDescription>
              여러 결제 방법 ID를 하나로 합칩니다. 결제 기록, 회사·예약·투어 지출, 티켓·호텔 부킹 등{' '}
              <span className="font-semibold text-gray-800">payment_method</span> 컬럼을 쓰는 모든 행이 함께
              바뀝니다. 서버에 SUPABASE_SERVICE_ROLE_KEY가 있어야 합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">
                유지할 결제 방법 (통합 후 이 ID를 사용)
              </label>
              <div className="mt-1 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-xs min-w-[52rem]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                      <th className="w-9 px-1 py-1.5 font-medium whitespace-nowrap" aria-hidden />
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[8rem]">
                        방법 / ID
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[6rem]">
                        가이드(이름)
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[7rem]">사용자</th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[6rem]">
                        금융 계정
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[7rem]">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <td colSpan={6} className="px-2 py-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-500">
                          <input
                            type="radio"
                            name="mergeTargetPick"
                            className="border-gray-300 text-violet-600"
                            checked={mergeTargetId === ''}
                            onChange={() => setMergeTargetId('')}
                          />
                          <span>선택… (유지할 행을 고르세요)</span>
                        </label>
                      </td>
                    </tr>
                    {[...methods]
                      .sort((a, b) =>
                        a.method.localeCompare(b.method, undefined, { sensitivity: 'base' })
                      )
                      .map((m) => (
                        <tr
                          key={m.id}
                          className={
                            mergeTargetId === m.id
                              ? 'bg-violet-50/90'
                              : 'hover:bg-gray-50/80'
                          }
                        >
                          <td className="px-1 py-1.5 align-top text-center">
                            <input
                              type="radio"
                              name="mergeTargetPick"
                              className="border-gray-300 text-violet-600"
                              checked={mergeTargetId === m.id}
                              onChange={() => setMergeTargetId(m.id)}
                            />
                          </td>
                          <MergeMethodDetailCells
                            method={m}
                            userLabel={displayPaymentMethodUser(m)}
                          />
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-sm font-medium text-gray-700">
                  통합할 결제 방법 (선택한 ID는 모두 위 ID로 치환)
                </label>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-xs text-violet-700 hover:underline"
                    onClick={() => {
                      const all = methods.filter((m) => m.id !== mergeTargetId).map((m) => m.id)
                      setMergeSourceIds(new Set(all))
                    }}
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:underline"
                    onClick={() => setMergeSourceIds(new Set())}
                  >
                    해제
                  </button>
                </div>
              </div>
              <div className="max-h-[min(24rem,55vh)] overflow-auto border border-gray-200 rounded-lg bg-gray-50/50">
                <table className="w-full text-left text-xs min-w-[52rem]">
                  <thead className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-100 text-gray-600 shadow-sm">
                    <tr>
                      <th className="w-9 px-1 py-1.5 font-medium whitespace-nowrap" aria-hidden />
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[8rem]">
                        방법 / ID
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[6rem]">
                        가이드(이름)
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[7rem]">사용자</th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[6rem]">
                        금융 계정
                      </th>
                      <th className="px-2 py-1.5 font-medium whitespace-nowrap min-w-[7rem]">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods
                      .filter((m) => m.id !== mergeTargetId)
                      .sort((a, b) =>
                        a.method.localeCompare(b.method, undefined, { sensitivity: 'base' })
                      )
                      .map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-white/90 border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-1 py-1.5 align-top text-center">
                            <input
                              type="checkbox"
                              checked={mergeSourceIds.has(m.id)}
                              onChange={() => toggleMergeSource(m.id)}
                              className="rounded border-gray-300 text-violet-600"
                              aria-label={`통합 대상 ${m.id}`}
                            />
                          </td>
                          <MergeMethodDetailCells
                            method={m}
                            userLabel={displayPaymentMethodUser(m)}
                          />
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            {mergePreviewLoading && (
              <p className="text-xs text-gray-500">참조 건수 미리보기 계산 중…</p>
            )}
            {mergePreview && mergeSourceIds.size > 0 && !mergePreviewLoading && (
              <div className="text-xs border border-violet-100 rounded-lg p-3 bg-violet-50/60 space-y-2">
                <div className="font-medium text-violet-950">치환될 참조 (통합 전, 선택한 ID별)</div>
                <p className="text-violet-900">
                  합계 약 <strong>{mergePreview.total}</strong>건
                </p>
                {Object.entries(mergePreview.perSource).map(([sid, tbl]) => (
                  <div key={sid} className="pl-2 border-l-2 border-violet-300">
                    <div className="font-mono text-[11px] text-violet-950 break-all">{sid}</div>
                    <ul className="text-[11px] text-gray-700 mt-0.5 space-y-0.5">
                      {Object.entries(tbl).map(([t, c]) =>
                        c > 0 ? (
                          <li key={t}>
                            {MERGE_REF_TABLE_LABELS[t] || t}: {c}건
                          </li>
                        ) : c < 0 ? (
                          <li key={t} className="text-red-600">
                            {MERGE_REF_TABLE_LABELS[t] || t}: 집계 오류
                          </li>
                        ) : null
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-start gap-2 text-sm cursor-pointer text-gray-800">
              <input
                type="checkbox"
                checked={mergeDeleteSources}
                onChange={(e) => setMergeDeleteSources(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 mt-0.5"
              />
              <span>
                통합 완료 후 위에서 선택한 원본 결제 방법 행을 <strong>payment_methods</strong>에서 삭제
                (참조가 모두 옮겨진 뒤에만 안전합니다)
              </span>
            </label>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setMergeModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 w-full sm:w-auto"
            >
              취소
            </button>
            <button
              type="button"
              disabled={
                mergeSubmitting ||
                !mergeTargetId.trim() ||
                [...mergeSourceIds].filter((id) => id !== mergeTargetId).length === 0
              }
              onClick={() => void runMergePaymentMethods()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 w-full sm:w-auto"
            >
              {mergeSubmitting ? '처리 중…' : '통합 실행'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentMethodUsageModal
        open={usageModalMethod != null}
        onOpenChange={(o) => {
          if (!o) setUsageModalMethod(null)
        }}
        locale={locale}
        methodId={usageModalMethod?.id ?? ''}
        methodLabel={usageModalMethod?.method ?? ''}
        paymentMethodOptions={paymentMethodSelectOptions}
        onSaved={() => {
          void loadMethods()
          onMethodUpdated?.()
        }}
      />
    </div>
  )
}
