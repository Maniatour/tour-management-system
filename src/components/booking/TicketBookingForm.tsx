'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay';
import { fetchUploadApi } from '@/lib/uploadClient';
import { useLocale, useTranslations } from 'next-intl';
import {
  TICKET_BOOKING_STATUS_VALUES,
  formatTicketBookingStatusLabel,
  normalizeTicketBookingStatusForSave,
  normalizeTicketBookingStatusFromDb,
} from '@/lib/ticketBookingStatus';
import TicketBookingActionPanel from '@/components/booking/TicketBookingActionPanel';
import {
  axisSnapshotFromLegacyTicketBookingStatus,
  deriveLegacyTicketBookingStatusFromAxes,
  type TicketBookingAxisSnapshotRequired,
} from '@/lib/ticketBookingLegacyAxisMap';
import {
  getTicketBookingTimeSelectOptions,
  normalizeDbTimeToTicketSelectSlot,
} from '@/lib/ticketBookingTimeSelect';
import { fetchTicketToursForCheckIn } from '@/lib/ticketBookingToursForCheckIn';

/** 원격 DB에 ticket_bookings.zelle_confirmation_number 가 아직 없을 때 PostgREST PGRST204 */
function isMissingZelleConfirmationColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === 'PGRST204' &&
    typeof e.message === 'string' &&
    e.message.includes('zelle_confirmation_number')
  );
}

/**
 * 한 번 스키마에 컬럼이 없다고 확인되면, 같은 탭 세션 동안은 Zelle 필드를 보내지 않음.
 * (매 저장마다 400 → 재시도 PATCH가 나가는 것을 막음. 마이그레이션 적용 후에는 새로고침하면 다시 전송됨.)
 */
let omitZelleConfirmationInTicketBookingsPayload = false;

/** 새 입장권 부킹 추가 시 초기값 (편집 모드에서는 기존 booking이 덮어씀) */
const DEFAULT_NEW_TICKET_BOOKING_CATEGORY = 'antelope_canyon';
/** `getCancelDeadlineDays` 등과 동일하게 DB·로직에서 쓰는 표기 */
const DEFAULT_NEW_TICKET_BOOKING_COMPANY = 'SEE CANYON';

interface TicketBooking {
  id?: string;
  category: string;
  submitted_by: string;
  check_in_date: string;
  time: string;
  company: string;
  ea: number;
  expense: number;
  income: number;
  payment_method: string;
  rn_number: string;
  invoice_number?: string;
  /** Zelle 결제 시 Confirmation 번호 */
  zelle_confirmation_number?: string | null;
  tour_id: string | null;
  reservation_id?: string; // 예약 ID 추가
  note: string;
  status: string;
  season: string;
  supplier_product_id?: string; // 공급업체 상품 ID 추가
  uploaded_files?: File[]; // 파일 업로드 필드 추가
  uploaded_file_urls?: string[]; // 업로드된 파일 URL들
  deletion_requested_at?: string | null;
  deletion_requested_by?: string | null;
  booking_status?: string | null;
  vendor_status?: string | null;
  change_status?: string | null;
  payment_status?: string | null;
  refund_status?: string | null;
  operation_status?: string | null;
}

function initialAxesForTicketBookingEdit(b?: TicketBooking): TicketBookingAxisSnapshotRequired | null {
  if (!b?.id) return null;
  const bs = b.booking_status;
  if (bs != null && String(bs).trim() !== '') {
    return {
      booking_status: String(bs),
      vendor_status: String(b.vendor_status ?? 'pending'),
      change_status: String(b.change_status ?? 'none'),
      payment_status: String(b.payment_status ?? 'not_due'),
      refund_status: String(b.refund_status ?? 'none'),
      operation_status: String(b.operation_status ?? 'none'),
    };
  }
  return axisSnapshotFromLegacyTicketBookingStatus(
    String(normalizeTicketBookingStatusFromDb(b.status ?? ''))
  );
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

interface SupplierProduct {
  id: string;
  supplier_id: string;
  ticket_name: string;
  regular_price: number;
  supplier_price: number;
  season_price: number | null;
  entry_times: string[] | null;
  season_dates: any;
  suppliers: Supplier;
}

interface TicketBookingFormProps {
  booking?: TicketBooking;
  onSave: (booking: TicketBooking) => void;
  onCancel: () => void;
  /** Super만 사용. 삭제 요청된 건을 실제 삭제 */
  onDelete?: (id: string) => void;
  /** 사용자 삭제 요청 (실제 삭제는 하지 않음) */
  onRequestDelete?: (id: string) => void;
  /** OP·매니저 등 삭제 요청 버튼 표시 (미설정 시 요청 버튼 숨김) */
  canRequestSoftDelete?: boolean;
  /** Super 권한 여부 */
  isSuper?: boolean;
  tourId?: string;
  /** true면 6축 워크플로 액션 패널 숨김 (스케줄 달력 등 — 상태·벤더는 달력 셀에서 관리) */
  hideAxisActionPanel?: boolean;
}

export default function TicketBookingForm({ 
  booking, 
  onSave, 
  onCancel,
  onDelete,
  onRequestDelete,
  canRequestSoftDelete = false,
  isSuper,
  tourId,
  hideAxisActionPanel = false,
}: TicketBookingFormProps) {
  const t = useTranslations('booking.ticketBooking');
  const tCal = useTranslations('booking.calendar');
  const locale = useLocale();
  const [formData, setFormData] = useState<TicketBooking>(() => {
    console.log('편집 모드 - 전달받은 booking 데이터:', booking);
    
    const initialData = {
      category: DEFAULT_NEW_TICKET_BOOKING_CATEGORY,
      submitted_by: '',
      check_in_date: '',
      time: '',
      company: DEFAULT_NEW_TICKET_BOOKING_COMPANY,
      ea: 1,
      expense: 0,
      income: 0,
      payment_method: '',
      rn_number: '',
      invoice_number: '',
      zelle_confirmation_number: '',
      tour_id: tourId || null,
      reservation_id: '',
      note: '',
      status: 'tentative',
      season: 'no', // 시즌 아님으로 기본값 변경
      uploaded_files: [], // 파일 업로드 필드 추가
      uploaded_file_urls: [] // 업로드된 파일 URL들
    };

    if (booking) {
      const mergedData = {
        ...initialData,
        ...booking,
        // 명시적으로 각 필드를 설정하여 undefined 값 처리
        category: booking.category ?? initialData.category,
        check_in_date: booking.check_in_date ?? initialData.check_in_date,
        time: normalizeDbTimeToTicketSelectSlot(booking.time) || initialData.time,
        company: booking.company ?? initialData.company,
        ea: booking.ea ?? initialData.ea,
        expense: booking.expense ?? initialData.expense,
        income: booking.income ?? initialData.income,
        payment_method: booking.payment_method ?? initialData.payment_method,
        rn_number: booking.rn_number ?? initialData.rn_number,
        invoice_number: (booking as { invoice_number?: string }).invoice_number ?? initialData.invoice_number ?? '',
        zelle_confirmation_number:
          (booking as { zelle_confirmation_number?: string | null }).zelle_confirmation_number ??
          initialData.zelle_confirmation_number ??
          '',
        tour_id: booking.tour_id ?? tourId ?? initialData.tour_id,
        reservation_id: booking.reservation_id ?? initialData.reservation_id,
        note: booking.note ?? initialData.note,
        status: String(normalizeTicketBookingStatusFromDb(booking.status ?? '')),
        season: booking.season ?? initialData.season,
      };
      
      console.log('편집 모드 - 최종 formData:', mergedData);
      return mergedData;
    }
    
    return initialData;
  });

  const [axisSnapshot, setAxisSnapshot] = useState<TicketBookingAxisSnapshotRequired | null>(() =>
    initialAxesForTicketBookingEdit(booking)
  );

  useEffect(() => {
    setAxisSnapshot(initialAxesForTicketBookingEdit(booking));
  }, [booking?.id]);

  const refreshAxesFromDb = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('ticket_bookings')
      .select(
        'status, booking_status, vendor_status, change_status, payment_status, refund_status, operation_status'
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return;
    const d = data as Record<string, unknown>;
    setAxisSnapshot({
      booking_status: String(d.booking_status ?? 'requested'),
      vendor_status: String(d.vendor_status ?? 'pending'),
      change_status: String(d.change_status ?? 'none'),
      payment_status: String(d.payment_status ?? 'not_due'),
      refund_status: String(d.refund_status ?? 'none'),
      operation_status: String(d.operation_status ?? 'none'),
    });
    setFormData((prev) => ({
      ...prev,
      status: String(normalizeTicketBookingStatusFromDb(String(d.status ?? ''))),
    }));
  }, []);

  interface Tour {
    id: string;
    tour_date: string;
    tour_end_datetime?: string | null;
    tour_status?: string | null;
    product_id: string | null;
    tour_guide_id?: string | null;
    assistant_id?: string | null;
    products?: {
      name: string;
    };
    /** 드롭다운 표시용 (team 조회 후 채움) */
    guide_display?: string;
    assistant_display?: string;
  }

  interface Reservation {
    id: string;
    tour_date: string;
    status: string;
    product_id: string | null;
    products?: {
      name: string;
    };
  }

  const [tours, setTours] = useState<Tour[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const prevCheckInYmdRef = useRef<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [paymentMethodsList, setPaymentMethodsList] = useState<Array<{ id: string; method: string; display_name: string | null }>>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [useSupplierTicket, setUseSupplierTicket] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [newCompanyValue, setNewCompanyValue] = useState('');
  const [showNewPaymentMethodInput, setShowNewPaymentMethodInput] = useState(false);
  const [newPaymentMethodValue, setNewPaymentMethodValue] = useState('');
  
  // 파일 업로드 관련 상태
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchCompanies();
    fetchPaymentMethods();
    fetchSupplierProducts();
  }, []);

  /** 체크인이 투어 달력 구간(시작~종료일)에 포함되는 투어 (선택 tour는 구간 밖이어도 병합) */
  useEffect(() => {
    const tourIdToMerge = formData.tour_id ?? null;
    void fetchTours(formData.check_in_date, tourIdToMerge);
    // 투어 드롭다운 값만 바꿀 때는 재조회하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formData.tour_id 제외
  }, [formData.check_in_date]);

  /** 예약 선택: 체크인일과 동일한 tour_date 행만 조회 (날짜 변경 시 예약 연결 초기화) */
  useEffect(() => {
    const ymd = String(formData.check_in_date ?? '').trim().slice(0, 10);
    const prev = prevCheckInYmdRef.current;

    let mergeReservationId: string | null =
      (formData.reservation_id && String(formData.reservation_id).trim()) || null;
    if (prev !== null && prev !== ymd) {
      mergeReservationId = null;
      setFormData((p) => ({ ...p, reservation_id: '' }));
    }
    prevCheckInYmdRef.current = ymd || null;

    if (!ymd) {
      setReservations([]);
      return;
    }
    void fetchReservationsForCheckIn(ymd, mergeReservationId);
  }, [formData.check_in_date]);

  // 제출자 이메일: 새 부킹일 때만 로그인 사용자 이메일로 자동 설정
  useEffect(() => {
    if (booking?.submitted_by) return;
    let mounted = true;
    (async () => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      if (mounted && session?.user?.email) {
        setFormData(prev => ({ ...prev, submitted_by: session.user.email }));
      }
    })();
    return () => { mounted = false; };
  }, [booking?.submitted_by]);

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('payment_methods')
        .select('id, method, display_name, card_holder_name, user_email')
        .eq('status', 'active')
        .order('display_name');
      if (error) throw error;
      const rows = data || [];
      const emails = [
        ...new Set(rows.map((r: any) => String(r.user_email || '').toLowerCase()).filter(Boolean)),
      ];
      let teamMap = new Map<
        string,
        { nick_name?: string | null; name_en?: string | null; name_ko?: string | null }
      >();
      if (emails.length > 0) {
        const { data: teams } = await (supabase as any)
          .from('team')
          .select('email, nick_name, name_en, name_ko')
          .in('email', emails);
        teamMap = new Map(
          (teams || []).map((t: any) => [String(t.email).toLowerCase(), t])
        );
      }
      setPaymentMethodsList(
        rows.map((r: any) => {
          const em = r.user_email ? String(r.user_email).toLowerCase() : '';
          const team = em ? teamMap.get(em) : undefined;
          const label = formatPaymentMethodDisplay(
            {
              id: r.id,
              method: r.method,
              display_name: r.display_name,
              user_email: r.user_email,
              card_holder_name: r.card_holder_name,
            },
            team
              ? {
                  nick_name: team.nick_name ?? null,
                  name_en: team.name_en ?? null,
                  name_ko: team.name_ko ?? null,
                }
              : undefined
          );
          return {
            id: r.id,
            method: r.method,
            display_name: label,
          };
        })
      );
    } catch (error) {
      console.error('결제 방법 목록 조회 오류:', error);
    }
  };

  const handleAddPaymentMethod = async () => {
    const methodName = newPaymentMethodValue.trim();
    if (!methodName) return;
    try {
      const id = `PAYM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, method: methodName, method_type: 'other', status: 'active' })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add payment method');
      await fetchPaymentMethods();
      setFormData(prev => ({ ...prev, payment_method: methodName }));
      setNewPaymentMethodValue('');
      setShowNewPaymentMethodInput(false);
    } catch (error) {
      console.error('결제 방법 추가 오류:', error);
      alert(typeof error === 'object' && error && 'message' in error ? String((error as Error).message) : '결제 방법 추가에 실패했습니다.');
    }
  };

  const fetchTours = async (checkInDate: string, tourIdToMerge: string | null) => {
    try {
      if (!checkInDate || !String(checkInDate).trim()) {
        setTours([]);
        setToursLoading(false);
        return;
      }
      setToursLoading(true);
      const rows = await fetchTicketToursForCheckIn(supabase as any, checkInDate, tourIdToMerge);
      setTours(rows as Tour[]);
    } catch (error) {
      console.error('투어 목록 조회 오류:', error);
    } finally {
      setToursLoading(false);
    }
  };

  /** 체크인 날짜와 같은 tour_date 예약만 (편집 시 목록에 없으면 mergeReservationId 한 건 병합) */
  const fetchReservationsForCheckIn = async (checkInYmd: string, mergeReservationId?: string | null) => {
    try {
      const ymd = String(checkInYmd ?? '').trim().slice(0, 10);
      if (!ymd) {
        setReservations([]);
        return;
      }

      setReservationsLoading(true);
      console.log('예약 목록 조회 (체크인일 일치):', ymd);

      const { data: reservationsData, error: reservationsError } = await (supabase as any)
        .from('reservations')
        .select(
          `
          id,
          tour_date,
          status,
          product_id
        `
        )
        .eq('tour_date', ymd)
        .order('id', { ascending: true });

      if (reservationsError) {
        console.error('예약 목록 조회 오류:', reservationsError);
        throw reservationsError;
      }

      let typedReservationsData = (reservationsData || []) as Reservation[];
      const ids = new Set(typedReservationsData.map((r) => r.id));
      const merge = mergeReservationId && String(mergeReservationId).trim();
      if (merge && !ids.has(merge)) {
        const { data: extra, error: exErr } = await (supabase as any)
          .from('reservations')
          .select(`id, tour_date, status, product_id`)
          .eq('id', merge)
          .maybeSingle();
        if (!exErr && extra) {
          typedReservationsData = [...typedReservationsData, extra as Reservation];
        }
      }

      if (typedReservationsData.length === 0) {
        setReservations([]);
        return;
      }

      const reservationsWithProductId = typedReservationsData.filter((reservation: Reservation) => reservation.product_id);
      
      if (reservationsWithProductId.length === 0) {
        setReservations(typedReservationsData);
        return;
      }

      // 모든 product_id를 한 번에 조회
      const productIds = [...new Set(reservationsWithProductId.map((reservation: Reservation) => reservation.product_id).filter(Boolean))] as string[];
      
      const { data: productsData, error: productsError } = await (supabase as any)
        .from('products')
        .select(`
          id,
          name
        `)
        .in('id', productIds);

      if (productsError) {
        console.warn('상품 정보 조회 오류:', productsError);
        setReservations(typedReservationsData);
        return;
      }

      // products 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const productsMap = new Map<string, { id: string; name: string }>();
      ((productsData || []) as Array<{ id: string; name: string }>).forEach((product: { id: string; name: string }) => {
        productsMap.set(product.id, product);
      });

      // 예약 데이터에 상품 정보 추가
      const reservationsWithProducts = typedReservationsData.map((reservation: Reservation) => {
        if (reservation.product_id && productsMap.has(reservation.product_id)) {
          const product = productsMap.get(reservation.product_id)!;
          return {
            ...reservation,
            products: {
              name: product.name
            }
          };
        }
        return reservation;
      });

      console.log('예약 목록 조회 성공:', reservationsWithProducts);
      setReservations(reservationsWithProducts);
    } catch (error) {
      console.error('예약 목록 조회 오류:', error);
    } finally {
      setReservationsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('ticket_bookings')
        .select('category')
        .not('category', 'is', null)
        .order('category');
      
      if (error) throw error;
      const uniqueCategories = [...new Set((data as Array<{ category: string }>)?.map((item: { category: string }) => item.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('카테고리 목록 조회 오류:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('ticket_bookings')
        .select('company')
        .not('company', 'is', null)
        .order('company');
      
      if (error) throw error;
      const uniqueCompanies = [...new Set((data as Array<{ company: string }>)?.map((item: { company: string }) => item.company) || [])];
      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error('공급업체 목록 조회 오류:', error);
    }
  };

  const fetchSupplierProducts = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('supplier_products')
        .select(`
          *,
          suppliers (
            id,
            name,
            contact_person,
            phone,
            email
          )
        `)
        .eq('is_active', true)
        .order('ticket_name');
      
      if (error) throw error;
      setSupplierProducts(data || []);
    } catch (error) {
      console.error('공급업체 상품 목록 조회 오류:', error);
    }
  };

  const createSupplierTicketPurchase = async (bookingId: string, supplierProductId: string, quantity: number) => {
    try {
      const selectedProduct = supplierProducts.find(p => p.id === supplierProductId);
      if (!selectedProduct) return;

      const isSeasonPrice = checkIfSeasonPrice(selectedProduct);
      const finalPrice = isSeasonPrice ? (selectedProduct.season_price || selectedProduct.supplier_price) : selectedProduct.supplier_price;
      const totalAmount = finalPrice * quantity;

      const purchaseData = {
        supplier_id: selectedProduct.supplier_id,
        supplier_product_id: supplierProductId,
        booking_id: bookingId,
        quantity: quantity,
        unit_price: finalPrice,
        total_amount: totalAmount,
        is_season_price: isSeasonPrice,
        purchase_date: formData.check_in_date,
        payment_status: 'pending',
        notes: `부킹 ID: ${bookingId}`
      };

      const { error } = await (supabase as any)
        .from('supplier_ticket_purchases')
        .insert([purchaseData]);

      if (error) throw error;
    } catch (error) {
      console.error('공급업체 티켓 구매 기록 생성 오류:', error);
    }
  };

  const checkIfSeasonPrice = (product: SupplierProduct) => {
    if (!product.season_dates || !product.season_price || !Array.isArray(product.season_dates)) return false;
    
    const today = new Date().toISOString().split('T')[0];
    
    return product.season_dates.some((period: any) => {
      return today >= period.start && today <= period.end;
    });
  };

  // 시즌 여부 확인 함수 (check_in_date 기준)
  const checkIfSeason = (checkInDate: string): boolean => {
    if (!checkInDate) return false;
    
    // supplier_product_id가 있으면 해당 product의 season_dates 확인
    if (formData.supplier_product_id) {
      const selectedProduct = supplierProducts.find(p => p.id === formData.supplier_product_id);
      if (selectedProduct?.season_dates && Array.isArray(selectedProduct.season_dates)) {
        const checkIn = new Date(checkInDate);
        checkIn.setHours(0, 0, 0, 0);
        
        return selectedProduct.season_dates.some((period: any) => {
          const start = new Date(period.start);
          const end = new Date(period.end);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          return checkIn >= start && checkIn <= end;
        });
      }
    }
    
    // supplier_product_id가 없으면 formData.season 필드 사용
    return formData.season === 'yes';
  };

  // 취소 기한 일수 계산 함수
  const getCancelDeadlineDays = (company: string, checkInDate: string): number => {
    if (!company || !checkInDate) return 0;
    
    const isSeason = checkIfSeason(checkInDate);
    
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
  const getCancelDueDate = (): string | null => {
    if (!formData.check_in_date || !formData.company) return null;
    
    const cancelDeadlineDays = getCancelDeadlineDays(formData.company, formData.check_in_date);
    
    if (cancelDeadlineDays === 0) return null;
    
    const checkInDate = new Date(formData.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    
    const cancelDueDate = new Date(checkInDate);
    cancelDueDate.setDate(cancelDueDate.getDate() - cancelDeadlineDays);
    
    return cancelDueDate.toISOString().split('T')[0];
  };

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...(prev.uploaded_files || []), ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: (prev.uploaded_files || []).filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      alert('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...(prev.uploaded_files || []), ...validFiles]
      }))
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...(prev.uploaded_files || []), ...files]
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category?.trim()) {
      alert('카테고리를 선택하거나 새로 추가해주세요.');
      return;
    }
    if (!formData.company?.trim()) {
      alert('공급업체를 선택하거나 새로 추가해주세요.');
      return;
    }
    if (!formData.submitted_by?.trim()) {
      alert('로그인이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해주세요.');
      return;
    }
    setLoading(true);

    try {
       // 파일 업로드 처리
       let newUploadedUrls: string[] = []
       if (formData.uploaded_files && formData.uploaded_files.length > 0) {
         setIsUploading(true)
         try {
           const uploadFormData = new FormData()
           uploadFormData.append('bucketType', 'ticket_bookings')
           formData.uploaded_files.forEach(file => {
             uploadFormData.append('files', file)
           })

           const uploadResponse = await fetchUploadApi(uploadFormData)

           const uploadResult = await uploadResponse.json().catch(() => ({}))
           if (!uploadResponse.ok) {
             const msg =
               typeof uploadResult?.error === 'string'
                 ? uploadResult.error
                 : '파일 업로드에 실패했습니다.'
             console.error('파일 업로드 실패', uploadResponse.status, msg)
             alert(msg)
             setLoading(false)
             return
           }
           newUploadedUrls = Array.isArray(uploadResult.urls) ? uploadResult.urls : []
         } finally {
           setIsUploading(false)
         }
       }

      const tourId = formData.tour_id && formData.tour_id.trim() !== '' ? formData.tour_id : null;
      const reservationId = formData.reservation_id && formData.reservation_id.trim() !== '' ? formData.reservation_id : null;

      const existingFileUrls = Array.isArray(formData.uploaded_file_urls)
        ? formData.uploaded_file_urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '')
        : []
      const mergedFileUrls = [...existingFileUrls, ...newUploadedUrls]

      const zelleDb =
        formData.zelle_confirmation_number?.trim() ? formData.zelle_confirmation_number.trim() : null

      const normalizedStatus = String(normalizeTicketBookingStatusForSave(formData.status));
      /** 새 부킹: 예매 요청 · 벤더 응답 대기만 두고 나머지 축은 기본값 */
      const axesForInsert = booking?.id
        ? axisSnapshotFromLegacyTicketBookingStatus(normalizedStatus)
        : {
            booking_status: 'requested',
            vendor_status: 'pending',
            change_status: 'none',
            payment_status: 'not_due',
            refund_status: 'none',
            operation_status: 'none',
          };
      const legacyForInsert = deriveLegacyTicketBookingStatusFromAxes(
        axesForInsert.booking_status,
        axesForInsert.vendor_status,
        axesForInsert.change_status,
        axesForInsert.payment_status,
        axesForInsert.refund_status,
        axesForInsert.operation_status
      );

      // DB에 없는 필드(supplier_product_id, uploaded_files 등)를 제거한 payload만 전송 (400 방지)
      const dbPayloadBase = {
        category: formData.category,
        submitted_by: formData.submitted_by,
        check_in_date: formData.check_in_date,
        time: formData.time,
        company: formData.company,
        ea: formData.ea,
        expense: formData.expense,
        income: formData.income,
        payment_method: formData.payment_method || null,
        rn_number: formData.rn_number || null,
        invoice_number: formData.invoice_number?.trim() ? formData.invoice_number.trim() : null,
        ...(omitZelleConfirmationInTicketBookingsPayload
          ? {}
          : { zelle_confirmation_number: zelleDb }),
        tour_id: tourId,
        reservation_id: reservationId,
        note: formData.note || null,
        season: formData.season || null,
        uploaded_file_urls: mergedFileUrls.length ? mergedFileUrls : null
      };

      const dbPayloadInsert = {
        ...dbPayloadBase,
        ...axesForInsert,
        status: legacyForInsert,
      };

      console.log('전송할 데이터:', booking?.id ? dbPayloadBase : dbPayloadInsert);

      let authSession = (await supabase.auth.getSession()).data.session;
      if (!authSession?.access_token) {
        const { data } = await supabase.auth.refreshSession();
        authSession = data.session ?? null;
      }
      if (!authSession?.access_token) {
        alert(
          locale === 'ko'
            ? '로그인 세션이 없거나 아직 붙지 않았습니다. 잠시 후 다시 시도하거나 페이지를 새로고침해 주세요.'
            : 'Your session is not ready or has expired. Wait a moment or refresh the page and try again.'
        );
        setLoading(false);
        return;
      }

      // getSession()만 쓰면 로컬 캐시/레이스로 JWT가 비어 RLS(ticket_bookings 등)가 실패할 수 있음 — 서버 검증으로 동기화
      const { error: verifyUserErr } = await supabase.auth.getUser();
      if (verifyUserErr) {
        alert(
          locale === 'ko'
            ? '로그인 정보를 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
            : 'Could not verify your login. Refresh the page and try again.'
        );
        setLoading(false);
        return;
      }

      let error;
      let savedId: string | undefined;
      let savedRow: Record<string, unknown> | undefined;
      if (booking?.id) {
        // 수정인 경우 — 레거시 status·다축은 apply_ticket_booking_action 으로만 바꿈 (여기서는 제외)
        console.log('수정 모드 - ID:', booking.id);
        const updateData = {
          category: dbPayloadBase.category,
          check_in_date: dbPayloadBase.check_in_date,
          time: dbPayloadBase.time,
          company: dbPayloadBase.company,
          ea: dbPayloadBase.ea,
          expense: dbPayloadBase.expense,
          income: dbPayloadBase.income,
          payment_method: dbPayloadBase.payment_method,
          rn_number: dbPayloadBase.rn_number,
          invoice_number: dbPayloadBase.invoice_number,
          ...(omitZelleConfirmationInTicketBookingsPayload
            ? {}
            : { zelle_confirmation_number: zelleDb }),
          tour_id: dbPayloadBase.tour_id,
          reservation_id: dbPayloadBase.reservation_id,
          note: dbPayloadBase.note,
          season: dbPayloadBase.season,
          uploaded_file_urls: dbPayloadBase.uploaded_file_urls
        };
        console.log('업데이트할 데이터:', updateData);

        let updateError = (
          await (supabase as any).from('ticket_bookings').update(updateData).eq('id', booking.id)
        ).error;
        if (isMissingZelleConfirmationColumnError(updateError)) {
          omitZelleConfirmationInTicketBookingsPayload = true;
          console.warn(
            '[ticket_bookings] zelle_confirmation_number 컬럼이 스키마에 없어 해당 필드 없이 다시 저장합니다. ' +
              'supabase/migrations/20260401160000_ticket_bookings_zelle_confirmation_number.sql 을 적용하면 Zelle 확인#도 저장됩니다.'
          );
          const { zelle_confirmation_number: _z, ...withoutZelle } = updateData;
          updateError = (
            await (supabase as any).from('ticket_bookings').update(withoutZelle).eq('id', booking.id)
          ).error;
        }
        error = updateError;
        savedId = booking.id;
      } else {
        // 새로 생성은 서버 API에서 인증 확인 후 service role로 insert (브라우저 RLS 세션 레이스 방지)
        console.log('새로 생성 모드');
        const apiRes = await fetch('/api/ticket-bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify(dbPayloadInsert),
        });
        const apiJson = await apiRes.json().catch(() => ({}));
        if (!apiRes.ok) {
          error = new Error(
            typeof apiJson?.error === 'string'
              ? apiJson.error
              : '입장권 부킹을 생성할 수 없습니다'
          );
        } else {
          savedId = apiJson.ticketBooking?.id;
          savedRow = apiJson.ticketBooking as Record<string, unknown> | undefined;
        }
      }

      if (error) throw error;

      // 공급업체 티켓을 사용한 경우 구매 기록 생성
      if (formData.supplier_product_id && savedId) {
        await createSupplierTicketPurchase(savedId, formData.supplier_product_id, formData.ea);
      }

      const resultBooking: TicketBooking = {
        ...formData,
        ...(savedId ? { id: savedId } : {}),
        tour_id: tourId,
        ...(reservationId ? { reservation_id: reservationId } : {}),
        uploaded_file_urls: mergedFileUrls,
        uploaded_files: [],
      };
      if (savedRow && typeof savedRow === 'object') {
        resultBooking.status = String(
          normalizeTicketBookingStatusFromDb(String(savedRow.status ?? formData.status))
        );
        if (savedRow.booking_status != null)
          resultBooking.booking_status = String(savedRow.booking_status);
        if (savedRow.vendor_status != null)
          resultBooking.vendor_status = String(savedRow.vendor_status);
        if (savedRow.change_status != null)
          resultBooking.change_status = String(savedRow.change_status);
        if (savedRow.payment_status != null)
          resultBooking.payment_status = String(savedRow.payment_status);
        if (savedRow.refund_status != null)
          resultBooking.refund_status = String(savedRow.refund_status);
        if (savedRow.operation_status != null)
          resultBooking.operation_status = String(savedRow.operation_status);
      } else if (!booking?.id) {
        resultBooking.status = legacyForInsert;
        resultBooking.booking_status = axesForInsert.booking_status;
        resultBooking.vendor_status = axesForInsert.vendor_status;
        resultBooking.change_status = axesForInsert.change_status;
        resultBooking.payment_status = axesForInsert.payment_status;
        resultBooking.refund_status = axesForInsert.refund_status;
        resultBooking.operation_status = axesForInsert.operation_status;
      }
      onSave(resultBooking);
    } catch (error) {
      console.error('입장권 부킹 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'ea' || name === 'expense' || name === 'income' ? Number(value) : value
    }));

  };


  const handleDateChange = (field: string, direction: 'up' | 'down') => {
    const currentDate = new Date(formData[field as keyof TicketBooking] as string);
    if (isNaN(currentDate.getTime())) return;

    const newDate = new Date(currentDate);
    if (direction === 'up') {
      newDate.setDate(currentDate.getDate() + 1);
    } else {
      newDate.setDate(currentDate.getDate() - 1);
    }

    const formattedDate = newDate.toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      [field]: formattedDate
    }));
  };

  return (
    <div className="space-y-3 sm:space-y-4">
        <form onSubmit={handleSubmit}>
          {/* 공급업체 티켓 사용 여부 선택 - 모바일 최적화 */}
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center mb-2 sm:mb-3">
              <input
                type="checkbox"
                id="useSupplierTicket"
                checked={useSupplierTicket}
                onChange={(e) => {
                  setUseSupplierTicket(e.target.checked);
                  if (!e.target.checked) {
                    setFormData(prev => {
                      const { supplier_product_id, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
                className="mr-2"
              />
              <label htmlFor="useSupplierTicket" className="text-sm font-medium text-blue-800">
                {t('useSupplierTicket')}
              </label>
            </div>
            <p className="text-xs text-blue-600">
              {t('useSupplierTicketDesc')}
            </p>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {/* ① 카테고리 | 공급업체 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('category')} *
              </label>
              {showNewCategoryInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = newCategoryValue.trim();
                        if (v) {
                          if (!categories.includes(v)) setCategories(prev => [...prev].concat(v).sort());
                          setFormData(prev => ({ ...prev, category: v }));
                          setNewCategoryValue('');
                          setShowNewCategoryInput(false);
                        }
                      }
                      if (e.key === 'Escape') setShowNewCategoryInput(false);
                    }}
                    placeholder={t('categoryPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    disabled={useSupplierTicket}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newCategoryValue.trim();
                      if (v) {
                        if (!categories.includes(v)) setCategories(prev => [...prev].concat(v).sort());
                        setFormData(prev => ({ ...prev, category: v }));
                        setNewCategoryValue('');
                        setShowNewCategoryInput(false);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    {t('add')}
                  </button>
                  <button type="button" onClick={() => setShowNewCategoryInput(false)} className="px-3 py-2 border rounded-md text-sm">
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <select
                  name="category"
                  value={formData.category}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__new__') {
                      setShowNewCategoryInput(true);
                      return;
                    }
                    setFormData(prev => ({ ...prev, category: v }));
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={useSupplierTicket}
                >
                  <option value="">{t('selectCategory')}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new__">➕ {t('addNew')}</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplier')} *
              </label>
              {showNewCompanyInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCompanyValue}
                    onChange={(e) => setNewCompanyValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = newCompanyValue.trim();
                        if (v) {
                          if (!companies.includes(v)) setCompanies(prev => [...prev].concat(v).sort());
                          setFormData(prev => ({ ...prev, company: v }));
                          setNewCompanyValue('');
                          setShowNewCompanyInput(false);
                        }
                      }
                      if (e.key === 'Escape') setShowNewCompanyInput(false);
                    }}
                    placeholder={t('supplierPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    disabled={useSupplierTicket}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newCompanyValue.trim();
                      if (v) {
                        if (!companies.includes(v)) setCompanies(prev => [...prev].concat(v).sort());
                        setFormData(prev => ({ ...prev, company: v }));
                        setNewCompanyValue('');
                        setShowNewCompanyInput(false);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    {t('add')}
                  </button>
                  <button type="button" onClick={() => setShowNewCompanyInput(false)} className="px-3 py-2 border rounded-md text-sm">
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <select
                  name="company"
                  value={formData.company}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__new__') {
                      setShowNewCompanyInput(true);
                      return;
                    }
                    setFormData(prev => ({ ...prev, company: v }));
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={useSupplierTicket}
                >
                  <option value="">{t('selectCompany')}</option>
                  {companies.map((comp) => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                  <option value="__new__">➕ {t('addNew')}</option>
                </select>
              )}
            </div>
            </div>

            {/* 카탈로그 티켓 선택 (전체 너비) */}
            {useSupplierTicket && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  공급업체 티켓 선택 *
                </label>
                <select
                  name="supplier_product_id"
                  value={formData.supplier_product_id || ''}
                  onChange={(e) => {
                    const selectedProduct = supplierProducts.find(p => p.id === e.target.value);
                    if (selectedProduct) {
                      setFormData(prev => ({
                        ...prev,
                        supplier_product_id: e.target.value,
                        category: selectedProduct.ticket_name,
                        company: selectedProduct.suppliers.name,
                        time: selectedProduct.entry_times && selectedProduct.entry_times.length > 0 ? selectedProduct.entry_times[0] : prev.time,
                        expense: selectedProduct.supplier_price,
                        income: selectedProduct.regular_price
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, supplier_product_id: e.target.value }));
                    }
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">공급업체 티켓을 선택하세요</option>
                  {supplierProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.suppliers.name} - {product.ticket_name} 
                      (정가: ${product.regular_price} → 제공가: ${product.supplier_price})
                      {product.entry_times && product.entry_times.length > 0 && ` - 입장시간: ${product.entry_times.join(', ')}`}
                    </option>
                  ))}
                </select>
                {formData.supplier_product_id && (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-800">
                      <p><strong>선택된 티켓:</strong> {supplierProducts.find(p => p.id === formData.supplier_product_id)?.ticket_name}</p>
                      <p><strong>공급업체:</strong> {supplierProducts.find(p => p.id === formData.supplier_product_id)?.suppliers.name}</p>
                      <p><strong>정가:</strong> ${supplierProducts.find(p => p.id === formData.supplier_product_id)?.regular_price}</p>
                      <p><strong>제공가:</strong> ${supplierProducts.find(p => p.id === formData.supplier_product_id)?.supplier_price}</p>
                      {(() => {
                        const entryTimes = supplierProducts.find(p => p.id === formData.supplier_product_id)?.entry_times
                        return Array.isArray(entryTimes) && entryTimes.length > 0 ? (
                          <p><strong>입장시간:</strong> {entryTimes.join(', ')}</p>
                        ) : null
                      })()}
                      {supplierProducts.find(p => p.id === formData.supplier_product_id)?.season_price && (
                        <p><strong>시즌가:</strong> ${supplierProducts.find(p => p.id === formData.supplier_product_id)?.season_price}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ② 체크인 | 시간 | 수량 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('checkInDate')} *
                {formData.check_in_date && formData.company && (() => {
                  const cancelDueDate = getCancelDueDate();
                  if (cancelDueDate) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDate = new Date(cancelDueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const isOverdue = dueDate < today;
                    
                    return (
                      <span className={`ml-2 text-xs font-normal ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                        (Cancel Due: {cancelDueDate})
                      </span>
                    );
                  }
                  return null;
                })()}
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="check_in_date"
                  value={formData.check_in_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleDateChange('check_in_date', 'up')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800"
                    title="다음 날"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateChange('check_in_date', 'down')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800"
                    title="이전 날"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('time')} *
              </label>
              <select
                name="time"
                value={formData.time || ''}
                onChange={handleChange}
                required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('selectTime')}</option>
                {getTicketBookingTimeSelectOptions().map(({ value, bg, text }) => (
                  <option key={value} value={value} style={{ backgroundColor: bg, color: text }}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('quantity')} *
              </label>
              <input
                type="number"
                name="ea"
                value={formData.ea}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            </div>

            {/* ③ 비용 | 수입 | 결제 방법 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('costUsd')}
              </label>
              <input
                type="number"
                name="expense"
                value={formData.expense}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('revenueUsd')}
              </label>
              <input
                type="number"
                name="income"
                value={formData.income}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('paymentMethod')}
              </label>
              {showNewPaymentMethodInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPaymentMethodValue}
                    onChange={(e) => setNewPaymentMethodValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentMethod();
                      }
                      if (e.key === 'Escape') setShowNewPaymentMethodInput(false);
                    }}
                    placeholder={t('paymentMethod')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    {t('add')}
                  </button>
                  <button type="button" onClick={() => { setShowNewPaymentMethodInput(false); setNewPaymentMethodValue(''); }} className="px-3 py-2 border rounded-md text-sm">
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <select
                  name="payment_method"
                  value={formData.payment_method || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__new__') {
                      setShowNewPaymentMethodInput(true);
                      return;
                    }
                    setFormData(prev => ({ ...prev, payment_method: v }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('select')}</option>
                  {paymentMethodsList.map((pm) => (
                    <option key={pm.id} value={pm.method}>{pm.display_name || pm.method}</option>
                  ))}
                  <option value="__new__">➕ {t('addNew')}</option>
                </select>
              )}
            </div>
            </div>

            {/* ④ RN# | Invoice# | Zelle 확인 번호 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RN#
              </label>
              <input
                type="text"
                name="rn_number"
                value={formData.rn_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice#
              </label>
              <input
                type="text"
                name="invoice_number"
                value={formData.invoice_number || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Invoice#"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('zelleConfirmationNumber')}
              </label>
              <input
                type="text"
                name="zelle_confirmation_number"
                value={formData.zelle_confirmation_number || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('zelleConfirmationPlaceholder')}
                autoComplete="off"
              />
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{t('zelleConfirmationHint')}</p>
            </div>
            </div>

            {/* ⑤a 투어 선택 | 예약 선택 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('selectTourOptional')}
              </label>
              <select
                name="tour_id"
                value={formData.tour_id || ''}
                onChange={handleChange}
                disabled={Boolean(formData.check_in_date?.trim()) && toursLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">{t('selectTourPlaceholder')}</option>
                {!formData.check_in_date?.trim() ? (
                  <option value="" disabled>
                    {t('enterCheckInToLoadTours')}
                  </option>
                ) : toursLoading ? (
                  <option value="" disabled>
                    {t('loadingTourOptions')}
                  </option>
                ) : tours.length > 0 ? (
                  tours.map((tour) => {
                    const productName =
                      tour.products?.name ||
                      (locale === 'ko' ? '상품명 없음' : 'No product');
                    const g = tour.guide_display?.trim();
                    const a = tour.assistant_display?.trim();
                    const nameParts = [g, a].filter(Boolean) as string[];
                    const label =
                      nameParts.length > 0
                        ? `${tour.tour_date} ${productName}, ${nameParts.join(', ')}`
                        : `${tour.tour_date} ${productName}`;
                    return (
                      <option key={tour.id} value={tour.id}>
                        {label}
                      </option>
                    );
                  })
                ) : (
                  <option value="" disabled>
                    {t('noToursInCheckInWindow')}
                  </option>
                )}
              </select>
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                {t('selectTourHelpText')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('selectReservationOptional')}
              </label>
              <select
                name="reservation_id"
                value={formData.reservation_id || ''}
                onChange={handleChange}
                disabled={
                  Boolean(formData.tour_id) ||
                  !formData.check_in_date?.trim() ||
                  reservationsLoading
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">{t('selectReservationPlaceholder')}</option>
                {!formData.check_in_date?.trim() ? (
                  <option value="" disabled>
                    {t('enterCheckInToLoadReservations')}
                  </option>
                ) : reservationsLoading ? (
                  <option value="" disabled>
                    {t('loadingReservationOptions')}
                  </option>
                ) : reservations.length > 0 ? (
                  reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.id} - {reservation.tour_date} -{' '}
                      {reservation.products?.name || (locale === 'ko' ? '상품명 없음' : 'No product')} (
                      {reservation.status})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {t('noReservationsForCheckInDate')}
                  </option>
                )}
              </select>
              <p className="text-[11px] mt-0.5 leading-snug text-gray-500">
                {!formData.tour_id
                  ? t('selectReservationHelpText')
                  : t('selectReservationDisabledWhenTour')}
              </p>
            </div>
            </div>

            {/* ⑤b 상태 | 시즌 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('status')}
              </label>
              {booking?.id ? (
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-800">
                    {formatTicketBookingStatusLabel(formData.status, tCal, locale)}
                  </p>
                  <p className="text-xs text-gray-600 leading-snug">
                    {hideAxisActionPanel
                      ? locale === 'ko'
                        ? '예약·벤더 상태는 스케줄 달력 부킹 상세 줄에서 변경할 수 있습니다.'
                        : 'Change booking and vendor status from the schedule calendar booking row.'
                      : locale === 'ko'
                        ? '상태 단계 변경은 아래 액션으로 진행합니다. 목록·통계의 상세 모달에서도 동일하게 사용할 수 있습니다.'
                        : 'Use the actions below to advance workflow stages. The same actions are available from the list and stats detail modals.'}
                  </p>
                  {!hideAxisActionPanel && axisSnapshot && booking.id ? (
                    <TicketBookingActionPanel
                      bookingId={booking.id}
                      axes={axisSnapshot}
                      onApplied={() => {
                        void refreshAxesFromDb(booking.id as string);
                      }}
                    />
                  ) : null}
                </div>
              ) : (
                <select
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TICKET_BOOKING_STATUS_VALUES.map((sv) => (
                    <option key={sv} value={sv}>
                      {formatTicketBookingStatusLabel(sv, tCal, locale)}
                    </option>
                  ))}
                  {formData.status &&
                  !(TICKET_BOOKING_STATUS_VALUES as readonly string[]).includes(formData.status) ? (
                    <option value={formData.status}>{formData.status}</option>
                  ) : null}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('season')}
              </label>
              <select
                name="season"
                value={formData.season || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="no">{t('seasonNo')}</option>
                <option value="yes">{t('seasonYes')}</option>
              </select>
            </div>
            </div>

            {/* ⑥ 메모 | 관련 문서 첨부 */}
            <div className="ticket-form-row grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3 lg:items-stretch">
            <div className="flex flex-col min-h-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('memo')}
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                className="w-full min-h-[12rem] flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y box-border"
                placeholder={t('memoPlaceholder')}
              />
            </div>

            {/* 파일 업로드 섹션 */}
            <div className="flex flex-col min-h-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attachDocuments')}
              </label>
            <div 
              className={`min-h-[12rem] flex flex-col border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                isUploading 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                  : isDragOver 
                    ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
              }`}
              onDragOver={!isUploading ? handleDragOver : undefined}
              onDragEnter={!isUploading ? handleDragEnter : undefined}
              onDragLeave={!isUploading ? handleDragLeave : undefined}
              onDrop={!isUploading ? handleDrop : undefined}
              onPaste={!isUploading ? handlePaste : undefined}
              tabIndex={!isUploading ? 0 : -1}
              onClick={!isUploading ? () => document.getElementById('ticket_file_upload')?.click() : undefined}
            >
              <div className="flex flex-1 flex-col items-center justify-center space-y-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isUploading 
                    ? 'bg-blue-100' 
                    : isDragOver 
                      ? 'bg-blue-200' 
                      : 'bg-gray-100'
                }`}>
                  {isUploading ? (
                    <div className="animate-spin">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                  ) : isDragOver ? (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium transition-colors ${
                    isDragOver ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {isUploading 
                      ? t('uploading') 
                      : isDragOver 
                        ? t('dropFilesHere') 
                        : t('dragOrClickFiles')
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('orPasteClipboard')}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {t('supportedFormats')}
                </div>
              </div>
              
              <input
                id="ticket_file_upload"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {/* 업로드된 파일 목록 */}
              {formData.uploaded_files && formData.uploaded_files.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium mb-3 text-gray-900">{t('uploadedFiles')} ({formData.uploaded_files.length})</h4>
                  <div className="space-y-2">
                    {formData.uploaded_files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                            {file.type.startsWith('image/') ? (
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(index)
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            {booking?.id && (() => {
              const bookingId = booking.id;
              return (
              <div className="flex items-center gap-2">
                {isSuper && booking.deletion_requested_at && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('정말로 이 부킹을 삭제하시겠습니까? (실제 삭제)')) {
                        onDelete(bookingId);
                      }
                    }}
                    className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800"
                  >
                    {t('deleteActual')}
                  </button>
                )}
                {!booking.deletion_requested_at && onRequestDelete && canRequestSoftDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('deleteRequestConfirm'))) {
                        onRequestDelete(bookingId);
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
                  >
                    {t('deleteRequest')}
                  </button>
                )}
                {booking.deletion_requested_at && !isSuper && (
                  <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded">
                    {t('deleteRequestedWaiting')}
                  </span>
                )}
              </div>
              );
            })()}
            <div className="flex space-x-3 ml-auto">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}
