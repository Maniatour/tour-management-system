'use client'

import React, { useState } from 'react'
import { getEnhancedKoreanTransliteration, transliterateKorean, getKoreanNameInEnglishOrder } from '@/utils/koreanTransliteration'

export default function KoreanNameTest() {
  const [inputName, setInputName] = useState('')
  const [result, setResult] = useState('')

  const handleTest = () => {
    const englishOrderName = getKoreanNameInEnglishOrder(inputName)
    const basicTransliteration = transliterateKorean(inputName)
    const enhancedTransliteration = getEnhancedKoreanTransliteration(inputName)
    
    setResult(`${englishOrderName}\n기본 변환: ${basicTransliteration}\n향상된 변환: ${enhancedTransliteration}`)
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">한국어 이름 테스트</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            한국어 이름 입력:
          </label>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="예: 허유림, 김민수, 이지혜"
          />
        </div>
        <button
          onClick={handleTest}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          변환하기
        </button>
        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <p className="text-sm text-gray-600 whitespace-pre-line">
              <strong>변환 결과:</strong><br/>{result}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
