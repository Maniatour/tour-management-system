'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TourHotelBooking {
  id?: string;
  tour_id: string;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const bookingData = {
        ...formData,
        tour_id: formData.tour_id || null, // 빈 문자열을 null로 변환
      };

      const { error } = await supabase
        .from('tour_hotel_bookings')
        .upsert(bookingData);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {booking ? '투어 호텔 부킹 수정' : '새 투어 호텔 부킹'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 첫 번째 줄: 투어 선택, RN# */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                투어 선택 (선택사항)
              </label>
              <select
                name="tour_id"
                value={formData.tour_id}
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
          </div>

          {/* 두 번째 줄부터: 나머지 필드들 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


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
                value={formData.reservation_name}
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
                CC 상태
              </label>
              <select
                name="cc"
                value={formData.cc}
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
              <select
                name="room_type"
                value={formData.room_type}
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

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                웹사이트
              </label>
              <input
                type="url"
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
                placeholder="https://"
                autoComplete="off"
              />
              {showWebsiteSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredWebsites.map((website, index) => (
                    <div
                      key={index}
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
