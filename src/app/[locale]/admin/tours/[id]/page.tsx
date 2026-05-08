/* @ts-nocheck */
'use client'

import { useParams } from 'next/navigation'
import { TourDetailPageView } from '@/components/tour/TourDetailPageView'

export default function TourDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''
  if (!id) return null
  return <TourDetailPageView tourId={id} />
}
