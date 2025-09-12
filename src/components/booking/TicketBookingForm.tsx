'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
  tourId?: string;
}

export default function TicketBookingForm({ 
  booking, 
  onSave, 
  onCancel, 
  tourId 
}: TicketBookingFormProps) {
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

  const [tours, setTours] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<string[]>([]);
  const [useSupplierTicket, setUseSupplierTicket] = useState(false);

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
      const { data: toursData, error: toursError } = await supabase
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

      // product_id가 있는 투어들만 필터링
      const toursWithProductId = toursData.filter(tour => tour.product_id);
      
      if (toursWithProductId.length === 0) {
        setTours(toursData);
        return;
      }

      // 모든 product_id를 한 번에 조회
      const productIds = [...new Set(toursWithProductId.map(tour => tour.product_id))];
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name
        `)
        .in('id', productIds);

      if (productsError) {
        console.warn('상품 정보 조회 오류:', productsError);
        setTours(toursData);
        return;
      }

      // products 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const productsMap = new Map();
      (productsData || []).forEach(product => {
        productsMap.set(product.id, product);
      });

      // 투어 데이터에 상품 정보 추가
      const toursWithProducts = toursData.map(tour => {
        if (tour.product_id && productsMap.has(tour.product_id)) {
          const product = productsMap.get(tour.product_id);
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
      const { data: reservationsData, error: reservationsError } = await supabase
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
      const reservationsWithProductId = reservationsData.filter(reservation => reservation.product_id);
      
      if (reservationsWithProductId.length === 0) {
        setReservations(reservationsData);
        return;
      }

      // 모든 product_id를 한 번에 조회
      const productIds = [...new Set(reservationsWithProductId.map(reservation => reservation.product_id))];
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name
        `)
        .in('id', productIds);

      if (productsError) {
        console.warn('상품 정보 조회 오류:', productsError);
        setReservations(reservationsData);
        return;
      }

      // products 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const productsMap = new Map();
      (productsData || []).forEach(product => {
        productsMap.set(product.id, product);
      });

      // 예약 데이터에 상품 정보 추가
      const reservationsWithProducts = reservationsData.map(reservation => {
        if (reservation.product_id && productsMap.has(reservation.product_id)) {
          const product = productsMap.get(reservation.product_id);
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
      const { data, error } = await supabase
        .from('ticket_bookings')
        .select('category')
        .not('category', 'is', null)
        .order('category');
      
      if (error) throw error;
      const uniqueCategories = [...new Set(data?.map(item => item.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('카테고리 목록 조회 오류:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_bookings')
        .select('company')
        .not('company', 'is', null)
        .order('company');
      
      if (error) throw error;
      const uniqueCompanies = [...new Set(data?.map(item => item.company) || [])];
      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error('공급업체 목록 조회 오류:', error);
    }
  };

  const fetchSupplierProducts = async () => {
    try {
      const { data, error } = await supabase
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

  const createSupplierTicketPurchase = async (bookingId: string, supplierProductId: string, quantity: number, unitPrice: number) => {
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

      const { error } = await supabase
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // UUID 유효성 검사 함수
      const isValidUUID = (uuid: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      };

      const bookingData = {
        ...formData,
        tour_id: formData.tour_id && formData.tour_id.trim() !== '' ? formData.tour_id : null,
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
        
        const { error: updateError } = await supabase
          .from('ticket_bookings')
          .update(updateData)
          .eq('id', booking.id);
        error = updateError;
      } else {
        // 새로 생성인 경우
        console.log('새로 생성 모드');
        const { data: insertedData, error: insertError } = await supabase
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
        await createSupplierTicketPurchase(bookingData.id, formData.supplier_product_id, formData.ea, formData.expense);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold mb-4">
          {booking ? '입장권 부킹 수정' : '새 입장권 부킹'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
                    setFormData(prev => ({ ...prev, supplier_product_id: undefined }));
                  }
                }}
                className="mr-2"
              />
              <label htmlFor="useSupplierTicket" className="text-sm font-medium text-blue-800">
                공급업체 티켓 사용
              </label>
            </div>
            <p className="text-xs text-blue-600">
              체크하면 등록된 공급업체의 티켓을 선택할 수 있습니다. 가격과 입장시간이 자동으로 설정됩니다.
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
                카테고리 *
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
                placeholder="카테고리를 입력하세요 (예: 앤텔로프 캐니언)"
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
                제출자 이메일 *
              </label>
              <input
                type="email"
                name="submitted_by"
                value={formData.submitted_by}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="제출자 이메일을 입력하세요"
              />
            </div>

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
                시간 *
              </label>
              <select
                name="time"
                value={formData.time || ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">시간을 선택하세요</option>
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
                공급업체 *
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
                placeholder="공급업체를 입력하세요"
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
                수량 *
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
                비용 (USD)
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
                수입 (USD)
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
                결제 방법
              </label>
              <select
                name="payment_method"
                value={formData.payment_method || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                <option value="credit_card">신용카드</option>
                <option value="bank_transfer">계좌이체</option>
                <option value="cash">현금</option>
                <option value="other">기타</option>
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
                투어 선택 (선택사항)
              </label>
              <select
                name="tour_id"
                value={formData.tour_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">투어를 선택하세요 (선택사항)</option>
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
                투어가 아직 생성되지 않은 경우 비워두고 저장할 수 있습니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                예약 선택 (선택사항)
              </label>
              <select
                name="reservation_id"
                value={formData.reservation_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">예약을 선택하세요 (선택사항)</option>
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
                예약이 아직 생성되지 않은 경우 비워두고 저장할 수 있습니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                name="status"
                value={formData.status || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tentative">가예약</option>
                <option value="confirmed">확정</option>
                <option value="paid">결제완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시즌
              </label>
              <select
                name="season"
                value={formData.season || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="no">시즌 아님</option>
                <option value="yes">시즌</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="특별 사항이나 메모를 입력하세요"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
