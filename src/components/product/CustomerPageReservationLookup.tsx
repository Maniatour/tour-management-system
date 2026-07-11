'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CustomerPageReservationLookupProps = {
  locale: string
}

type ReservationResult = {
  id: string
  channel_rn: string | null
  tour_date: string
  customer_label: string
}

export default function CustomerPageReservationLookup({ locale }: CustomerPageReservationLookupProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ReservationResult[]>([])
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    const term = query.trim()
    if (!term) return

    setLoading(true)
    setSearched(true)
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, channel_rn, tour_date, customers(name, email)')
        .or(`id.ilike.%${term}%,channel_rn.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      setResults(
        ((data ?? []) as unknown as Array<{
          id: string
          channel_rn: string | null
          tour_date: string
          customers: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
        }>).map((row) => {
          const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers
          return {
            id: row.id,
            channel_rn: row.channel_rn,
            tour_date: row.tour_date,
            customer_label:
              customer?.name || customer?.email || row.channel_rn || '—',
          }
        })
      )
    } catch (err) {
      console.error('Reservation search failed:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        예약 ID 또는 채널 예약번호(RN)로 검색합니다. 고객 페이지 예약 조회 폼은{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">/api/reservations/check</code> API를 사용합니다.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          placeholder="예약 ID, 채널 RN"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          검색
        </button>
      </div>

      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {results.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{row.id}</p>
                <p className="text-xs text-gray-500 truncate">
                  {row.customer_label}
                  {row.tour_date ? ` · ${row.tour_date}` : ''}
                  {row.channel_rn ? ` · RN ${row.channel_rn}` : ''}
                </p>
              </div>
              <Link
                href={`/${locale}/admin/reservations/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary hover:text-primary/80 font-medium"
              >
                상세 열기
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
