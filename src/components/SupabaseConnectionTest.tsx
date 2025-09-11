'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing')
  const [errorMessage, setErrorMessage] = useState('')
  const [testResults, setTestResults] = useState<any[]>([])

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    const tests = [
      { name: 'vehicles 테이블', query: () => supabase.from('vehicles').select('*').limit(1) },
      { name: 'chat_rooms 테이블', query: () => supabase.from('chat_rooms').select('*').limit(1) },
      { name: 'customers 테이블', query: () => supabase.from('customers').select('*').limit(1) },
      { name: 'tours 테이블', query: () => supabase.from('tours').select('*').limit(1) }
    ]

    const results = []
    
    for (const test of tests) {
      try {
        console.log(`Testing ${test.name}...`)
        const { data, error } = await test.query()
        
        if (error) {
          console.error(`${test.name} error:`, error)
          results.push({
            name: test.name,
            status: 'error',
            error: error.message,
            code: error.code
          })
        } else {
          console.log(`${test.name} success:`, data)
          results.push({
            name: test.name,
            status: 'success',
            data: data
          })
        }
      } catch (err) {
        console.error(`${test.name} exception:`, err)
        results.push({
          name: test.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    setTestResults(results)
    
    const hasErrors = results.some(r => r.status === 'error')
    setConnectionStatus(hasErrors ? 'error' : 'success')
    
    if (hasErrors) {
      const errorMsgs = results.filter(r => r.status === 'error').map(r => `${r.name}: ${r.error}`)
      setErrorMessage(errorMsgs.join('; '))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600'
      case 'error': return 'text-red-600'
      default: return 'text-yellow-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅'
      case 'error': return '❌'
      default: return '⏳'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Supabase 연결 테스트</h3>
      
      <div className="space-y-3">
        {testResults.map((result, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center space-x-3">
              <span className="text-lg">{getStatusIcon(result.status)}</span>
              <span className="font-medium">{result.name}</span>
            </div>
            <div className={`text-sm ${getStatusColor(result.status)}`}>
              {result.status === 'success' ? '연결 성공' : result.error}
            </div>
          </div>
        ))}
      </div>

      {connectionStatus === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">연결 오류</h4>
          <p className="text-sm text-red-700">{errorMessage}</p>
          <div className="mt-3">
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              다시 테스트
            </button>
          </div>
        </div>
      )}

      {connectionStatus === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">연결 성공</h4>
          <p className="text-sm text-green-700">모든 테이블에 정상적으로 연결되었습니다.</p>
        </div>
      )}
    </div>
  )
}
