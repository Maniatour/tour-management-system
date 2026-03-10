'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

export default function AdminEmailIntegrationPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'ko'
  const [status, setStatus] = useState<{ connected: boolean; email: string | null; updated_at: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** OAuth 직후 success=1일 때, fetchStatus 응답 전까지 낙관적으로 '연결됨' 표시 */
  const [optimisticConnected, setOptimisticConnected] = useState(false)

  const emptyStatus = { connected: false, email: null as string | null, updated_at: null as string | null }
  const normalizeStatus = (data: unknown) =>
    data && typeof (data as { connected?: boolean }).connected === 'boolean'
      ? (data as { connected: boolean; email: string | null; updated_at: string | null })
      : emptyStatus

  const fetchStatus = React.useCallback(() => {
    return fetch('/api/email/gmail/status')
      .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        const status = normalizeStatus(data)
        setStatus(status)
        // API가 200으로 성공했을 때만 낙관 상태 해제. 500이면 OAuth 직후 '연결됨' UI·동기화 버튼 유지
        if (ok) setOptimisticConnected(false)
        return status
      })
      .catch(() => {
        setStatus(emptyStatus)
        // 네트워크/기타 오류 시 optimisticConnected 유지 → success=1 직후에도 동기화 버튼 표시
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/email/gmail/status')
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) setStatus(normalizeStatus(data))
      })
      .catch(() => {
        if (!cancelled) setStatus(emptyStatus)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === '1') {
      setMessage('Gmail 연결이 완료되었습니다.')
      setOptimisticConnected(true)
      fetchStatus()
    }
    if (error) setMessage(`연결 실패: ${decodeURIComponent(error)}`)
  }, [searchParams, fetchStatus])

  const startAuthUrl = `/api/email/gmail/start?locale=${locale}`

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/email/gmail/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || res.statusText)
      setMessage(`동기화 완료: 새 메일 ${data.imported ?? 0}건이 예약 가져오기 목록에 추가되었습니다.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">이메일 연동 (Gmail)</h1>
      <p className="text-sm text-gray-600">
        Gmail 받은편지함의 예약 알림 메일을 자동으로 읽어와 예약 가져오기 목록에 넣습니다. 연결 후 수동 동기화 또는 Cron으로 주기 실행할 수 있습니다.
      </p>

      {message && (
        <div className={`rounded-lg border p-4 text-sm ${message.startsWith('연결 실패') || message.startsWith('동기화 실패') ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Gmail 연결</h2>
        {status?.connected || optimisticConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>연결됨: <strong>{status?.email ?? '확인 중…'}</strong></span>
            </div>
            <p className="text-xs text-gray-500">
              마지막 연결: {status?.updated_at ? new Date(status.updated_at).toLocaleString('ko-KR') : '-'}
            </p>
            <div className="flex gap-2">
              <a
                href={startAuthUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                다시 연결
              </a>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                지금 동기화
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-600">
              <XCircle className="w-5 h-5 text-gray-400" />
              <span>Gmail이 연결되지 않았습니다.</span>
            </div>
            <p className="text-xs text-gray-500">
              아래 &quot;Gmail 연결&quot; 버튼을 눌러 Google 계정으로 한 번 연결해 주세요.
            </p>
            <a
              href={startAuthUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Mail className="w-4 h-4" />
              Gmail 연결
            </a>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        예약 가져오기 목록에서 자동으로 추가된 항목을 확인·보완한 뒤 예약으로 생성할 수 있습니다.
      </p>
    </div>
  )
}
