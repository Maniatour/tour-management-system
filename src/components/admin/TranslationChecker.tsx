'use client'

import React, { useState } from 'react'
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TranslationCheckResult {
  namespace: string
  key: string
  usedIn: string[]
  inDatabase: boolean
  inJsonFiles: boolean
  recommendation: string
}

interface TranslationCheckerProps {
  locale: string
}

export default function TranslationChecker({ locale }: TranslationCheckerProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [results, setResults] = useState<TranslationCheckResult[]>([])
  const [summary, setSummary] = useState({ total: 0, unused: 0, missing: 0 })

  const checkTranslations = async () => {
    setIsChecking(true)
    try {
      // 1. DB에서 모든 번역 키 가져오기
      const { data: dbTranslations } = await supabase
        .from('translations')
        .select('namespace, key_path')

      // 2. JSON 파일에서 모든 번역 키 가져오기
      const allJsonKeys = getAllJsonKeys()

      // 3. 코드베이스에서 사용되는 번역 키 추출 (간단한 휴리스틱)
      const usedTranslations = findUsedTranslations()

      // 4. 비교 및 결과 생성
      const checks: TranslationCheckResult[] = []

      // JSON에 있지만 DB에 없는 것
      allJsonKeys.forEach(({ namespace, key }) => {
        const inDb = dbTranslations?.some(t => t.namespace === namespace && t.key_path === key)
        const usedIn = usedTranslations.filter(u => u.namespace === namespace && u.key === key)
        
        checks.push({
          namespace,
          key,
          usedIn: usedIn.map(u => u.file),
          inDatabase: !!inDb,
          inJsonFiles: true,
          recommendation: inDb 
            ? 'DB에 있고 JSON에도 있음' 
            : 'JSON에만 있음 - DB 동기화 필요'
        })
      })

      // DB에 있지만 사용되지 않는 것
      if (dbTranslations) {
        dbTranslations.forEach(({ namespace, key_path: key }) => {
          const usedIn = usedTranslations.filter(u => u.namespace === namespace && u.key === key)
          const inJson = allJsonKeys.some(j => j.namespace === namespace && j.key === key)
          
          if (usedIn.length === 0) {
            checks.push({
              namespace,
              key,
              usedIn: [],
              inDatabase: true,
              inJsonFiles: inJson,
              recommendation: 'DB에 있지만 사용되지 않음'
            })
          }
        })
      }

      setResults(checks)
      setSummary({
        total: checks.length,
        unused: checks.filter(c => c.recommendation === 'DB에 있지만 사용되지 않음').length,
        missing: checks.filter(c => c.recommendation === 'JSON에만 있음 - DB 동기화 필요').length
      })
    } catch (error) {
      console.error('Error checking translations:', error)
    } finally {
      setIsChecking(false)
    }
  }

  // JSON 파일에서 모든 키 추출 (재귀적으로)
  const getAllJsonKeys = (): Array<{ namespace: string, key: string }> => {
    const keys: Array<{ namespace: string, key: string }> = []
    
    const flatten = (obj: any, namespace: string, prefix = '') => {
      for (const key in obj) {
        const value = obj[key]
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, namespace, fullKey)
        } else if (typeof value === 'string') {
          keys.push({ namespace, key: fullKey })
        }
      }
    }

    try {
      const koData = require('@/i18n/locales/ko.json')
      const enData = require('@/i18n/locales/en.json')
      
      for (const ns in koData) {
        flatten(koData[ns], ns)
      }
    } catch (e) {
      console.error('Error loading JSON files:', e)
    }

    return keys
  }

  // 코드에서 사용되는 번역 찾기 (휴리스틱)
  const findUsedTranslations = (): Array<{ namespace: string, key: string, file: string }> => {
    // 실제 구현은 더 정교해야 하지만, 여기서는 예시만 제공
    return [
      // 예: src/app/[locale]/admin/page.tsx에서 사용
      { namespace: 'admin', key: 'dashboard', file: 'src/app/[locale]/admin/page.tsx' },
      { namespace: 'admin', key: 'products', file: 'src/app/[locale]/admin/page.tsx' },
    ]
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">번역 상태 체크</h3>
          <p className="text-sm text-gray-500 mt-1">
            JSON 파일과 DB의 번역 키를 비교하여 누락되거나 사용되지 않는 번역을 찾습니다.
          </p>
        </div>
        <button
          onClick={checkTranslations}
          disabled={isChecking}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw size={20} className={isChecking ? 'animate-spin' : ''} />
          <span>체크 시작</span>
        </button>
      </div>

      {summary.total > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">전체 키</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">DB 동기화 필요</p>
              <p className="text-2xl font-bold text-orange-600">{summary.missing}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">사용되지 않음</p>
              <p className="text-2xl font-bold text-red-600">{summary.unused}</p>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">네임스페이스</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">키</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DB</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">JSON</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용 위치</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index} className={
                    result.recommendation === 'DB 동기화 필요' ? 'bg-orange-50' :
                    result.recommendation === '사용되지 않음' ? 'bg-red-50' : ''
                  }>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.namespace}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{result.key}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {result.inDatabase ? (
                        <CheckCircle className="text-green-600" size={20} />
                      ) : (
                        <AlertCircle className="text-red-600" size={20} />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {result.inJsonFiles ? (
                        <CheckCircle className="text-green-600" size={20} />
                      ) : (
                        <AlertCircle className="text-red-600" size={20} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {result.usedIn.length > 0 ? (
                        <div className="space-y-1">
                          {result.usedIn.slice(0, 2).map((file, i) => (
                            <div key={i} className="text-xs">{file}</div>
                          ))}
                          {result.usedIn.length > 2 && (
                            <div className="text-xs text-gray-400">+{result.usedIn.length - 2} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        result.recommendation.includes('필요') ? 'bg-orange-100 text-orange-800' :
                        result.recommendation.includes('사용되지 않음') ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {result.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

