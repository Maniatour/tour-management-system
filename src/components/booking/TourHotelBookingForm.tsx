'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchUploadApi } from '@/lib/uploadClient';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay';
import {
  fetchTicketToursForCheckIn,
  type TicketTourPickerRow,
} from '@/lib/ticketBookingToursForCheckIn';
import { SearchableTextSelect } from '@/components/booking/SearchableTextSelect';
import TourHotelReferenceManageModal from '@/components/booking/TourHotelReferenceManageModal';
import {
  addDaysToYmd,
  DEFAULT_TOUR_HOTEL_ROOM_TYPE,
  resolveHotelReferenceFields,
  TOUR_HOTEL_BOOKING_STATUS_OPTIONS,
  normalizeTourHotelBookingStatus,
  type TourHotelReference,
} from '@/lib/tourHotelReferences';

interface TourHotelBooking {
  id?: string;
  tour_id: string;
  /** DB NOT NULL — 폼에 필드가 없으면 check_in_date로 채움 */
  event_date?: string | null;
  check_in_date: string;
  check_out_date: string;
  reservation_name: string;
  submitted_by: string;
  cc: string;
  rooms: number;
  city: string;
  hotel: string;
  room_type: string;
  unit_price: number;
  total_price: number;
  payment_method: string;
  website: string;
  rn_number: string;
  status: string;
  uploaded_files?: File[]; // 파일 업로드 필드 추가
  uploaded_file_urls?: string[]; // 업로드된 파일 URL들
}

/** USD 금액 표시·저장용 2자리 반올림 (부동소수점 오차 제거) */
function roundUsdTotal(product: number): number {
  return Math.round(product * 100) / 100;
}


/** DB 컬럼만 전송 (File 등 클라이언트 전용 필드 제외) — 그대로내면 400 발생 */
function toTourHotelBookingRowPayload(
  formData: TourHotelBooking,
  newUploadedUrls: string[],
  submittedByEmail: string,
  replacesBookingId?: string
): Record<string, unknown> {
  const existingUrls = Array.isArray(formData.uploaded_file_urls)
    ? formData.uploaded_file_urls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];
  const tourIdRaw = formData.tour_id?.trim();
  const eventDate =
    (formData.event_date && String(formData.event_date).trim()) ||
    (formData.check_in_date && String(formData.check_in_date).trim()) ||
    null;

  const row: Record<string, unknown> = {
    tour_id: tourIdRaw ? tourIdRaw : null,
    event_date: eventDate,
    check_in_date: formData.check_in_date,
    check_out_date: formData.check_out_date,
    reservation_name: formData.reservation_name,
    submitted_by: submittedByEmail,
    cc: formData.cc?.trim() ? formData.cc : null,
    rooms: formData.rooms,
    city: formData.city,
    hotel: formData.hotel,
    room_type: formData.room_type?.trim() ? formData.room_type : null,
    unit_price: formData.unit_price,
    total_price: formData.total_price,
    payment_method: formData.payment_method?.trim() ? formData.payment_method : null,
    website: formData.website?.trim() ? formData.website : null,
    rn_number: formData.rn_number?.trim() ? formData.rn_number : null,
    status: formData.status,
  };

  if (replacesBookingId?.trim()) {
    row.replaces_booking_id = replacesBookingId.trim();
  }

  if (newUploadedUrls.length > 0) {
    row.uploaded_file_urls = [...existingUrls, ...newUploadedUrls];
  } else if (existingUrls.length > 0) {
    row.uploaded_file_urls = existingUrls;
  }

  return row;
}

function buildInitialFormData(
  tourId: string | undefined,
  booking?: TourHotelBooking,
  defaultTourDate?: string,
  seedBooking?: TourHotelBooking
): TourHotelBooking {
  const tourDate = String(defaultTourDate || '').trim().slice(0, 10);
  const empty: TourHotelBooking = {
    tour_id: tourId || '',
    event_date: tourDate || '',
    check_in_date: tourDate,
    check_out_date: tourDate ? addDaysToYmd(tourDate, 1) : '',
    reservation_name: '',
    submitted_by: '',
    cc: 'not_sent',
    rooms: 1,
    city: '',
    hotel: '',
    room_type: DEFAULT_TOUR_HOTEL_ROOM_TYPE,
    unit_price: 0,
    total_price: 0,
    payment_method: '',
    website: '',
    rn_number: '',
    status: 'confirmed',
    uploaded_files: [],
    uploaded_file_urls: [],
  };

  if (booking?.id) {
    return {
      ...empty,
      ...booking,
      tour_id: booking.tour_id ?? tourId ?? empty.tour_id,
      event_date: booking.event_date ?? null,
      check_in_date: booking.check_in_date ?? empty.check_in_date,
      check_out_date: booking.check_out_date ?? empty.check_out_date,
      reservation_name: booking.reservation_name ?? empty.reservation_name,
      submitted_by: booking.submitted_by ?? empty.submitted_by,
      cc: booking.cc ?? empty.cc,
      rooms: booking.rooms ?? empty.rooms,
      city: (booking.city != null ? String(booking.city).trim() : '') || empty.city,
      hotel: (booking.hotel != null ? String(booking.hotel).trim() : '') || empty.hotel,
      room_type: booking.room_type ?? empty.room_type,
      unit_price: booking.unit_price ?? empty.unit_price,
      total_price: booking.total_price ?? empty.total_price,
      payment_method: booking.payment_method ?? empty.payment_method,
      website: booking.website ?? empty.website,
      rn_number: booking.rn_number ?? empty.rn_number,
      status: normalizeTourHotelBookingStatus(booking.status),
      uploaded_file_urls: booking.uploaded_file_urls ?? empty.uploaded_file_urls,
      uploaded_files: [],
    } as TourHotelBooking;
  }

  if (seedBooking) {
    return {
      ...empty,
      ...seedBooking,
      tour_id: seedBooking.tour_id ?? tourId ?? empty.tour_id,
      event_date: seedBooking.event_date ?? seedBooking.check_in_date ?? empty.event_date,
      check_in_date: seedBooking.check_in_date ?? empty.check_in_date,
      check_out_date: seedBooking.check_out_date ?? empty.check_out_date,
      reservation_name: seedBooking.reservation_name ?? empty.reservation_name,
      cc: seedBooking.cc ?? empty.cc,
      rooms: seedBooking.rooms ?? empty.rooms,
      city: (seedBooking.city != null ? String(seedBooking.city).trim() : '') || empty.city,
      hotel: (seedBooking.hotel != null ? String(seedBooking.hotel).trim() : '') || empty.hotel,
      room_type: seedBooking.room_type ?? empty.room_type,
      unit_price: 0,
      total_price: 0,
      payment_method: seedBooking.payment_method ?? '',
      website: seedBooking.website ?? empty.website,
      rn_number: '',
      status: 'confirmed',
      uploaded_file_urls: [],
      uploaded_files: [],
    } as TourHotelBooking;
  }

  if (!booking) {
    return empty;
  }

  return {
    ...empty,
    ...booking,
    tour_id: booking.tour_id ?? tourId ?? empty.tour_id,
    event_date: booking.event_date ?? null,
    check_in_date: booking.check_in_date ?? empty.check_in_date,
    check_out_date: booking.check_out_date ?? empty.check_out_date,
    reservation_name: booking.reservation_name ?? empty.reservation_name,
    submitted_by: booking.submitted_by ?? empty.submitted_by,
    cc: booking.cc ?? empty.cc,
    rooms: booking.rooms ?? empty.rooms,
    city: (booking.city != null ? String(booking.city).trim() : '') || empty.city,
    hotel: (booking.hotel != null ? String(booking.hotel).trim() : '') || empty.hotel,
    room_type: booking.room_type ?? empty.room_type,
    unit_price: booking.unit_price ?? empty.unit_price,
    total_price: booking.total_price ?? empty.total_price,
    payment_method: booking.payment_method ?? empty.payment_method,
    website: booking.website ?? empty.website,
    rn_number: booking.rn_number ?? empty.rn_number,
    status: normalizeTourHotelBookingStatus(booking.status),
    uploaded_file_urls: booking.uploaded_file_urls ?? empty.uploaded_file_urls,
    uploaded_files: [],
  } as TourHotelBooking;
}

interface TourHotelBookingFormProps {
  booking?: TourHotelBooking;
  onSave: (booking: TourHotelBooking) => void;
  onCancel: () => void;
  tourId?: string;
  /** 투어 상세 모달 등에서 새 부킹 시 체크인 기본값 */
  defaultTourDate?: string;
  /** 모달 제목줄 왼쪽 (상태 버튼은 오른쪽 끝) */
  modalTitle?: string;
  /** 제목줄 오른쪽에 닫기(X) 버튼 표시 */
  showHeaderClose?: boolean;
  /** 취소된 부킹에서 이어서 새로 추가할 때 시드 데이터 */
  seedBooking?: TourHotelBooking;
  /** replaces_booking_id 로 저장 */
  replacesBookingId?: string;
}

export default function TourHotelBookingForm({ 
  booking, 
  onSave, 
  onCancel, 
  tourId,
  defaultTourDate,
  modalTitle,
  showHeaderClose = false,
  seedBooking,
  replacesBookingId,
}: TourHotelBookingFormProps) {
  const t = useTranslations('booking.tourHotelBooking');
  const locale = useLocale();
  const { authUser } = useAuth();
  const [formData, setFormData] = useState<TourHotelBooking>(() =>
    buildInitialFormData(tourId, booking, defaultTourDate, seedBooking)
  );

  useEffect(() => {
    setFormData(buildInitialFormData(tourId, booking, defaultTourDate, seedBooking));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- booking/seed 참조 불안정
  }, [booking?.id, tourId, defaultTourDate, seedBooking, replacesBookingId]);

  const [tours, setTours] = useState<TicketTourPickerRow[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [hotelReferences, setHotelReferences] = useState<TourHotelReference[]>([]);
  const [hotels, setHotels] = useState<string[]>([]);
  const [websites, setWebsites] = useState<string[]>([]);
  const [showHotelManageModal, setShowHotelManageModal] = useState(false);
  const [paymentMethodsList, setPaymentMethodsList] = useState<
    Array<{ id: string; method: string; display_name: string | null }>
  >([]);
  const [showNewPaymentMethodInput, setShowNewPaymentMethodInput] = useState(false);
  const [newPaymentMethodValue, setNewPaymentMethodValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWebsiteSuggestions, setShowWebsiteSuggestions] = useState(false);
  const [filteredWebsites, setFilteredWebsites] = useState<string[]>([]);
  
  // 파일 업로드 관련 상태
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
    fetchHotelReferences();
    fetchHotels();
    fetchWebsites();
    fetchPaymentMethods();
  }, []);

  /** 체크인이 투어 달력 구간(시작~종료일)에 포함되는 투어 (선택 tour는 구간 밖이어도 병합) */
  useEffect(() => {
    const tourIdToMerge = formData.tour_id ?? null;
    void fetchTours(formData.check_in_date, tourIdToMerge);
    // 투어 드롭다운 값만 바꿀 때는 재조회하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formData.tour_id 제외
  }, [formData.check_in_date]);

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method, display_name, card_holder_name, user_email')
        .eq('status', 'active')
        .order('display_name');
      if (error) throw error;
      const rows = data || [];
      const emails = [
        ...new Set(rows.map((r) => String(r.user_email || '').toLowerCase()).filter(Boolean)),
      ];
      let teamMap = new Map<
        string,
        { nick_name?: string | null; name_en?: string | null; name_ko?: string | null }
      >();
      if (emails.length > 0) {
        const { data: teams } = await supabase
          .from('team')
          .select('email, nick_name, name_en, name_ko')
          .in('email', emails);
        teamMap = new Map(
          (teams || []).map((t) => [String(t.email).toLowerCase(), t])
        );
      }
      setPaymentMethodsList(
        rows.map((r) => {
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
        body: JSON.stringify({ id, method: methodName, method_type: 'other', status: 'active' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add payment method');
      await fetchPaymentMethods();
      setFormData((prev) => ({ ...prev, payment_method: methodName }));
      setNewPaymentMethodValue('');
      setShowNewPaymentMethodInput(false);
    } catch (error) {
      console.error('결제 방법 추가 오류:', error);
      alert(
        typeof error === 'object' && error && 'message' in error
          ? String((error as Error).message)
          : '결제 방법 추가에 실패했습니다.'
      );
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
      setTours(rows);
    } catch (error) {
      console.error('투어 목록 조회 오류:', error);
    } finally {
      setToursLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, position')
        .eq('is_active', true)
        .order('name_ko');
      
      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('팀원 목록 조회 오류:', error);
    }
  };

  const fetchHotelReferences = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_hotel_references' as never)
        .select('id, hotel_name, city, website')
        .order('hotel_name');
      if (error) throw error;
      setHotelReferences((data || []) as TourHotelReference[]);
    } catch (error) {
      console.error('호텔 참조 목록 조회 오류:', error);
    }
  };

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_hotel_bookings')
        .select('hotel')
        .not('hotel', 'is', null)
        .order('hotel');
      
      if (error) throw error;
      const uniqueHotels = [
        ...new Set(
          (data?.map((item) => (item.hotel != null ? String(item.hotel).trim() : '')) || []).filter(
            (h) => h.length > 0
          )
        ),
      ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      setHotels(uniqueHotels);
    } catch (error) {
      console.error('호텔 목록 조회 오류:', error);
    }
  };

  const applyHotelAutoFields = useCallback(
    (hotelName: string) => {
      const resolved = resolveHotelReferenceFields(hotelName, hotelReferences);
      if (!resolved) return;
      setFormData((prev) => ({
        ...prev,
        city: resolved.city,
        ...(resolved.website ? { website: resolved.website } : {}),
      }));
    },
    [hotelReferences]
  );

  const hotelNameOptions = useMemo(() => {
    const names = new Set<string>();
    hotelReferences.forEach((r) => {
      if (r.hotel_name.trim()) names.add(r.hotel_name.trim());
    });
    hotels.forEach((h) => {
      if (h.trim()) names.add(h.trim());
    });
    return [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((name) => ({ value: name, label: name }));
  }, [hotelReferences, hotels]);

  const reservationNameOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; hint?: string }> = [];
    const seen = new Set<string>();
    teamMembers.forEach((member) => {
      const ko = (member.name_ko || '').trim();
      const en = (member.name_en || '').trim();
      const position = member.position || '';
      if (ko && !seen.has(ko)) {
        seen.add(ko);
        opts.push({
          value: ko,
          label: ko,
          hint: [en, position].filter(Boolean).join(' · '),
        });
      }
      if (en && en !== ko && !seen.has(en)) {
        seen.add(en);
        opts.push({
          value: en,
          label: en,
          hint: [ko, position].filter(Boolean).join(' · '),
        });
      }
    });
    const current = formData.reservation_name?.trim();
    if (current && !seen.has(current)) {
      opts.unshift({ value: current, label: current, hint: '기존 값' });
    }
    return opts;
  }, [teamMembers, formData.reservation_name]);

  const paymentMethodOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ id: string; value: string; label: string }> = [];
    for (const pm of paymentMethodsList) {
      const value = String(pm.method || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      opts.push({
        id: pm.id,
        value,
        label: pm.display_name || value,
      });
    }
    const current = formData.payment_method?.trim();
    if (current && !seen.has(current)) {
      opts.unshift({ id: `legacy-${current}`, value: current, label: current });
    }
    return opts;
  }, [paymentMethodsList, formData.payment_method]);

  const roomTypeOptions = useMemo(
    () => [
      DEFAULT_TOUR_HOTEL_ROOM_TYPE,
      '1 KING',
      '2 QUEEN',
      '2 FULL',
      '3 FULL',
      '3 QUEEN',
    ],
    []
  );

  const fetchWebsites = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_hotel_bookings')
        .select('website')
        .not('website', 'is', null)
        .order('website');
      
      if (error) throw error;
      const uniqueWebsites = [...new Set(data?.map(item => item.website) || [])];
      setWebsites(uniqueWebsites);
    } catch (error) {
      console.error('웹사이트 목록 조회 오류:', error);
    }
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
    const submitterEmail = authUser?.email?.trim();
    if (!submitterEmail) {
      alert('제출자 이메일을 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.');
      return;
    }
    setLoading(true);

    try {
       // 파일 업로드 처리
       let uploadedFileUrls: string[] = []
       if (formData.uploaded_files && formData.uploaded_files.length > 0) {
         setIsUploading(true)
         try {
           const uploadFormData = new FormData()
           uploadFormData.append('bucketType', 'tour_hotel_bookings')
           formData.uploaded_files.forEach(file => {
             uploadFormData.append('files', file)
           })
           
           const uploadResponse = await fetchUploadApi(uploadFormData)
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            uploadedFileUrls = uploadResult.urls
          } else {
            console.error('파일 업로드 실패')
          }
        } finally {
          setIsUploading(false)
        }
      }

      const rowPayload = toTourHotelBookingRowPayload(
        formData,
        uploadedFileUrls,
        submitterEmail,
        !booking?.id ? replacesBookingId : undefined
      );

      let error;
      if (booking?.id) {
        const { error: updateError } = await supabase
          .from('tour_hotel_bookings')
          .update(rowPayload as never)
          .eq('id', booking.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('tour_hotel_bookings')
          .insert(rowPayload as never);
        error = insertError;

        if (!error && replacesBookingId?.trim()) {
          const priorId = replacesBookingId.trim();
          const { error: cancelError } = await supabase
            .from('tour_hotel_bookings')
            .update({ status: 'cancelled' } as never)
            .eq('id', priorId)
            .neq('status', 'cancelled');
          if (cancelError) {
            console.error('이전 부킹 취소 오류:', cancelError);
            alert(
              locale === 'ko'
                ? '새 부킹은 저장되었으나 이전 부킹 취소 처리에 실패했습니다. 수동으로 취소해 주세요.'
                : 'New booking saved but failed to cancel the previous booking. Please cancel it manually.'
            );
          }
        }
      }

      if (error) throw error;

      const { uploaded_files: _dropFiles, ...formWithoutFiles } = formData;
      onSave({
        ...formWithoutFiles,
        ...rowPayload,
        tour_id: (rowPayload.tour_id as string | null) ?? '',
        id: booking?.id,
      } as TourHotelBooking);
    } catch (error) {
      console.error('투어 호텔 부킹 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const raw =
      name === 'rooms' || name === 'unit_price' || name === 'total_price' ? Number(value) : value;
    const nextVal =
      name === 'city' || name === 'hotel'
        ? typeof raw === 'string'
          ? raw.trim()
          : raw
        : raw;
    setFormData(prev => {
      const next = { ...prev, [name]: nextVal } as TourHotelBooking;
      if (name === 'rooms' || name === 'unit_price') {
        const roomsNum = name === 'rooms' ? (Number(nextVal) || 0) : prev.rooms;
        const unitNum = name === 'unit_price' ? (Number(nextVal) || 0) : prev.unit_price;
        next.total_price = roundUsdTotal(roomsNum * unitNum);
      }
      if (name === 'check_in_date' && typeof nextVal === 'string' && nextVal.trim()) {
        next.check_out_date = addDaysToYmd(nextVal, 1);
        next.event_date = nextVal.trim();
      }
      return next;
    });

    if (name === 'hotel' && typeof nextVal === 'string') {
      applyHotelAutoFields(nextVal);
    }

    // 투어 선택 시 날짜 자동 설정
    if (name === 'tour_id' && value) {
      const selectedTour = tours.find(tour => tour.id === value);
      if (selectedTour && selectedTour.tour_date) {
        const tourDate = selectedTour.tour_date;
        const checkOutDateString = addDaysToYmd(tourDate, 1);
        
        setFormData(prev => ({
          ...prev,
          check_in_date: tourDate,
          check_out_date: checkOutDateString,
          event_date: tourDate,
        }));
      }
    }

    // 웹사이트 자동완성
    if (name === 'website') {
      const filtered = websites.filter(website => 
        website.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredWebsites(filtered);
      setShowWebsiteSuggestions(value.length > 0 && filtered.length > 0);
    }
  };

  const handleHotelNameChange = (hotelName: string) => {
    setFormData((prev) => ({ ...prev, hotel: hotelName.trim() }));
    applyHotelAutoFields(hotelName);
  };

  const handleWebsiteSelect = (website: string) => {
    setFormData(prev => ({ ...prev, website }));
    setShowWebsiteSuggestions(false);
  };

  const handleWebsiteBlur = () => {
    setTimeout(() => setShowWebsiteSuggestions(false), 200);
  };

  const handleDateChange = (field: 'check_in_date' | 'check_out_date', direction: 'up' | 'down') => {
    const currentDate = new Date(formData[field] as string);
    if (isNaN(currentDate.getTime())) return;

    const newDate = new Date(currentDate);
    if (direction === 'up') {
      newDate.setDate(currentDate.getDate() + 1);
    } else {
      newDate.setDate(currentDate.getDate() - 1);
    }

    const formattedDate = newDate.toISOString().split('T')[0];
    setFormData(prev => {
      const next = { ...prev, [field]: formattedDate };
      if (field === 'check_in_date') {
        next.check_out_date = addDaysToYmd(formattedDate, 1);
        next.event_date = formattedDate;
      }
      return next;
    });
  };

  const legacyStatusOption =
    formData.status &&
    !TOUR_HOTEL_BOOKING_STATUS_OPTIONS.some((o) => o.value === formData.status)
      ? formData.status
      : null;

  const statusBar = (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
      {TOUR_HOTEL_BOOKING_STATUS_OPTIONS.map((opt) => {
        const active = formData.status === opt.value;
        const label = locale === 'ko' ? opt.labelKo : opt.labelEn;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, status: opt.value }))}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-colors ${
              active
                ? opt.value === 'confirmed'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        );
      })}
      {legacyStatusOption ? (
        <span className="text-xs text-amber-700 px-1">
          ({legacyStatusOption})
        </span>
      ) : null}
      {showHeaderClose ? (
        <button
          type="button"
          onClick={onCancel}
          className="ml-1 p-1 text-gray-400 hover:text-gray-600 rounded-md"
          aria-label={t('cancel')}
        >
          <X size={20} />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
        {(modalTitle || !showHeaderClose) && (
          <div className={`flex items-start sm:items-center gap-3 ${modalTitle ? '-mt-2 mb-2' : 'mb-3'}`}>
            {modalTitle ? (
              <h3 className="text-lg font-semibold text-gray-900 shrink-0">{modalTitle}</h3>
            ) : (
              <span className="flex-1" />
            )}
            <div className="flex-1 min-w-0 flex justify-end">{statusBar}</div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {replacesBookingId ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {locale === 'ko'
                ? `저장하면 이전 부킹이 취소되고 새 부킹이 추가됩니다. 호텔·날짜 정보는 유지됩니다. 새 RN#·금액·결제 방법을 입력한 뒤 저장하세요. (이전 ID: ${replacesBookingId.slice(0, 8)}…)`
                : `Saving will cancel the previous booking and add this new one. Hotel and dates are kept — enter new RN#, price, and payment method. (Prior ID: ${replacesBookingId.slice(0, 8)}…)`}
            </div>
          ) : null}
          {/* 첫 번째 줄: 투어 선택, RN# - 모바일 최적화 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('selectTourOptional')}
              </label>
              <select
                name="tour_id"
                value={formData.tour_id || ''}
                onChange={handleChange}
                disabled={Boolean(formData.check_in_date?.trim()) && toursLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm disabled:bg-gray-50 disabled:text-gray-500"
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
              <p className="text-xs text-gray-500 mt-1">
                {t('selectTourHelpText')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RN#
              </label>
              <input
                type="text"
                name="rn_number"
                value={formData.rn_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>

          {/* 두 번째 줄부터: 나머지 필드들 - 모바일 최적화 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                체크인 날짜 *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="check_in_date"
                  value={formData.check_in_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                체크아웃 날짜 *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="check_out_date"
                  value={formData.check_out_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleDateChange('check_out_date', 'up')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800"
                    title="다음 날"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateChange('check_out_date', 'down')}
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
                예약자명 *
              </label>
              <SearchableTextSelect
                value={formData.reservation_name || ''}
                onChange={(v) => setFormData((prev) => ({ ...prev, reservation_name: v }))}
                options={reservationNameOptions}
                placeholder="이름 검색"
                required
                allowCustom={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CC 상태
              </label>
              <select
                name="cc"
                value={formData.cc || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">CC 상태를 선택하세요</option>
                <option value="sent">CC 발송 완료</option>
                <option value="not_sent">미발송</option>
                <option value="not_needed">필요없음</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  호텔명 *
                </label>
                <button
                  type="button"
                  onClick={() => setShowHotelManageModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  호텔 관리
                </button>
              </div>
              <SearchableTextSelect
                value={formData.hotel || ''}
                onChange={handleHotelNameChange}
                options={hotelNameOptions}
                placeholder="호텔명 검색 또는 입력"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                호텔명 앞 글자(P=Page 등) 또는 호텔 관리에 등록된 정보로 도시가 자동 입력됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                도시 * (자동 입력)
              </label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                required
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-800"
                placeholder="호텔명 입력 시 자동 설정"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                객실 타입
              </label>
              <input
                type="text"
                name="room_type"
                list="tour-hotel-room-type-options"
                value={formData.room_type || DEFAULT_TOUR_HOTEL_ROOM_TYPE}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={DEFAULT_TOUR_HOTEL_ROOM_TYPE}
              />
              <datalist id="tour-hotel-room-type-options">
                {roomTypeOptions.map((rt) => (
                  <option key={rt} value={rt} />
                ))}
              </datalist>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                웹사이트
              </label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                onBlur={handleWebsiteBlur}
                onFocus={() => {
                  if (formData.website.length > 0) {
                    const filtered = websites.filter(website => 
                      website.toLowerCase().includes(formData.website.toLowerCase())
                    );
                    setFilteredWebsites(filtered);
                    setShowWebsiteSuggestions(filtered.length > 0);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="웹사이트 주소 또는 이름을 입력하세요"
                autoComplete="off"
              />
              {showWebsiteSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredWebsites.map((website, index) => (
                    <div
                      key={`website-${website}-${index}`}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleWebsiteSelect(website)}
                    >
                      {website}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  객실 수 *
                </label>
                <input
                  type="number"
                  name="rooms"
                  value={formData.rooms}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  단가 (USD) *
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  총 가격 (USD)
                </label>
                <input
                  type="text"
                  readOnly
                  value={roundUsdTotal(formData.total_price).toFixed(2)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-medium text-gray-900"
                />
              </div>
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
                        void handleAddPaymentMethod();
                      }
                      if (e.key === 'Escape') setShowNewPaymentMethodInput(false);
                    }}
                    placeholder={t('paymentMethod')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddPaymentMethod()}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                  >
                    {t('add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewPaymentMethodInput(false);
                      setNewPaymentMethodValue('');
                    }}
                    className="px-3 py-2 border rounded-md text-sm"
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <SearchableTextSelect
                    value={formData.payment_method || ''}
                    onChange={(v) => setFormData((prev) => ({ ...prev, payment_method: v }))}
                    options={paymentMethodOptions}
                    placeholder={t('select')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPaymentMethodInput(true)}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    ➕ {t('addNew')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 파일 업로드 섹션 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              관련 문서 첨부 (선택사항)
            </label>
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                isUploading 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                  : isDragOver 
                    ? 'border-primary bg-primary/10 scale-105 cursor-pointer' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-muted/50 cursor-pointer'
              }`}
              onDragOver={!isUploading ? handleDragOver : undefined}
              onDragEnter={!isUploading ? handleDragEnter : undefined}
              onDragLeave={!isUploading ? handleDragLeave : undefined}
              onDrop={!isUploading ? handleDrop : undefined}
              onPaste={!isUploading ? handlePaste : undefined}
              tabIndex={!isUploading ? 0 : -1}
              onClick={!isUploading ? () => document.getElementById('hotel_file_upload')?.click() : undefined}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isUploading 
                    ? 'bg-primary/10' 
                    : isDragOver 
                      ? 'bg-blue-200' 
                      : 'bg-gray-100'
                }`}>
                  {isUploading ? (
                    <div className="animate-spin">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                  ) : isDragOver ? (
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    isDragOver ? 'text-foreground' : 'text-gray-900'
                  }`}>
                    {isUploading 
                      ? '파일 업로드 중...' 
                      : isDragOver 
                        ? '파일을 여기에 놓으세요' 
                        : '파일을 드래그하여 놓거나 클릭하여 선택하세요'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    또는 클립보드에서 붙여넣기 (Ctrl+V)
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)
                </div>
              </div>
              
              <input
                id="hotel_file_upload"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {/* 업로드된 파일 목록 */}
              {formData.uploaded_files && formData.uploaded_files.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium mb-3 text-gray-900">업로드된 파일 ({formData.uploaded_files.length}개)</h4>
                  <div className="space-y-2">
                    {formData.uploaded_files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                            {file.type.startsWith('image/') ? (
                              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="flex justify-end space-x-3 pt-4">
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
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>

      <TourHotelReferenceManageModal
        open={showHotelManageModal}
        onOpenChange={setShowHotelManageModal}
        locale={locale}
        initialHotelNames={hotels}
        initialReferences={hotelReferences}
        onChanged={() => {
          void fetchHotelReferences();
          void fetchHotels();
        }}
      />
    </div>
  );
}
