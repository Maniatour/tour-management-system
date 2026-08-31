'use client'

import { useState } from 'react'
import { 
  FileText, 
  Calendar, 
  AlertTriangle, 
  MoreVertical, 
  Download, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Tag,
  ChevronDown
} from 'lucide-react'
import { flattenCategoryTree, categoryOptionLabel } from '@/lib/documentCategories'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DocumentCategory {
  id: string
  name_ko: string
  name_en: string
  color: string
  icon: string
  parent_id?: string | null
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

interface DocumentCardProps {
  document: Document
  categories: DocumentCategory[]
  viewMode: 'grid' | 'list'
  categoryUpdating?: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onDownload: () => void
  onCategoryChange: (categoryId: string) => void
}

function DocumentCategoryBadge({
  categories,
  value,
  disabled,
  onChange,
}: {
  categories: DocumentCategory[]
  value?: string
  disabled?: boolean
  onChange: (categoryId: string) => void
}) {
  const options = flattenCategoryTree(categories)
  const selected = options.find((category) => category.id === value)
  const color = selected?.color || '#6B7280'
  const label = selected?.name_ko || '미분류'

  return (
    <div className="relative inline-flex max-w-full">
      <span
        className="inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <span className="break-words">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </span>
      <select
        aria-label="문서 분류"
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        <option value="">미분류</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {categoryOptionLabel(category.name_ko, category.depth)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function DocumentCard({
  document,
  categories,
  viewMode,
  categoryUpdating = false,
  onView,
  onEdit,
  onDelete,
  onDownload,
  onCategoryChange,
}: DocumentCardProps) {
  const [showActions, setShowActions] = useState(false)

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 만료 상태 확인
  const getExpiryStatus = () => {
    if (!document.expiry_date) return { status: 'no-expiry', color: 'gray', text: '만료일 없음' }
    
    const now = new Date()
    const expiryDate = new Date(document.expiry_date)
    const diffTime = expiryDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { status: 'expired', color: 'red', text: '만료됨' }
    } else if (diffDays <= 7) {
      return { status: 'expiring-soon', color: 'red', text: `${diffDays}일 후 만료` }
    } else if (diffDays <= 30) {
      return { status: 'expiring-soon', color: 'yellow', text: `${diffDays}일 후 만료` }
    } else {
      return { status: 'active', color: 'green', text: `${diffDays}일 후 만료` }
    }
  }

  const expiryStatus = getExpiryStatus()
  const categoryColor = document.category?.color || '#6B7280'

  const viewButton = (
    <button
      type="button"
      onClick={onView}
      title="문서 보기"
      aria-label="문서 보기"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring"
      style={{ backgroundColor: `${categoryColor}20` }}
    >
      <FileText className="h-5 w-5" style={{ color: categoryColor }} />
    </button>
  )

  const categoryBadge = (
    <DocumentCategoryBadge
      categories={categories}
      {...(document.category_id ? { value: document.category_id } : {})}
      {...(categoryUpdating ? { disabled: true } : {})}
      onChange={onCategoryChange}
    />
  )

  // 그리드 뷰 (모바일 컴팩트)
  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
        <div className="p-4 sm:p-5 lg:p-6">
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
              {viewButton}
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words leading-snug">
                  {document.title}
                </h3>
              </div>
            </div>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring rounded"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-40 sm:w-48 bg-white rounded-md shadow-lg z-10 border py-1">
                  <button
                    onClick={onDownload}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </button>
                  <button
                    onClick={onEdit}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    편집
                  </button>
                  <button
                    onClick={onDelete}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 설명 - 모바일에서 1줄 */}
          {document.description && (
            <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-4 line-clamp-1 sm:line-clamp-2">
              {document.description}
            </p>
          )}

          {/* 태그 - 모바일에서 더 적게 */}
          {document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 sm:mb-4">
              {document.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  <Tag className="w-3 h-3 mr-0.5 sm:mr-1 hidden sm:inline" />
                  {tag}
                </span>
              ))}
              {document.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{document.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* 만료일 정보 */}
          <div className="space-y-1.5 sm:space-y-2">
            {document.expiry_date && (
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-600 truncate">
                    {format(new Date(document.expiry_date), 'yyyy-MM-dd', { locale: ko })}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    expiryStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                    expiryStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {expiryStatus.color === 'red' ? (
                    <XCircle className="w-3 h-3 mr-0.5 sm:mr-1" />
                  ) : expiryStatus.color === 'yellow' ? (
                    <AlertTriangle className="w-3 h-3 mr-0.5 sm:mr-1" />
                  ) : (
                    <CheckCircle className="w-3 h-3 mr-0.5 sm:mr-1" />
                  )}
                  {expiryStatus.text}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {categoryBadge}
                <span>{formatFileSize(document.file_size)}</span>
              </div>
              <span>{document.file_type.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 리스트 뷰 - 모바일: 세로 스택, 데스크톱: 가로 한 줄
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
      <div className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {/* 상단: 아이콘 + 제목 + 액션 (모바일 한 줄) */}
          <div className="flex items-start gap-2 sm:gap-4 min-w-0">
            {viewButton}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words leading-snug">
                {document.title}
              </h3>
              {document.description && (
                <p className="text-gray-600 text-xs sm:text-sm mt-1 break-words">
                  {document.description}
                </p>
              )}
            </div>
            {/* 모바일: 액션을 오른쪽에 */}
            <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0 sm:ml-auto">
              <button
                onClick={onDownload}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                title="다운로드"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                title="편집"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 하단: 만료일 + 파일정보 (모바일), 데스크톱에서는 위와 한 줄 */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pl-11 sm:pl-0 sm:flex-shrink-0 text-sm">
            {categoryBadge}
            {document.expiry_date ? (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">
                  {format(new Date(document.expiry_date), 'yyyy-MM-dd', { locale: ko })}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    expiryStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                    expiryStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {expiryStatus.text}
                </span>
              </div>
            ) : (
              <span className="text-gray-400 text-xs sm:text-sm">만료일 없음</span>
            )}
            <span className="text-gray-500 text-xs sm:text-sm">
              {formatFileSize(document.file_size)} · {document.file_type.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
