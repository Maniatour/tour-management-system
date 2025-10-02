'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  AlertTriangle, 
  FileText, 
  Upload,
  Folder,
  Eye,
  Edit,
  Trash2,
  Download,
  MoreVertical,
  Clock,
  CheckCircle,
  XCircle,
  Bell
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import DocumentUploadModal from '@/components/documents/DocumentUploadModal'
import DocumentCategoryModal from '@/components/documents/DocumentCategoryModal'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentFilters from '@/components/documents/DocumentFilters'
import DocumentReminderDashboard from '@/components/documents/DocumentReminderDashboard'
import { toast } from 'sonner'

// 타입 정의
interface DocumentCategory {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string
  description_en?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Document {
  id: string
  title: string
  description?: string
  category_id?: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  issue_date?: string
  expiry_date?: string
  auto_calculate_expiry: boolean
  validity_period_months: number
  reminder_30_days: boolean
  reminder_7_days: boolean
  reminder_expired: boolean
  tags: string[]
  version: string
  status: 'active' | 'expired' | 'archived'
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
  category?: DocumentCategory
}

interface DocumentStats {
  total: number
  active: number
  expiring_soon: number
  expired: number
  by_category: { [key: string]: number }
}

export default function DocumentManagementPage() {
  const t = useTranslations('documents')
  const { user, userRole } = useAuth()
  
  // 상태 관리
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    active: 0,
    expiring_soon: 0,
    expired: 0,
    by_category: {}
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expiryFilter, setExpiryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'title' | 'expiry_date' | 'created_at'>('expiry_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // 모달 상태
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showReminderDashboard, setShowReminderDashboard] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null)

  // 데이터 로드
  useEffect(() => {
    loadDocuments()
    loadCategories()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(*)
        `)
        .order('expiry_date', { ascending: true })

      if (error) throw error

      setDocuments(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('문서 로드 오류:', error)
      toast.error('문서를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
    }
  }

  const calculateStats = (docs: Document[]) => {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const stats: DocumentStats = {
      total: docs.length,
      active: 0,
      expiring_soon: 0,
      expired: 0,
      by_category: {}
    }

    docs.forEach(doc => {
      // 카테고리별 통계
      const categoryName = doc.category?.name_ko || '미분류'
      stats.by_category[categoryName] = (stats.by_category[categoryName] || 0) + 1

      // 만료일 기준 통계
      if (doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date)
        if (expiryDate < now) {
          stats.expired++
        } else if (expiryDate <= thirtyDaysFromNow) {
          stats.expiring_soon++
        } else {
          stats.active++
        }
      } else {
        stats.active++
      }
    })

    setStats(stats)
  }

  // 필터링된 문서 목록
  const filteredDocuments = documents.filter(doc => {
    // 검색어 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = doc.title.toLowerCase().includes(query)
      const matchesDescription = doc.description?.toLowerCase().includes(query) || false
      const matchesTags = doc.tags.some(tag => tag.toLowerCase().includes(query))
      if (!matchesTitle && !matchesDescription && !matchesTags) return false
    }

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') {
        if (doc.category_id) return false
      } else {
        if (doc.category_id !== selectedCategory) return false
      }
    }

    // 만료일 필터
    if (expiryFilter !== 'all') {
      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      if (expiryFilter === 'expired') {
        if (!doc.expiry_date || new Date(doc.expiry_date) >= now) return false
      } else if (expiryFilter === 'expiring_soon') {
        if (!doc.expiry_date || new Date(doc.expiry_date) < now || new Date(doc.expiry_date) > thirtyDaysFromNow) return false
      } else if (expiryFilter === 'active') {
        if (!doc.expiry_date || new Date(doc.expiry_date) < now) return false
      }
    }

    return true
  })

  // 정렬
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0
    
    if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title)
    } else if (sortBy === 'expiry_date') {
      if (!a.expiry_date && !b.expiry_date) comparison = 0
      else if (!a.expiry_date) comparison = 1
      else if (!b.expiry_date) comparison = -1
      else comparison = new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    } else if (sortBy === 'created_at') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  // 문서 삭제
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (error) throw error

      toast.success('문서가 삭제되었습니다.')
      loadDocuments()
    } catch (error) {
      console.error('문서 삭제 오류:', error)
      toast.error('문서 삭제 중 오류가 발생했습니다.')
    }
  }

  // 문서 다운로드
  const handleDownloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('document-files')
        .download(document.file_path)

      if (error) throw error

      // 다운로드 로그 기록
      await supabase
        .from('document_download_logs')
        .insert({
          document_id: document.id,
          user_id: user?.id,
          ip_address: null, // 클라이언트에서는 IP 주소를 가져올 수 없음
          user_agent: navigator.userAgent
        })

      // 파일 다운로드
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = document.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('문서가 다운로드되었습니다.')
    } catch (error) {
      console.error('문서 다운로드 오류:', error)
      toast.error('문서 다운로드 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">문서 관리</h1>
              <p className="mt-2 text-gray-600">회사 문서를 체계적으로 관리하고 만료일을 추적하세요</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowReminderDashboard(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Bell className="w-4 h-4 mr-2" />
                알림 관리
              </button>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Folder className="w-4 h-4 mr-2" />
                카테고리 관리
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Upload className="w-4 h-4 mr-2" />
                문서 업로드
              </button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">전체 문서</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">활성 문서</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">만료 예정</p>
                <p className="text-2xl font-bold text-gray-900">{stats.expiring_soon}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">만료된 문서</p>
                <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <DocumentFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          expiryFilter={expiryFilter}
          setExpiryFilter={setExpiryFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {/* 문서 목록 */}
        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">문서를 불러오는 중...</span>
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">문서가 없습니다</h3>
              <p className="mt-1 text-sm text-gray-500">새로운 문서를 업로드해보세요.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  문서 업로드
                </button>
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {sortedDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  viewMode={viewMode}
                  onEdit={() => setEditingDocument(document)}
                  onDelete={() => handleDeleteDocument(document.id)}
                  onDownload={() => handleDownloadDocument(document)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 모달들 */}
      {showUploadModal && (
        <DocumentUploadModal
          categories={categories}
          onClose={() => {
            setShowUploadModal(false)
            setEditingDocument(null)
          }}
          onSuccess={() => {
            loadDocuments()
            setShowUploadModal(false)
            setEditingDocument(null)
          }}
          editingDocument={editingDocument}
        />
      )}

      {showCategoryModal && (
        <DocumentCategoryModal
          onClose={() => {
            setShowCategoryModal(false)
            setEditingCategory(null)
          }}
          onSuccess={() => {
            loadCategories()
            setShowCategoryModal(false)
            setEditingCategory(null)
          }}
          editingCategory={editingCategory}
        />
      )}

      {showReminderDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <DocumentReminderDashboard onClose={() => setShowReminderDashboard(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
