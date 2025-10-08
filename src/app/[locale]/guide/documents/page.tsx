'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Shield, Check, X, Download, Trash2 } from 'lucide-react'

interface Document {
  id: string
  title: string
  description?: string
  category_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  issue_date?: string
  expiry_date?: string
  guide_email?: string
  created_at: string
  updated_at: string
}

export default function DocumentsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('common')
  const { user, userRole } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  
  const documentType = searchParams.get('type') as 'medical' | 'cpr' | null
  
  useEffect(() => {
    if (!user || userRole !== 'team_member') {
      router.push('/auth')
      return
    }
    
    loadDocuments()
  }, [user, userRole, documentType])
  
  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      // 먼저 카테고리 ID를 가져옴
      const categoryName = documentType === 'medical' ? '메디컬 리포트' : 'CPR 자격증'
      const { data: categoryData, error: categoryError } = await supabase
        .from('document_categories')
        .select('id')
        .eq('name_ko', categoryName)
        .single()

      if (categoryError || !categoryData) {
        console.error(`${categoryName} 카테고리를 찾을 수 없습니다:`, categoryError)
        setError(`${categoryName} 카테고리를 찾을 수 없습니다.`)
        return
      }
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('guide_email', user?.email)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('문서 로드 오류:', error)
        setError('문서를 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setDocuments(data || [])
    } catch (error) {
      console.error('문서 로드 오류:', error)
      setError('문서를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setUploading(true)
    setError('')
    
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

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `guide-documents/${documentType}/${fileName}`
      
      // 파일 업로드
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file)
      
      if (uploadError) {
        throw uploadError
      }
      
      // 데이터베이스에 문서 정보 저장
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          title: file.name.split('.')[0], // 파일명에서 확장자 제거
          description: `${categoryName} 업로드`,
          category_id: categoryData.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: fileExt || '',
          mime_type: file.type,
          issue_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1년 후 만료
          guide_email: user?.email,
          auto_calculate_expiry: true,
          validity_period_months: 12,
          status: 'active'
        })
      
      if (insertError) {
        throw insertError
      }
      
      // 문서 목록 다시 로드
      await loadDocuments()
      
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      setError('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }
  
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
      
      if (error) {
        throw error
      }
      
      await loadDocuments()
    } catch (error) {
      console.error('문서 삭제 오류:', error)
      setError('문서 삭제 중 오류가 발생했습니다.')
    }
  }
  
  const getDocumentTypeInfo = () => {
    if (documentType === 'medical') {
      return {
        title: t('medicalReport'),
        icon: <FileText className="w-6 h-6" />,
        description: '의료 검진 보고서를 업로드하세요.'
      }
    } else if (documentType === 'cpr') {
      return {
        title: t('cprCertificate'),
        icon: <Shield className="w-6 h-6" />,
        description: 'CPR 자격증을 업로드하세요.'
      }
    }
    return {
      title: t('myDocuments'),
      icon: <FileText className="w-6 h-6" />,
      description: '문서를 관리하세요.'
    }
  }
  
  const documentInfo = getDocumentTypeInfo()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-blue-600">
                {documentInfo.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {documentInfo.title}
                </h1>
                <p className="text-gray-600">{documentInfo.description}</p>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              뒤로가기
            </button>
          </div>
        </div>
        
        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <X className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
        
        {/* 파일 업로드 영역 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('uploadDocument')}
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-lg text-blue-600 hover:text-blue-800 font-medium">
                  파일을 선택하거나 드래그하여 업로드
                </span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  disabled={uploading}
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">
                JPG, PNG, PDF, DOC, DOCX 파일 (최대 10MB)
              </p>
              {uploading && (
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 mt-2">업로드 중...</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 문서 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              업로드된 문서 ({documents.length}개)
            </h2>
          </div>
          
          {documents.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">업로드된 문서가 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <div key={doc.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-blue-600">
                      {documentType === 'medical' ? (
                        <FileText className="w-8 h-8" />
                      ) : (
                        <Shield className="w-8 h-8" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        업로드일: {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                      </p>
                      {doc.expiry_date && (
                        <p className="text-sm text-orange-600">
                          만료일: {new Date(doc.expiry_date).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <a
                      href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${doc.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                      title="다운로드"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
