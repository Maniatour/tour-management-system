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
  tour_id: string;
  note: string;
  status: string;
  season: string;
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
  const [formData, setFormData] = useState<TicketBooking>({
    category: '',
    submitted_by: 'admin@example.com', // 기본값 설정, 실제로는 현재 사용자 이메일
    check_in_date: '',
    time: '',
    company: '',
    ea: 1,
    expense: 0,
    income: 0,
    payment_method: '',
    rn_number: '',
    tour_id: tourId || '',
    note: '',
    status: 'tentative', // 가예약으로 기본값 변경
    season: 'no', // 시즌 아님으로 기본값 변경
    ...booking
  });

  const [tours, setTours] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<string[]>([]);

  useEffect(() => {
    fetchTours();
    fetchCategories();
    fetchCompanies();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const bookingData = {
        ...formData,
        tour_id: formData.tour_id || null, // 빈 문자열을 null로 변환
      };

      const { error } = await supabase
        .from('ticket_bookings')
        .upsert(bookingData);

      if (error) throw error;

      onSave(bookingData);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {booking ? '입장권 부킹 수정' : '새 입장권 부킹'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                제출자 *
              </label>
              <input
                type="email"
                name="submitted_by"
                value={formData.submitted_by}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                readOnly
                title="현재 사용자 이메일이 자동으로 입력됩니다"
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
                value={formData.time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">시간을 선택하세요</option>
                {Array.from({ length: 13 * 12 }, (_, i) => {
                  const hour = Math.floor(i / 12) + 6; // 6시부터 시작
                  const minute = (i % 12) * 5;
                  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                  return (
                    <option key={timeString} value={timeString}>
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
                상태
              </label>
              <select
                name="status"
                value={formData.status}
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
                value={formData.season}
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
