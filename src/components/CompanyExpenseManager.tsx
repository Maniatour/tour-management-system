'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { fetchUploadApi } from '@/lib/uploadClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle, Clock, DollarSign, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { StatementReconciledBadge } from '@/components/reconciliation/StatementReconciledBadge'
import { fetchReconciledSourceIds } from '@/lib/reconciliation-match-queries'
import { toast } from 'sonner'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type TeamMember = Database['public']['Tables']['team']['Row']

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** DB submit_on(ISO) → date input 값 (로컬 달력 기준) */
function ymdFromSubmitOnIso(iso: string | null | undefined): string {
  if (!iso) return ymdFromLocalDate(new Date())
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ymdFromLocalDate(new Date())
  return ymdFromLocalDate(d)
}

/** date input(YYYY-MM-DD) → 명세·회사지출과 동일하게 정오 UTC ISO */
function submitOnIsoFromYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return `${ymdFromLocalDate(new Date())}T12:00:00.000Z`
  }
  return `${ymd}T12:00:00.000Z`
}

interface CompanyExpenseFormData {
  id: string
  /** YYYY-MM-DD — 표시·편집용 */
  submit_on: string
  paid_to: string
  paid_for: string
  description: string
  amount: string
  payment_method: string
  submit_by: string
  photo_url: string
  category: string
  subcategory: string
  vehicle_id: string
  maintenance_type: string
  notes: string
  expense_type: string
  tax_deductible: boolean
  uploaded_files: File[]
}

export default function CompanyExpenseManager() {
  const t = useTranslations('companyExpense')
  const tTour = useTranslations('tours.tourExpense')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch (error) {
    console.warn('로케일을 가져올 수 없습니다. 기본값(ko)을 사용합니다.', error)
  }
  const { user } = useAuth()
  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()
  const [expenses, setExpenses] = useState<CompanyExpense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [teamMembers, setTeamMembers] = useState<Map<string, TeamMember>>(new Map())
  const [teamList, setTeamList] = useState<Array<{ email: string; name_ko: string | null; display_name: string | null; is_active: boolean }>>([])
  const [employeeEmailTab, setEmployeeEmailTab] = useState<'active' | 'inactive'>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [expenseSuggestions, setExpenseSuggestions] = useState<{
    paid_to: string[]
    paid_for: string[]
  } | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  /** reconciliation_matches에 연결된 회사 지출 id */
  const [reconciledExpenseIds, setReconciledExpenseIds] = useState<Set<string>>(() => new Set())

  const [formData, setFormData] = useState<CompanyExpenseFormData>({
    id: '',
    submit_on: ymdFromLocalDate(new Date()),
    paid_to: '',
    paid_for: '',
    description: '',
    amount: '',
    payment_method: '',
    submit_by: user?.email || '',
    photo_url: '',
    category: '',
    subcategory: '',
    vehicle_id: '',
    maintenance_type: '',
    notes: '',
    expense_type: '',
    tax_deductible: true,
    uploaded_files: []
  })

  const isAbortError = (err: unknown) => {
    if (err instanceof Error)
      return err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted')
    const msg = typeof (err as { message?: string })?.message === 'string' ? (err as { message: string }).message : ''
    return msg.includes('AbortError') || msg.includes('aborted') || msg.includes('signal is aborted')
  }

  const limit = 20
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (searchTerm) params.append('search', searchTerm)
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (vehicleFilter && vehicleFilter !== 'all') params.append('vehicle_id', vehicleFilter)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      
      const response = await fetch(`/api/company-expenses?${params.toString()}`)
      const result = await response.json()
      
      if (response.ok) {
        setExpenses(result.data || [])
        setPagination(result.pagination || { page: 1, limit, total: 0, totalPages: 1 })
      } else {
        toast.error(result.error || '지출 목록을 불러올 수 없습니다.')
      }
    } catch (error) {
      if (isAbortError(error)) return
      console.error('지출 목록 로드 오류:', error)
      toast.error('지출 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, categoryFilter, statusFilter, vehicleFilter, dateFrom, dateTo, page])

  useEffect(() => {
    const ids = expenses.map((e) => e.id)
    if (ids.length === 0) {
      setReconciledExpenseIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIds(supabase, 'company_expenses', ids).then((set) => {
      if (!cancelled) setReconciledExpenseIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [expenses])

  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number')
      
      if (error) throw error
      setVehicles(data || [])
    } catch (error) {
      if (isAbortError(error)) return
      console.error('차량 목록 로드 오류:', error)
    }
  }, [supabase])

  const loadTeamMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, display_name, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko')
      
      if (error) {
        if (isAbortError(error)) return
        console.error('팀 멤버 조회 오류:', error)
        return
      }
      
      const list = (data || []).map((m: any) => ({
        email: m.email,
        name_ko: m.name_ko ?? null,
        display_name: m.display_name ?? null,
        is_active: m.is_active !== false
      }))
      setTeamList(list)
      
      const memberMap = new Map<string, TeamMember>()
      if (data) {
        data.forEach((member: any) => {
          if (member && member.email) {
            memberMap.set(member.email.toLowerCase(), member)
          }
        })
      }
      setTeamMembers(memberMap)
    } catch (error) {
      if (isAbortError(error)) return
      console.error('팀 멤버 목록 로드 오류:', error)
      setTeamMembers(new Map())
      setTeamList([])
    }
  }, [])

  // 필터 변경 시 1페이지로
  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, statusFilter, vehicleFilter, dateFrom, dateTo])

  useEffect(() => {
    loadExpenses()
    loadVehicles()
    loadTeamMembers()
  }, [loadExpenses, loadVehicles, loadTeamMembers])

  useEffect(() => {
    if (!isDialogOpen) return
    let cancelled = false
    ;(async () => {
      setSuggestionsLoading(true)
      try {
        const res = await fetch('/api/company-expenses/suggestions')
        const json = await res.json()
        if (cancelled) return
        if (res.ok && json && typeof json === 'object' && !Array.isArray(json)) {
          const paid_to = Array.isArray(json.paid_to) ? json.paid_to.filter((x: unknown) => typeof x === 'string') : []
          const paid_for = Array.isArray(json.paid_for) ? json.paid_for.filter((x: unknown) => typeof x === 'string') : []
          setExpenseSuggestions({ paid_to, paid_for })
        } else {
          setExpenseSuggestions({ paid_to: [], paid_for: [] })
          if (!res.ok) toast.error(t('messages.suggestionsLoadError'))
        }
      } catch {
        if (!cancelled) {
          setExpenseSuggestions({ paid_to: [], paid_for: [] })
          toast.error(t('messages.suggestionsLoadError'))
        }
      } finally {
        if (!cancelled) setSuggestionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDialogOpen, t])

  const paidToDatalistOptions = useMemo(() => {
    const s = new Set<string>()
    expenseSuggestions?.paid_to?.forEach((x) => {
      if (x) s.add(x)
    })
    const cur = formData.paid_to.trim()
    if (cur) s.add(cur)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [expenseSuggestions, formData.paid_to])

  const paidForDatalistOptions = useMemo(() => {
    const s = new Set<string>()
    expenseSuggestions?.paid_for?.forEach((x) => {
      if (x) s.add(x)
    })
    const cur = formData.paid_for.trim()
    if (cur) s.add(cur)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [expenseSuggestions, formData.paid_for])

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      toast.error('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
      toast.success(`${validFiles.length}개 파일이 추가되었습니다.`)
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
      toast.success(`${files.length}개 파일이 붙여넣기되었습니다.`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ID는 자동 생성되므로 검증에서 제외
    if (!formData.paid_to || !formData.paid_for || !formData.amount || !formData.payment_method?.trim()) {
      toast.error('필수 필드를 모두 입력해주세요.')
      return
    }

    try {
      setSaving(true)
      
       // 파일 업로드 처리
       let uploadedFileUrls: string[] = []
       if (formData.uploaded_files.length > 0) {
         setIsUploading(true)
         try {
           const uploadFormData = new FormData()
           uploadFormData.append('bucketType', 'company_expenses')
           formData.uploaded_files.forEach(file => {
             uploadFormData.append('files', file)
           })
           
           const uploadResponse = await fetchUploadApi(uploadFormData)
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            uploadedFileUrls = uploadResult.urls
            toast.success(`${uploadedFileUrls.length}개 파일이 업로드되었습니다.`)
          } else {
            console.error('파일 업로드 실패')
            toast.error('파일 업로드에 실패했습니다.')
          }
        } finally {
          setIsUploading(false)
        }
      }
      
      // 지출 데이터 준비 (수정 시 새 파일이 없으면 기존 첨부 유지 — 빈 배열로 덮어쓰지 않음)
      const attachmentsPayload =
        uploadedFileUrls.length > 0
          ? [
              ...(Array.isArray(editingExpense?.attachments)
                ? editingExpense.attachments.filter(Boolean)
                : []),
              ...uploadedFileUrls,
            ]
          : editingExpense
            ? Array.isArray(editingExpense.attachments)
              ? editingExpense.attachments
              : null
            : null

      const submitData = {
        ...formData,
        submit_on: submitOnIsoFromYmd(formData.submit_on),
        photo_url: formData.photo_url || uploadedFileUrls[0] || '', // 첫 번째 파일을 메인 이미지로
        attachments: attachmentsPayload,
        uploaded_files: undefined // 서버로 전송하지 않음
      }
      
      const url = editingExpense ? `/api/company-expenses/${editingExpense.id}` : '/api/company-expenses'
      const method = editingExpense ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(editingExpense ? t('messages.expenseUpdated') : t('messages.expenseAdded'))
        setIsDialogOpen(false)
        setEditingExpense(null)
        resetForm()
        loadExpenses()
      } else {
        toast.error(result.error || '지출 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('지출 저장 오류:', error)
      toast.error('지출 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (expense: CompanyExpense) => {
    setEditingExpense(expense)
    const amountStr =
      expense.amount != null && expense.amount !== ''
        ? String(expense.amount)
        : ''
    setFormData({
      id: expense.id ?? '',
      submit_on: ymdFromSubmitOnIso(
        (expense as { submit_on?: string | null }).submit_on ?? null
      ),
      paid_to: expense.paid_to ?? '',
      paid_for: expense.paid_for ?? '',
      description: expense.description ?? '',
      amount: amountStr,
      payment_method: expense.payment_method ?? '',
      submit_by: expense.submit_by ?? '',
      photo_url: expense.photo_url ?? '',
      category: expense.category ?? '',
      subcategory: expense.subcategory ?? '',
      vehicle_id: expense.vehicle_id ?? '',
      maintenance_type: expense.maintenance_type ?? '',
      notes: expense.notes ?? '',
      expense_type: expense.expense_type ?? '',
      tax_deductible: expense.tax_deductible ?? true,
      uploaded_files: [] // 기존 데이터에는 없으므로 빈 배열
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/company-expenses/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(t('messages.expenseDeleted'))
        loadExpenses()
      } else {
        toast.error(result.error || '지출 삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('지출 삭제 오류:', error)
      toast.error('지출 삭제 중 오류가 발생했습니다.')
    }
  }

  const updatePaidToEmployeeEmail = async (expenseId: string, email: string | null) => {
    try {
      const { error } = await supabase
        .from('company_expenses')
        .update({ paid_to_employee_email: email || null, updated_at: new Date().toISOString() })
        .eq('id', expenseId)
      if (error) throw error
      setExpenses(prev =>
        prev.map((e) => (e.id === expenseId ? { ...e, paid_to_employee_email: email || null } as CompanyExpense : e))
      )
      toast.success('직원(이메일)이 저장되었습니다.')
    } catch (err) {
      if (isAbortError(err)) return
      console.error('직원 이메일 수정 오류:', err)
      toast.error('직원(이메일) 저장에 실패했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({
      id: '',
      submit_on: ymdFromLocalDate(new Date()),
      paid_to: '',
      paid_for: '',
      description: '',
      amount: '',
      payment_method: '',
      submit_by: user?.email || '',
      photo_url: '',
      category: '',
      subcategory: '',
      vehicle_id: '',
      maintenance_type: '',
      notes: '',
      expense_type: '',
      tax_deductible: true,
      uploaded_files: []
    })
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      status = 'pending'
    }
    
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      paid: { color: 'bg-blue-100 text-blue-800', icon: DollarSign }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const categories = [
    { value: 'office', label: t('categories.office') },
    { value: 'marketing', label: t('categories.marketing') },
    { value: 'utilities', label: t('categories.utilities') },
    { value: 'vehicle', label: t('categories.vehicle') },
    { value: 'travel', label: t('categories.travel') },
    { value: 'meals', label: t('categories.meals') },
    { value: 'equipment', label: t('categories.equipment') },
    { value: 'maintenance', label: t('categories.maintenance') },
    { value: 'other', label: t('categories.other') },
    { value: '인건비', label: t('categories.laborCost') }
  ]

  const categoryKeys = new Set(categories.map((c) => c.value))
  const getCategoryLabel = (category: string) => {
    if (category === '인건비') return t('categories.laborCost')
    return categoryKeys.has(category) ? t(`categories.${category}`) : category
  }

  const expenseTypes = [
    { value: 'operating', label: t('expenseTypes.operating') },
    { value: 'capital', label: t('expenseTypes.capital') },
    { value: 'marketing', label: t('expenseTypes.marketing') },
    { value: 'travel', label: t('expenseTypes.travel') },
    { value: 'maintenance', label: t('expenseTypes.maintenance') },
    { value: 'other', label: t('expenseTypes.other') }
  ]

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const parseExpenseAmount = (e: CompanyExpense) => parseFloat(String(e.amount ?? 0)) || 0

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )
  const pendingAmount = useMemo(
    () =>
      expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )
  const approvedAmount = useMemo(
    () =>
      expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )

  const resetFilters = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setVehicleFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder={tTour('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm()
                  setEditingExpense(null)
                }}
                className="w-full sm:w-auto shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('addExpense')}
              </Button>
            </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? t('buttons.edit') : t('addExpense')}
              </DialogTitle>
              <DialogDescription>
                {editingExpense ? '지출 정보를 수정하세요.' : '새로운 지출을 등록하세요.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submit_on">{t('form.date')} *</Label>
                  <Input
                    id="submit_on"
                    type="date"
                    value={formData.submit_on}
                    onChange={(e) => setFormData({ ...formData, submit_on: e.target.value })}
                    required
                    className="block w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">{t('form.amount')} *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                
                {editingExpense && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="id">{t('form.id')}</Label>
                    <Input
                      id="id"
                      value={formData.id}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paid_to">{t('form.paidTo')} *</Label>
                  <Input
                    id="paid_to"
                    list="company-expense-datalist-paid-to"
                    autoComplete="off"
                    value={formData.paid_to}
                    onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })}
                    required
                  />
                  <datalist id="company-expense-datalist-paid-to">
                    {paidToDatalistOptions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  <p className="text-muted-foreground text-xs mt-1">
                    {suggestionsLoading ? t('form.suggestionsLoading') : t('form.suggestOrType')}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="paid_for">{t('form.paidFor')} *</Label>
                  <Input
                    id="paid_for"
                    list="company-expense-datalist-paid-for"
                    autoComplete="off"
                    value={formData.paid_for}
                    onChange={(e) => setFormData({ ...formData, paid_for: e.target.value })}
                    required
                  />
                  <datalist id="company-expense-datalist-paid-for">
                    {paidForDatalistOptions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  <p className="text-muted-foreground text-xs mt-1">
                    {suggestionsLoading ? t('form.suggestionsLoading') : t('form.suggestOrType')}
                  </p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">{t('form.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">{t('form.category')}</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="expense_type">{t('form.expenseType')}</Label>
                  <Select value={formData.expense_type} onValueChange={(value) => setFormData({ ...formData, expense_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="지출 유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_id">{t('form.vehicleId')}</Label>
                  <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="차량 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">차량 없음</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} ({vehicle.vehicle_category || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="payment_method">{t('form.paymentMethod')} *</Label>
                  <PaymentMethodAutocomplete
                    options={paymentMethodOptions}
                    valueId={formData.payment_method || ''}
                    onChange={(id) => setFormData({ ...formData, payment_method: id })}
                    disabled={saving}
                    pleaseSelectLabel={t('form.selectPaymentMethodPlaceholder')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('form.paymentMethodHint')}
                  </p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tax_deductible"
                  checked={formData.tax_deductible}
                  onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                />
                <Label htmlFor="tax_deductible">{t('form.taxDeductible')}</Label>
              </div>
              
              {/* 파일 업로드 섹션 */}
              <div>
                <Label htmlFor="file_upload">영수증/인보이스 첨부</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isUploading 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : isDragOver 
                        ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onDragOver={!isUploading ? handleDragOver : undefined}
                  onDragEnter={!isUploading ? handleDragEnter : undefined}
                  onDragLeave={!isUploading ? handleDragLeave : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onPaste={!isUploading ? handlePaste : undefined}
                  tabIndex={!isUploading ? 0 : -1}
                  onClick={!isUploading ? () => document.getElementById('file_upload')?.click() : undefined}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isUploading 
                        ? 'bg-blue-100' 
                        : isDragOver 
                          ? 'bg-blue-200' 
                          : 'bg-gray-100'
                    }`}>
                      {isUploading ? (
                        <div className="animate-spin">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      ) : isDragOver ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors ${
                        isDragOver ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {isUploading 
                          ? '파일 업로드 중...' 
                          : isDragOver 
                            ? '파일을 여기에 놓으세요' 
                            : '파일을 드래그하여 놓거나 클릭하여 선택하세요'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        또는 클립보드에서 붙여넣기 (Ctrl+V)
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)
                    </div>
                  </div>
                  
                  <input
                    id="file_upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* 업로드된 파일 목록 */}
                  {formData.uploaded_files.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">업로드된 파일 ({formData.uploaded_files.length}개)</h4>
                      <div className="space-y-2">
                        {formData.uploaded_files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                {file.type.startsWith('image/') ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                {editingExpense && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>지출 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('messages.confirmDelete')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (editingExpense) {
                              handleDelete(editingExpense.id)
                              setIsDialogOpen(false)
                              setEditingExpense(null)
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <div className="flex justify-end space-x-2 ml-auto">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('buttons.cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : t('buttons.save')}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1" htmlFor="co-filter-category">
              {t('filters.category')}
            </label>
            <select
              id="co-filter-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{t('filters.all')}</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1" htmlFor="co-filter-status">
              {tTour('statusLabel')}
            </label>
            <select
              id="co-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{tTour('filterAll')}</option>
              <option value="pending">{tTour('filterPending')}</option>
              <option value="approved">{tTour('filterApproved')}</option>
              <option value="rejected">{tTour('filterRejected')}</option>
              <option value="paid">{t('status.paid')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1" htmlFor="co-filter-date-from">
              {tTour('startDate')}
            </label>
            <input
              id="co-filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1" htmlFor="co-filter-date-to">
              {tTour('endDate')}
            </label>
            <input
              id="co-filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-end">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1" htmlFor="co-filter-vehicle">
              {t('filters.vehicle')}
            </label>
            <select
              id="co-filter-vehicle"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{t('filters.all')}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} ({vehicle.vehicle_category || 'N/A'})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm w-full sm:w-auto"
              onClick={resetFilters}
            >
              {t('buttons.resetFilters')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200/80">
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('totalExpenseSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 border border-yellow-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('pendingSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">{formatCurrency(pendingAmount)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('approvedSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(approvedAmount)}</div>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500">{t('statsPageNote')}</p>
      </div>

      {/* 지출 목록 */}
      <div className="space-y-2 sm:space-y-3">
        <p className="text-xs sm:text-sm text-gray-600">
          {t('expenseList')}
          {pagination.total > 0
            ? ` · ${t('listCountLabel', { count: pagination.total })}${pagination.totalPages > 1 ? ` · ${page} / ${pagination.totalPages}` : ''}`
            : ''}
        </p>
          {loading ? (
            <div className="text-center py-6 sm:py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-500 mt-2 text-sm">{t('loading')}</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
              <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-gray-300" />
              <p>{t('noExpenses')}</p>
            </div>
          ) : (
            <>
              {/* 모바일: 카드 리스트 - 라벨/값 구조로 가독성 개선 */}
              <div className="md:hidden space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    onClick={() => handleEdit(expense)}
                    className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-semibold text-gray-900 text-sm truncate flex-1 flex items-center gap-1.5 min-w-0">
                        <StatementReconciledBadge matched={reconciledExpenseIds.has(expense.id)} />
                        {expense.paid_for}
                      </p>
                      <p className="text-lg font-bold text-green-600 whitespace-nowrap">
                        ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
                      </p>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                      <span className="text-gray-400">제출일</span>
                      <span>{expense.submit_on ? new Date(expense.submit_on).toLocaleDateString() : '-'}</span>
                      <span className="text-gray-400">결제처</span>
                      <span className="truncate">{expense.paid_to}</span>
                      <span className="text-gray-400">직원(이메일)</span>
                      <span className="truncate">
                        {(() => {
                          const email = (expense as { paid_to_employee_email?: string | null }).paid_to_employee_email
                          if (!email) return '미지정'
                          const m = teamList.find((x) => x.email === email)
                          const name = (m?.display_name || m?.name_ko) || email
                          return m && !m.is_active ? `${name} (Inactive)` : name
                        })()}
                      </span>
                      {expense.category && (
                        <>
                          <span className="text-gray-400">카테고리</span>
                          <span><Badge variant="outline" className="text-xs">{getCategoryLabel(expense.category)}</Badge></span>
                        </>
                      )}
                      <span className="text-gray-400">상태</span>
                      <span>{getStatusBadge(expense.status || 'pending')}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 데스크톱: 테이블 */}
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 w-10 text-center" title="명세 대조">
                      명세
                    </TableHead>
                    <TableHead className="py-2">제출일</TableHead>
                    <TableHead className="py-2">결제처</TableHead>
                    <TableHead className="py-2">결제내용</TableHead>
                    <TableHead className="py-2">설명</TableHead>
                    <TableHead className="py-2">금액</TableHead>
                    <TableHead className="py-2">결제방법</TableHead>
                    <TableHead className="w-32 py-2">카테고리</TableHead>
                    <TableHead className="w-28 py-2">상태</TableHead>
                    <TableHead className="w-48 py-2">직원(이메일)</TableHead>
                    <TableHead className="py-2">제출자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow 
                      key={expense.id}
                      onClick={() => handleEdit(expense)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <StatementReconciledBadge matched={reconciledExpenseIds.has(expense.id)} />
                      </TableCell>
                      <TableCell className="py-2">
                        {expense.submit_on ? new Date(expense.submit_on).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="py-2">{expense.paid_to}</TableCell>
                      <TableCell className="max-w-xs truncate py-2">{expense.paid_for}</TableCell>
                      <TableCell className="max-w-xs truncate py-2">{expense.description || '-'}</TableCell>
                      <TableCell className="font-medium py-2">
                        ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
                      </TableCell>
                      <TableCell className="py-2">
                        {expense.payment_method
                          ? paymentMethodMap[expense.payment_method] || expense.payment_method
                          : '-'}
                      </TableCell>
                      <TableCell className="w-32 py-2">
                        {expense.category && (
                          <Badge variant="outline">
                            {getCategoryLabel(expense.category)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-28 py-2">{getStatusBadge(expense.status || 'pending')}</TableCell>
                      <TableCell className="w-48 py-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const currentEmail = (expense as { paid_to_employee_email?: string | null }).paid_to_employee_email || null
                          const filtered = employeeEmailTab === 'active' ? teamList.filter((m) => m.is_active) : teamList.filter((m) => !m.is_active)
                          const currentInFiltered = currentEmail ? filtered.find((m) => m.email === currentEmail) : null
                          const currentMember = currentEmail ? teamList.find((m) => m.email === currentEmail) : null
                          const options = currentInFiltered ? filtered : (currentMember ? [currentMember, ...filtered] : filtered)
                          return (
                            <Select
                              value={currentEmail || '__none__'}
                              onValueChange={(value) => updatePaidToEmployeeEmail(expense.id, value === '__none__' ? null : value)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="미지정" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="flex rounded border border-gray-200 p-0.5 bg-gray-100 mb-2 sticky top-0 z-10" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEmployeeEmailTab('active') }}
                                    className={`flex-1 px-2 py-1 text-xs rounded ${employeeEmailTab === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                                  >
                                    Active
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEmployeeEmailTab('inactive') }}
                                    className={`flex-1 px-2 py-1 text-xs rounded ${employeeEmailTab === 'inactive' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                                  >
                                    Inactive
                                  </button>
                                </div>
                                <SelectItem value="__none__">미지정</SelectItem>
                                {options.map((m) => (
                                  <SelectItem key={m.email} value={m.email}>
                                    {(m.display_name || m.name_ko) || m.email}
                                    {!m.is_active ? ' (Inactive)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="py-2">
                        {(() => {
                          if (!expense.submit_by) return '-'
                          try {
                            const member = teamMembers.get(expense.submit_by.toLowerCase())
                            if (member) {
                              return locale === 'ko' ? member.name_ko : (member.name_en || member.name_ko)
                            }
                            return expense.submit_by
                          } catch (error) {
                            return expense.submit_by
                          }
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {/* 페이지 네비게이션 */}
              {pagination.totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
                  <p className="text-xs text-muted-foreground">
                    {pagination.total}건 중 {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} 표시
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8"
                    >
                      <ChevronLeft className="w-4 h-4 mr-0.5" />
                      이전
                    </Button>
                    <span className="text-sm text-gray-600 px-2">
                      {page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages || loading}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      className="h-8"
                    >
                      다음
                      <ChevronRight className="w-4 h-4 ml-0.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  )
}
