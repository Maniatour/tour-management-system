'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';

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
  tour_id: string | null;
  reservation_id?: string; // 예약 ID 추가
  note: string;
  status: string;
  season: string;
  supplier_product_id?: string; // 공급업체 상품 ID 추가
  uploaded_files?: File[]; // 파일 업로드 필드 추가
  uploaded_file_urls?: string[]; // 업로드된 파일 URL들
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
  onDelete?: (id: string) => void;
  tourId?: string;
}

export default function TicketBookingForm({ 
  booking, 
  onSave, 
  onCancel,
  onDelete,
  tourId 
}: TicketBookingFormProps) {
  const t = useTranslations('booking.ticketBooking');
  const [formData, setFormData] = useState<TicketBooking>(() => {
    console.log('편집 모드 - 전달받은 booking 데이터:', booking);
    
    const initialData = {
      category: '',
      submitted_by: 'admin@maniatour.com',
      check_in_date: '',
      time: '',
      company: '',
      ea: 1,
      expense: 0,
      income: 0,
      payment_method: '',
      rn_number: '',
      tour_id: tourId || null,
      reservation_id: '',
      note: '',
      status: 'tentative', // 가예약으로 기본값 변경
      season: 'no', // 시즌 아님으로 기본값 변경
      uploaded_files: [], // 파일 업로드 필드 추가
      uploaded_file_urls: [] // 업로드된 파일 URL들
    };

    if (booking) {
      // 시간 데이터를 드롭다운 옵션 형식으로 변환
      const formatTimeForDropdown = (timeValue: string) => {
        if (!timeValue) return '';
        
        // TIME 타입에서 가져온 데이터가 "HH:MM:SS" 형식일 수 있음
        const timeStr = timeValue.toString();
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          
          // 5분 단위로 반올림
          const roundedMinutes = Math.round(minutes / 5) * 5;
          
          // 시간과 분을 2자리로 포맷
          const formattedTime = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
          
          console.log('시간 변환:', timeValue, '->', formattedTime);
          return formattedTime;
        }
        
        return timeValue;
      };

      const mergedData = {
        ...initialData,
        ...booking,
        // 명시적으로 각 필드를 설정하여 undefined 값 처리
        category: booking.category ?? initialData.category,
        check_in_date: booking.check_in_date ?? initialData.check_in_date,
        time: formatTimeForDropdown(booking.time) ?? initialData.time,
        company: booking.company ?? initialData.company,
        ea: booking.ea ?? initialData.ea,
        expense: booking.expense ?? initialData.expense,
        income: booking.income ?? initialData.income,
        payment_method: booking.payment_method ?? initialData.payment_method,
        rn_number: booking.rn_number ?? initialData.rn_number,
        tour_id: booking.tour_id ?? tourId ?? initialData.tour_id,
        reservation_id: booking.reservation_id ?? initialData.reservation_id,
        note: booking.note ?? initialData.note,
        status: booking.status ?? initialData.status,
        season: booking.season ?? initialData.season,
      };
      
      console.log('편집 모드 - 최종 formData:', mergedData);
      return mergedData;
    }
    
    return initialData;
  });

  interface Tour {
    id: string;
    tour_date: string;
    product_id: string | null;
    products?: {
      name: string;
    };
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
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<string[]>([]);
  const [useSupplierTicket, setUseSupplierTicket] = useState(false);
  
  // 파일 업로드 관련 상태
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchTours();
    fetchReservations();
    fetchCategories();
    fetchCompanies();
    fetchSupplierProducts();
  }, []);

  const fetchTours = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      console.log('투어 목록 조회 시작...');
      
      // 먼저 tours만 조회
      const { data: toursData, error: toursError } = await (supabase as any)
        .from('tours')
        .select('id, tour_date, product_id')
        .gte('tour_date', today) // 오늘 날짜 이후의 투어만
        .order('tour_date', { ascending: true });

      if (toursError) {
        console.error('투어 목록 조회 오류:', toursError);
        throw toursError;
      }

      console.log('투어 데이터:', toursData);

      if (!toursData || toursData.length === 0) {
        setTours([]);
        return;
      }

      // 타입 단언
      const typedToursData = toursData as Tour[];

      // product_id가 있는 투어들만 필터링
      const toursWithProductId = typedToursData.filter((tour: Tour) => tour.product_id);
      
      if (toursWithProductId.length === 0) {
        setTours(typedToursData);
        return;
      }

      // 모든 product_id를 한 번에 조회
      const productIds = [...new Set(toursWithProductId.map((tour: Tour) => tour.product_id).filter(Boolean))] as string[];
      
      const { data: productsData, error: productsError } = await (supabase as any)
        .from('products')
        .select(`
          id,
          name
        `)
        .in('id', productIds);

      if (productsError) {
        console.warn('상품 정보 조회 오류:', productsError);
        setTours(typedToursData);
        return;
      }

      // products 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const productsMap = new Map<string, { id: string; name: string }>();
      ((productsData || []) as Array<{ id: string; name: string }>).forEach((product: { id: string; name: string }) => {
        productsMap.set(product.id, product);
      });

      // 투어 데이터에 상품 정보 추가
      const toursWithProducts = typedToursData.map((tour: Tour) => {
        if (tour.product_id && productsMap.has(tour.product_id)) {
          const product = productsMap.get(tour.product_id)!;
          return {
            ...tour,
            products: {
              name: product.name
            }
          };
        }
        return tour;
      });

      console.log('투어 목록 조회 성공:', toursWithProducts);
      setTours(toursWithProducts);
    } catch (error) {
      console.error('투어 목록 조회 오류:', error);
    }
  };

  const fetchReservations = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      console.log('예약 목록 조회 시작...');
      // 먼저 reservations만 조회
      const { data: reservationsData, error: reservationsError } = await (supabase as any)
        .from('reservations')
        .select(`
          id, 
          tour_date, 
          status,
          product_id
        `)
        .gte('tour_date', today) // 오늘 날짜 이후의 예약만
        .order('tour_date', { ascending: true });

      if (reservationsError) {
        console.error('예약 목록 조회 오류:', reservationsError);
        throw reservationsError;
      }

      if (!reservationsData || reservationsData.length === 0) {
        setReservations([]);
        return;
      }

      // product_id가 있는 예약들만 필터링
      const typedReservationsData = (reservationsData || []) as Reservation[];
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
    setLoading(true);

    try {
       // 파일 업로드 처리
       let uploadedFileUrls: string[] = []
       if (formData.uploaded_files && formData.uploaded_files.length > 0) {
         setIsUploading(true)
         try {
           const uploadFormData = new FormData()
           uploadFormData.append('bucketType', 'ticket_bookings')
           formData.uploaded_files.forEach(file => {
             uploadFormData.append('files', file)
           })
           
           const uploadResponse = await fetch('/api/upload', {
             method: 'POST',
             body: uploadFormData
           })
          
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

      const bookingData = {
        ...formData,
        tour_id: formData.tour_id && formData.tour_id.trim() !== '' ? formData.tour_id : null,
        uploaded_file_urls: uploadedFileUrls // 업로드된 파일 URL들 추가
      };

      console.log('전송할 데이터:', bookingData);

      let error;
      if (booking?.id) {
        // 수정인 경우 - 간단한 필드만 업데이트
        console.log('수정 모드 - ID:', booking.id);
        const updateData = {
          category: bookingData.category,
          check_in_date: bookingData.check_in_date,
          time: bookingData.time,
          company: bookingData.company,
          ea: bookingData.ea,
          expense: bookingData.expense,
          income: bookingData.income,
          payment_method: bookingData.payment_method,
          rn_number: bookingData.rn_number,
          tour_id: bookingData.tour_id,
          reservation_id: bookingData.reservation_id,
          note: bookingData.note,
          status: bookingData.status,
          season: bookingData.season
        };
        console.log('업데이트할 데이터:', updateData);
        
        const { error: updateError } = await (supabase as any)
          .from('ticket_bookings')
          .update(updateData)
          .eq('id', booking.id);
        error = updateError;
      } else {
        // 새로 생성인 경우
        console.log('새로 생성 모드');
        const { data: insertedData, error: insertError } = await (supabase as any)
          .from('ticket_bookings')
          .insert(bookingData)
          .select()
          .single();
        error = insertError;
        
        if (!error && insertedData) {
          bookingData.id = insertedData.id;
        }
      }

      if (error) throw error;

      // 공급업체 티켓을 사용한 경우 구매 기록 생성
      if (formData.supplier_product_id && bookingData.id) {
        await createSupplierTicketPurchase(bookingData.id, formData.supplier_product_id, formData.ea);
      }

      onSave(bookingData as TicketBooking);
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

    // 카테고리 자동완성
    if (name === 'category') {
      const filtered = categories.filter(cat => 
        cat.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCategories(filtered);
      setShowCategorySuggestions(value.length > 0 && filtered.length > 0);
    }

    // 공급업체 자동완성
    if (name === 'company') {
      const filtered = companies.filter(comp => 
        comp.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCompanies(filtered);
      setShowCompanySuggestions(value.length > 0 && filtered.length > 0);
    }
  };

  const handleCategorySelect = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
    setShowCategorySuggestions(false);
  };

  const handleCompanySelect = (company: string) => {
    setFormData(prev => ({ ...prev, company }));
    setShowCompanySuggestions(false);
  };

  const handleCategoryBlur = () => {
    setTimeout(() => setShowCategorySuggestions(false), 200);
  };

  const handleCompanyBlur = () => {
    setTimeout(() => setShowCompanySuggestions(false), 200);
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* 공급업체 티켓 선택 - 모바일 최적화 */}
            {useSupplierTicket && (
              <div className="sm:col-span-2">
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

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('category')} *
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                onBlur={handleCategoryBlur}
                onFocus={() => {
                  if (formData.category.length > 0) {
                    const filtered = categories.filter(cat => 
                      cat.toLowerCase().includes(formData.category.toLowerCase())
                    );
                    setFilteredCategories(filtered);
                    setShowCategorySuggestions(filtered.length > 0);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('categoryPlaceholder')}
                autoComplete="off"
                disabled={useSupplierTicket}
              />
              {showCategorySuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCategories.map((category, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleCategorySelect(category)}
                    >
                      {category}
                    </div>
                  ))}
                </div>
              )}
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('submitterEmail')} *
              </label>
              <input
                type="email"
                name="submitted_by"
                value={formData.submitted_by}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('submitterEmailPlaceholder')}
              />
            </div>

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
                {Array.from({ length: 13 * 12 }, (_, i) => {
                  const hour = Math.floor(i / 12) + 6; // 6시부터 시작
                  const minute = (i % 12) * 5;
                  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                  
                  // 각 시간별 색상 결정
                  const getTimeSlotColor = (hour: number) => {
                    if (hour === 6) return { 
                      bg: '#dbeafe', 
                      text: '#1e40af'  // 6시: 파란색
                    };
                    if (hour === 7) return { 
                      bg: '#dcfce7', 
                      text: '#166534'  // 7시: 초록색
                    };
                    if (hour === 8) return { 
                      bg: '#fef3c7', 
                      text: '#92400e'  // 8시: 노란색
                    };
                    if (hour === 9) return { 
                      bg: '#fce7f3', 
                      text: '#be185d'  // 9시: 핑크색
                    };
                    if (hour === 10) return { 
                      bg: '#e0e7ff', 
                      text: '#3730a3'  // 10시: 인디고색
                    };
                    if (hour === 11) return { 
                      bg: '#f0fdf4', 
                      text: '#14532d'  // 11시: 연두색
                    };
                    if (hour === 12) return { 
                      bg: '#fefce8', 
                      text: '#a16207'  // 12시: 주황색
                    };
                    if (hour === 13) return { 
                      bg: '#fff7ed', 
                      text: '#9a3412'  // 13시: 오렌지색
                    };
                    if (hour === 14) return { 
                      bg: '#fef2f2', 
                      text: '#dc2626'  // 14시: 빨간색
                    };
                    if (hour === 15) return { 
                      bg: '#f3e8ff', 
                      text: '#7c3aed'  // 15시: 보라색
                    };
                    if (hour === 16) return { 
                      bg: '#ecfdf5', 
                      text: '#059669'  // 16시: 에메랄드색
                    };
                    if (hour === 17) return { 
                      bg: '#f0f9ff', 
                      text: '#0284c7'  // 17시: 스카이블루
                    };
                    if (hour === 18) return { 
                      bg: '#f8fafc', 
                      text: '#475569'  // 18시: 슬레이트색
                    };
                    return { 
                      bg: '#f9fafb', 
                      text: '#111827'  // 기타: 회색
                    };
                  };
                  
                  const timeSlotColor = getTimeSlotColor(hour);
                  
                  return (
                    <option 
                      key={timeString} 
                      value={timeString}
                      style={{
                        backgroundColor: timeSlotColor.bg,
                        color: timeSlotColor.text
                      }}
                    >
                      {timeString}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplier')} *
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                onBlur={handleCompanyBlur}
                onFocus={() => {
                  if (formData.company.length > 0) {
                    const filtered = companies.filter(comp => 
                      comp.toLowerCase().includes(formData.company.toLowerCase())
                    );
                    setFilteredCompanies(filtered);
                    setShowCompanySuggestions(filtered.length > 0);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('supplierPlaceholder')}
                autoComplete="off"
                disabled={useSupplierTicket}
              />
              {showCompanySuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCompanies.map((company, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleCompanySelect(company)}
                    >
                      {company}
                    </div>
                  ))}
                </div>
              )}
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
              <select
                name="payment_method"
                value={formData.payment_method || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('select')}</option>
                <option value="credit_card">{t('paymentCreditCard')}</option>
                <option value="bank_transfer">{t('paymentBankTransfer')}</option>
                <option value="cash">{t('paymentCash')}</option>
                <option value="other">{t('paymentOther')}</option>
              </select>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('selectTourOptional')}
              </label>
              <select
                name="tour_id"
                value={formData.tour_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('selectTourPlaceholder')}</option>
                {tours.length > 0 ? (
                  tours.map(tour => (
                    <option key={tour.id} value={tour.id}>
                      {tour.tour_date} - {tour.products?.name || '상품명 없음'}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    예정된 투어가 없습니다
                  </option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('selectReservationPlaceholder')}</option>
                {reservations.length > 0 ? (
                    reservations.map(reservation => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.id} - {reservation.tour_date} - {reservation.products?.name || '상품명 없음'} ({reservation.status})
                      </option>
                    ))
                ) : (
                  <option value="" disabled>
                    예정된 예약이 없습니다
                  </option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t('selectReservationHelpText')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('status')}
              </label>
              <select
                name="status"
                value={formData.status || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tentative">{t('statusTentative')}</option>
                <option value="confirmed">{t('statusConfirmed')}</option>
                <option value="paid">{t('statusPaid')}</option>
                <option value="cancelled">{t('statusCancelled')}</option>
                <option value="credit">크레딧</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('season')}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('memo')}
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('memoPlaceholder')}
            />
          </div>

          {/* 파일 업로드 섹션 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('attachDocuments')}
            </label>
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
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
              <div className="flex flex-col items-center space-y-2">
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

          <div className="flex justify-between items-center pt-4">
            {booking?.id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (booking?.id && confirm('정말로 이 부킹을 삭제하시겠습니까?')) {
                    onDelete(booking.id);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                삭제
              </button>
            )}
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
