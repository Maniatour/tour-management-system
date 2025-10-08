'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, X, FileText, Calendar, CheckCircle } from 'lucide-react'

interface MedicalReportStatus {
  hasReport: boolean
  isExpired: boolean
  expiresInOneMonth: boolean
  latestReport?: {
    id: string
    title: string
    file_name: string
    created_at: string
    expiry_date?: string
  }
}

interface MedicalReportWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadClick: () => void
}

export default function MedicalReportWarningModal({ 
  isOpen, 
  onClose, 
  onUploadClick 
}: MedicalReportWarningModalProps) {
  const t = useTranslations('common')
  const { user } = useAuth()
  const [status, setStatus] = useState<MedicalReportStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && user?.email) {
      checkMedicalReportStatus()
    }
  }, [isOpen, user?.email])

  const checkMedicalReportStatus = async () => {
    try {
      setLoading(true)
      
      // 먼저 메디컬 리포트 카테고리 ID를 가져옴
      const { data: categoryData, error: categoryError } = await supabase
        .from('document_categories')
        .select('id')
        .eq('name_ko', '메디컬 리포트')
        .single()

      if (categoryError || !categoryData) {
        console.error('메디컬 리포트 카테고리를 찾을 수 없습니다:', categoryError)
        return
      }

      // 메디컬 리포트 문서를 가져옴
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('guide_email', user?.email)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('메디컬 리포트 상태 확인 오류:', error)
        return
      }

      const latestReport = data?.[0]
      const now = new Date()
      
      let isExpired = false
      let expiresInOneMonth = false

      if (latestReport?.expiry_date) {
        const expiryDate = new Date(latestReport.expiry_date)
        const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        isExpired = expiryDate < now
        expiresInOneMonth = expiryDate <= oneMonthFromNow && expiryDate > now
      }

      setStatus({
        hasReport: !!latestReport,
        isExpired,
        expiresInOneMonth,
        latestReport: latestReport ? {
          id: latestReport.id,
          title: latestReport.title,
          file_name: latestReport.file_name,
          created_at: latestReport.created_at,
          expiry_date: latestReport.expiry_date
        } : undefined
      })
    } catch (error) {
      console.error('메디컬 리포트 상태 확인 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWarningType = () => {
    if (!status?.hasReport) return 'missing'
    if (status.isExpired) return 'expired'
    if (status.expiresInOneMonth) return 'expiring'
    return 'valid'
  }

  const getWarningMessage = () => {
    const warningType = getWarningType()
    
    switch (warningType) {
      case 'missing':
        return {
          title: t('medicalReportMissing'),
          message: t('medicalReportRequired'),
          icon: <AlertTriangle className="w-8 h-8 text-red-500" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        }
      case 'expired':
        return {
          title: t('medicalReportExpired'),
          message: t('medicalReportExpiredMessage'),
          icon: <AlertTriangle className="w-8 h-8 text-red-500" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        }
      case 'expiring':
        return {
          title: t('medicalReportExpiring'),
          message: t('medicalReportExpiringMessage'),
          icon: <AlertTriangle className="w-8 h-8 text-orange-500" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800'
        }
      default:
        return {
          title: t('medicalReportValid'),
          message: t('medicalReportValidMessage'),
          icon: <CheckCircle className="w-8 h-8 text-green-500" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        }
    }
  }

  const shouldShowWarning = () => {
    const warningType = getWarningType()
    return warningType !== 'valid'
  }

  if (!isOpen) return null

  const warningInfo = getWarningMessage()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t('medicalReportStatus')}
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
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('checkingStatus')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 경고 메시지 */}
              <div className={`p-4 rounded-lg border ${warningInfo.bgColor} ${warningInfo.borderColor}`}>
                <div className="flex items-start space-x-3">
                  {warningInfo.icon}
                  <div>
                    <h3 className={`font-semibold ${warningInfo.textColor}`}>
                      {warningInfo.title}
                    </h3>
                    <p className={`text-sm mt-1 ${warningInfo.textColor}`}>
                      {warningInfo.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* 현재 리포트 정보 */}
              {status?.latestReport && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">{t('currentMedicalReport')}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {status.latestReport.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {t('uploadDate')}: {new Date(status.latestReport.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    {status.latestReport.expiry_date && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className={`text-sm ${
                          status.isExpired ? 'text-red-600' : 
                          status.expiresInOneMonth ? 'text-orange-600' : 'text-gray-700'
                        }`}>
                          {t('expiryDate')}: {new Date(status.latestReport.expiry_date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex space-x-3">
                {shouldShowWarning() && (
                  <button
                    onClick={() => {
                      onClose()
                      onUploadClick()
                    }}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t('uploadMedicalReport')}</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {shouldShowWarning() ? t('later') : t('confirm')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
