'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export default function SupabaseTest() {
  const [status, setStatus] = useState('Testing...')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        setStatus('Testing Supabase connection...')
        
        const client = getSupabaseClient()
        if (!client) {
          setError('Supabase client is null')
          setStatus('Failed')
          return
        }

        setStatus('Client created, testing query...')
        
        // 간단한 테스트 쿼리
        const { data, error } = await client
          .from('team')
          .select('count', { count: 'exact', head: true })
          .limit(1)

        if (error) {
          setError(`Query error: ${error.message}`)
          setStatus('Failed')
          return
        }

        setData(data)
        setStatus('Success')
        
      } catch (err) {
        setError(`Exception: ${err}`)
        setStatus('Failed')
      }
    }

    testConnection()
  }, [])

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Supabase Connection Test</h3>
      <p><strong>Status:</strong> {status}</p>
      {error && <p><strong>Error:</strong> {error}</p>}
      {data && <p><strong>Data:</strong> {JSON.stringify(data)}</p>}
    </div>
  )
}