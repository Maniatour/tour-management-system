'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TicketBookingForm from './TicketBookingForm';
import BookingHistory from './BookingHistory';
import { Grid, Calendar as CalendarIcon, Plus, Search, Calendar } from 'lucide-react';

interface TicketBooking {
  id: string;
  tour_id?: string;
  submit_on: string;
  check_in_date: string;
  time: string;
  category: string;
  ea: number;
  reservation_name: string;
  submitted_by: string;
  cc: string;
  unit_price: number;
  total_price: number;
  payment_method: string;
  website: string;
  rn_number: string;
  status: string;
  company: string;
  created_at: string;
  updated_at: string;
  tours?: {
    tour_date: string;
    products?: {
      name: string;
    };
  };
}

interface TourEvent {
  id: string;
  tour_date: string;
  reservation_ids: string[];
  total_reservations: number;
  total_people: number;
  adults: number;
  child: number;
  infant: number;
  products?: {
    name: string;
  };
}

export default function TicketBookingList() {
  const router = useRouter();
  const [bookings, setBookings] = useState<TicketBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TicketBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [tourFilter, setTourFilter] = useState('all'); // 'all', 'connected', 'unconnected'
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'calendar'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<TicketBooking[]>([]);
  const [tourEvents, setTourEvents] = useState<TourEvent[]>([]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // 먼저 ticket_bookings만 조회
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .order('submit_on', { ascending: false });

      if (bookingsError) throw bookingsError;

      console.log('입장권 부킹 데이터:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // tour_id가 있는 부킹들만 필터링
      const bookingsWithTourId = (bookingsData || []).filter((booking: TicketBooking) => booking.tour_id);
      
      console.log('투어 ID가 있는 입장권 부킹들:', bookingsWithTourId);
      
      if (bookingsWithTourId.length === 0) {
        setBookings(bookingsData);
        return;
      }

      // 모든 tour_id를 한 번에 조회
      const tourIds = [...new Set(bookingsWithTourId.map((booking: TicketBooking) => booking.tour_id))];
      
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
        .in('id', tourIds as string[]);

      console.log('투어 데이터:', toursData);
      console.log('투어 조회 오류:', toursError);

      if (toursError) {
        console.warn('투어 정보 조회 오류:', toursError);
        setBookings(bookingsData);
        return;
      }

      // tours 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const toursMap = new Map<string, TourEvent>();
      (toursData || []).forEach((tour: TourEvent) => {
        toursMap.set(tour.id, tour);
      });

      console.log('투어 맵:', toursMap);

      // 부킹 데이터에 투어 정보 추가 및 check_in_date 설정
      const bookingsWithTours = (bookingsData || []).map((booking: TicketBooking) => {
        const baseBooking = {
          ...booking,
          check_in_date: booking.check_in_date || booking.submit_on
        };
        
        if (booking.tour_id && toursMap.has(booking.tour_id)) {
          const tour = toursMap.get(booking.tour_id);
          console.log(`입장권 부킹 ${booking.id}의 투어 정보:`, tour);
          return {
            ...baseBooking,
            tours: {
              tour_date: tour?.tour_date || '',
              products: tour?.products
            }
          };
        }
        console.log(`입장권 부킹 ${booking.id}에 투어 정보 없음 (tour_id: ${booking.tour_id})`);
        return baseBooking;
      });

      console.log('최종 입장권 부킹 데이터:', bookingsWithTours);
      setBookings(bookingsWithTours);
    } catch (error) {
      console.error('입장권 부킹 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTourEvents = useCallback(async () => {
    try {
      // 현재 달력에 표시되는 월의 시작일과 종료일 계산
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      console.log('투어 이벤트 조회 기간:', startDate.toISOString().split('T')[0], '~', endDate.toISOString().split('T')[0]);

      // 먼저 투어 데이터만 조회 (reservation_ids 포함)
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          reservation_ids,
          products (
            name
          )
        `)
        .gte('tour_date', startDate.toISOString().split('T')[0])
        .lte('tour_date', endDate.toISOString().split('T')[0])
        .order('tour_date', { ascending: true });

      if (toursError) {
        console.error('투어 데이터 조회 오류:', toursError);
        throw toursError;
      }

      console.log('투어 데이터:', toursData);
      console.log('투어 데이터 상세:', JSON.stringify(toursData, null, 2));

      if (!toursData || toursData.length === 0) {
        console.log('투어 데이터가 없음');
        setTourEvents([]);
        return;
      }

      // 각 투어별로 예약 데이터 조회 (reservation_ids 사용)
      const tourEventsWithReservations = await Promise.all(
        toursData.map(async (tour: TourEvent) => {
          try {
            console.log(`투어 ${tour.id} 처리 시작:`, {
              tour_id: tour.id,
              reservation_ids: tour.reservation_ids,
              reservation_ids_length: tour.reservation_ids?.length || 0
            });

            // reservation_ids가 없거나 비어있는 경우
            if (!tour.reservation_ids || tour.reservation_ids.length === 0) {
              console.log(`투어 ${tour.id}에 배정된 예약이 없음 (reservation_ids: ${tour.reservation_ids})`);
              return {
                ...tour,
                total_reservations: 0,
                total_people: 0,
                adults: 0,
                child: 0,
                infant: 0
              };
            }

            console.log(`투어 ${tour.id}의 reservation_ids로 예약 조회:`, tour.reservation_ids);

            // reservation_ids에 있는 예약 ID들로 예약 데이터 조회 (상태 필터 제거)
            const { data: reservationsData, error: reservationsError } = await supabase
              .from('reservations')
              .select('id, adults, child, infant, total_people, status')
              .in('id', tour.reservation_ids);

            console.log(`투어 ${tour.id} 예약 조회 결과:`, {
              reservationsData,
              error: reservationsError
            });

            if (reservationsError) {
              console.error(`투어 ${tour.id} 예약 조회 오류:`, reservationsError);
              // Fallback: tour_id로 예약 조회 시도
              console.log(`투어 ${tour.id} fallback: tour_id로 예약 조회 시도`);
              const { data: fallbackReservations, error: fallbackError } = await supabase
                .from('reservations')
                .select('id, adults, child, infant, total_people, status')
                .eq('tour_id', tour.id);
              
              if (fallbackError) {
                console.error(`투어 ${tour.id} fallback 조회도 실패:`, fallbackError);
                return {
                  ...tour,
                  total_reservations: 0,
                  total_people: 0,
                  adults: 0,
                  child: 0,
                  infant: 0
                };
              }
              
              console.log(`투어 ${tour.id} fallback 조회 성공:`, fallbackReservations);
              const fallbackTotalPeople = fallbackReservations?.reduce((sum: number, reservation: { total_people?: number }) => {
                return sum + (reservation.total_people || 0);
              }, 0) || 0;
              
              return {
                ...tour,
                total_reservations: fallbackReservations?.length || 0,
                total_people: fallbackTotalPeople,
                adults: 0,
                child: 0,
                infant: 0
              };
            }

            const totalReservations = reservationsData?.length || 0;
            
            console.log(`투어 ${tour.id} 예약 데이터 상세:`, reservationsData);
            
            // reservation_ids에 있는 예약들의 total_people 합산
            const totalPeople = reservationsData?.reduce((sum: number, reservation: { id: string; total_people?: number }) => {
              console.log(`예약 ${reservation.id} total_people:`, reservation.total_people);
              return sum + (reservation.total_people || 0);
            }, 0) || 0;
            
            // adults, child, infant도 계산 (상세 정보용)
            const totalAdults = reservationsData?.reduce((sum: number, reservation: { adults?: number }) => {
              return sum + (reservation.adults || 0);
            }, 0) || 0;
            
            const totalChild = reservationsData?.reduce((sum: number, reservation: { child?: number }) => {
              return sum + (reservation.child || 0);
            }, 0) || 0;
            
            const totalInfant = reservationsData?.reduce((sum: number, reservation: { infant?: number }) => {
              return sum + (reservation.infant || 0);
            }, 0) || 0;

            console.log(`투어 ${tour.id} 인원 정보 (reservation_ids 사용):`, {
              reservation_ids: tour.reservation_ids,
              adults: totalAdults,
              child: totalChild,
              infant: totalInfant,
              total_people: totalPeople,
              reservations: totalReservations
            });

            return {
              ...tour,
              total_reservations: totalReservations,
              total_people: totalPeople,
              adults: totalAdults,
              child: totalChild,
              infant: totalInfant
            };
          } catch (error) {
            console.error(`투어 ${tour.id} 처리 오류:`, error);
            return {
              ...tour,
              total_reservations: 0,
              total_people: 0,
              adults: 0,
              child: 0,
              infant: 0
            };
          }
        })
      );

      console.log('최종 투어 이벤트 데이터:', tourEventsWithReservations);
      setTourEvents(tourEventsWithReservations);
    } catch (error) {
      console.error('투어 이벤트 조회 오류:', error);
      console.error('오류 상세:', JSON.stringify(error, null, 2));
      setTourEvents([]);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    fetchTourEvents();
  }, [fetchTourEvents]);

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
      booking.reservation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.rn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.company.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    const matchesDate = !dateFilter || booking.submit_on === dateFilter;

    const matchesTour = 
      tourFilter === 'all' || 
      (tourFilter === 'connected' && booking.tour_id) ||
      (tourFilter === 'unconnected' && !booking.tour_id);

    return matchesSearch && matchesStatus && matchesDate && matchesTour;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'confirmed': return '확정';
      case 'cancelled': return '취소';
      case 'completed': return '완료';
      default: return status;
    }
  };

  const getCCStatusText = (cc: string) => {
    switch (cc) {
      case 'sent': return 'CC 발송 완료';
      case 'not_sent': return '미발송';
      case 'not_needed': return '필요없음';
      default: return cc || '-';
    }
  };

  const getCCStatusColor = (cc: string) => {
    switch (cc) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'not_sent': return 'bg-yellow-100 text-yellow-800';
      case 'not_needed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '신용카드';
      case 'bank_transfer': return '계좌이체';
      case 'cash': return '현금';
      case 'other': return '기타';
      default: return method;
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleBookingClick = (bookings: TicketBooking[]) => {
    setSelectedBookings(bookings);
    setShowBookingModal(true);
  };

  const handleTourClick = (tourId: string) => {
    router.push(`/ko/admin/tours/${tourId}`);
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
      <div className="flex items-center justify-between px-1 sm:px-6 py-4">
        <h2 className="text-lg sm:text-2xl font-bold">입장권 부킹 관리</h2>
        <div className="flex items-center space-x-2">
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarIcon size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-base flex items-center space-x-1"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">새 부킹 추가</span>
            <span className="sm:hidden">추가</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일 최적화 */}
      <div className="px-1 sm:px-6 py-4">
        <div className="flex flex-row sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="검색..."
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="confirmed">확정</option>
              <option value="cancelled">취소</option>
              <option value="completed">완료</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              투어 연결
            </label>
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">모든 부킹</option>
              <option value="connected">투어 연결됨</option>
              <option value="unconnected">투어 미연결</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              제출일
            </label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 표시 영역 */}
      <div className="px-1 sm:px-6">
        {viewMode === 'calendar' ? (
          /* 달력 뷰 - 실제 달력 UI에 라벨로 표시 */
          <div>
                        <div>
              {(() => {
                console.log('필터된 부킹 데이터:', filteredBookings);
                console.log('부킹 개수:', filteredBookings.length);
                
                // 체크인 날짜별로 그룹화 (날짜 형식 변환)
                const groupedByDate = filteredBookings.reduce((groups, booking) => {
                  // check_in_date를 YYYY-MM-DD 형식으로 변환
                  const date = new Date(booking.check_in_date).toISOString().split('T')[0];
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(booking);
                  return groups;
                }, {} as Record<string, TicketBooking[]>);
                
                console.log('날짜별 그룹화된 데이터:', groupedByDate);
                
                console.log('최종 그룹화된 데이터:', groupedByDate);

                // 선택된 월 기준으로 달력 생성
                const now = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                // 이번 달의 첫 번째 날
                const firstDay = new Date(currentYear, currentMonth, 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작
                
                // 6주 표시를 위해 42일 생성
                const calendarDays = [];
                for (let i = 0; i < 42; i++) {
                  const date = new Date(startDate);
                  date.setDate(startDate.getDate() + i);
                  calendarDays.push(date);
                }

                const monthNames = [
                  '1월', '2월', '3월', '4월', '5월', '6월',
                  '7월', '8월', '9월', '10월', '11월', '12월'
                ];

                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

                return (
                  <div className="space-y-4">
                    {/* 달력 헤더 */}
                    <div className="flex items-center justify-between">
                          <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="이전 달"
                          >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                          </button>
                      
                      <div className="text-center">
                        <h4 className="text-xl font-semibold text-gray-900">
                          {currentYear}년 {monthNames[currentMonth]}
                        </h4>
                          <button
                          onClick={goToToday}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                          >
                          오늘로 이동
                          </button>
                      </div>
                      
                          <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="다음 달"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1">
                      {dayNames.map((day) => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((date, index) => {
                        const dateString = date.toISOString().split('T')[0];
                        const isCurrentMonth = date.getMonth() === currentMonth;
                        const isToday = date.toDateString() === now.toDateString();
                        const dayBookings = groupedByDate[dateString] || [];
                        const totalQuantity = dayBookings.reduce((sum, booking) => sum + booking.ea, 0);
                        
                        // 해당 날짜의 투어 이벤트 조회
                        const dayTours = tourEvents.filter(tour => tour.tour_date === dateString);
                        
                        // 디버깅: 해당 날짜에 부킹이 있는지 확인
                        if (dayBookings.length > 0) {
                          console.log(`${dateString}에 부킹 ${dayBookings.length}개:`, dayBookings);
                        }
                        
                        // 디버깅: 해당 날짜에 투어가 있는지 확인
                        if (dayTours.length > 0) {
                          console.log(`${dateString}에 투어 ${dayTours.length}개:`, dayTours);
                        }

                        return (
                          <div
                            key={index}
                            className={`min-h-[160px] p-2 border border-gray-200 ${
                              isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                            } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <div className={`text-sm font-medium mb-1 ${
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            } ${isToday ? 'text-blue-600' : ''}`}>
                              {date.getDate()}
                            </div>
                            
                            {/* 투어 이벤트 정보 */}
                            {dayTours.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {dayTours.map((tour, tourIndex) => (
                  <div
                    key={tourIndex}
                    className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-[8px] sm:text-[10px] font-medium cursor-pointer hover:bg-purple-200 transition-colors"
                    title={`${tour.products?.name || '투어'} - 성인:${tour.adults}명, 아동:${tour.child}명, 유아:${tour.infant}명 (총 ${tour.total_people}명) (클릭하여 상세보기)`}
                    onClick={() => handleTourClick(tour.id)}
                  >
                    <div className="truncate">
                      {(() => {
                        const tourName = tour.products?.name || '투어';
                        const totalPeople = tour.total_people;
                        const child = tour.child || 0;
                        const infant = tour.infant || 0;
                        
                        // 아동이나 유아가 있을 때만 괄호 안에 표시
                        if (child > 0 || infant > 0) {
                          const childText = child > 0 ? `아동${child}` : '';
                          const infantText = infant > 0 ? `유아${infant}` : '';
                          const additionalText = [childText, infantText].filter(Boolean).join(' ');
                          return `${tourName} ${totalPeople}명 (${additionalText})`;
                        } else {
                          // 성인만 있을 경우
                          return `${tourName} ${totalPeople}명`;
                        }
                      })()}
                    </div>
                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* 부킹 정보 라벨 */}
                            {dayBookings.length > 0 && (
                              <div className="space-y-0.5">
                                <div className="text-xs text-blue-600 font-semibold">
                                  총 {totalQuantity}개
                                </div>
                                {(() => {
                                  // 공급업체별로 그룹화하고 시간순으로 정렬
                                  const supplierGroups = dayBookings.reduce((groups, booking) => {
                                    const company = booking.company;
                                    if (!groups[company]) {
                                      groups[company] = [];
                                    }
                                    groups[company].push(booking);
                                    return groups;
                                  }, {} as Record<string, TicketBooking[]>);

                                  // 각 공급업체별로 시간순 정렬
                                  Object.keys(supplierGroups).forEach(company => {
                                    supplierGroups[company].sort((a, b) => a.time.localeCompare(b.time));
                                  });

                                  // 공급업체별로 정렬 (시간순)
                                  const sortedSuppliers = Object.keys(supplierGroups).sort((a, b) => {
                                    const aTime = supplierGroups[a][0].time;
                                    const bTime = supplierGroups[b][0].time;
                                    return aTime.localeCompare(bTime);
                                  });

                                  return sortedSuppliers.map((company) => {
                                    const companyBookings = supplierGroups[company];
                                    const companyTotal = companyBookings.reduce((sum, booking) => sum + booking.ea, 0);
                                    const firstBooking = companyBookings[0];
                                    
                                    // 공급업체별 색상 구분 (투어 연결 상태 고려)
                                    let companyBgColor = '';
                                    const hasTourConnection = companyBookings.some(booking => booking.tour_id);
                                    
                                    if (company === 'SEE CANYON') {
                                      companyBgColor = hasTourConnection ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-600';
                                    } else if (company === 'Antelope X') {
                                      companyBgColor = hasTourConnection ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-600';
                                    } else {
                                      companyBgColor = hasTourConnection ? getStatusColor(firstBooking.status) : 'bg-gray-100 text-gray-600';
                                    }

                                    return (
                                      <div
                                        key={company}
                                        className={`px-0.5 py-0 rounded truncate ${companyBgColor} text-[8px] sm:text-[12px] cursor-pointer hover:opacity-80`}
                                        title={`${company} - ${companyBookings.map(b => `${b.category} (${b.ea}개)`).join(', ')}`}
                                        onClick={() => handleBookingClick(companyBookings)}
                                      >
                                        <div className="block sm:hidden">
                                          <div className="font-bold">{firstBooking.time.replace(/:\d{2}$/, '')}</div>
                                          <div>{companyTotal}개 ({companyBookings.length})</div>
                                        </div>
                                        <div className="hidden sm:block">
                                          <span className="font-bold">{firstBooking.time.replace(/:\d{2}$/, '')}</span> <span>{companyTotal}개</span> <span>({companyBookings.length})</span>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 범례 */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">상태 범례</div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          대기중
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          확정
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          취소
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          완료
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">투어 이벤트</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            투어명 인원수
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">공급업체 구분</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-200 text-blue-800">
                            L (SEE CANYON) - 투어 연결됨
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-600">
                            L (SEE CANYON) - 투어 미연결
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                            X (Antelope X) - 투어 연결됨
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600">
                            X (Antelope X) - 투어 미연결
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                      <p className="text-sm text-gray-600">{booking.company}</p>
                      <p className="text-xs text-gray-500 mt-1">{booking.reservation_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">제출일</span>
                      <span className="font-medium">{booking.submit_on}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">시간</span>
                      <span className="font-medium">{booking.time}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">수량</span>
                      <span className="font-medium">{booking.ea}개</span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">단가</span>
                        <span className="font-medium">${booking.unit_price}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">총액</span>
                        <span className="font-medium text-blue-600">${booking.total_price}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-sm">
                        <span className="text-gray-500">결제 방법</span>
                        <div className="mt-1 font-medium">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                          {getCCStatusText(booking.cc)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-sm">
                        <span className="text-gray-500">투어 연결</span>
                        <div className="mt-1">
                          {booking.tours ? (
                            <div>
                              <div className="font-medium">{booking.tours.tour_date}</div>
                              <div className="text-xs text-gray-500">
                                {booking.tours.products?.name || '상품명 없음'}
                              </div>
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 mt-1">
                                연결됨
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-400">투어 미연결</span>
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 mt-1">
                                미연결
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          booking={editingBooking as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSave={handleSave as any}
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

      {/* 부킹 상세 모달 */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">예약 상세 정보</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 선택된 예약들을 시간순으로 정렬하여 표시 */}
              <div className="space-y-1">
                {selectedBookings
                  .sort((a, b) => a.time.localeCompare(b.time)) // 시간순 정렬
                  .map((booking) => (
                    <div key={booking.id} className={`rounded border p-2 hover:opacity-90 transition-opacity ${
                      booking.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                      booking.status === 'confirmed' ? 'bg-green-50 border-green-200' :
                      booking.status === 'cancelled' ? 'bg-red-50 border-red-200' :
                      booking.status === 'completed' ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        {/* 왼쪽: 기본 정보 */}
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                          <div>
                            <div className="text-gray-500 text-xs">제출일</div>
                            <div className="font-medium text-xs">
                              {(() => {
                                const date = new Date(booking.submit_on);
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const year = date.getFullYear();
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                return `${month}/${day}/${year} ${hours}:${minutes}`;
                              })()}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">카테고리</div>
                            <div className="font-medium truncate text-sm">{booking.category}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">공급업체</div>
                            <div className="font-medium truncate text-sm">{booking.company}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">예약자</div>
                            <div className="font-medium truncate text-sm">{booking.reservation_name}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">시간</div>
                            <div className="font-medium text-sm">{booking.time.replace(/:\d{2}$/, '')}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">수량/가격</div>
                            <div className="font-medium text-sm">{booking.ea}개 / ${booking.total_price}</div>
                          </div>
                        </div>

                        {/* 오른쪽: 상태 및 액션 */}
                        <div className="flex items-center space-x-2 ml-2">
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                              {getStatusText(booking.status)}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                              {getCCStatusText(booking.cc)}
                            </span>
                          </div>
                          
                          {/* 투어 연결 정보 */}
                          <div className="text-right min-w-[80px]">
                            {booking.tours ? (
                              <div>
                                <div className="text-xs text-green-600 font-medium">투어 연결</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {booking.tours.products?.name || '상품명 없음'}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-red-500">미연결</div>
                            )}
                          </div>

                          {/* 액션 버튼들 */}
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingBooking(booking);
                                setShowForm(true);
                                setShowBookingModal(false);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                              title="편집"
                            >
                              편집
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBookingId(booking.id);
                                setShowHistory(true);
                                setShowBookingModal(false);
                              }}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                              title="히스토리"
                            >
                              히스토리
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(booking.id);
                                setShowBookingModal(false);
                              }}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                              title="삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}