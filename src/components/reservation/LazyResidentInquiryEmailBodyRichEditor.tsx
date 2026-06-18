'use client'

import dynamic from 'next/dynamic'

const ResidentInquiryEmailBodyRichEditor = dynamic(
  () => import('@/components/reservation/ResidentInquiryEmailBodyRichEditor'),
  { ssr: false, loading: () => <div className="min-h-[120px] animate-pulse rounded-md bg-gray-100" /> }
)

export default ResidentInquiryEmailBodyRichEditor
