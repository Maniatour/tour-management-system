'use client'

import React from 'react'

export default function TestPage() {
  console.log('Test page rendering')
  
  return (
    <div className="p-8">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">테스트 페이지</h1>
      <p className="text-gray-600">이 페이지가 보인다면 기본 렌더링은 정상입니다.</p>
      <div className="mt-4 p-4 bg-green-100 rounded">
        <p>현재 시간: {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}
