'use client'

import React, { useState, useEffect } from 'react'
import { CreditCard, DollarSign, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DepositReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
}

export default function DepositReportTab({ dateRange, period }: DepositReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDepositStats()
  }, [dateRange, period])

  const loadDepositStats = async () => {
    setLoading(true)
    try {
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      const startDate = new Date(dateRange.start + 'T00:00:00')
      const endDate = new Date(dateRange.end + 'T23:59:59.999')

      // 날짜 유효성 검사
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('유효하지 않은 날짜 범위:', dateRange)
        setLoading(false)
        return
      }

      // submit_on은 TIMESTAMP이므로 ISO 범위로 조회 (일별도 하루 전체 포함)
      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      const { data: deposits } = await supabase
        .from('payment_records')
        .select('id, amount, payment_method, payment_status, submit_on, reservation_id')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])

      if (!deposits) {
        setStats({ total: 0, byMethod: [], byStatus: [], deposits: [] })
        return
      }

      // 결제 방법 정보 조회
      const paymentMethodIds = [...new Set(deposits.map(d => d.payment_method).filter(Boolean))]
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, method, display_name')
        .in('id', paymentMethodIds)

      // 결제 방법 ID -> 방법명 매핑 생성
      const methodNameMap = new Map<string, string>()
      if (paymentMethods) {
        paymentMethods.forEach(pm => {
          // 입금 통계에서는 ID(PAYMxxx) 없이 방법명만 표시
          methodNameMap.set(pm.id, pm.method || pm.display_name || pm.id)
        })
      }

      // 결제 방법별 집계
      const methodMap = new Map<string, number>()
      deposits.forEach(d => {
        const methodId = d.payment_method || 'Unknown'
        const methodName = methodNameMap.get(methodId) || methodId
        methodMap.set(methodName, (methodMap.get(methodName) || 0) + (d.amount || 0))
      })

      // 상태별 집계
      const statusMap = new Map<string, number>()
      deposits.forEach(d => {
        const status = d.payment_status || 'Unknown'
        statusMap.set(status, (statusMap.get(status) || 0) + (d.amount || 0))
      })

      // 예약별 입금 합계
      const reservationMap = new Map<string, number>()
      deposits.forEach(d => {
        if (d.reservation_id) {
          reservationMap.set(
            d.reservation_id,
            (reservationMap.get(d.reservation_id) || 0) + (d.amount || 0)
          )
        }
      })

      // 예약별 채널 정보 조회
      const reservationIds = [...new Set(deposits.map(d => d.reservation_id).filter(Boolean))]
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, channel_id')
        .in('id', reservationIds)

      // 채널 정보 조회
      const channelIds = [...new Set((reservations || []).map(r => r.channel_id).filter(Boolean))]
      const { data: channels } = await supabase
        .from('channels')
        .select('id, name')
        .in('id', channelIds)

      // 채널 ID -> 채널명 매핑 생성
      const channelNameMap = new Map<string, string>()
      if (channels) {
        channels.forEach(ch => {
          channelNameMap.set(ch.id, ch.name || ch.id)
        })
      }

      // 예약 ID -> 채널 ID 매핑 생성
      const reservationChannelMap = new Map<string, string>()
      if (reservations) {
        reservations.forEach(r => {
          if (r.channel_id) {
            reservationChannelMap.set(r.id, r.channel_id)
          }
        })
      }

      // 채널별 입금 집계
      const channelMap = new Map<string, number>()
      deposits.forEach(d => {
        if (d.reservation_id) {
          const channelId = reservationChannelMap.get(d.reservation_id)
          if (channelId) {
            const channelName = channelNameMap.get(channelId) || channelId
            channelMap.set(channelName, (channelMap.get(channelName) || 0) + (d.amount || 0))
          } else {
            // 채널 정보가 없는 경우
            channelMap.set('채널 미지정', (channelMap.get('채널 미지정') || 0) + (d.amount || 0))
          }
        } else {
          // reservation_id가 없는 경우
          channelMap.set('예약 없음', (channelMap.get('예약 없음') || 0) + (d.amount || 0))
        }
      })

      const total = deposits.reduce((sum, d) => sum + (d.amount || 0), 0)

      setStats({
        total,
        count: deposits.length,
        byMethod: Array.from(methodMap.entries()).map(([method, amount]) => ({
          method,
          amount,
          percentage: (amount / total) * 100
        })),
        byStatus: Array.from(statusMap.entries()).map(([status, amount]) => ({
          status,
          amount,
          percentage: (amount / total) * 100
        })),
        byReservation: Array.from(reservationMap.entries()).map(([reservationId, amount]) => ({
          reservationId,
          amount
        })),
        byChannel: Array.from(channelMap.entries()).map(([channel, amount]) => ({
          channel,
          amount,
          percentage: (amount / total) * 100
        })),
        deposits: deposits.map(d => {
          const channelId = d.reservation_id ? reservationChannelMap.get(d.reservation_id) : null
          const channelName = channelId ? (channelNameMap.get(channelId) || channelId) : null
          return {
            ...d,
            payment_method_name: methodNameMap.get(d.payment_method || '') || d.payment_method || 'Unknown',
            channel_name: channelName || '채널 미지정'
          }
        }).sort((a, b) => 
          new Date(b.submit_on).getTime() - new Date(a.submit_on).getTime()
        )
      })
    } catch (error) {
      console.error('입금 통계 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">데이터를 불러올 수 없습니다.</div>
  }

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">총 입금액</p>
              <p className="text-3xl font-bold text-gray-900">${stats.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <CreditCard className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">입금 건수</p>
              <p className="text-3xl font-bold text-gray-900">{stats.count}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">평균 입금액</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.count > 0 ? (stats.total / stats.count).toFixed(0) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 결제 방법별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 방법별 입금</h3>
        <div className="space-y-3">
          {stats.byMethod
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.method}</span>
                    <span className="text-sm text-gray-500">{item.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="ml-4 text-sm font-semibold text-gray-900">
                  ${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* 채널별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">채널별 입금</h3>
        <div className="space-y-3">
          {stats.byChannel
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.channel}</span>
                    <span className="text-sm text-gray-500">{item.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="ml-4 text-sm font-semibold text-gray-900">
                  ${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* 상태별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상태별 입금</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.byStatus
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm">{item.status}</td>
                    <td className="px-4 py-3 text-sm font-medium">${item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 입금 내역 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 입금 내역</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제 방법</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.deposits.slice(0, 50).map((deposit: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">
                    {new Date(deposit.submit_on).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">${deposit.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{deposit.payment_method_name || deposit.payment_method}</td>
                  <td className="px-4 py-3 text-sm">{deposit.channel_name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{deposit.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
