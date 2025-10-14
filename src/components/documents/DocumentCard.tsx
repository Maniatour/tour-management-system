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
  Clock,
  Tag
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DocumentCategory {
  id: string
  name_ko: string
  name_en: string
  color: string
  icon: string
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
  viewMode: 'grid' | 'list'
  onEdit: () => void
  onDelete: () => void
  onDownload: () => void
}

export default function DocumentCard({
  document,
  viewMode,
  onEdit,
  onDelete,
  onDownload
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

  // 그리드 뷰
  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: document.category?.color + '20' }}
              >
                <FileText 
                  className="w-5 h-5" 
                  style={{ color: document.category?.color }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {document.title}
                </h3>
                {document.category && (
                  <p className="text-sm text-gray-500">{document.category.name_ko}</p>
                )}
              </div>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                  <div className="py-1">
                    <button
                      onClick={onDownload}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4 mr-3" />
                      다운로드
                    </button>
                    <button
                      onClick={onEdit}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Edit className="w-4 h-4 mr-3" />
                      편집
                    </button>
                    <button
                      onClick={onDelete}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-3" />
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 설명 */}
          {document.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {document.description}
            </p>
          )}

          {/* 태그 */}
          {document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {document.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </span>
              ))}
              {document.tags.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{document.tags.length - 3}개 더
                </span>
              )}
            </div>
          )}

          {/* 만료일 정보 */}
          <div className="space-y-2">
            {document.expiry_date && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    만료일: {format(new Date(document.expiry_date), 'yyyy-MM-dd', { locale: ko })}
                  </span>
                </div>
                <span 
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    expiryStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                    expiryStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {expiryStatus.color === 'red' ? (
                    <XCircle className="w-3 h-3 mr-1" />
                  ) : expiryStatus.color === 'yellow' ? (
                    <AlertTriangle className="w-3 h-3 mr-1" />
                  ) : (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  )}
                  {expiryStatus.text}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{formatFileSize(document.file_size)}</span>
              <span>{document.file_type.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 리스트 뷰
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-center space-x-4">
          {/* 아이콘 */}
          <div 
            className="p-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: document.category?.color + '20' }}
          >
            <FileText 
              className="w-5 h-5" 
              style={{ color: document.category?.color }}
            />
          </div>

          {/* 제목 및 설명 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {document.title}
              </h3>
              {document.category && (
                <span className="text-sm text-gray-500">({document.category.name_ko})</span>
              )}
            </div>
            {document.description && (
              <p className="text-gray-600 text-sm mt-1 line-clamp-1">
                {document.description}
              </p>
            )}
          </div>

          {/* 만료일 */}
          <div className="flex-shrink-0 text-center">
            {document.expiry_date ? (
              <div>
                <div className="text-sm text-gray-600">
                  {format(new Date(document.expiry_date), 'yyyy-MM-dd', { locale: ko })}
                </div>
                <span 
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    expiryStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                    expiryStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {expiryStatus.text}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">만료일 없음</span>
            )}
          </div>

          {/* 파일 정보 */}
          <div className="flex-shrink-0 text-center">
            <div className="text-sm text-gray-600">{formatFileSize(document.file_size)}</div>
            <div className="text-xs text-gray-500">{document.file_type.toUpperCase()}</div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex-shrink-0 flex items-center space-x-2">
            <button
              onClick={onDownload}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
