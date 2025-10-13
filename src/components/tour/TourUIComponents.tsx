import React from 'react'

// 연결 상태 라벨 컴포넌트
export const ConnectionStatusLabel = ({ status, section }: { status: boolean, section: string }) => (
  <span 
    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
      status 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}
    title={status ? `${section} 데이터베이스 연결됨` : `${section} 데이터베이스 연결 실패`}
  >
    {status ? '✓' : '✗'}
  </span>
)

// 스켈레톤 UI 컴포넌트
export const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
)

export const SkeletonText = ({ lines = 1, className = "" }: { lines?: number, className?: string }) => (
  <div className={className}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonCard key={i} className="h-4 mb-2" />
    ))}
  </div>
)
