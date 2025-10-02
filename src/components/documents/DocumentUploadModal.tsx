'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { 
  X, 
  Upload, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  Tag,
  Save,
  Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

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

interface DocumentUploadModalProps {
  categories: DocumentCategory[]
  onClose: () => void
  onSuccess: () => void
  editingDocument?: Document | null
}

export default function DocumentUploadModal({
  categories,
  onClose,
  onSuccess,
  editingDocument
}: DocumentUploadModalProps) {
  const t = useTranslations('documents')
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: editingDocument?.title || '',
    description: editingDocument?.description || '',
    category_id: editingDocument?.category_id || '',
    issue_date: editingDocument?.issue_date || '',
    expiry_date: editingDocument?.expiry_date || '',
    auto_calculate_expiry: editingDocument?.auto_calculate_expiry || false,
    validity_period_months: editingDocument?.validity_period_months || 12,
    reminder_30_days: editingDocument?.reminder_30_days ?? true,
    reminder_7_days: editingDocument?.reminder_7_days ?? true,
    reminder_expired: editingDocument?.reminder_expired ?? true,
    tags: editingDocument?.tags.join(', ') || '',
    version: editingDocument?.version || '1.0'
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 파일 크기 제한 (100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('파일 크기는 100MB를 초과할 수 없습니다.')
        return
      }
      
      // 허용된 파일 타입 확인
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('PDF, Word 문서, 이미지 파일만 업로드할 수 있습니다.')
        return
      }
      
      setSelectedFile(file)
      
      // 제목이 비어있으면 파일명으로 설정
      if (!formData.title) {
        setFormData(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, '') // 확장자 제거
        }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('문서 제목을 입력해주세요.')
      return
    }
    
    if (!editingDocument && !selectedFile) {
      toast.error('파일을 선택해주세요.')
      return
    }

    try {
      setLoading(true)
      
      let filePath = editingDocument?.file_path
      
      // 새 파일이 선택된 경우 업로드
      if (selectedFile) {
        setUploading(true)
        
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        filePath = `${user?.id}/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('document-files')
          .upload(filePath, selectedFile)
        
        if (uploadError) throw uploadError
        
        setUploading(false)
      }
      
      // 태그 처리
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
      
      const documentData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category_id: formData.category_id || null,
        file_name: selectedFile?.name || editingDocument?.file_name,
        file_path: filePath,
        file_size: selectedFile?.size || editingDocument?.file_size,
        file_type: selectedFile?.name.split('.').pop() || editingDocument?.file_type,
        mime_type: selectedFile?.type || editingDocument?.mime_type,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
        auto_calculate_expiry: formData.auto_calculate_expiry,
        validity_period_months: formData.validity_period_months,
        reminder_30_days: formData.reminder_30_days,
        reminder_7_days: formData.reminder_7_days,
        reminder_expired: formData.reminder_expired,
        tags,
        version: formData.version,
        updated_by: user?.id
      }
      
      if (editingDocument) {
        // 문서 수정
        const { error } = await supabase
          .from('documents')
          .update(documentData)
          .eq('id', editingDocument.id)
        
        if (error) throw error
        
        toast.success('문서가 수정되었습니다.')
      } else {
        // 새 문서 생성
        const { error } = await supabase
          .from('documents')
          .insert({
            ...documentData,
            created_by: user?.id
          })
        
        if (error) throw error
        
        toast.success('문서가 업로드되었습니다.')
      }
      
      onSuccess()
    } catch (error) {
      console.error('문서 업로드 오류:', error)
      toast.error('문서 업로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  const handleAutoCalculateChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      auto_calculate_expiry: checked,
      expiry_date: checked && prev.issue_date ? '' : prev.expiry_date
    }))
  }

  const handleIssueDateChange = (date: string) => {
    setFormData(prev => ({
      ...prev,
      issue_date: date,
      expiry_date: prev.auto_calculate_expiry ? '' : prev.expiry_date
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingDocument ? '문서 수정' : '문서 업로드'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 파일 선택 */}
            {!editingDocument && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  파일 선택 *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer transition-colors"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center space-x-3">
                      <FileText className="w-8 h-8 text-blue-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">클릭하여 파일을 선택하거나 드래그하여 업로드</p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF, Word 문서, 이미지 파일 (최대 100MB)
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                />
              </div>
            )}

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                문서 제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="문서 제목을 입력하세요"
                required
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="문서에 대한 설명을 입력하세요"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">카테고리 선택</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ko}
                  </option>
                ))}
              </select>
            </div>

            {/* 발급일 및 만료일 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  발급일
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleIssueDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  만료일
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  disabled={formData.auto_calculate_expiry}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* 자동 만료일 계산 */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="auto_calculate_expiry"
                checked={formData.auto_calculate_expiry}
                onChange={(e) => handleAutoCalculateChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto_calculate_expiry" className="text-sm font-medium text-gray-700">
                발급일 기준으로 만료일 자동 계산
              </label>
            </div>

            {formData.auto_calculate_expiry && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  유효기간 (개월)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={formData.validity_period_months}
                  onChange={(e) => setFormData(prev => ({ ...prev, validity_period_months: parseInt(e.target.value) || 12 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* 알림 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                알림 설정
              </label>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="reminder_30_days"
                    checked={formData.reminder_30_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminder_30_days: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="reminder_30_days" className="text-sm text-gray-700">
                    30일 전 알림
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="reminder_7_days"
                    checked={formData.reminder_7_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminder_7_days: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="reminder_7_days" className="text-sm text-gray-700">
                    7일 전 알림
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="reminder_expired"
                    checked={formData.reminder_expired}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminder_expired: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="reminder_expired" className="text-sm text-gray-700">
                    만료일 당일 알림
                  </label>
                </div>
              </div>
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                태그
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 계약서, 호텔, 중요)"
              />
            </div>

            {/* 버전 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                버전
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1.0"
              />
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploading ? '업로드 중...' : '저장 중...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingDocument ? '수정' : '업로드'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
