'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, DollarSign, TrendingUp, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export default function TourReportTab({ dateRange, period }: TourReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTourStats()
  }, [dateRange, period])

  const loadTourStats = async () => {
    setLoading(true)
    try {
      const { data: tours } = await supabase
        .from('tours')
        .select('id, tour_date, reservation_ids, vehicle_type, guide_fee, assistant_fee')
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)

      if (!tours) {
        setStats({ total: 0, tours: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 })
        return
      }

      const tourStats = await Promise.all(
        tours.map(async (tour) => {
          // 예약 가격 합산
          let revenue = 0
          if (tour.reservation_ids && Array.isArray(tour.reservation_ids)) {
            const { data: pricing } = await supabase
              .from('reservation_pricing')
              .select('total_price')
              .in('reservation_id', tour.reservation_ids)
            
            if (pricing) {
              revenue = pricing.reduce((sum, p) => sum + (p.total_price || 0), 0)
            }
          }

          // 투어 지출 합산
          const { data: expenses } = await supabase
            .from('tour_expenses')
            .select('amount')
            .eq('tour_id', tour.id)

          const { data: ticketBookings } = await supabase
            .from('ticket_bookings')
            .select('expense')
            .eq('tour_id', tour.id)
            .eq('status', 'confirmed')

          const { data: hotelBookings } = await supabase
            .from('tour_hotel_bookings')
            .select('total_price')
            .eq('tour_id', tour.id)
            .eq('status', 'confirmed')

          const tourExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
          const ticketCosts = ticketBookings?.reduce((sum, b) => sum + (b.expense || 0), 0) || 0
          const hotelCosts = hotelBookings?.reduce((sum, b) => sum + (b.total_price || 0), 0) || 0
          const fees = (tour.guide_fee || 0) + (tour.assistant_fee || 0)
          
          const totalExpenses = tourExpenses + ticketCosts + hotelCosts + fees
          const netProfit = revenue - totalExpenses

          return {
            tourId: tour.id,
            tourDate: tour.tour_date,
            vehicleType: tour.vehicle_type || 'Unknown',
            revenue,
            expenses: totalExpenses,
            netProfit,
            guideFee: tour.guide_fee || 0,
            assistantFee: tour.assistant_fee || 0
          }
        })
      )

      const totalRevenue = tourStats.reduce((sum, t) => sum + t.revenue, 0)
      const totalExpenses = tourStats.reduce((sum, t) => sum + t.expenses, 0)
      const netProfit = totalRevenue - totalExpenses

      setStats({
        total: tours.length,
        tours: tourStats,
        totalRevenue,
        totalExpenses,
        netProfit
      })
    } catch (error) {
      console.error('투어 통계 로드 오류:', error)
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">총 투어</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">총 수익</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">총 지출</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Car className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">순이익</p>
              <p className="text-2xl font-bold text-gray-900">${stats.netProfit.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 투어별 상세 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">투어별 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">투어 날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">차량 유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순이익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.tours.map((tour: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{new Date(tour.tourDate).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-sm">{tour.vehicleType}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">${tour.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-red-600">${tour.expenses.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">${tour.netProfit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
