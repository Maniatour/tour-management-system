'use client'

import { useParams, useRouter } from 'next/navigation'
import { QuickPaymentRequestModal } from '@/components/customer/QuickPaymentRequestForm'

/** 북마크/직접 URL 호환: 페이지 대신 모달만 띄우고 닫으면 관리자로 돌아갑니다. */
export default function QuickPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const locale = params?.locale === 'en' ? 'en' : 'ko'

  return (
    <QuickPaymentRequestModal
      open
      onClose={() => router.replace(`/${locale}/admin`)}
      locale={locale}
    />
  )
}
