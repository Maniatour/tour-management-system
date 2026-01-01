'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { User, Mail, Phone, MapPin, Globe, Save, ArrowLeft, Upload, XCircle, Image as ImageIcon, AlertCircle, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  pass_photo_url: string | null
  id_photo_url: string | null
  created_at: string
}

export default function CustomerProfile() {
  const { user, userRole, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const customerIdFromUrl = params.customer_id as string
  const t = useTranslations('common')
  const tPass = useTranslations('passUpload')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [passPhotoUrl, setPassPhotoUrl] = useState<string | null>(null)
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: 'ko',
    resident_status: null as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  })

  // 인증 확인 (시뮬레이션 상태 우선 확인)
  useEffect(() => {
    console.log('Profile: Auth check effect triggered', { 
      isSimulating, 
      hasSimulatedUser: !!simulatedUser, 
      hasUser: !!user,
      simulatedUserEmail: simulatedUser?.email 
    })
    
    // 시뮬레이션 중인 경우 인증 체크 완전히 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('Profile: Simulation active, skipping authentication check')
      return
    }
    
    // 시뮬레이션 중이지만 simulatedUser가 없는 경우 잠시 기다림
    if (isSimulating && !simulatedUser) {
      console.log('Profile: Simulation in progress but no simulatedUser yet, waiting...')
      return
    }
    
    // 고객 페이지는 로그인하지 않은 사용자도 접근 가능하므로 인증 체크 제거
    console.log('Profile: Customer page allows unauthenticated access')
  }, [user, isSimulating, simulatedUser, router, locale])

  // 시뮬레이션 상태 변화 감지 (언어 전환 시 시뮬레이션 상태 복원 확인)
  useEffect(() => {
    if (isSimulating && simulatedUser) {
      console.log('Profile: Simulation state confirmed:', {
        simulatedUser: simulatedUser.email,
        role: simulatedUser.role,
        isSimulating
      })
    }
  }, [isSimulating, simulatedUser])

  // 데이터 로딩
  useEffect(() => {
    if (customerIdFromUrl) {
      // URL에 customer_id가 있으면 해당 고객의 프로필을 로드
      loadCustomerDataById(customerIdFromUrl)
    } else if (isSimulating && simulatedUser && simulatedUser.id) {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보로 설정
      console.log('Profile: Loading simulated customer data:', simulatedUser)
      setCustomer({
        id: simulatedUser.id,
        name: simulatedUser.name_ko,
        email: simulatedUser.email,
        phone: simulatedUser.phone,
        language: simulatedUser.language,
        resident_status: (simulatedUser as any).resident_status || null,
        pass_photo_url: (simulatedUser as any).pass_photo_url || null,
        id_photo_url: (simulatedUser as any).id_photo_url || null,
        created_at: simulatedUser.created_at
      })
      
      // 폼 데이터 설정
      setFormData({
        name: simulatedUser.name_ko,
        phone: simulatedUser.phone || '',
        language: simulatedUser.language || 'ko',
        resident_status: (simulatedUser as any).resident_status || null
      })
      
      setPassPhotoUrl((simulatedUser as any).pass_photo_url || null)
      setIdPhotoUrl((simulatedUser as any).id_photo_url || null)
      
      setLoading(false)
    } else if (!isSimulating && user && authUser?.email) {
      // 일반 모드: 현재 사용자의 프로필 로드
      loadCustomerData()
    } else {
      // 로그인하지 않은 사용자의 경우 로딩 완료
      console.log('Profile: No user logged in, showing public page')
      setLoading(false)
    }
  }, [customerIdFromUrl, isSimulating, simulatedUser, user, authUser?.email])

  // URL의 customer_id로 고객 정보 로드
  const loadCustomerDataById = async (customerId: string) => {
    try {
      setLoading(true)
      
      const { data: customerData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle()

      if (error) {
        console.error('Customer lookup error:', error)
        setLoading(false)
        return
      }

      if (customerData) {
        setCustomer(customerData)
        setFormData({
          name: customerData.name || '',
          phone: customerData.phone || '',
          language: customerData.language || 'ko',
          resident_status: customerData.resident_status || null
        })
        setPassPhotoUrl(customerData.pass_photo_url || null)
        setIdPhotoUrl(customerData.id_photo_url || null)
      } else {
        setCustomer(null)
      }
    } catch (error) {
      console.error('Error loading customer data:', error)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }

  // 고객 정보 로드 (이메일 기반)
  const loadCustomerData = async () => {
    if (!authUser?.email) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const { data: customerData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle()

      if (error) {
        console.error(t('customerInfoError'), {
          error: error,
          message: error?.message || 'Unknown error',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          status: error?.status || 'No status',
          email: authUser.email
        })
        // 406 오류나 다른 권한 오류의 경우 새 고객으로 처리
        if (error.code === 'PGRST116' || error.code === 'PGRST301' || error.status === 406) {
          setCustomer(null)
          setFormData({
            name: authUser.name || authUser.email?.split('@')[0] || '',
            phone: '',
            language: 'ko'
          })
          setLoading(false)
          return
        }
        setLoading(false)
        return
      }

      if (customerData) {
        setCustomer(customerData)
        setFormData({
          name: customerData.name || '',
          phone: customerData.phone || '',
          language: customerData.language || 'ko',
          resident_status: customerData.resident_status || null
        })
        setPassPhotoUrl(customerData.pass_photo_url || null)
        setIdPhotoUrl(customerData.id_photo_url || null)
      } else {
        // 고객 정보가 없으면 새로 생성
        setCustomer(null)
        setFormData({
          name: authUser.name || authUser.email?.split('@')[0] || '',
          phone: '',
          language: 'ko',
          resident_status: null
        })
        setPassPhotoUrl(null)
        setIdPhotoUrl(null)
      }
    } catch (error) {
      console.error(t('dataLoadError'), error)
      setCustomer(null)
      setFormData({
        name: authUser.name || authUser.email?.split('@')[0] || '',
        phone: '',
        language: 'ko'
      })
    } finally {
      setLoading(false)
    }
  }

  // 파일 업로드 처리
  const handleFileUpload = async (file: File, type: 'pass' | 'id') => {
    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert(tPass('imageOnly'))
      return
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert(tPass('fileTooLarge'))
      return
    }

    setUploading(true)

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

      alert(tPass('uploadSuccess'))
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : tPass('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  // 파일 삭제 처리
  const handleDeletePhoto = async (type: 'pass' | 'id', url: string) => {
    if (!confirm(locale === 'en' ? 'Are you sure you want to delete this photo?' : '이 사진을 삭제하시겠습니까?')) {
      return
    }

    try {
      // Supabase Storage에서 파일 삭제
      const response = await fetch('/api/upload/image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      if (type === 'pass') {
        setPassPhotoUrl(null)
      } else {
        setIdPhotoUrl(null)
      }

      // 고객 정보에서도 URL 제거
      if (customer) {
        const updateData: any = {}
        if (type === 'pass') {
          updateData.pass_photo_url = null
        } else {
          updateData.id_photo_url = null
        }

        await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customer.id)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert(locale === 'en' ? 'Failed to delete photo' : '사진 삭제에 실패했습니다.')
    }
  }

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      // 약간의 지연을 두고 페이지 이동
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 관리자 페이지로 이동
      router.push(`/${locale}/admin`)
    }
  }

  // 고객 정보 저장
  const handleSave = async () => {
    if (customerIdFromUrl) {
      // URL에 customer_id가 있는 경우 해당 고객 정보 업데이트
      if (!customer) return

      try {
        setSaving(true)

        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            language: formData.language,
            resident_status: formData.resident_status,
            pass_photo_url: passPhotoUrl,
            id_photo_url: idPhotoUrl
          })
          .eq('id', customer.id)

        if (error) {
          console.error('고객 정보 업데이트 오류:', error)
          alert(t('saveError'))
          return
        }

        alert(t('saveSuccess'))
        loadCustomerDataById(customer.id)
      } catch (error) {
        console.error(t('saveErrorLog'), error)
        alert(t('saveError'))
      } finally {
        setSaving(false)
      }
    } else {
      // 현재 사용자의 프로필 저장
      if (!authUser?.email) return

      try {
        setSaving(true)

        if (customer) {
          // 기존 고객 정보 업데이트
          const { error } = await supabase
            .from('customers')
            .update({
              name: formData.name,
              phone: formData.phone || null,
              language: formData.language,
              resident_status: formData.resident_status,
              pass_photo_url: passPhotoUrl,
              id_photo_url: idPhotoUrl
            })
            .eq('id', customer.id)

          if (error) {
            console.error('고객 정보 업데이트 오류:', error)
            alert(t('saveError'))
            return
          }
        } else {
          // 새 고객 정보 생성
          const { error } = await supabase
            .from('customers')
            .insert({
              name: formData.name,
              email: authUser.email,
              phone: formData.phone || null,
              language: formData.language,
              resident_status: formData.resident_status,
              pass_photo_url: passPhotoUrl,
              id_photo_url: idPhotoUrl
            })

          if (error) {
            console.error('고객 정보 생성 오류:', error)
            alert(t('saveError'))
            return
          }
        }

        alert(t('saveSuccess'))
        loadCustomerData()
      } catch (error) {
        console.error(t('saveErrorLog'), error)
        alert(t('saveError'))
      } finally {
        setSaving(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                뒤로
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{t('myInfo')}</h1>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    대시보드
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                    className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                  >
                    내 예약
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    관리자로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-gray-600">{t('profileDescription')}</p>
        </div>

        {/* 프로필 폼 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <User className="w-5 h-5 mr-2" />
            {t('personalInfo')}
          </h2>

          <div className="space-y-6">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('name')} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterName')}
                  required
                />
              </div>
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={customer?.email || authUser?.email || ''}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                  disabled
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('emailCannotChange')}</p>
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('phone')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterPhone')}
                />
              </div>
            </div>

            {/* 언어 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('language')}
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>

            {/* 거주 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {locale === 'en' ? 'Resident Status' : '거주 상태'}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.resident_status || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    resident_status: e.target.value === '' ? null : e.target.value as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
                  }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{locale === 'en' ? 'No Information' : '정보 없음'}</option>
                  <option value="us_resident">{locale === 'en' ? 'US Resident' : '미국 거주자'}</option>
                  <option value="non_resident">{locale === 'en' ? 'Non-Resident' : '비거주자'}</option>
                  <option value="non_resident_with_pass">{locale === 'en' ? 'Non-Resident with Pass' : '비거주자 (패스 보유)'}</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {locale === 'en' 
                  ? 'Please select your resident status. If you select "Non-Resident with Pass", please upload your pass and ID photos below.' 
                  : '거주 상태를 선택해주세요. "비거주자 (패스 보유)"를 선택하시면 아래에서 패스 사진과 ID 사진을 업로드해주세요.'}
              </p>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('save')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 패스 및 ID 업로드 섹션 - 비거주자 패스 보유자일 때만 표시 */}
        {formData.resident_status === 'non_resident_with_pass' && (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            {tPass('title')}
          </h2>

          {/* 안내 사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2 text-sm">{tPass('uploadGuide')}</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>{tPass('passPhoto')}: {tPass('passPhotoDesc')}</li>
                  <li>{tPass('idPhoto')}: {tPass('idPhotoDesc')}</li>
                  <li>{tPass('fileFormat')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 개인정보 삭제 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2 text-sm">{tPass('privacyTitle')}</h3>
                <p className="text-xs text-amber-800">
                  {tPass('privacyDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* 업로드 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 패스 사진 */}
            <div>
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
                      onClick={() => handleDeletePhoto('pass', passPhotoUrl)}
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
                      disabled={uploading}
                    />
                    <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <Upload className="h-4 w-4 mr-2" />
                      {tPass('changePhoto')}
                    </span>
                  </label>
                </div>
              ) : (
                <label className="block">
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
                  <div className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploading 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  }`}>
                    {uploading ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">{tPass('uploading')}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600">{tPass('uploadPassPhoto')}</span>
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>

            {/* ID 사진 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tPass('idPhotoLabel')}
              </label>
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
                      onClick={() => handleDeletePhoto('id', idPhotoUrl)}
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
                      disabled={uploading}
                    />
                    <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <Upload className="h-4 w-4 mr-2" />
                      {tPass('changePhoto')}
                    </span>
                  </label>
                </div>
              ) : (
                <label className="block">
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
                  <div className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploading 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  }`}>
                    {uploading ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">{tPass('uploading')}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600">{tPass('uploadIdPhoto')}</span>
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

