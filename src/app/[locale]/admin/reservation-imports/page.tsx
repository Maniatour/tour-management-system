'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mail, ChevronRight, Loader2, FileText } from 'lucide-react'
import type { ExtractedReservationData } from '@/types/reservationImport'

interface ImportItem {
  id: string
  message_id: string | null
  source_email: string | null
  platform_key: string | null
  subject: string | null
  received_at: string | null
  extracted_data: ExtractedReservationData
  status: string
  reservation_id: string | null
  created_at: string | null
}

interface AdminReservationImportsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservationImportsPage({}: AdminReservationImportsProps) {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || 'ko'
  const [items, setItems] = useState<ImportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteSubject, setPasteSubject] = useState('')
  const [pasteBody, setPasteBody] = useState('')
  const [pasteFrom, setPasteFrom] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)

  const summary = (extracted: ExtractedReservationData) => {
    const parts = []
    if (extracted.customer_name) parts.push(extracted.customer_name)
    if (extracted.customer_email) parts.push(extracted.customer_email)
    if (extracted.tour_date) parts.push(extracted.tour_date)
    if (extracted.adults != null) parts.push(`성인 ${extracted.adults}`)
    return parts.length ? parts.join(' · ') : '-'
  }

  const loadList = useCallback(() => {
    setLoading(true)
    fetch(`/api/reservation-imports?status=${statusFilter}`)
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handlePasteSubmit = async () => {
    if (!pasteSubject.trim() && !pasteBody.trim()) {
      alert('제목 또는 본문을 입력하세요.')
      return
    }
    setPasteSubmitting(true)
    try {
      const res = await fetch('/api/reservation-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: pasteSubject.trim() || '(제목 없음)',
          text: pasteBody.trim() || '',
          from: pasteFrom.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || res.statusText)
      setPasteOpen(false)
      setPasteSubject('')
      setPasteBody('')
      setPasteFrom('')
      loadList()
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패')
    } finally {
      setPasteSubmitting(false)
    }
  }

  const formatDate = (s: string | null) => {
    if (!s) return '-'
    try {
      const d = new Date(s)
      return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return s
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">예약 가져오기</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <FileText className="w-4 h-4" />
            이메일 붙여넣기
          </button>
          <span className="text-sm text-gray-600">상태:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="pending">대기 중</option>
            <option value="confirmed">확정됨</option>
            <option value="rejected">무시됨</option>
          </select>
        </div>
      </div>

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">이메일 붙여넣기</h2>
              <p className="text-sm text-gray-500 mt-0.5">Gmail 등에서 받은 예약 메일의 제목·본문을 복사해 붙여넣으면 자동으로 정보를 추출합니다. (Resend/도메인 없이 사용 가능)</p>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input
                  type="text"
                  value={pasteSubject}
                  onChange={(e) => setPasteSubject(e.target.value)}
                  placeholder="이메일 제목"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">발신 (선택, 플랫폼 식별용)</label>
                <input
                  type="text"
                  value={pasteFrom}
                  onChange={(e) => setPasteFrom(e.target.value)}
                  placeholder="예: noreply@viator.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">본문 *</label>
                <textarea
                  value={pasteBody}
                  onChange={(e) => setPasteBody(e.target.value)}
                  placeholder="이메일 본문 전체를 복사해 붙여넣으세요"
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={pasteSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {pasteSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                가져오기
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600">
        플랫폼에서 수신된 이메일로 자동 추출된 예약 후보입니다. 항목을 클릭해 정보를 보완한 뒤 예약으로 생성하세요.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>해당 상태의 예약 가져오기 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">수신일시</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">플랫폼</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">추출 요약</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/${locale}/admin/reservation-imports/${row.id}`)}
                >
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(row.received_at ?? row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={row.subject ?? ''}>
                    {row.subject ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.platform_key ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[280px] truncate" title={summary(row.extracted_data)}>
                    {summary(row.extracted_data)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
