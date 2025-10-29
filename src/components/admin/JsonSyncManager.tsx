'use client'

import React, { useState, useEffect } from 'react'
import { Download, Upload, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface JsonTranslation {
  namespace: string
  key: string
  ko: string
  en: string
}

interface JsonSyncManagerProps {
  locale: string
}

export default function JsonSyncManager({ locale }: JsonSyncManagerProps) {
  const [jsonTranslations, setJsonTranslations] = useState<JsonTranslation[]>([])
  const [dbTranslations, setDbTranslations] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')

  useEffect(() => {
    loadJsonTranslations()
    loadDbTranslations()
  }, [])

  // JSON 파일을 재귀적으로 파싱
  const flattenObject = (obj: any, namespace: string, parentKey = ''): JsonTranslation[] => {
    const result: JsonTranslation[] = []
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key
        const value = obj[key]

        if (typeof value === 'object' && value !== null) {
          // 객체인 경우 재귀적으로 처리
          result.push(...flattenObject(value, namespace, fullKey))
        } else if (typeof value === 'string') {
          // 문자열인 경우 번역으로 추가
          result.push({
            namespace,
            key: fullKey,
            ko: '',
            en: ''
          })
        }
      }
    }
    
    return result
  }

  const loadJsonTranslations = async () => {
    try {
      setLoading(true)
      
      // JSON 파일들 로드
      const [koResponse, enResponse] = await Promise.all([
        fetch('/locales/ko.json'),
        fetch('/locales/en.json')
      ])

      if (!koResponse.ok || !enResponse.ok) {
        throw new Error('Failed to load JSON files')
      }

      const koData = await koResponse.json()
      const enData = await enResponse.json()

      // 모든 네임스페이스 수집
      const allNamespaces = new Set([...Object.keys(koData), ...Object.keys(enData)])
      
      const translations: JsonTranslation[] = []
      
      // 각 네임스페이스별로 키 수집
      for (const ns of allNamespaces) {
        const koNamespace = koData[ns] || {}
        const enNamespace = enData[ns] || {}
        
        // 모든 키 수집 (ko 또는 en에 있으면 포함)
        const allKeys = new Set([
          ...flattenObject(koNamespace, ns).map(t => t.key),
          ...flattenObject(enNamespace, ns).map(t => t.key)
        ])

        for (const key of allKeys) {
          const getNestedValue = (obj: any, path: string): string => {
            const keys = path.split('.')
            let current = obj
            for (const k of keys) {
              current = current?.[k]
              if (current === undefined) return ''
            }
            return typeof current === 'string' ? current : ''
          }

          translations.push({
            namespace: ns,
            key,
            ko: getNestedValue(koNamespace, key),
            en: getNestedValue(enNamespace, key)
          })
        }
      }

      setJsonTranslations(translations)
      setSyncStatus(`로컬 JSON 파일에서 ${translations.length}개의 번역 키를 찾았습니다.`)
    } catch (error) {
      console.error('Error loading JSON translations:', error)
      setSyncStatus('JSON 파일 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadDbTranslations = async () => {
    try {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace, key_path')

      if (error) {
        console.error('Error loading DB translations:', error)
        return
      }

      const dbKeys = new Set((data || []).map(t => `${t.namespace}.${t.key_path}`))
      setDbTranslations(dbKeys)
    } catch (error) {
      console.error('Error loading DB translations:', error)
    }
  }

  const syncToDatabase = async () => {
    try {
      setLoading(true)
      
      // DB에 없는 키만 필터링
      const missingKeys = jsonTranslations.filter(t => 
        !dbTranslations.has(`${t.namespace}.${t.key}`)
      )

      if (missingKeys.length === 0) {
        setSyncStatus('동기화할 새로운 번역 키가 없습니다.')
        return
      }

      // DB에 추가
      for (const trans of missingKeys) {
        // 번역 키 추가
        const { data: newTranslation, error: transError } = await (supabase as any)
          .from('translations')
          .insert({
            id: crypto.randomUUID(),
            namespace: trans.namespace,
            key_path: trans.key,
            is_system: true
          })
          .select()
          .single()

        if (transError && transError.code !== '23505') {
          console.error('Error adding translation:', transError)
          continue
        }

        // 번역 값들 추가
        const valuesToInsert = []
        
        if (trans.ko) {
          valuesToInsert.push({
            id: crypto.randomUUID(),
            translation_id: (newTranslation as any)?.id,
            locale: 'ko',
            value: trans.ko
          })
        }

        if (trans.en) {
          valuesToInsert.push({
            id: crypto.randomUUID(),
            translation_id: (newTranslation as any)?.id,
            locale: 'en',
            value: trans.en
          })
        }

        if (valuesToInsert.length > 0) {
          await (supabase as any)
            .from('translation_values')
            .insert(valuesToInsert)
        }
      }

      setSyncStatus(`${missingKeys.length}개의 번역 키가 DB에 추가되었습니다.`)
      await loadDbTranslations()
    } catch (error) {
      console.error('Error syncing to database:', error)
      setSyncStatus('동기화 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const namespaces = Array.from(new Set(jsonTranslations.map(t => t.namespace))).sort()
  const missingCount = jsonTranslations.filter(t => 
    !dbTranslations.has(`${t.namespace}.${t.key}`)
  ).length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">JSON 파일 동기화</h3>
          <p className="text-sm text-gray-500 mt-1">
            로컬 JSON 파일의 번역 키를 DB와 동기화합니다.
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadJsonTranslations}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw size={20} />
            <span>새로고침</span>
          </button>
          <button
            onClick={syncToDatabase}
            disabled={loading || missingCount === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
          >
            <Upload size={20} />
            <span>동기화 ({missingCount})</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className={`p-4 rounded-lg ${syncStatus.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {syncStatus}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">네임스페이스</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">키</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KO</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jsonTranslations.map((trans, index) => {
                const exists = dbTranslations.has(`${trans.namespace}.${trans.key}`)
                return (
                  <tr key={index} className={exists ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {trans.namespace}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{trans.key}</code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate">{trans.ko || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate">{trans.en || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {exists ? (
                        <span className="text-green-600 font-medium">✓ DB에 있음</span>
                      ) : (
                        <span className="text-orange-600 font-medium">새로 추가 필요</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span>처리 중...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

