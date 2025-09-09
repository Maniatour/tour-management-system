'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import TicketBookingForm from './TicketBookingForm';
import BookingHistory from './BookingHistory';
import { Grid, List, Plus, Search, Calendar, Filter } from 'lucide-react';

interface TicketBooking {
  id: string;
  category: string;
  submit_on: string;
  submitted_by: string;
  check_in_date: string;
  time: string;
  company: string;
  ea: number;
  expense: number;
  income: number;
  payment_method: string;
  rn_number: string;
  tour_id: string;
  note: string;
  status: string;
  season: string;
  created_at: string;
  updated_at: string;
  tours?: {
    tour_date: string;
    products?: {
      name: string;
    };
  };
}

export default function TicketBookingList() {
  const [bookings, setBookings] = useState<TicketBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TicketBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // 먼저 ticket_bookings만 조회
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .order('check_in_date', { ascending: false });

      if (bookingsError) throw bookingsError;

      console.log('입장권 부킹 데이터:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // tour_id가 있는 부킹들만 필터링
      const bookingsWithTourId = bookingsData.filter(booking => booking.tour_id);
      
      console.log('투어 ID가 있는 부킹들:', bookingsWithTourId);
      
      if (bookingsWithTourId.length === 0) {
        setBookings(bookingsData);
        return;
      }

      // 모든 tour_id를 한 번에 조회
      const tourIds = [...new Set(bookingsWithTourId.map(booking => booking.tour_id))];
      
      console.log('조회할 투어 ID들:', tourIds);
      
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          products (
            name
          )
        `)
        .in('id', tourIds);

      console.log('투어 데이터:', toursData);
      console.log('투어 조회 오류:', toursError);

      if (toursError) {
        console.warn('투어 정보 조회 오류:', toursError);
        setBookings(bookingsData);
        return;
      }

      // tours 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const toursMap = new Map();
      (toursData || []).forEach(tour => {
        toursMap.set(tour.id, tour);
      });

      console.log('투어 맵:', toursMap);

      // 부킹 데이터에 투어 정보 추가
      const bookingsWithTours = bookingsData.map(booking => {
        if (booking.tour_id && toursMap.has(booking.tour_id)) {
          const tour = toursMap.get(booking.tour_id);
          console.log(`부킹 ${booking.id}의 투어 정보:`, tour);
          return {
            ...booking,
            tours: {
              tour_date: tour.tour_date,
              products: tour.products
            }
          };
        }
        console.log(`부킹 ${booking.id}에 투어 정보 없음 (tour_id: ${booking.tour_id})`);
        return booking;
      });

      console.log('최종 부킹 데이터:', bookingsWithTours);
      setBookings(bookingsWithTours);
    } catch (error) {
      console.error('입장권 부킹 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (booking: TicketBooking) => {
    setEditingBooking(booking);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 부킹을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('ticket_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setBookings(prev => prev.filter(booking => booking.id !== id));
    } catch (error) {
      console.error('입장권 부킹 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleViewHistory = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowHistory(true);
  };

  const handleSave = (booking: TicketBooking) => {
    if (editingBooking) {
      setBookings(prev => 
        prev.map(b => b.id === booking.id ? { ...booking, tours: b.tours } : b)
      );
    } else {
      setBookings(prev => [booking, ...prev]);
    }
    setShowForm(false);
    setEditingBooking(null);
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.submitted_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.rn_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    const matchesDate = !dateFilter || booking.check_in_date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'tentative': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'tentative': return '가예약';
      case 'confirmed': return '확정';
      case 'paid': return '결제완료';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-4 sm:px-6 py-4 space-y-4 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold">입장권 부킹 관리</h2>
        <div className="flex items-center space-x-3">
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base flex items-center space-x-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">새 부킹 추가</span>
            <span className="sm:hidden">추가</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일 최적화 */}
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="카테고리, 공급업체, 제출자, RN# 검색..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태 필터
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">모든 상태</option>
              <option value="tentative">가예약</option>
              <option value="confirmed">확정</option>
              <option value="paid">결제완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              체크인 날짜
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 표시 영역 */}
      <div className="px-4 sm:px-6">
        {viewMode === 'table' ? (
          /* 테이블 뷰 - 모바일 최적화 */
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      카테고리
                    </th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      제출자
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      체크인 날짜
                    </th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시간
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      공급업체
                    </th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      수량
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      비용/수입
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex flex-col">
                          <span>{booking.category}</span>
                          <span className="text-xs text-gray-500 sm:hidden">{booking.submitted_by}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.submitted_by}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span>{booking.check_in_date}</span>
                          <span className="text-xs text-gray-500 md:hidden">{booking.time}</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.time}
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.company}
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.ea}
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>비용: ${booking.expense}</div>
                          <div>수입: ${booking.income}</div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                          {getStatusText(booking.status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                          <button
                            onClick={() => handleEdit(booking)}
                            className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleViewHistory(booking.id)}
                            className="text-green-600 hover:text-green-900 text-xs sm:text-sm"
                          >
                            히스토리
                          </button>
                          <button
                            onClick={() => handleDelete(booking.id)}
                            className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 카드뷰 - 모바일 최적화 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="p-4 sm:p-6">
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {booking.category}
                      </h3>
                      <p className="text-sm text-gray-600">{booking.submitted_by}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">체크인 날짜</span>
                      <span className="font-medium">{booking.check_in_date}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">시간</span>
                      <span className="font-medium">{booking.time}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">공급업체</span>
                      <span className="font-medium truncate ml-2">{booking.company}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">수량</span>
                      <span className="font-medium">{booking.ea}개</span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">비용</span>
                        <span className="font-medium text-red-600">${booking.expense}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">수입</span>
                        <span className="font-medium text-green-600">${booking.income}</span>
                      </div>
                    </div>

                    {booking.tours && (
                      <div className="border-t pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">투어</span>
                          <div className="mt-1">
                            <div className="font-medium">{booking.tours.tour_date}</div>
                            <div className="text-xs text-gray-500">
                              {booking.tours.products?.name || '상품명 없음'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(booking)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleViewHistory(booking.id)}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        히스토리
                      </button>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredBookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg font-medium mb-2">
              {searchTerm || statusFilter !== 'all' || dateFilter 
                ? '검색 조건에 맞는 부킹이 없습니다.' 
                : '등록된 입장권 부킹이 없습니다.'
              }
            </div>
            <p className="text-sm text-gray-400">
              {!searchTerm && statusFilter === 'all' && !dateFilter && '새 부킹을 추가해보세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <TicketBookingForm
          booking={editingBooking || undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingBooking(null);
          }}
        />
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <BookingHistory
          bookingType="ticket"
          bookingId={selectedBookingId}
          onClose={() => {
            setShowHistory(false);
            setSelectedBookingId('');
          }}
        />
      )}
    </div>
  );
}
