'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import TicketBookingForm from './TicketBookingForm';
import BookingHistory from './BookingHistory';
import { Grid, Calendar as CalendarIcon, Plus, Search, Calendar, Table } from 'lucide-react';

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
  expense?: number;
  income?: number;
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
      name_en?: string;
    } | undefined;
  } | undefined;
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
    name_en?: string;
  };
}

export default function TicketBookingList() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('booking.calendar');
  const [bookings, setBookings] = useState<TicketBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TicketBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [tourFilter, setTourFilter] = useState('all'); // 'all', 'connected', 'unconnected'
  const [futureEventFilter, setFutureEventFilter] = useState(false);
  const [cancelDeadlineFilter, setCancelDeadlineFilter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'calendar' | 'table'>('calendar');
  const [sortField, setSortField] = useState<'date' | 'submit_on' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [teamMemberMap, setTeamMemberMap] = useState<Map<string, string>>(new Map());
  type SeasonDate = { start: string; end: string };
  const [supplierProductsMap, setSupplierProductsMap] = useState<Map<string, { season_dates: SeasonDate[] | null }>>(new Map());
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const statusButtonRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

  // 상품 이름을 로케일에 따라 반환하는 함수
  const getProductName = (product: { name?: string; name_en?: string; name_ko?: string } | undefined) => {
    if (!product) return t('tour');
    
    if (locale === 'en') {
      // 영어 로케일인 경우
      if (product.name_en && product.name_en !== product.name) {
        return product.name_en;
      }
      
      // name_en이 없거나 한국어와 동일한 경우, 한국어 이름을 영어로 변환
      const koreanToEnglish: { [key: string]: string } = {
        '야경투어': 'Night Tour',
        '그랜드서클': 'Grand Circle',
        '도깨비 그랜드캐년 일출 투어': 'Goblin Grand Canyon Sunrise Tour',
        '웨스트림': 'West Rim',
        '공항 픽업 서비스': 'Airport Pickup Service',
        '불의 계곡': 'Valley of Fire',
        '그랜드캐년': 'Grand Canyon',
        '자이언 캐니언': 'Zion Canyon',
        '브라이스 캐니언': 'Bryce Canyon',
        '라스베가스': 'Las Vegas',
        '앤텔롭 캐니언': 'Antelope Canyon',
        '후버댐': 'Hoover Dam',
        '데쓰밸리': 'Death Valley',
        '모뉴먼트 밸리': 'Monument Valley',
        '그랜드서클 1박 2일 투어': 'Grand Circle 1 Night 2 Days Tour',
        '그랜드서클 당일 투어': 'Grand Circle Day Tour',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤틸롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 X': 'Goblin Grand Canyon Sunrise Tour + Antelope X Canyon',
        '도깨비 프라이빗': 'Goblin Private Tour',
        '2박3일': '2 Nights 3 Days',
        '엔텔롭캐년': 'Antelope Canyon',
        '앤텔롭캐년': 'Antelope Canyon',
        '앤틸롭캐년': 'Antelope Canyon'
      };
      
      return koreanToEnglish[product.name || ''] || product.name || t('tour');
    } else {
      // 한국어 로케일인 경우
      return product.name_ko || product.name || t('tour');
    }
  };
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

      // supplier_ticket_purchases를 통해 supplier_product 정보 조회
      if (bookingsData && bookingsData.length > 0) {
        try {
          const bookingIds = bookingsData.map((b: TicketBooking) => b.id);
          const { data: purchasesData } = await supabase
            .from('supplier_ticket_purchases')
            .select(`
              booking_id,
              supplier_product_id,
              supplier_products (
                id,
                season_dates
              )
            `)
            .in('booking_id', bookingIds);

          if (purchasesData) {
            const productMap = new Map<string, { season_dates: SeasonDate[] | null }>();
            purchasesData.forEach((purchase: { booking_id: string; supplier_products?: { season_dates: SeasonDate[] | null } }) => {
              if (purchase.booking_id && purchase.supplier_products) {
                productMap.set(purchase.booking_id, {
                  season_dates: purchase.supplier_products.season_dates
                });
              }
            });
            setSupplierProductsMap(productMap);
            console.log('Supplier products 매핑:', productMap);
          }
        } catch (error) {
          console.warn('Supplier product 정보 조회 오류:', error);
        }
      }

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
            name,
            name_en
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

      // submitted_by 이메일로 team 테이블에서 name_ko 조회
      const submittedByEmails = [...new Set(
        (bookingsData || [])
          .map((booking: TicketBooking) => booking.submitted_by)
          .filter((email): email is string => !!email && typeof email === 'string' && email.includes('@'))
      )];

      console.log('조회할 submitted_by 이메일들:', submittedByEmails);

      if (submittedByEmails.length > 0) {
        try {
          // team 테이블에서 email 컬럼으로 검색 (대소문자 구분 없이)
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('email, name_ko')
            .in('email', submittedByEmails);

          if (!teamError && teamData) {
            const emailToNameMap = new Map<string, string>();
            (teamData || []).forEach((member: { email: string; name_ko: string | null }) => {
              if (member.email && member.name_ko) {
                // 이메일을 소문자로 변환하여 저장 (대소문자 구분 없이 매칭)
                emailToNameMap.set(member.email.toLowerCase(), member.name_ko);
              }
            });
            setTeamMemberMap(emailToNameMap);
            console.log('Team 멤버 매핑 (submitted_by -> name_ko):', emailToNameMap);
          } else {
            console.warn('Team 정보 조회 오류:', teamError);
            setTeamMemberMap(new Map());
          }
        } catch (error) {
          console.error('Team 정보 조회 중 오류:', error);
          setTeamMemberMap(new Map());
        }
      } else {
        setTeamMemberMap(new Map());
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!openStatusDropdown) return;

    const handleClickOutside = () => {
      setOpenStatusDropdown(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openStatusDropdown]);

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

  // 시즌 여부 확인 함수 (check_in_date 기준)
  const checkIfSeason = (checkInDate: string, supplierProduct?: { season_dates: SeasonDate[] | null }): boolean => {
    if (!checkInDate || !supplierProduct?.season_dates) return false;
    
    const seasonDates = supplierProduct.season_dates;
    if (!Array.isArray(seasonDates)) return false;
    
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    
    return seasonDates.some((period: { start: string; end: string }) => {
      const start = new Date(period.start);
      const end = new Date(period.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return checkIn >= start && checkIn <= end;
    });
  };

  // 취소 기한 계산 함수
  const getCancelDeadlineDays = (company: string, checkInDate: string, supplierProduct?: { season_dates: SeasonDate[] | null }): number => {
    const isSeason = checkIfSeason(checkInDate, supplierProduct);
    
    switch (company) {
      case 'Antelope X':
        return 4; // 시즌과 상관없이 4일전
      case 'SEE CANYON':
        return isSeason ? 5 : 4; // 시즌 = 5일전, 시즌이 아니면 4일전
      case 'Mei Tour':
        return isSeason ? 8 : 5; // 시즌 = 8일전, 시즌이 아니면 5일전
      default:
        return 0; // 알 수 없는 공급업체
    }
  };

  // Cancel Due 날짜 계산 함수
  const getCancelDueDate = (booking: TicketBooking): string | null => {
    if (!booking.check_in_date || !booking.company) return null;
    
    const supplierProduct = supplierProductsMap.get(booking.id);
    const cancelDeadlineDays = getCancelDeadlineDays(booking.company, booking.check_in_date, supplierProduct);
    
    if (cancelDeadlineDays === 0) return null;
    
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    
    const cancelDueDate = new Date(checkInDate);
    cancelDueDate.setDate(cancelDueDate.getDate() - cancelDeadlineDays);
    
    return cancelDueDate.toISOString().split('T')[0];
  };


  // Future Event 필터: 체크인 날짜가 오늘 이후인 예약만 표시
  const matchesFutureEvent = (booking: TicketBooking): boolean => {
    if (!futureEventFilter) return true;
    
    const checkInDate = booking.check_in_date ? new Date(booking.check_in_date) : null;
    if (!checkInDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    checkInDate.setHours(0, 0, 0, 0);
    
    return checkInDate >= today;
  };

  // 취소 기한 필터: 취소 기한 날짜가 오늘이거나 과거이고, 체크인 날짜가 오늘이거나 미래인 예약만 표시
  const matchesCancelDeadline = (booking: TicketBooking): boolean => {
    if (!cancelDeadlineFilter) return true;
    
    if (!booking.check_in_date || !booking.company) return false;
    
    const supplierProduct = supplierProductsMap.get(booking.id);
    const cancelDeadlineDays = getCancelDeadlineDays(booking.company, booking.check_in_date, supplierProduct);
    if (cancelDeadlineDays === 0) return false;
    
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    
    const cancelDeadline = new Date(checkInDate);
    cancelDeadline.setDate(cancelDeadline.getDate() - cancelDeadlineDays);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 취소 기한 날짜가 오늘이거나 과거이고, 체크인 날짜가 오늘이거나 미래인 예약만 표시
    // 조건: 취소 기한 날짜 <= 오늘 && 체크인 날짜 >= 오늘
    return cancelDeadline <= today && checkInDate >= today;
  };

  // 검색 필터
  const matchesSearch = (booking: TicketBooking): boolean => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (booking.category || '').toLowerCase().includes(searchLower) ||
      (booking.reservation_name || '').toLowerCase().includes(searchLower) ||
      (booking.rn_number || '').toLowerCase().includes(searchLower) ||
      (booking.company || '').toLowerCase().includes(searchLower)
    );
  };

  // 상태 필터
  const matchesStatus = (booking: TicketBooking): boolean => {
    if (statusFilter === 'all') return true;
    
    const bookingStatus = booking.status?.toLowerCase();
    if (statusFilter === 'cancelled') {
      return bookingStatus === 'cancelled' || bookingStatus === 'canceled';
    }
    if (statusFilter === 'confirmed') {
      return bookingStatus === 'confirmed';
    }
    
    return bookingStatus === statusFilter.toLowerCase();
  };

  // 제출일 필터
  const matchesDate = (booking: TicketBooking): boolean => {
    if (!dateFilter) return true;
    return booking.submit_on === dateFilter;
  };

  // 투어 연결 필터
  const matchesTour = (booking: TicketBooking): boolean => {
    if (tourFilter === 'all') return true;
    if (tourFilter === 'connected') return !!booking.tour_id;
    if (tourFilter === 'unconnected') return !booking.tour_id;
    return true;
  };

  // 모든 필터를 적용한 부킹 목록
  const filteredBookings = bookings.filter(booking => {
    return (
      matchesSearch(booking) &&
      matchesStatus(booking) &&
      matchesDate(booking) &&
      matchesTour(booking) &&
      matchesFutureEvent(booking) &&
      matchesCancelDeadline(booking)
    );
  });

  // 정렬된 부킹 목록
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'date') {
      const dateA = a.check_in_date 
        ? new Date(a.check_in_date).getTime() 
        : 0;
      const dateB = b.check_in_date 
        ? new Date(b.check_in_date).getTime() 
        : 0;
      
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortField === 'submit_on') {
      const dateA = a.submit_on ? new Date(a.submit_on).getTime() : 0;
      const dateB = b.submit_on ? new Date(b.submit_on).getTime() : 0;
      
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    return 0;
  });

  const handleSort = (field: 'date' | 'submit_on') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStatusChange = async (booking: TicketBooking, newStatus: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('ticket_bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (error) throw error;

      // 로컬 상태 업데이트
      setBookings(prev =>
        prev.map(b =>
          b.id === booking.id ? { ...b, status: newStatus } : b
        )
      );

      // 드롭다운 닫기
      setOpenStatusDropdown(null);
      setDropdownPosition(null);
    } catch (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const statusOptions = [
    { value: 'pending', label: '대기', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'confirmed', label: '확정', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: '취소', color: 'bg-red-100 text-red-800' },
    { value: 'completed', label: '완료', color: 'bg-blue-100 text-blue-800' },
    { value: 'credit', label: '크레딧', color: 'bg-cyan-100 text-cyan-800' },
    { value: 'cancellation_requested', label: '전체 취소 요청', color: 'bg-orange-100 text-orange-800' },
    { value: 'guest_change_requested', label: '인원 변경 요청', color: 'bg-purple-100 text-purple-800' },
    { value: 'time_change_requested', label: '시간 변경 요청', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'payment_requested', label: '결제 요청', color: 'bg-pink-100 text-pink-800' },
  ];

  const handleTourClick = (tourId: string) => {
    router.push(`/ko/admin/tours/${tourId}`);
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'credit': return 'bg-cyan-100 text-cyan-800';
      case 'cancellation_requested': return 'bg-orange-100 text-orange-800';
      case 'guest_change_requested': return 'bg-purple-100 text-purple-800';
      case 'time_change_requested': return 'bg-indigo-100 text-indigo-800';
      case 'payment_requested': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'pending': return t('pending');
      case 'confirmed': return t('confirmed');
      case 'cancelled':
      case 'canceled': return t('cancelled');
      case 'completed': return t('completed');
      case 'credit': return '크레딧';
      case 'cancellation_requested': return '전체 취소 요청';
      case 'guest_change_requested': return '인원 변경 요청';
      case 'time_change_requested': return '시간 변경 요청';
      case 'payment_requested': return '결제 요청';
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="flex items-center justify-between px-1 sm:px-6 py-4">
        <h2 className="text-lg sm:text-2xl font-bold">{t('ticketBookingManagement')}</h2>
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
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-base flex items-center space-x-1"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{t('addNewBooking')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일 최적화 */}
      <div className="px-1 sm:px-6 py-4">
        <div className="flex flex-row sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allStatus')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="cancelled">{t('cancelled')}</option>
              <option value="completed">{t('completed')}</option>
              <option value="credit">크레딧</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('tourConnection')}
            </label>
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allBookings')}</option>
              <option value="connected">{t('tourConnected')}</option>
              <option value="unconnected">{t('tourNotConnected')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('submissionDate')}
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

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              필터
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const newValue = !futureEventFilter;
                  setFutureEventFilter(newValue);
                  // 필터 활성화 시 자동으로 날짜순 정렬
                  if (newValue) {
                    setSortField('date');
                    setSortDirection('asc');
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  futureEventFilter
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Future Event
              </button>
              <button
                onClick={() => {
                  const newValue = !cancelDeadlineFilter;
                  setCancelDeadlineFilter(newValue);
                  // 필터 활성화 시 자동으로 날짜순 정렬
                  if (newValue) {
                    setSortField('date');
                    setSortDirection('asc');
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  cancelDeadlineFilter
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                취소 기한
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 표시 영역 */}
      <div className="px-1 sm:px-6">
        {viewMode === 'table' ? (
          <>
            {/* 상태 설명 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">상태 설명:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                    확정
                  </span>
                  <span className="text-xs text-gray-600">확정 예약으로 티켓값을 지불한 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
                    대기
                  </span>
                  <span className="text-xs text-gray-600">가예약으로 티켓값을 지불하기 전 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 whitespace-nowrap">
                    취소
                  </span>
                  <span className="text-xs text-gray-600">전체 취소된 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 whitespace-nowrap">
                    완료
                  </span>
                  <span className="text-xs text-gray-600">이벤트가 종료 된 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800 whitespace-nowrap">
                    크레딧
                  </span>
                  <span className="text-xs text-gray-600">날씨 등으로 인한 당일 크레딧 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 whitespace-nowrap">
                    전체 취소 요청
                  </span>
                  <span className="text-xs text-gray-600">전체 취소 요청 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 whitespace-nowrap">
                    인원 변경 요청
                  </span>
                  <span className="text-xs text-gray-600">인원 변경 요청 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">
                    시간 변경 요청
                  </span>
                  <span className="text-xs text-gray-600">시간 변경 요청 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-pink-100 text-pink-800 whitespace-nowrap">
                    결제 요청
                  </span>
                  <span className="text-xs text-gray-600">결제 요청 상태</span>
                </div>
              </div>
            </div>
            {/* 테이블 뷰 - 모바일 최적화 */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      상태
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      공급업체
                    </th>
                    <th 
                      className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>날짜</span>
                        {sortField === 'date' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시간
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      수량
                    </th>
                    <th className="hidden md:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cancel Due
                    </th>
                    <th className="hidden lg:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      비용(USD)
                    </th>
                    <th className="hidden lg:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      수입(USD)
                    </th>
                    <th className="hidden md:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RN#
                    </th>
                    <th className="hidden lg:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      결제방법
                    </th>
                    <th className="hidden md:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CC
                    </th>
                    <th className="hidden lg:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      투어연결
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                    <th 
                      className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('submit_on')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>제출일</span>
                        {sortField === 'submit_on' && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="hidden md:table-cell px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      예약자
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Cancel Due 날짜별로 그룹화하여 배경색 매핑 생성
                    const cancelDueColorMap = new Map<string, string>();
                    const backgroundColors = [
                      'bg-white',
                      'bg-blue-50',
                      'bg-green-50',
                      'bg-yellow-50',
                      'bg-purple-50',
                      'bg-pink-50',
                      'bg-indigo-50',
                      'bg-cyan-50',
                    ];
                    const hoverColors = [
                      'hover:bg-gray-50',
                      'hover:bg-blue-100',
                      'hover:bg-green-100',
                      'hover:bg-yellow-100',
                      'hover:bg-purple-100',
                      'hover:bg-pink-100',
                      'hover:bg-indigo-100',
                      'hover:bg-cyan-100',
                    ];
                    
                    let colorIndex = 0;
                    const usedDates = new Set<string>();
                    
                    // sortedBookings를 순회하면서 각 booking의 Cancel Due 날짜에 색상 할당
                    sortedBookings.forEach((booking) => {
                      const cancelDueDate = getCancelDueDate(booking);
                      if (cancelDueDate && !usedDates.has(cancelDueDate)) {
                        cancelDueColorMap.set(cancelDueDate, backgroundColors[colorIndex % backgroundColors.length]);
                        usedDates.add(cancelDueDate);
                        colorIndex++;
                      }
                    });
                    
                    return sortedBookings.map((booking) => {
                      const cancelDueDate = getCancelDueDate(booking);
                      const bgColor = cancelDueDate 
                        ? (cancelDueColorMap.get(cancelDueDate) || 'bg-white')
                        : 'bg-white';
                      const hoverColor = cancelDueDate
                        ? (hoverColors[backgroundColors.indexOf(bgColor)] || 'hover:bg-gray-50')
                        : 'hover:bg-gray-50';
                      
                      return (
                        <tr key={booking.id} className={`${bgColor} ${hoverColor} transition-colors`}>
                      <td className={`px-2 py-1.5 whitespace-nowrap text-xs sticky left-0 ${bgColor} z-10`}>
                        <div className="relative z-50">
                          <span 
                            ref={(el) => {
                              if (el) {
                                statusButtonRefs.current.set(booking.id, el);
                              } else {
                                statusButtonRefs.current.delete(booking.id);
                              }
                            }}
                            className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(booking.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const button = statusButtonRefs.current.get(booking.id);
                              if (button) {
                                const rect = button.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + 4,
                                  left: rect.left
                                });
                              }
                              setOpenStatusDropdown(openStatusDropdown === booking.id ? null : booking.id);
                            }}
                            title="클릭하여 상태 선택"
                          >
                            {getStatusText(booking.status)}
                          </span>
                          
                          {openStatusDropdown === booking.id && dropdownPosition && typeof window !== 'undefined' && createPortal(
                            <>
                              {/* 오버레이로 다른 요소 클릭 방지 */}
                              <div 
                                className="fixed inset-0 z-[9998]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenStatusDropdown(null);
                                  setDropdownPosition(null);
                                }}
                              />
                              <div 
                                className="fixed bg-black border-2 border-gray-600 rounded-lg shadow-2xl z-[9999] w-36 overflow-hidden"
                                style={{
                                  top: `${dropdownPosition.top}px`,
                                  left: `${dropdownPosition.left}px`
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {statusOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(booking, option.value);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-gray-800 transition-colors flex items-center gap-2 border-b border-gray-700 last:border-b-0 ${
                                      booking.status?.toLowerCase() === option.value ? 'bg-gray-900 font-semibold' : 'bg-black'
                                    }`}
                                  >
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${option.color}`}>
                                      {option.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">{booking.company}</div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">
                          {booking.check_in_date 
                            ? new Date(booking.check_in_date).toISOString().split('T')[0]
                            : '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">{booking.time?.replace(/:\d{2}$/, '') || '-'}</div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900 font-medium">{booking.ea}개</div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">
                          {(() => {
                            const cancelDueDate = getCancelDueDate(booking);
                            if (!cancelDueDate) return '-';
                            
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dueDate = new Date(cancelDueDate);
                            dueDate.setHours(0, 0, 0, 0);
                            
                            // 취소 기한이 지났으면 빨간색으로 표시
                            const isOverdue = dueDate < today;
                            
                            return (
                              <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                                {cancelDueDate}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">${booking.expense || '-'}</div>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">${booking.income || '-'}</div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">{booking.rn_number || '-'}</div>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                          {getCCStatusText(booking.cc)}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        {booking.tours && booking.tour_id ? (
                          <div 
                            className="text-gray-900 text-xs cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTourClick(booking.tour_id!);
                            }}
                            title="투어 상세 보기"
                          >
                            {getProductName(booking.tours.products)} {booking.tours.tour_date ? new Date(booking.tours.tour_date).toISOString().split('T')[0] : ''}
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs">미연결</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="flex space-x-0.5 relative z-20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(booking);
                            }}
                            className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors relative z-20"
                            title="편집"
                          >
                            편집
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewHistory(booking.id);
                            }}
                            className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors relative z-20"
                            title="히스토리"
                          >
                            히스토리
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">
                          {booking.submit_on ? new Date(booking.submit_on).toISOString().split('T')[0] : '-'}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="text-gray-900">
                          {(() => {
                            const submittedByEmail = booking.submitted_by?.toLowerCase() || '';
                            const nameKo = teamMemberMap.get(submittedByEmail);
                            // team 테이블에서 name_ko를 찾으면 표시, 없으면 submitted_by 이메일 표시
                            return nameKo || booking.submitted_by || '-';
                          })()}
                        </div>
                      </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {sortedBookings.length === 0 && (
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
          </>
        ) : viewMode === 'calendar' ? (
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
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const calendarDays: Date[] = [];
                
                // 월별 달력 뷰 (전체 월)
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                // 이번 달의 첫 번째 날
                const firstDay = new Date(currentYear, currentMonth, 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작
                
                // 6주 표시를 위해 42일 생성
                for (let i = 0; i < 42; i++) {
                  const date = new Date(startDate);
                  date.setDate(startDate.getDate() + i);
                  calendarDays.push(date);
                }

                const monthNames = t.raw('monthNames');
                const dayNames = t.raw('dayNames');

                return (
                  <div className="space-y-4">
                    {/* 달력 헤더 */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title={t('previousMonth')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="text-center">
                        <h4 className="text-xl font-semibold text-gray-900">
                          {currentYear} {monthNames[currentMonth]}
                        </h4>
                        <button
                          onClick={goToToday}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                        >
                          {t('goToToday')}
                        </button>
                      </div>
                      
                      <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title={t('nextMonth')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1">
                      {dayNames.map((day: string) => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* 달력 그리드 */}
                    <div className="grid gap-1 grid-cols-7">
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
                    title={`${getProductName(tour.products)} - ${t('adults')}:${tour.adults}${t('people')}, ${t('children')}:${tour.child}${t('people')}, ${t('infants')}:${tour.infant}${t('people')} (${t('total')} ${tour.total_people}${t('people')}) (Click for details)`}
                    onClick={() => handleTourClick(tour.id)}
                  >
                    <div className="truncate">
                      {(() => {
                        const tourName = getProductName(tour.products);
                        const totalPeople = tour.total_people;
                        const child = tour.child || 0;
                        const infant = tour.infant || 0;
                        
                        // 아동이나 유아가 있을 때만 괄호 안에 표시
                        if (child > 0 || infant > 0) {
                          const childText = child > 0 ? `${t('children')}${child}` : '';
                          const infantText = infant > 0 ? `${t('infants')}${infant}` : '';
                          const additionalText = [childText, infantText].filter(Boolean).join(' ');
                          return `${tourName} ${totalPeople}${t('people')} (${additionalText})`;
                        } else {
                          // 성인만 있을 경우
                          return `${tourName} ${totalPeople}${t('people')}`;
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
                                  {t('total')} {totalQuantity}{t('items')}
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
                                        title={`${company} - ${companyBookings.map(b => `${b.category} (${b.ea}${t('items')})`).join(', ')}`}
                                        onClick={() => handleBookingClick(companyBookings)}
                                      >
                                        <div className="block sm:hidden">
                                          <div className="font-bold">{firstBooking.time.replace(/:\d{2}$/, '')}</div>
                                          <div>{companyTotal}{t('items')} ({companyBookings.length})</div>
                                        </div>
                                        <div className="hidden sm:block">
                                          <span className="font-bold">{firstBooking.time.replace(/:\d{2}$/, '')}</span> <span>{companyTotal}{t('items')}</span> <span>({companyBookings.length})</span>
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
                      <div className="text-sm font-medium text-gray-700 mb-2">{t('statusLegend')}</div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {t('pending')}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {t('confirmed')}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {t('cancelled')}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {t('completed')}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">{t('tourEvents')}</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {t('tourNameAndPeople')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {t('supplierCategory')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">{t('supplierCategory')}</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-200 text-blue-800">
                            {t('seeCanyonConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-600">
                            {t('seeCanyonNotConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                            {t('antelopeXConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600">
                            {t('antelopeXNotConnected')}
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
                                {getProductName(booking.tours.products)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-xl font-semibold">
                {editingBooking ? '입장권 부킹 편집' : '새 입장권 부킹 추가'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBooking(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <TicketBookingForm
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                booking={editingBooking as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onSave={handleSave as any}
                onCancel={() => {
                  setShowForm(false);
                  setEditingBooking(null);
                }}
                onDelete={(id) => {
                  handleDelete(id);
                  setShowForm(false);
                  setEditingBooking(null);
                }}
              />
            </div>
          </div>
        </div>
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
                      booking.status === 'credit' ? 'bg-cyan-50 border-cyan-200' :
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
                                  {getProductName(booking.tours.products)}
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