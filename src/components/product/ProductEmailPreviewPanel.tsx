'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'
import {
  getEmailDestinationLabel,
  type ProductEmailDestinationKey,
} from '@/lib/productEmailDestinations'
import { stripAdminPreviewMarkupFromEmailHtml } from '@/lib/stripAdminPreviewMarkupFromEmailHtml'

type ProductEmailPreviewPanelProps = {
  productId: string
  emailType: ProductEmailDestinationKey
  locale: string
}

export default function ProductEmailPreviewPanel({
  productId,
  emailType,
  locale,
}: ProductEmailPreviewPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usedSampleData, setUsedSampleData] = useState(false)
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
  } | null>(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/preview-product-email', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          emailType,
          locale: locale === 'en' ? 'en' : 'ko',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `미리보기 로드 실패 (${response.status})`)
      }

      const data = await response.json()
      if (!data.emailContent?.html) {
        throw new Error('이메일 내용을 받을 수 없습니다.')
      }

      setEmailContent({
        subject: data.emailContent.subject,
        html: data.emailContent.html,
      })
      setUsedSampleData(!!data.usedSampleData)
    } catch (e) {
      setEmailContent(null)
      setError(e instanceof Error ? e.message : '미리보기를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [productId, emailType, locale])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px] bg-violet-50/30">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[320px] p-6">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    )
  }

  if (!emailContent) return null

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {usedSampleData && (
        <div className="mx-4 mt-3 mb-0 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {emailType === 'pickup_notification'
            ? '실제 예약·투어가 없으면 샘플 픽업 정보로 미리보기합니다. 저장된 상품명·준비물(preparation_info)은 반영됩니다.'
            : '이 상품의 실제 예약이 없어 샘플 예약 데이터로 미리보기합니다. 저장된 상품·세부정보 내용은 반영됩니다.'}
        </div>
      )}
      <div className="px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <p className="text-xs text-gray-500">제목</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{emailContent.subject}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <EmailPreviewBodyPanel
          html={emailContent.html}
          title={getEmailDestinationLabel(emailType)}
          prepareHtml={stripAdminPreviewMarkupFromEmailHtml}
          maxHeightClass="max-h-none"
        />
      </div>
    </div>
  )
}
