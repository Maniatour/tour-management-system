'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import BulkCreateTourPhotoBuckets from '@/components/BulkCreateTourPhotoBuckets'

export default function TourPhotoBucketsPage() {
  const t = useTranslations('admin')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          투어 포토 버켓 관리
        </h1>
        <p className="text-gray-600">
          기존 투어 데이터에 대해 tour-photos 버켓을 일괄 생성하고 관리합니다.
        </p>
      </div>

      <BulkCreateTourPhotoBuckets />
    </div>
  )
}
