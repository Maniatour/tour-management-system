'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Upload, X, Check, Eye, DollarSign, Edit, Trash2, Settings, Receipt, Image as ImageIcon, Folder, Search, Calendar, Filter, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import GoogleDriveReceiptImporter from './GoogleDriveReceiptImporter'

interface TourExpense {
  id: string
  tour_id: string
  submit_on: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  tour_date: string
  product_id: string | null
  submitted_by: string
  image_url: string | null
  file_path: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  // 조인된 데이터
  tours?: {
    id: string
    tour_date: string
    product_id: string | null
  }
  products?: {
    id: string
    name: string | null
    name_en: string | null
    name_ko: string | null
  }
}

export default function AllTourExpensesManager() {
  const t = useTranslations('tours.tourExpense')
  const locale = useLocale()
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [viewingReceipt, setViewingReceipt] = useState<{ imageUrl: string; expenseId: string; paidFor: string } | null>(null)
  const [showDriveImporter, setShowDriveImporter] = useState(false)
  
  // 필터링 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tourIdFilter, setTourIdFilter] = useState('')

  // 팀 멤버 정보 로드
  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const memberMap: Record<string, string> = {}
      data?.forEach(member => {
        memberMap[member.email] = member.name_ko || member.email
      })
      setTeamMembers(memberMap)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  // 모든 투어 지출 목록 로드
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      
      // tour_expenses 기본 조회
      let query = supabase
        .from('tour_expenses')
        .select('*')
        .order('created_at', { ascending: false })

      // 필터 적용
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (dateFrom) {
        query = query.gte('tour_date', dateFrom)
      }
      if (dateTo) {
        query = query.lte('tour_date', dateTo)
      }
      if (tourIdFilter) {
        query = query.eq('tour_id', tourIdFilter)
      }

      const { data, error } = await query

      if (error) throw error
      
      console.log('🔍 Loaded all tour expenses:', data?.length || 0)
      
      // 투어 및 상품 정보 별도 조회
      const tourIds = [...new Set((data || []).map((e: any) => e.tour_id).filter(Boolean))]
      const productIds = [...new Set((data || []).map((e: any) => e.product_id).filter(Boolean))]
      
      // 투어 정보 조회
      const toursMap = new Map()
      if (tourIds.length > 0) {
        const { data: toursData } = await supabase
          .from('tours')
          .select('id, tour_date, product_id')
          .in('id', tourIds)
        
        toursData?.forEach(tour => {
          toursMap.set(tour.id, tour)
          // 투어의 product_id도 productIds에 추가 (expense.product_id가 없을 때 사용)
          if (tour.product_id) {
            productIds.push(tour.product_id)
          }
        })
      }
      
      // 상품 정보 조회 (중복 제거)
      const uniqueProductIds = [...new Set(productIds.filter(Boolean))]
      const productsMap = new Map()
      if (uniqueProductIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, name_en, name_ko')
          .in('id', uniqueProductIds)
        
        productsData?.forEach(product => {
          productsMap.set(product.id, product)
        })
      }
      
      // file_path가 있지만 image_url이 없는 경우 공개 URL 생성 및 관련 데이터 병합
      const processedExpenses = await Promise.all((data || []).map(async (expense: any) => {
        const tour = toursMap.get(expense.tour_id)
        
        // product_id 우선순위: expense.product_id > tour.product_id
        const finalProductId = expense.product_id || tour?.product_id || null
        const product = finalProductId ? productsMap.get(finalProductId) : null
        
        let finalExpense = {
          ...expense,
          tours: tour || null,
          products: product || null
        }
        
        // image_url이 없고 file_path가 있는 경우
        if ((!expense.image_url || expense.image_url.trim() === '') && expense.file_path) {
          try {
            const { data: urlData } = supabase.storage
              .from('tour-expenses')
              .getPublicUrl(expense.file_path)
            
            finalExpense = {
              ...finalExpense,
              image_url: urlData.publicUrl
            }
          } catch (urlError) {
            console.error('Error generating public URL:', urlError)
          }
        }
        
        return finalExpense
      }))
      
      setExpenses(processedExpenses)
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dateFrom, dateTo, tourIdFilter])

  useEffect(() => {
    loadExpenses()
    loadTeamMembers()
  }, [loadExpenses])

  // 검색 필터 적용
  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      expense.paid_for?.toLowerCase().includes(searchLower) ||
      expense.paid_to?.toLowerCase().includes(searchLower) ||
      expense.tour_id?.toLowerCase().includes(searchLower) ||
      expense.products?.name?.toLowerCase().includes(searchLower) ||
      expense.products?.name_en?.toLowerCase().includes(searchLower) ||
      expense.products?.name_ko?.toLowerCase().includes(searchLower) ||
      expense.note?.toLowerCase().includes(searchLower)
    )
  })

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '승인'
      case 'rejected':
        return '거부'
      default:
        return '대기'
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // 총계 계산
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const pendingAmount = filteredExpenses
    .filter(e => e.status === 'pending')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const approvedAmount = filteredExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="space-y-4">
      {/* 필터 및 액션 바 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        {/* 검색 및 구글 드라이브 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="지출명, 결제처, 투어 ID, 상품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowDriveImporter(!showDriveImporter)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Folder className="w-4 h-4" />
            <span className="hidden sm:inline">구글 드라이브 영수증</span>
            <span className="sm:hidden">영수증</span>
          </button>
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="pending">대기</option>
              <option value="approved">승인</option>
              <option value="rejected">거부</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 날짜</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 날짜</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">투어 ID</label>
            <input
              type="text"
              placeholder="투어 ID 입력..."
              value={tourIdFilter}
              onChange={(e) => setTourIdFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm text-gray-600">총 지출</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">대기 중</div>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">승인됨</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(approvedAmount)}</div>
          </div>
        </div>
      </div>

      {/* 구글 드라이브 연동 */}
      {showDriveImporter && (
        <div className="mb-4">
          <GoogleDriveReceiptImporter
            onImportComplete={() => {
              setShowDriveImporter(false)
              loadExpenses()
            }}
          />
        </div>
      )}

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">로딩 중...</p>
        </div>
      ) : filteredExpenses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">투어/상품</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제내용</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제처</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제출자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">영수증</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {expense.tour_date}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm">
                      {expense.products?.name_ko || expense.products?.name || expense.products?.name_en || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{expense.paid_for}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{expense.paid_to}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {teamMembers[expense.submitted_by] || expense.submitted_by}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {expense.image_url && expense.image_url.trim() !== '' ? (
                      <button
                        onClick={() => setViewingReceipt({ 
                          imageUrl: expense.image_url!, 
                          expenseId: expense.id,
                          paidFor: expense.paid_for 
                        })}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Receipt className="w-4 h-4" />
                        보기
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={`/${locale}/admin/tours/${expense.tour_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-600 hover:text-blue-600"
                        title="투어 상세"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>조건에 맞는 지출이 없습니다.</p>
        </div>
      )}

      {/* 영수증 보기 모달 */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  영수증: {viewingReceipt.paidFor}
                </h3>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="flex flex-col items-center">
                <img
                  src={viewingReceipt.imageUrl}
                  alt={`${viewingReceipt.paidFor} 영수증`}
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-receipt.png'
                    target.alt = '영수증 이미지를 불러올 수 없습니다'
                  }}
                />
                <div className="mt-4 flex gap-2">
                  <a
                    href={viewingReceipt.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    새 창에서 열기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

