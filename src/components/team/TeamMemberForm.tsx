'use client'

import React, { useState, useEffect, useRef } from 'react'
import { User, Car, CreditCard, Shield, FileText, Upload, Download, Edit, Trash2, ImagePlus, StickyNote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type TeamMember = Database['public']['Tables']['team']['Row']
type TeamMemberInsert = Database['public']['Tables']['team']['Insert']

const TEAM_POSITION_OPTIONS = [
  { value: 'manager', labelKo: '매니저', labelEn: 'manager' },
  { value: 'admin', labelKo: '관리자', labelEn: 'admin' },
  { value: 'tour guide', labelKo: '투어 가이드', labelEn: 'tour guide' },
  { value: 'driver', labelKo: '운전기사', labelEn: 'driver' },
  { value: 'op', labelKo: '운영자', labelEn: 'op' },
] as const

const TEAM_DOCUMENT_TYPE_OPTIONS = [
  { type: 'contract', label: '계약서', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp' },
  { type: 'id_copy', label: '신분증 사본', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { type: 'bank_info', label: 'W9', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { type: 'other', label: '기타 문서', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp' },
] as const

type TeamDocumentType = (typeof TEAM_DOCUMENT_TYPE_OPTIONS)[number]['type']

function teamPositionOptionLabel(ko: string, en: string) {
  return `${ko} (${en})`
}

function teamDocumentTypeLabel(type: string): string {
  return TEAM_DOCUMENT_TYPE_OPTIONS.find((o) => o.type === type)?.label || type
}

function fileExtensionFromName(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop() || '').toLowerCase() : ''
}

function isImageDocument(name: string, url?: string): boolean {
  const ext = fileExtensionFromName(name) || fileExtensionFromName(url || '')
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)
}

/** 카드 표시명: 계약서.pdf 형태 */
function teamDocumentDisplayName(type: string, name: string): string {
  const label = teamDocumentTypeLabel(type)
  const ext = fileExtensionFromName(name)
  return ext ? `${label}.${ext}` : label
}

/** 팀원 문서(documents 버킷) 업로드 최대 크기 — storage.buckets.file_size_limit 과 맞출 것 */
const TEAM_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024
const TEAM_DOCUMENT_MAX_LABEL = '50MB'

function documentsBucketPathFromPublicUrl(publicUrl: string): string | null {
  const u = publicUrl.trim()
  const markers = ['/object/public/documents/', '/storage/v1/object/public/documents/']
  for (const m of markers) {
    const i = u.indexOf(m)
    if (i !== -1) {
      const raw = u.slice(i + m.length).split('?')[0]
      try {
        return decodeURIComponent(raw || '')
      } catch {
        return raw || null
      }
    }
  }
  return null
}

export type TeamMemberFormProps = {
  member: TeamMember | null
  onSubmit: (data: TeamMemberInsert) => void
  onCancel: () => void
  onDelete?: () => void | Promise<void>
  onDocumentChange?: (email: string) => void
}

export default function TeamMemberForm({ member, onSubmit, onCancel, onDelete, onDocumentChange }: TeamMemberFormProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  // 문서 타입별 문서 목록을 관리
  type DocumentItem = {
    id: string
    name: string
    url: string
    path: string
    size: number
    uploadedAt: string
  }
  
  const [uploadedDocuments, setUploadedDocuments] = useState<{[key: string]: DocumentItem[]}>({})
  const [uploading, setUploading] = useState<{[key: string]: boolean}>({})
  const [uploadDocumentType, setUploadDocumentType] = useState<TeamDocumentType>('contract')
  const documentUploadInputRef = useRef<HTMLInputElement>(null)
  
  // 컴포넌트 마운트 시 기존 문서 불러오기
  useEffect(() => {
    if (member?.email) {
      loadExistingDocuments()
    }
  }, [member?.email])

  const selectedUploadOption =
    TEAM_DOCUMENT_TYPE_OPTIONS.find((o) => o.type === uploadDocumentType) || TEAM_DOCUMENT_TYPE_OPTIONS[0]

  const flatDocuments = TEAM_DOCUMENT_TYPE_OPTIONS.flatMap(({ type }) =>
    (uploadedDocuments[type] || []).map((doc) => ({ ...doc, documentType: type }))
  )

  const isAnyDocumentUploading = Object.values(uploading).some(Boolean)

  // 기존 문서 불러오기
  const loadExistingDocuments = async () => {
    if (!member?.email) return
    
    try {
      const documentTypes = ['contract', 'id_copy', 'bank_info', 'other']
      const allDocuments: {[key: string]: DocumentItem[]} = {}
      
      for (const docType of documentTypes) {
        const prefix = `team-documents/${member.email}/${docType}/`
        const { data: files, error } = await supabase.storage
          .from('documents')
          .list(prefix, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
          })
        
        if (error) {
          console.error(`${docType} 문서 목록 조회 오류:`, error)
          allDocuments[docType] = []
          continue
        }
        
        if (files && files.length > 0) {
          allDocuments[docType] = files
            .filter(file => file.name !== '.emptyFolderPlaceholder')
            .map(file => {
              const filePath = `${prefix}${file.name}`
              const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath)
              
              return {
                id: file.id || `${docType}-${file.name}`,
                name: file.name,
                url: publicUrl,
                path: filePath,
                size: file.metadata?.size || 0,
                uploadedAt: file.created_at || new Date().toISOString()
              }
            })
        } else {
          allDocuments[docType] = []
        }
      }
      
      setUploadedDocuments(allDocuments)
    } catch (error) {
      console.error('문서 목록 불러오기 오류:', error)
    }
  }
  
  // 문서 업로드 함수 (여러 개 업로드 가능)
  const handleDocumentUpload = async (files: FileList | null, documentType: string) => {
    if (!files || files.length === 0) return
    
    if (!member?.email) {
      alert('팀원 이메일이 필요합니다. 먼저 이메일을 입력해주세요.')
      return
    }
    
    setUploading(prev => ({ ...prev, [documentType]: true }))
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 파일 크기 체크
        if (file.size > TEAM_DOCUMENT_MAX_BYTES) {
          throw new Error(
            `파일 "${file.name}"의 크기가 너무 큽니다. 최대 ${TEAM_DOCUMENT_MAX_LABEL}까지 업로드 가능합니다.`
          )
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `team-documents/${member.email}/${documentType}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`파일 "${file.name}" 업로드 실패: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath)

        return {
          id: `${documentType}-${fileName}`,
          name: file.name,
          url: publicUrl,
          path: filePath,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }
      })
      
      const uploadedDocs = await Promise.all(uploadPromises)
      
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: [...(prev[documentType] || []), ...uploadedDocs]
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert(`${uploadedDocs.length}개의 문서가 성공적으로 업로드되었습니다!`)
    } catch (error: any) {
      console.error('문서 업로드 오류:', error)
      
      // 버킷이 없는 경우 명확한 에러 메시지
      if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
        alert('문서 저장소가 설정되지 않았습니다. 관리자에게 문의해주세요.\n\n에러: ' + error.message)
      } else {
        alert('문서 업로드 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
      }
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }
  
  // 문서 삭제 함수
  const handleDocumentDelete = async (e: React.MouseEvent, documentType: string, documentId: string, filePath: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove([filePath])
      
      if (error) {
        throw error
      }
      
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: (prev[documentType] || []).filter(doc => doc.id !== documentId)
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert('문서가 삭제되었습니다.')
    } catch (error: any) {
      console.error('문서 삭제 오류:', error)
      alert('문서 삭제 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
    }
  }
  
  // 문서 교체 함수 (수정)
  const handleDocumentReplace = async (file: File, documentType: string, oldDocumentId: string, oldFilePath: string) => {
    if (!member?.email) {
      alert('팀원 이메일이 필요합니다.')
      return
    }
    
    // 파일 크기 체크
    if (file.size > TEAM_DOCUMENT_MAX_BYTES) {
      alert(`파일 크기가 너무 큽니다. 최대 ${TEAM_DOCUMENT_MAX_LABEL}까지 업로드 가능합니다.`)
      return
    }
    
    setUploading(prev => ({ ...prev, [documentType]: true }))
    
    try {
      // 새 파일 업로드
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const newFilePath = `team-documents/${member.email}/${documentType}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(newFilePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(newFilePath)

      // 기존 파일 삭제
      try {
        await supabase.storage
          .from('documents')
          .remove([oldFilePath])
      } catch (deleteError) {
        console.warn('기존 파일 삭제 실패 (무시):', deleteError)
      }

      // 문서 목록 업데이트
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: (prev[documentType] || []).map(doc => 
          doc.id === oldDocumentId 
            ? {
                id: oldDocumentId,
                name: file.name,
                url: publicUrl,
                path: newFilePath,
                size: file.size,
                uploadedAt: new Date().toISOString()
              }
            : doc
        )
      }))
      
      // 부모 컴포넌트에 문서 변경 알림
      if (member?.email && onDocumentChange) {
        onDocumentChange(member.email)
      }
      
      alert('문서가 성공적으로 교체되었습니다!')
    } catch (error: any) {
      console.error('문서 교체 오류:', error)
      alert('문서 교체 중 오류가 발생했습니다.\n\n에러: ' + (error?.message || '알 수 없는 오류'))
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }
  
  const [formData, setFormData] = useState<TeamMemberInsert>({
    email: member?.email || '',
    name_ko: member?.name_ko || '',
    name_en: member?.name_en || '',
    nick_name: member?.nick_name || '',
    phone: member?.phone || '',
    position: member?.position || '',
    languages: member?.languages || ['KR'],
    avatar_url: member?.avatar_url || '',
    is_active: member?.is_active ?? true,
    hire_date: member?.hire_date || '',
    home_address: member?.home_address || '',
    emergency_contact: member?.emergency_contact || '',
    date_of_birth: member?.date_of_birth || '',
    ssn: member?.ssn || '',
    personal_car_model: member?.personal_car_model || '',
    car_year: member?.car_year || null,
    car_plate: member?.car_plate || '',
    bank_name: member?.bank_name || '',
    account_holder: member?.account_holder || '',
    bank_number: member?.bank_number || '',
    routing_number: member?.routing_number || '',
    cpr: member?.cpr || false,
    cpr_acquired: member?.cpr_acquired || '',
    cpr_expired: member?.cpr_expired || '',
    cdl_driver_license: member?.cdl_driver_license || false,
    medical_report: member?.medical_report || false,
    medical_acquired: member?.medical_acquired || '',
    medical_expired: member?.medical_expired || '',
    notes: member?.notes || '',
  })

  const removeStoredTeamAvatarIfManaged = async (publicUrl: string | null | undefined) => {
    const url = publicUrl?.trim()
    if (!url) return
    const path = documentsBucketPathFromPublicUrl(url)
    if (!path || !path.startsWith('team-avatars/')) return
    try {
      await supabase.storage.from('documents').remove([path])
    } catch {
      /* 스토리지 정리 실패는 무시 */
    }
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const email = formData.email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      alert('프로필 사진을 올리려면 먼저 유효한 이메일을 입력해주세요.')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.')
      return
    }

    setAvatarUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
      const objectPath = `team-avatars/${email}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('documents').getPublicUrl(objectPath)

      const previous = formData.avatar_url?.trim()
      if (previous && previous !== publicUrl) {
        await removeStoredTeamAvatarIfManaged(previous)
      }

      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      console.error('프로필 사진 업로드 오류:', err)
      alert(`프로필 사진을 올리지 못했습니다.\n${msg}`)
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleAvatarRemove = async () => {
    const url = formData.avatar_url?.trim()
    if (!url) return
    setAvatarUploading(true)
    try {
      await removeStoredTeamAvatarIfManaged(url)
      setFormData((prev) => ({ ...prev, avatar_url: '' }))
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 필드 검증 (전화번호는 선택사항으로 변경)
    if (!formData.email || !formData.name_ko) {
      alert('이메일과 한국어 이름은 필수 입력 항목입니다.')
      return
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('올바른 이메일 형식을 입력해주세요.')
      return
    }

    // 날짜 필드의 빈 문자열을 null로 변환
    const processedData = {
      ...formData,
      hire_date: formData.hire_date || null,
      date_of_birth: formData.date_of_birth || null,
      cpr_acquired: formData.cpr_acquired || null,
      cpr_expired: formData.cpr_expired || null,
      medical_acquired: formData.medical_acquired || null,
      medical_expired: formData.medical_expired || null,
      phone: formData.phone || null,
      home_address: formData.home_address?.trim() || null,
      avatar_url: formData.avatar_url?.trim() || null,
      notes: formData.notes?.trim() || null,
    }

    onSubmit(processedData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200]">
      <div className="bg-white rounded-lg p-4 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {member ? '팀원 정보 수정' : '새 팀원 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 프로필 사진 + 노트 */}
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-4 shrink-0">
              <div className="h-20 w-20 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {formData.avatar_url?.trim() ? (
                  <img
                    src={formData.avatar_url.trim()}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-gray-400" aria-hidden />
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <span className="block text-sm font-medium text-gray-700">프로필 사진</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    title="이메일을 입력한 뒤 JPG·PNG·WebP·GIF 이미지를 올릴 수 있습니다. (최대 5MB)"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4 flex-shrink-0" />
                    {avatarUploading ? '업로드 중…' : '사진 선택'}
                  </button>
                  {formData.avatar_url?.trim() ? (
                    <button
                      type="button"
                      disabled={avatarUploading}
                      onClick={() => void handleAvatarRemove()}
                      className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                    >
                      사진 제거
                    </button>
                  ) : null}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(ev) => void handleAvatarFileChange(ev)}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <label
                htmlFor="team-member-notes"
                className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700"
              >
                <StickyNote className="h-4 w-4 shrink-0" aria-hidden />
                노트
              </label>
              <textarea
                id="team-member-notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full flex-1 min-h-[80px] px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm resize-y"
                placeholder="스케줄 뷰에서 가이드 이름에 마우스를 올리면 표시됩니다."
              />
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                한국어 이름 *
              </label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData({...formData, name_ko: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                영어 이름
              </label>
              <input
                type="text"
                value={formData.name_en || ''}
                onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                닉네임 <span className="text-xs text-gray-400">(투어 테이블 표시용)</span>
              </label>
              <input
                type="text"
                value={formData.nick_name || ''}
                onChange={(e) => setFormData({...formData, nick_name: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                placeholder="예: 홍길동 → 길동"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직책
              </label>
              <select
                value={formData.position || ''}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
              >
                <option value="">직책 선택 (Select position)</option>
                {TEAM_POSITION_OPTIONS.map(({ value, labelKo, labelEn }) => (
                  <option key={value} value={value}>
                    {teamPositionOptionLabel(labelKo, labelEn)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value.toLowerCase()})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                집주소
              </label>
              <textarea
                value={formData.home_address || ''}
                onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                rows={3}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm resize-y min-h-[4rem]"
                placeholder="자택 주소를 입력하세요"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                placeholder="전화번호를 입력하세요 (선택사항)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비상 연락처
              </label>
              <input
                type="text"
                value={formData.emergency_contact || ''}
                onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* 사용 언어 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사용 언어
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'KR', label: '한국어' },
                { value: 'EN', label: '영어' },
                { value: 'JP', label: '일본어' },
                { value: 'CN', label: '중국어' },
                { value: 'ES', label: '스페인어' },
                { value: 'FR', label: '프랑스어' },
                { value: 'DE', label: '독일어' },
                { value: 'RU', label: '러시아어' }
              ].map((language) => (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => {
                    const currentLanguages = formData.languages || []
                    if (currentLanguages.includes(language.value)) {
                      setFormData({
                        ...formData,
                        languages: currentLanguages.filter((lang: string) => lang !== language.value)
                      })
                    } else {
                      setFormData({
                        ...formData,
                        languages: [...currentLanguages, language.value]
                      })
                    }
                  }}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    (formData.languages || []).includes(language.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {language.label}
                </button>
              ))}
            </div>
          </div>

          {/* 개인 정보 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              개인 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  생년월일
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입사일
                </label>
                <input
                  type="date"
                  value={formData.hire_date || ''}
                  onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSN
                </label>
                <input
                  type="text"
                  value={formData.ssn || ''}
                  onChange={(e) => setFormData({...formData, ssn: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 차량 정보 - 한 줄에 배치 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <Car className="h-4 w-4 mr-2" />
              차량 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  개인 차량 모델
                </label>
                <input
                  type="text"
                  value={formData.personal_car_model || ''}
                  onChange={(e) => setFormData({...formData, personal_car_model: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차량 연도
                </label>
                <input
                  type="number"
                  min="1900"
                  max="2030"
                  value={formData.car_year || ''}
                  onChange={(e) => setFormData({...formData, car_year: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차량 번호판
                </label>
                <input
                  type="text"
                  value={formData.car_plate || ''}
                  onChange={(e) => setFormData({...formData, car_plate: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 은행 정보 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              은행 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  은행명
                </label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예금주
                </label>
                <input
                  type="text"
                  value={formData.account_holder || ''}
                  onChange={(e) => setFormData({...formData, account_holder: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  계좌번호
                </label>
                <input
                  type="text"
                  value={formData.bank_number || ''}
                  onChange={(e) => setFormData({...formData, bank_number: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  라우팅 번호
                </label>
                <input
                  type="text"
                  value={formData.routing_number || ''}
                  onChange={(e) => setFormData({...formData, routing_number: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* 자격증 및 의료 정보 - 좌우로 나누어 배치 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              자격증 및 의료 정보
            </h3>
            
            {/* CPR 자격증 정보 - 좌측 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="cpr"
                    checked={formData.cpr || false}
                    onChange={(e) => setFormData({...formData, cpr: e.target.checked})}
                    className="rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  <label htmlFor="cpr" className="text-sm font-medium text-gray-700">
                    CPR 자격증
                  </label>
                </div>
                
                {formData.cpr && (
                  <div className="space-y-2 ml-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPR 취득일
                      </label>
                      <input
                        type="date"
                        value={formData.cpr_acquired || ''}
                        onChange={(e) => setFormData({...formData, cpr_acquired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPR 만료일
                      </label>
                      <input
                        type="date"
                        value={formData.cpr_expired || ''}
                        onChange={(e) => setFormData({...formData, cpr_expired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* 의료 보고서 정보 - 우측 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="medical_report"
                    checked={formData.medical_report || false}
                    onChange={(e) => setFormData({...formData, medical_report: e.target.checked})}
                    className="rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  <label htmlFor="medical_report" className="text-sm font-medium text-gray-700">
                    의료 보고서
                  </label>
                </div>
                
                {formData.medical_report && (
                  <div className="space-y-2 ml-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        의료 보고서 취득일
                      </label>
                      <input
                        type="date"
                        value={formData.medical_acquired || ''}
                        onChange={(e) => setFormData({...formData, medical_acquired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        의료 보고서 만료일
                      </label>
                      <input
                        type="date"
                        value={formData.medical_expired || ''}
                        onChange={(e) => setFormData({...formData, medical_expired: e.target.value})}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center space-x-2">
              <input
                type="checkbox"
                id="cdl_driver_license"
                checked={formData.cdl_driver_license || false}
                onChange={(e) => setFormData({ ...formData, cdl_driver_license: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-ring"
              />
              <label htmlFor="cdl_driver_license" className="text-sm font-medium text-gray-700">
                CDL 운전면허 (Commercial Driver&apos;s License)
              </label>
            </div>
          </div>

          {/* 문서 업로드 섹션 */}
          <div className="border-t pt-4">
            <h3 className="text-base font-medium mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              문서 관리
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              PDF, Word, 이미지 파일 (파일당 최대 {TEAM_DOCUMENT_MAX_LABEL})
            </p>

            {/* 단일 업로드 영역 */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label htmlFor="team-document-type" className="block text-sm font-medium text-gray-700 mb-1">
                    문서 유형
                  </label>
                  <select
                    id="team-document-type"
                    value={uploadDocumentType}
                    onChange={(e) => setUploadDocumentType(e.target.value as TeamDocumentType)}
                    disabled={isAnyDocumentUploading}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-ring focus:border-transparent bg-white"
                  >
                    {TEAM_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={isAnyDocumentUploading || !member?.email}
                  onClick={() => documentUploadInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  {uploading[uploadDocumentType] ? '업로드 중…' : '파일 업로드'}
                </button>
                <input
                  ref={documentUploadInputRef}
                  type="file"
                  accept={selectedUploadOption.accept}
                  multiple
                  className="hidden"
                  disabled={isAnyDocumentUploading}
                  onChange={(e) => {
                    void handleDocumentUpload(e.target.files, uploadDocumentType)
                    e.target.value = ''
                  }}
                />
              </div>
              {!member?.email ? (
                <p className="text-xs text-amber-700">문서를 업로드하려면 먼저 이메일을 저장해 주세요.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  선택한 유형으로 저장됩니다. 이미지를 올리면 썸네일로 미리볼 수 있습니다.
                </p>
              )}
            </div>

            {/* 업로드된 문서 카드뷰 */}
            {flatDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                업로드된 문서가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {flatDocuments.map((doc) => {
                  const displayName = teamDocumentDisplayName(doc.documentType, doc.name)
                  const imagePreview = isImageDocument(doc.name, doc.url)
                  return (
                    <div
                      key={doc.id}
                      className="group relative flex flex-col rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                    >
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden"
                        title="열기"
                      >
                        {imagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={doc.url}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted-foreground px-3">
                            <FileText className="w-8 h-8" />
                            <span className="text-[10px] font-medium uppercase tracking-wide">
                              {fileExtensionFromName(doc.name) || 'FILE'}
                            </span>
                          </div>
                        )}
                      </a>
                      <div className="p-2.5 space-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate" title={displayName}>
                            {displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" title={doc.name}>
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-primary hover:bg-muted/50 rounded-lg"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <label
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                            title="교체"
                          >
                            <Edit className="w-4 h-4" />
                            <input
                              type="file"
                              accept={
                                TEAM_DOCUMENT_TYPE_OPTIONS.find((o) => o.type === doc.documentType)?.accept ||
                                selectedUploadOption.accept
                              }
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  void handleDocumentReplace(file, doc.documentType, doc.id, doc.path)
                                  e.target.value = ''
                                }
                              }}
                              className="hidden"
                              disabled={uploading[doc.documentType]}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={(e) => handleDocumentDelete(e, doc.documentType, doc.id, doc.path)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            title="삭제"
                            disabled={uploading[doc.documentType]}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
            <div>
              {member && onDelete ? (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-md text-red-700 hover:bg-red-50 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 ml-auto">
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
              >
                {member ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}