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
        return t('status.approved')
      case 'rejected':
        return t('status.rejected')
      default:
        return t('status.pending')
    }
  }

  const getProductDisplayName = (product: TourExpense['products']) => {
    if (!product) return '-'
    if (locale === 'en') {
      const en = (product.name_en || '').trim()
      return en || '-'
    }
    return product.name_ko || product.name || product.name_en || '-'
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
    <div className="space-y-3 sm:space-y-4">
      {/* 필터 및 액션 바 - 모바일 컴팩트 */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* 검색 및 구글 드라이브 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowDriveImporter(!showDriveImporter)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 sm:gap-2 text-sm"
          >
            <Folder className="w-4 h-4" />
            <span className="hidden sm:inline">{t('googleDriveReceipts')}</span>
            <span className="sm:hidden">{t('receiptShort')}</span>
          </button>
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('statusLabel')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('filterAll')}</option>
              <option value="pending">{t('filterPending')}</option>
              <option value="approved">{t('filterApproved')}</option>
              <option value="rejected">{t('filterRejected')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('startDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('endDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('tourId')}</label>
            <input
              type="text"
              placeholder={t('tourIdPlaceholder')}
              value={tourIdFilter}
              onChange={(e) => setTourIdFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 통계 - 모바일 컴팩트 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t">
          <div className="bg-white rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('totalExpenseSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('pendingSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">{formatCurrency(pendingAmount)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('approvedSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(approvedAmount)}</div>
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
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2 text-sm">{t('loading')}</p>
        </div>
      ) : filteredExpenses.length > 0 ? (
        <>
          {/* 모바일: 카드 리스트 - 라벨/값 구조 */}
          <div className="md:hidden space-y-3">
            {filteredExpenses.map((expense) => (
              <div key={expense.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50/80 active:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="font-semibold text-gray-900 text-sm truncate flex-1">{expense.paid_for}</p>
                  <p className="text-lg font-bold text-green-600 whitespace-nowrap">{formatCurrency(expense.amount)}</p>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                  <span className="text-gray-400">투어일</span>
                  <span>{expense.tour_date}</span>
                  <span className="text-gray-400">상품</span>
                  <span className="truncate">{expense.products?.name_ko || expense.products?.name || '-'}</span>
                  <span className="text-gray-400">결제처</span>
                  <span className="truncate">{expense.paid_to}</span>
                  <span className="text-gray-400">상태</span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  {expense.image_url && expense.image_url.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setViewingReceipt({ imageUrl: expense.image_url!, expenseId: expense.id, paidFor: expense.paid_for })}
                      className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-blue-50 min-h-[44px]"
                    >
                      <Receipt className="w-4 h-4" />
                      영수증
                    </button>
                  )}
                  <a href={`/${locale}/admin/tours/${expense.tour_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-gray-100 min-h-[44px]">
                    <Eye className="w-4 h-4" />
                    투어
                  </a>
                </div>
              </div>
            ))}
          </div>
          {/* 데스크톱: 테이블 */}
          <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('date')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('tourProduct')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('paymentDetails')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('paidTo')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('submitter')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('statusLabel')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('receipt')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('action')}</th>
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
                      <span className="text-xs text-gray-400">{t('none')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={`/${locale}/admin/tours/${expense.tour_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-600 hover:text-blue-600"
                        title={t('tourDetail')}
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
        </>
      ) : (
        <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
          <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-gray-300" />
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
                  {t('receiptLabel')}: {viewingReceipt.paidFor}
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
                  alt={`${t('receiptLabel')} ${viewingReceipt.paidFor}`}
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-receipt.png'
                    target.alt = t('receiptImageError')
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
                    {t('openInNewWindow')}
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

