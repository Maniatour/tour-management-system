import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import SimpleChoiceSelector from './SimpleChoiceSelector';

// 새로운 간결한 타입 정의
interface ChoiceOption {
  id: string;
  option_key: string;
  option_name: string;
  option_name_ko: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  capacity: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProductChoice {
  id: string;
  choice_group: string;
  choice_group_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
}

interface SelectedChoice {
  choice_id: string;
  option_id: string;
  option_key: string;
  option_name_ko: string;
  quantity: number;
  total_price: number;
}

interface SimpleReservationFormProps {
  reservation?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function SimpleReservationForm({
  reservation,
  onSubmit,
  onCancel
}: SimpleReservationFormProps) {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    adults: 1,
    children: 0,
    infants: 0,
    productId: '',
    tourDate: '',
    channelId: '',
    notes: '',
    selectedChoices: [] as SelectedChoice[]
  });

  const [products, setProducts] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([]);
  const [loading, setLoading] = useState(false);

  const totalPeople = formData.adults + formData.children + formData.infants;

  // 상품 목록 로드
  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, base_price')
        .eq('status', 'active')
        .order('name_ko');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('상품 로드 오류:', error);
    }
  }, []);

  // 채널 목록 로드
  const loadChannels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, name_ko')
        .eq('is_active', true)
        .order('name_ko');

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error('채널 로드 오류:', error);
    }
  }, []);

  // 상품의 초이스 로드
  const loadProductChoices = useCallback(async (productId: string) => {
    if (!productId) {
      setProductChoices([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', productId)
        .order('sort_order');

      if (error) throw error;
      setProductChoices(data || []);
    } catch (error) {
      console.error('상품 초이스 로드 오류:', error);
    }
  }, []);

  // 예약 데이터 로드 (편집 모드)
  const loadReservationData = useCallback(async () => {
    if (!reservation) return;

    try {
      // 예약 기본 정보 로드
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          adults,
          children,
          infants,
          product_id,
          tour_date,
          channel_id,
          notes
        `)
        .eq('id', reservation.id)
        .single();

      if (reservationError) throw reservationError;

      // 예약 초이스 로드
      const { data: choicesData, error: choicesError } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          total_price,
          choice:product_choices!inner (
            choice_group,
            choice_group_ko
          ),
          option:choice_options!inner (
            option_key,
            option_name_ko
          )
        `)
        .eq('reservation_id', reservation.id);

      if (choicesError) throw choicesError;

      // 초이스 데이터를 SelectedChoice 형식으로 변환
      const selectedChoices: SelectedChoice[] = (choicesData || []).map(choice => ({
        choice_id: choice.choice_id,
        option_id: choice.option_id,
        option_key: choice.option.option_key,
        option_name_ko: choice.option.option_name_ko,
        quantity: choice.quantity,
        total_price: choice.total_price
      }));

      setFormData({
        customerName: reservationData.customer_name || '',
        customerEmail: reservationData.customer_email || '',
        customerPhone: reservationData.customer_phone || '',
        adults: reservationData.adults || 1,
        children: reservationData.children || 0,
        infants: reservationData.infants || 0,
        productId: reservationData.product_id || '',
        tourDate: reservationData.tour_date || '',
        channelId: reservationData.channel_id || '',
        notes: reservationData.notes || '',
        selectedChoices
      });

      // 상품 초이스 로드
      if (reservationData.product_id) {
        await loadProductChoices(reservationData.product_id);
      }
    } catch (error) {
      console.error('예약 데이터 로드 오류:', error);
    }
  }, [reservation, loadProductChoices]);

  // 초기 데이터 로드
  useEffect(() => {
    loadProducts();
    loadChannels();
    if (reservation) {
      loadReservationData();
    }
  }, [loadProducts, loadChannels, loadReservationData]);

  // 상품 변경 시 초이스 로드
  useEffect(() => {
    if (formData.productId) {
      loadProductChoices(formData.productId);
    }
  }, [formData.productId, loadProductChoices]);

  // 초이스 선택 변경 핸들러
  const handleChoicesChange = useCallback((selections: SelectedChoice[]) => {
    setFormData(prev => ({
      ...prev,
      selectedChoices: selections
    }));
  }, []);

  // 폼 제출 핸들러
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const choicesTotal = formData.selectedChoices.reduce((total, choice) => total + choice.total_price, 0);

      const submissionData = {
        ...formData,
        totalPeople,
        choicesTotal,
        choices: formData.selectedChoices // 간결한 구조로 전달
      };

      onSubmit(submissionData);
    } catch (error) {
      console.error('폼 제출 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [formData, totalPeople, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 고객 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            고객명 *
          </label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이메일 *
          </label>
          <input
            type="email"
            value={formData.customerEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            전화번호 *
          </label>
          <input
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      {/* 인원 수 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            성인 수 *
          </label>
          <input
            type="number"
            min="1"
            value={formData.adults}
            onChange={(e) => setFormData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            아동 수
          </label>
          <input
            type="number"
            min="0"
            value={formData.children}
            onChange={(e) => setFormData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            유아 수
          </label>
          <input
            type="number"
            min="0"
            value={formData.infants}
            onChange={(e) => setFormData(prev => ({ ...prev, infants: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 상품 및 투어 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상품 *
          </label>
          <select
            value={formData.productId}
            onChange={(e) => setFormData(prev => ({ ...prev, productId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">상품을 선택하세요</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name_ko || product.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            투어 날짜 *
          </label>
          <input
            type="date"
            value={formData.tourDate}
            onChange={(e) => setFormData(prev => ({ ...prev, tourDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            채널 *
          </label>
          <select
            value={formData.channelId}
            onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">채널을 선택하세요</option>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.name_ko || channel.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 초이스 선택 */}
      {productChoices.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">옵션 선택</h3>
          <SimpleChoiceSelector
            choices={productChoices}
            adults={formData.adults}
            children={formData.children}
            infants={formData.infants}
            totalPeople={totalPeople}
            onSelectionChange={handleChoicesChange}
            initialSelections={formData.selectedChoices}
          />
        </div>
      )}

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          메모
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
