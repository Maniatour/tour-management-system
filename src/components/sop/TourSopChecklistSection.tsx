'use client'

import TourSopChecklistPanel from '@/components/sop/TourSopChecklistPanel'

type Props = {
  tourId: string
  productId: string | null | undefined
  tourDate: string
  locale: string
}

export default function TourSopChecklistSection(props: Props) {
  return <TourSopChecklistPanel {...props} mode="guide" />
}
