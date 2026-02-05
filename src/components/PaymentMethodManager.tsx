'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  Upload
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

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

export default function PaymentMethodManager({ 
  userEmail, 
  userRole = 'team_member',
  onMethodUpdated 
}: PaymentMethodManagerProps) {
  
  const t = useTranslations('paymentMethod')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [teamMembersWithStatus, setTeamMembersWithStatus] = useState<Array<{email: string, name_ko: string, is_active: boolean}>>([])
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
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
  const [filters, setFilters] = useState({
    status: '',
    method_type: '',
    search: ''
  })

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

  const loadMethods = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (userEmail) params.append('user_email', userEmail)
      if (filters.status) params.append('status', filters.status)
      if (filters.method_type) params.append('method_type', filters.method_type)

      const response = await fetch(`/api/payment-methods?${params}`)
      const result = await response.json()
      
      if (result.success) {
        let filteredData = result.data
        
        // 검색 필터 적용
        if (filters.search) {
          filteredData = filteredData.filter((method: PaymentMethod) =>
            method.method.toLowerCase().includes(filters.search.toLowerCase()) ||
            method.id.toLowerCase().includes(filters.search.toLowerCase()) ||
            (method.team?.name_ko && method.team.name_ko.toLowerCase().includes(filters.search.toLowerCase()))
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
        .select('email, name_ko, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko', { ascending: true })

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      const membersWithStatus: Array<{email: string, name_ko: string, is_active: boolean}> = []
      
      data?.forEach(member => {
        membersMap[member.email] = member.name_ko
        membersWithStatus.push({
          email: member.email,
          name_ko: member.name_ko,
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
    
    try {
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setMethods(prev => prev.filter(method => method.id !== id))
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
        const isSelected = row.user_emails.includes(email)
        return {
          ...row,
          user_emails: isSelected
            ? row.user_emails.filter(e => e !== email)
            : [...row.user_emails, email]
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

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 헤더 - 모바일 컴팩트 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">결제 방법 관리</h3>
        </div>
        <div className="flex gap-2 flex-shrink-0">
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
                  user_email: '',
                  status: 'active',
                  limit_amount: '',
                  card_number_last4: '',
                  card_type: '',
                  card_holder_name: '',
                  expiry_month: '',
                  expiry_year: '',
                  monthly_limit: '',
                  daily_limit: '',
                  notes: ''
                }])
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-2 sm:px-3 sm:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">벌크 업로드</span>
            </button>
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
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {teamMembersWithStatus.length === 0 ? (
                    <p className="text-sm text-gray-500">팀 멤버를 불러오는 중...</p>
                  ) : (
                    <div className="space-y-2">
                      {/* 활성 사용자 먼저 표시 */}
                      {teamMembersWithStatus
                        .filter(member => member.is_active)
                        .map(({ email, name_ko }) => {
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
                                {name_ko} ({email})
                              </span>
                            </label>
                          )
                        })}
                      
                      {/* 비활성 사용자 (더보기 버튼으로 표시) */}
                      {teamMembersWithStatus.filter(member => !member.is_active).length > 0 && (
                        <>
                          {!showAllUsers && (
                            <button
                              type="button"
                              onClick={() => setShowAllUsers(true)}
                              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-2 px-2 rounded hover:bg-blue-50 transition-colors"
                            >
                              더보기 ({teamMembersWithStatus.filter(member => !member.is_active).length}명)
                            </button>
                          )}
                          
                          {showAllUsers && (
                            <>
                              {teamMembersWithStatus
                                .filter(member => !member.is_active)
                                .map(({ email, name_ko }) => {
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
                                        {name_ko} ({email})
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

      {/* 벌크 업로드 사용자 선택 모달 */}
      <Dialog open={bulkUserSelectIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setBulkUserSelectIndex(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>사용자 선택</DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 pr-2">
            {bulkUserSelectIndex !== null && (
              <div className="space-y-4">
                {!teamMembersWithStatus || teamMembersWithStatus.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">팀 멤버를 불러오는 중...</p>
                ) : (
                  <div className="space-y-4">
                    {/* 활성 사용자 */}
                    {teamMembersWithStatus.filter(member => member.is_active).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">활성 사용자</h3>
                        <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                          {teamMembersWithStatus
                            .filter(member => member.is_active)
                            .map(({ email, name_ko }) => {
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
                                    {name_ko} ({email})
                                  </span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
                    )}
                    
                    {/* 비활성 사용자 */}
                    {teamMembersWithStatus.filter(member => !member.is_active).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">비활성 사용자</h3>
                        <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                          {teamMembersWithStatus
                            .filter(member => !member.is_active)
                            .map(({ email, name_ko }) => {
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
                                    {name_ko} ({email})
                                  </span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
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

      {/* 결제 방법 목록 - 모바일 컴팩트 */}
      {loading ? (
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2 text-sm">로딩중...</p>
        </div>
      ) : methods.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {methods.map((method) => (
            <div key={method.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-3 hover:shadow-md transition-shadow relative shadow-sm">
              {/* 상단: 방법명, 상태, 수정/삭제 버튼 */}
              <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{method.method}</span>
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
              <div className="flex items-center gap-1 text-xs text-gray-600 mb-1 sm:mb-2">
                <User size={12} className="flex-shrink-0" />
                <span className="truncate">{teamMembers[method.user_email] || method.user_email || '미할당'}</span>
              </div>
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
      ) : (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">
          <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2" />
          <p>등록된 결제 방법이 없습니다.</p>
        </div>
      )}
    </div>
  )
}
