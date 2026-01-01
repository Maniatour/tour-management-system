'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Upload, Image as ImageIcon, XCircle, CheckCircle, AlertCircle, FileText, Shield } from 'lucide-react'

interface Customer {
  id: string
  name: string
  email: string
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  pass_photo_url: string | null
  id_photo_url: string | null
}

export default function PassUploadPage() {
  const { authUser } = useAuth()
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const tPass = useTranslations('passUpload')
  
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [passPhotoUrl, setPassPhotoUrl] = useState<string | null>(null)
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 고객 정보 로드
  useEffect(() => {
    if (!authUser?.email) {
      setLoading(false)
      return
    }

    const loadCustomer = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, email, resident_status, pass_photo_url, id_photo_url')
          .eq('email', authUser.email)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading customer:', error)
        }

        if (data) {
          setCustomer(data)
          setPassPhotoUrl(data.pass_photo_url)
          setIdPhotoUrl(data.id_photo_url)
        }
      } catch (error) {
        console.error('Error loading customer:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCustomer()
  }, [authUser])

  // 파일 업로드 처리
  const handleFileUpload = async (file: File, type: 'pass' | 'id') => {
    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: tPass('imageOnly') })
      return
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: tPass('fileTooLarge') })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'customer-documents')

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || tPass('uploadFailed'))
      }

      const data = await response.json()
      
      if (type === 'pass') {
        setPassPhotoUrl(data.imageUrl)
      } else {
        setIdPhotoUrl(data.imageUrl)
      }

      setMessage({ type: 'success', text: tPass('uploadSuccess') })
    } catch (error) {
      console.error('Upload error:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : tPass('uploadError')
      })
    } finally {
      setUploading(false)
    }
  }

  // 저장 처리
  const handleSave = async () => {
    if (!passPhotoUrl || !idPhotoUrl) {
      setMessage({ type: 'error', text: tPass('bothPhotosRequired') })
      return
    }

    if (!customer) {
      setMessage({ type: 'error', text: tPass('customerNotFound') })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          resident_status: 'non_resident_with_pass',
          pass_photo_url: passPhotoUrl,
          id_photo_url: idPhotoUrl
        })
        .eq('id', customer.id)

      if (error) {
        throw error
      }

      setMessage({ type: 'success', text: tPass('saveSuccess') })
      
      // 고객 정보 다시 로드
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, resident_status, pass_photo_url, id_photo_url')
        .eq('id', customer.id)
        .single()

      if (data) {
        setCustomer(data)
      }
    } catch (error) {
      console.error('Error saving:', error)
      setMessage({ type: 'error', text: tPass('saveError') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{tPass('loading')}</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{tPass('loginRequired')}</p>
          <button
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {tPass('goToDashboard')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {tPass('title')}
          </h1>
          <p className="text-gray-600">
            {tPass('subtitle')}
          </p>
        </div>

        {/* 안내 사항 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">{tPass('uploadGuide')}</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{tPass('passPhoto')}: {tPass('passPhotoDesc')}</li>
                <li>{tPass('idPhoto')}: {tPass('idPhotoDesc')}</li>
                <li>{tPass('fileFormat')}</li>
                <li>{tPass('privacyNotice')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 개인정보 삭제 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-2">{tPass('privacyTitle')}</h3>
              <p className="text-sm text-amber-800">
                {tPass('privacyDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* 메시지 표시 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 업로드 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 패스 사진 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tPass('passPhotoLabel')}
            </label>
            {passPhotoUrl ? (
              <div className="space-y-3">
                <div className="relative">
                  <img 
                    src={passPhotoUrl} 
                    alt={tPass('passPhoto')} 
                    className="w-full h-64 object-contain rounded-lg border border-gray-300 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setPassPhotoUrl(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                <label className="block">
                  <span className="sr-only">{tPass('changePhoto')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'pass')
                    }}
                    className="hidden"
                  />
                  <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {tPass('changePhoto')}
                  </span>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="sr-only">{tPass('uploadPassPhoto')}</span>
                <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  uploading 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'pass')
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-600">{tPass('uploading')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">{tPass('uploadPassPhoto')}</p>
                      <p className="text-xs text-gray-400">{tPass('fileFormat')}</p>
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>

          {/* ID 사진 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tPass('idPhotoLabel')}
            </label>
            <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>{locale === 'ko' ? '안내:' : 'Note:'}</strong> {tPass('idPhotoNotice')}
              </p>
            </div>
            {idPhotoUrl ? (
              <div className="space-y-3">
                <div className="relative">
                  <img 
                    src={idPhotoUrl} 
                    alt={tPass('idPhoto')} 
                    className="w-full h-64 object-contain rounded-lg border border-gray-300 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setIdPhotoUrl(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                <label className="block">
                  <span className="sr-only">{tPass('changePhoto')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'id')
                    }}
                    className="hidden"
                  />
                  <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {tPass('changePhoto')}
                  </span>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="sr-only">{tPass('uploadIdPhoto')}</span>
                <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  uploading 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'id')
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-600">{tPass('uploading')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">{tPass('uploadIdPhoto')}</p>
                      <p className="text-xs text-gray-400">{tPass('fileFormat')}</p>
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {customer?.name || tPass('customer')}{locale === 'ko' ? '님' : ''}
              </h3>
              <p className="text-sm text-gray-600">
                {tPass('currentStatus')} {
                  customer?.resident_status === 'non_resident_with_pass' 
                    ? tPass('statusNonResidentWithPass')
                    : customer?.resident_status === 'non_resident'
                    ? tPass('statusNonResident')
                    : customer?.resident_status === 'us_resident'
                    ? tPass('statusUsResident')
                    : tPass('statusNone')
                }
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={!passPhotoUrl || !idPhotoUrl || saving}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                passPhotoUrl && idPhotoUrl && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saving ? tPass('saving') : tPass('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

