'use client'

import React, { useState, useEffect } from 'react'
import FlexibleProductMappingTool from '@/components/FlexibleProductMappingTool'

interface AdminDataReviewProps {
  params: Promise<{ locale: string }>
}

export default function AdminDataReview({ }: AdminDataReviewProps) {
  // 상태 관리
  const [loading, setLoading] = useState(true)

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // 데이터 로드 로직은 FlexibleProductMappingTool에서 처리
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">예약 데이터 검수</h1>
          <p className="text-gray-600">구글시트에서 가져온 데이터를 검수하고 수정할 수 있습니다.</p>
        </div>


        {/* 유연한 상품 매핑 도구 */}
        <FlexibleProductMappingTool onDataUpdated={loadData} />




      </div>
    </div>
  )
}
