'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TourHotelBooking {
  id?: string;
  tour_id: string;
  event_date: string;
  check_in_date: string;
  check_out_date: string;
  reservation_name: string;
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
  const [formData, setFormData] = useState<TourHotelBooking>({
    tour_id: tourId || '',
    event_date: '',
    check_in_date: '',
    check_out_date: '',
    reservation_name: '',
    cc: '',
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
    ...booking
  });

  const [tours, setTours] = useState<any[]>([]);
  const [hotels, setHotels] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHotelSuggestions, setShowHotelSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [filteredHotels, setFilteredHotels] = useState<string[]>([]);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);

  useEffect(() => {
    fetchTours();
    fetchHotels();
    fetchCities();
  }, []);

  const fetchTours = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      const { data, error } = await supabase
        .from('tours')
        .select('id, tour_date, product_id, products(name)')
        .gte('tour_date', today) // 오늘 날짜 이후의 투어만
        .order('tour_date', { ascending: true });
      
      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error('투어 목록 조회 오류:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('tour_hotel_bookings')
        .upsert(formData);

      if (error) throw error;

      onSave(formData);
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
  };

  const handleHotelSelect = (hotel: string) => {
    setFormData(prev => ({ ...prev, hotel }));
    setShowHotelSuggestions(false);
  };

  const handleCitySelect = (city: string) => {
    setFormData(prev => ({ ...prev, city }));
    setShowCitySuggestions(false);
  };

  const handleHotelBlur = () => {
    setTimeout(() => setShowHotelSuggestions(false), 200);
  };

  const handleCityBlur = () => {
    setTimeout(() => setShowCitySuggestions(false), 200);
  };

  const handleDateChange = (field: string, direction: 'up' | 'down') => {
    const currentDate = new Date(formData[field as keyof TourHotelBooking] as string);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {booking ? '투어 호텔 부킹 수정' : '새 투어 호텔 부킹'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                투어 선택 *
              </label>
              <select
                name="tour_id"
                value={formData.tour_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">투어를 선택하세요</option>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이벤트 날짜 *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleDateChange('event_date', 'up')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800"
                    title="다음 날"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateChange('event_date', 'down')}
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
                예약명 *
              </label>
              <input
                type="text"
                name="reservation_name"
                value={formData.reservation_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CC (신용카드 정보)
              </label>
              <input
                type="text"
                name="cc"
                value={formData.cc}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="마지막 4자리"
              />
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
                      key={index}
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
                      key={index}
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
              <input
                type="text"
                name="room_type"
                value={formData.room_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 스탠다드, 디럭스"
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
                value={formData.payment_method}
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
                웹사이트
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://"
              />
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
                상태
              </label>
              <select
                name="status"
                value={formData.status}
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
