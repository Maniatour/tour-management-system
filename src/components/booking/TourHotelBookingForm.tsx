'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TourHotelBooking {
  id?: string;
  tour_id: string;
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

interface TourHotelBookingFormProps {
  booking?: TourHotelBooking;
  onSave: (booking: TourHotelBooking) => void;
  onCancel: () => void;
  tourId?: string;
}

export default function TourHotelBookingForm({ 
  booking, 
  onSave, 
  onCancel, 
  tourId 
}: TourHotelBookingFormProps) {
  const [formData, setFormData] = useState<TourHotelBooking>(() => {
    console.log('편집 모드 - 전달받은 booking 데이터:', booking);
    
    const initialData = {
      tour_id: tourId || '',
      check_in_date: '',
      check_out_date: '',
      reservation_name: '',
      submitted_by: 'admin@maniatour.com',
      cc: 'not_sent',
      rooms: 1,
      city: '',
      hotel: '',
      room_type: '',
      unit_price: 0,
      total_price: 0,
      payment_method: '',
      website: '',
      rn_number: '',
      status: 'pending',
      uploaded_files: [], // 파일 업로드 필드 추가
      uploaded_file_urls: [] // 업로드된 파일 URL들
    };

    if (booking) {
      const mergedData = {
        ...initialData,
        ...booking,
        // 명시적으로 각 필드를 설정하여 undefined 값 처리
        tour_id: booking.tour_id ?? tourId ?? initialData.tour_id,
        check_in_date: booking.check_in_date ?? initialData.check_in_date,
        check_out_date: booking.check_out_date ?? initialData.check_out_date,
        reservation_name: booking.reservation_name ?? initialData.reservation_name,
        cc: booking.cc ?? initialData.cc,
        rooms: booking.rooms ?? initialData.rooms,
        city: booking.city ?? initialData.city,
        hotel: booking.hotel ?? initialData.hotel,
        room_type: booking.room_type ?? initialData.room_type,
        unit_price: booking.unit_price ?? initialData.unit_price,
        total_price: booking.total_price ?? initialData.total_price,
        payment_method: booking.payment_method ?? initialData.payment_method,
        website: booking.website ?? initialData.website,
        rn_number: booking.rn_number ?? initialData.rn_number,
        status: booking.status ?? initialData.status,
      };
      
      console.log('편집 모드 - 최종 formData:', mergedData);
      return mergedData;
    }
    
    return initialData;
  });

  const [tours, setTours] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [hotels, setHotels] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [websites, setWebsites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHotelSuggestions, setShowHotelSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showWebsiteSuggestions, setShowWebsiteSuggestions] = useState(false);
  const [filteredHotels, setFilteredHotels] = useState<string[]>([]);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const [filteredWebsites, setFilteredWebsites] = useState<string[]>([]);
  
  // 파일 업로드 관련 상태
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchTours();
    fetchTeamMembers();
    fetchHotels();
    fetchCities();
    fetchWebsites();
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

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_hotel_bookings')
        .select('hotel')
        .not('hotel', 'is', null)
        .order('hotel');
      
      if (error) throw error;
      const uniqueHotels = [...new Set(data?.map(item => item.hotel) || [])];
      setHotels(uniqueHotels);
    } catch (error) {
      console.error('호텔 목록 조회 오류:', error);
    }
  };

  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_hotel_bookings')
        .select('city')
        .not('city', 'is', null)
        .order('city');
      
      if (error) throw error;
      const uniqueCities = [...new Set(data?.map(item => item.city) || [])];
      setCities(uniqueCities);
    } catch (error) {
      console.error('도시 목록 조회 오류:', error);
    }
  };

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

      let error;
      if (booking?.id) {
        // 수정인 경우
        const { error: updateError } = await supabase
          .from('tour_hotel_bookings')
          .update(bookingData)
          .eq('id', booking.id);
        error = updateError;
      } else {
        // 새로 생성인 경우
        const { error: insertError } = await supabase
          .from('tour_hotel_bookings')
          .insert(bookingData);
        error = insertError;
      }

      if (error) throw error;

      onSave(bookingData);
    } catch (error) {
      console.error('투어 호텔 부킹 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rooms' || name === 'unit_price' || name === 'total_price' ? Number(value) : value
    }));

    // 투어 선택 시 날짜 자동 설정
    if (name === 'tour_id' && value) {
      const selectedTour = tours.find(tour => tour.id === value);
      if (selectedTour && selectedTour.tour_date) {
        const tourDate = selectedTour.tour_date;
        const checkOutDate = new Date(tourDate);
        checkOutDate.setDate(checkOutDate.getDate() + 1);
        const checkOutDateString = checkOutDate.toISOString().split('T')[0];
        
        setFormData(prev => ({
          ...prev,
          check_in_date: tourDate,
          check_out_date: checkOutDateString
        }));
      }
    }

    // 호텔 자동완성
    if (name === 'hotel') {
      const filtered = hotels.filter(hotel => 
        hotel.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredHotels(filtered);
      setShowHotelSuggestions(value.length > 0 && filtered.length > 0);
    }

    // 도시 자동완성
    if (name === 'city') {
      const filtered = cities.filter(city => 
        city.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
      setShowCitySuggestions(value.length > 0 && filtered.length > 0);
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

  const handleHotelSelect = (hotel: string) => {
    setFormData(prev => ({ ...prev, hotel }));
    setShowHotelSuggestions(false);
  };

  const handleCitySelect = (city: string) => {
    setFormData(prev => ({ ...prev, city }));
    setShowCitySuggestions(false);
  };

  const handleWebsiteSelect = (website: string) => {
    setFormData(prev => ({ ...prev, website }));
    setShowWebsiteSuggestions(false);
  };

  const handleHotelBlur = () => {
    setTimeout(() => setShowHotelSuggestions(false), 200);
  };

  const handleCityBlur = () => {
    setTimeout(() => setShowCitySuggestions(false), 200);
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
    setFormData(prev => ({
      ...prev,
      [field]: formattedDate
    }));
  };

  const calculateTotalPrice = () => {
    const total = formData.rooms * formData.unit_price;
    setFormData(prev => ({ ...prev, total_price: total }));
  };

  useEffect(() => {
    calculateTotalPrice();
  }, [formData.rooms, formData.unit_price]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold mb-4">
          {booking ? '투어 호텔 부킹 수정' : '새 투어 호텔 부킹'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* 첫 번째 줄: 투어 선택, RN# - 모바일 최적화 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                투어 선택 (선택사항)
              </label>
              <select
                name="tour_id"
                value={formData.tour_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                RN#
              </label>
              <input
                type="text"
                name="rn_number"
                value={formData.rn_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                체크아웃 날짜 *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="check_out_date"
                  value={formData.check_out_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <select
                name="reservation_name"
                value={formData.reservation_name || ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">예약자명을 선택하세요</option>
                {teamMembers.map((member) => (
                  <option key={member.email} value={member.name_ko}>
                    {member.name_ko} {member.name_en ? `(${member.name_en})` : ''} - {member.position || '직책 없음'}
                  </option>
                ))}
              </select>
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
                CC 상태
              </label>
              <select
                name="cc"
                value={formData.cc || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">CC 상태를 선택하세요</option>
                <option value="sent">CC 발송 완료</option>
                <option value="not_sent">미발송</option>
                <option value="not_needed">필요없음</option>
              </select>
            </div>

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                도시 *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                onBlur={handleCityBlur}
                onFocus={() => {
                  if (formData.city.length > 0) {
                    const filtered = cities.filter(city => 
                      city.toLowerCase().includes(formData.city.toLowerCase())
                    );
                    setFilteredCities(filtered);
                    setShowCitySuggestions(filtered.length > 0);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="도시를 입력하세요"
                autoComplete="off"
              />
              {showCitySuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredCities.map((city, index) => (
                    <div
                      key={`city-${city}-${index}`}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleCitySelect(city)}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                호텔명 *
              </label>
              <input
                type="text"
                name="hotel"
                value={formData.hotel}
                onChange={handleChange}
                onBlur={handleHotelBlur}
                onFocus={() => {
                  if (formData.hotel.length > 0) {
                    const filtered = hotels.filter(hotel => 
                      hotel.toLowerCase().includes(formData.hotel.toLowerCase())
                    );
                    setFilteredHotels(filtered);
                    setShowHotelSuggestions(filtered.length > 0);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="호텔명을 입력하세요"
                autoComplete="off"
              />
              {showHotelSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredHotels.map((hotel, index) => (
                    <div
                      key={`hotel-${hotel}-${index}`}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleHotelSelect(hotel)}
                    >
                      {hotel}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                객실 타입
              </label>
              <select
                name="room_type"
                value={formData.room_type || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">객실 타입을 선택하세요</option>
                <option value="1 king">1 King</option>
                <option value="2 queen">2 Queen</option>
                <option value="2 full">2 Full</option>
                <option value="3 full">3 Full</option>
                <option value="3 queen">3 Queen</option>
              </select>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                총 가격 (USD)
              </label>
              <input
                type="number"
                name="total_price"
                value={formData.total_price}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <option value="pending">대기중</option>
                <option value="confirmed">확정</option>
                <option value="cancelled">취소</option>
                <option value="completed">완료</option>
              </select>
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
                    ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
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
