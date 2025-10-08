'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Shield, X, Check, AlertCircle } from 'lucide-react'

interface GuideDocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  documentType: 'medical' | 'cpr'
}

export default function GuideDocumentUploadModal({ 
  isOpen, 
  onClose, 
  documentType 
}: GuideDocumentUploadModalProps) {
  const t = useTranslations('common')
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const getDocumentTypeInfo = () => {
    if (documentType === 'medical') {
      return {
        title: t('medicalReport'),
        icon: <FileText className="w-6 h-6" />,
        description: '의료 검진 보고서를 업로드하세요.',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      }
    } else if (documentType === 'cpr') {
      return {
        title: t('cprCertificate'),
        icon: <Shield className="w-6 h-6" />,
        description: 'CPR 자격증을 업로드하세요.',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      }
    }
    return {
      title: '문서',
      icon: <FileText className="w-6 h-6" />,
      description: '문서를 업로드하세요.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.')
      return
    }
    
    // 허용된 파일 타입
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setError('지원되지 않는 파일 형식입니다. (JPG, PNG, PDF, DOC, DOCX만 허용)')
      return
    }
    
    setSelectedFile(file)
    setError('')
    
    // 기본 날짜 설정 (발급일은 오늘, 만료일은 1년 후)
    const today = new Date().toISOString().split('T')[0]
    const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setIssueDate(today)
    setExpiryDate(oneYearLater)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('파일을 선택해주세요.')
      return
    }
    
    if (!issueDate || !expiryDate) {
      setError('발급일과 만료일을 입력해주세요.')
      return
    }
    
    // 만료일이 발급일보다 이전인지 확인
    if (new Date(expiryDate) <= new Date(issueDate)) {
      setError('만료일은 발급일보다 이후여야 합니다.')
      return
    }
    
    setUploading(true)
    setError('')
    setSuccess(false)
    
    try {
      // 먼저 카테고리 ID를 가져옴
      const categoryName = documentType === 'medical' ? '메디컬 리포트' : 'CPR 자격증'
      const { data: categoryData, error: categoryError } = await supabase
        .from('document_categories')
        .select('id')
        .eq('name_ko', categoryName)
        .single()

      if (categoryError || !categoryData) {
        throw new Error(`${categoryName} 카테고리를 찾을 수 없습니다.`)
      }

      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `guide-documents/${documentType}/${fileName}`
      
      // 파일 업로드
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, selectedFile)
      
      if (uploadError) {
        throw uploadError
      }
      
      // 데이터베이스에 문서 정보 저장
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          title: selectedFile.name.split('.')[0], // 파일명에서 확장자 제거
          description: `${categoryName} 업로드`,
          category_id: categoryData.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          file_type: fileExt || '',
          mime_type: selectedFile.type,
          issue_date: issueDate,
          expiry_date: expiryDate,
          guide_email: user?.email,
          auto_calculate_expiry: false,
          validity_period_months: Math.ceil((new Date(expiryDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24 * 30)),
          status: 'active'
        })
      
      if (insertError) {
        throw insertError
      }
      
      setSuccess(true)
      
      // 2초 후 모달 닫기
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setSelectedFile(null)
        setIssueDate('')
        setExpiryDate('')
      }, 2000)
      
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      setError('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const documentInfo = getDocumentTypeInfo()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={documentInfo.color}>
              {documentInfo.icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {documentInfo.title} 업로드
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          <div className="space-y-6">
            {/* 설명 */}
            <div className={`p-4 rounded-lg border ${documentInfo.bgColor} ${documentInfo.borderColor}`}>
              <p className={`text-sm ${documentInfo.color}`}>
                {documentInfo.description}
              </p>
            </div>

            {/* 성공 메시지 */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-green-700">문서가 성공적으로 업로드되었습니다!</span>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* 파일 업로드 영역 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-lg text-blue-600 hover:text-blue-800 font-medium">
                    파일을 선택하거나 드래그하여 업로드
                  </span>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    disabled={uploading}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG, PDF, DOC, DOCX 파일 (최대 10MB)
                </p>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">
                      선택된 파일: {selectedFile.name}
                    </p>
                    <p className="text-xs text-green-600">
                      크기: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
                {uploading && (
                  <div className="mt-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">업로드 중...</p>
                  </div>
                )}
              </div>
            </div>

            {/* 날짜 입력 필드 */}
            {selectedFile && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      발급일
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      만료일
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={uploading}
              >
                {success ? '완료' : '취소'}
              </button>
              {selectedFile && !success && (
                <button
                  onClick={handleUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  disabled={uploading || !issueDate || !expiryDate}
                >
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
