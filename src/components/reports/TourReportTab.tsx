'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, DollarSign, TrendingUp, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
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
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      const { data: tours } = await supabase
        .from('tours')
        .select('id, tour_date, tour_status, reservation_ids, product_id, tour_guide_id, assistant_id, guide_fee, assistant_fee')
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)

      if (!tours) {
        setStats({ total: 0, tours: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 })
        return
      }

      const tourIds = tours.map(t => t.id)
      const productIds = [...new Set(tours.map(t => t.product_id).filter(Boolean))] as string[]
      const guideEmails = [...new Set(tours.map(t => t.tour_guide_id).filter(Boolean))] as string[]
      const assistantEmails = [...new Set(tours.map(t => t.assistant_id).filter(Boolean))] as string[]
      const teamEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const allReservationIds = [
        ...new Set(
          tours
            .flatMap(t => (Array.isArray(t.reservation_ids) ? t.reservation_ids : []))
            .filter(Boolean)
        )
      ] as string[]

      const [
        { data: products },
        { data: team },
        { data: reservations },
        { data: pricing },
        { data: tourExpensesRows },
        { data: ticketBookingsRows },
        { data: hotelBookingsRows }
      ] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, name, name_en').in('id', productIds)
          : Promise.resolve({ data: [] as any[] } as any),
        teamEmails.length > 0
          ? supabase.from('team').select('email, name_ko, name_en, nick_name').in('email', teamEmails)
          : Promise.resolve({ data: [] as any[] } as any),
        allReservationIds.length > 0
          ? supabase.from('reservations').select('id, total_people').in('id', allReservationIds)
          : Promise.resolve({ data: [] as any[] } as any),
        allReservationIds.length > 0
          ? supabase.from('reservation_pricing').select('reservation_id, total_price').in('reservation_id', allReservationIds)
          : Promise.resolve({ data: [] as any[] } as any),
        tourIds.length > 0
          ? supabase.from('tour_expenses').select('tour_id, amount').in('tour_id', tourIds)
          : Promise.resolve({ data: [] as any[] } as any),
        tourIds.length > 0
          ? supabase.from('ticket_bookings').select('tour_id, expense').in('tour_id', tourIds).in('status', ['confirmed', 'paid'])
          : Promise.resolve({ data: [] as any[] } as any),
        tourIds.length > 0
          ? supabase.from('tour_hotel_bookings').select('tour_id, total_price').in('tour_id', tourIds).in('status', ['confirmed', 'paid'])
          : Promise.resolve({ data: [] as any[] } as any)
      ])

      const productNameMap = new Map<string, string>()
      ;(products || []).forEach((p: any) => {
        productNameMap.set(p.id, p.name || p.name_en || p.id)
      })

      const teamNameMap = new Map<string, string>()
      ;(team || []).forEach((m: any) => {
        teamNameMap.set(m.email, m.nick_name || m.name_ko || m.name_en || m.email)
      })

      const peopleMap = new Map<string, number>()
      ;(reservations || []).forEach((r: any) => {
        peopleMap.set(r.id, r.total_people || 0)
      })

      const pricingMap = new Map<string, number>()
      ;(pricing || []).forEach((p: any) => {
        pricingMap.set(p.reservation_id, p.total_price || 0)
      })

      const tourExpensesMap = new Map<string, number>()
      ;(tourExpensesRows || []).forEach((e: any) => {
        tourExpensesMap.set(e.tour_id, (tourExpensesMap.get(e.tour_id) || 0) + (e.amount || 0))
      })

      const ticketCostsMap = new Map<string, number>()
      ;(ticketBookingsRows || []).forEach((b: any) => {
        ticketCostsMap.set(b.tour_id, (ticketCostsMap.get(b.tour_id) || 0) + (b.expense || 0))
      })

      const hotelCostsMap = new Map<string, number>()
      ;(hotelBookingsRows || []).forEach((b: any) => {
        hotelCostsMap.set(b.tour_id, (hotelCostsMap.get(b.tour_id) || 0) + (b.total_price || 0))
      })

      const tourStats = tours.map((tour: any) => {
        const reservationIds = Array.isArray(tour.reservation_ids) ? tour.reservation_ids : []

        const revenue = reservationIds.reduce((sum: number, rid: string) => sum + (pricingMap.get(rid) || 0), 0)
        const totalPeople = reservationIds.reduce((sum: number, rid: string) => sum + (peopleMap.get(rid) || 0), 0)

        const fees = (tour.guide_fee || 0) + (tour.assistant_fee || 0)
        const totalExpenses =
          (tourExpensesMap.get(tour.id) || 0) +
          (ticketCostsMap.get(tour.id) || 0) +
          (hotelCostsMap.get(tour.id) || 0) +
          fees

        const netProfit = revenue - totalExpenses

        return {
          tourId: tour.id,
          tourDate: tour.tour_date,
          tourStatus: tour.tour_status || 'Unknown',
          productName: tour.product_id ? (productNameMap.get(tour.product_id) || 'Unknown') : 'Unknown',
          guideName: tour.tour_guide_id ? (teamNameMap.get(tour.tour_guide_id) || tour.tour_guide_id) : '미지정',
          assistantName: tour.assistant_id ? (teamNameMap.get(tour.assistant_id) || tour.assistant_id) : '미지정',
          totalPeople,
          revenue,
          expenses: totalExpenses,
          netProfit
        }
      })

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
            <Users className="h-8 w-8 text-purple-600" />
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가이드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">어시스턴트</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 인원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순이익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.tours.map((tour: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{tour.tourDate}</td>
                  <td className="px-4 py-3 text-sm">{tour.tourStatus}</td>
                  <td className="px-4 py-3 text-sm">{tour.productName}</td>
                  <td className="px-4 py-3 text-sm">{tour.guideName}</td>
                  <td className="px-4 py-3 text-sm">{tour.assistantName}</td>
                  <td className="px-4 py-3 text-sm font-medium">{(tour.totalPeople || 0).toLocaleString()}명</td>
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
