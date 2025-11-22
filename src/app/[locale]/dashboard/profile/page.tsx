'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { User, Mail, Phone, MapPin, Globe, Save, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

export default function CustomerProfile() {
  const { user, userRole, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: 'ko'
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

  // 데이터 로딩 (시뮬레이션 상태와 분리)
  useEffect(() => {
    // 시뮬레이션 중이 아닌 경우에만 고객 데이터 로드
    if (!isSimulating && user) {
      loadCustomerData()
    } else if (isSimulating && simulatedUser && simulatedUser.id) {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보로 설정
      console.log('Profile: Loading simulated customer data:', simulatedUser)
      setCustomer({
        id: simulatedUser.id,
        name: simulatedUser.name_ko,
        email: simulatedUser.email,
        phone: simulatedUser.phone,
        language: simulatedUser.language,
        created_at: simulatedUser.created_at
      })
      
      // 폼 데이터 설정
      setFormData({
        name: simulatedUser.name_ko,
        phone: simulatedUser.phone || '',
        language: simulatedUser.language || 'ko'
      })
      
      setLoading(false)
    } else if (isSimulating && !simulatedUser) {
      // 시뮬레이션 중이지만 simulatedUser가 없는 경우
      console.warn('Profile: 시뮬레이션 중이지만 simulatedUser가 없습니다.')
      setLoading(false)
    } else if (!isSimulating && !user) {
      // 로그인하지 않은 사용자의 경우 로딩 완료
      console.log('Profile: No user logged in, showing public page')
      setLoading(false)
    }
  }, [isSimulating, simulatedUser, user])

  // 고객 정보 로드
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
          language: customerData.language || 'ko'
        })
      } else {
        // 고객 정보가 없으면 새로 생성
        setCustomer(null)
        setFormData({
          name: authUser.name || authUser.email?.split('@')[0] || '',
          phone: '',
          language: 'ko'
        })
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
            language: formData.language
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
            language: formData.language
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
              <h1 className="text-2xl font-bold text-gray-900">내 정보</h1>
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
                  value={authUser?.email || ''}
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
      </div>
    </div>
  )
}
