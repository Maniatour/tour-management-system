'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Calendar, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { DateRangeSelection } from '@/lib/types/dynamic-pricing';
import { DateRangeSelector } from './DateRangeSelector';
import { supabase } from '@/lib/supabase';

interface ChoiceCombination {
  id: string;
  combination_key: string;
  combination_name: string;
  combination_name_ko?: string;
}

interface SaleStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dates: Date[], status: 'sale' | 'closed', choiceStatusMap?: Record<string, boolean>) => void;
  initialDates?: Date[];
  initialStatus?: 'sale' | 'closed';
  choiceCombinations?: ChoiceCombination[];
  productId?: string;
  channelId?: string;
  channelType?: string;
}

export const SaleStatusModal = memo(function SaleStatusModal({
  isOpen,
  onClose,
  onSave,
  initialDates = [],
  initialStatus = 'sale',
  choiceCombinations = [],
  productId,
  channelId,
  channelType
}: SaleStatusModalProps) {
  const t = useTranslations('products.dynamicPricingPage');
  const [selectedDates, setSelectedDates] = useState<Date[]>(initialDates);
  const [saleStatus, setSaleStatus] = useState<'sale' | 'closed'>(initialStatus);
  const [dateStatusMap, setDateStatusMap] = useState<Record<string, 'sale' | 'closed'>>({});
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  // 초이스별 날짜별 판매 상태 (choiceId -> date -> 'sale' | 'closed')
  const [choiceDateStatusMap, setChoiceDateStatusMap] = useState<Record<string, Record<string, 'sale' | 'closed'>>>({});
  const [dateRangeSelection, setDateRangeSelection] = useState<DateRangeSelection>({
    startDate: '',
    endDate: '',
    selectedDays: [0, 1, 2, 3, 4, 5, 6]
  });
  const [, setLoadingStatus] = useState(false);

  // 현재 채널의 날짜별 판매 상태 로드
  useEffect(() => {
    if (!isOpen || !productId) return;
    
    const loadDateStatus = async () => {
      setLoadingStatus(true);
      try {
        // 채널 ID 결정
        let targetChannelId = channelId;
        if (!targetChannelId && channelType === 'SELF') {
          // 자체 채널 타입이면 해당 타입의 첫 번째 채널 사용
          // type이 'self' 또는 'partner'이거나, category가 'Own', 'Self', 'Partner'인 채널 찾기
          const { data: channels, error: channelError } = await supabase
            .from('channels')
            .select('id')
            .or('type.eq.self,type.eq.partner,category.eq.Own,category.eq.Self,category.eq.Partner')
            .eq('status', 'active')
            .limit(1);
          
          if (!channelError && channels && channels.length > 0) {
            targetChannelId = channels[0].id;
          }
        }
        
        if (!targetChannelId) {
          setLoadingStatus(false);
          return;
        }
        
        // 현재 날짜부터 1년 후까지의 데이터 조회
        const today = new Date().toISOString().split('T')[0];
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        const endDate = oneYearLater.toISOString().split('T')[0];
        
        const { data: pricingData, error } = await supabase
          .from('dynamic_pricing')
          .select('date, is_sale_available, choices_pricing')
          .eq('product_id', productId)
          .eq('channel_id', targetChannelId)
          .gte('date', today)
          .lte('date', endDate)
          .order('date', { ascending: true });
        
        if (error) {
          console.error('판매 상태 로드 오류:', error);
          setLoadingStatus(false);
          return;
        }
        
        // 날짜별 판매 상태 맵 생성
        const statusMap: Record<string, 'sale' | 'closed'> = {};
        const choiceStatusMapLocal: Record<string, Record<string, 'sale' | 'closed'>> = {};
        
        if (pricingData) {
          pricingData.forEach((item) => {
            const dateStr = item.date;
            // 데이터가 있으면 is_sale_available 값 사용, 없으면 마감(closed)
            statusMap[dateStr] = item.is_sale_available === false ? 'closed' : 'sale';
            
            // 초이스별 판매 상태 로드
            if (item.choices_pricing && typeof item.choices_pricing === 'object') {
              Object.entries(item.choices_pricing).forEach(([choiceId, choiceData]) => {
                if (choiceData && typeof choiceData === 'object') {
                  const isSaleAvailable = (choiceData as any).is_sale_available !== false;
                  if (!choiceStatusMapLocal[choiceId]) {
                    choiceStatusMapLocal[choiceId] = {};
                  }
                  choiceStatusMapLocal[choiceId][dateStr] = isSaleAvailable ? 'sale' : 'closed';
                }
              });
            }
          });
        }
        
        setDateStatusMap(statusMap);
        setChoiceDateStatusMap(choiceStatusMapLocal);
      } catch (error) {
        console.error('판매 상태 로드 실패:', error);
      } finally {
        setLoadingStatus(false);
      }
    };
    
    loadDateStatus();
  }, [isOpen, productId, channelId, channelType]);

  // 날짜 범위 선택 핸들러
  const handleDateRangeSelection = useCallback((selection: DateRangeSelection) => {
    setDateRangeSelection(selection);
    
    if (selection.startDate && selection.endDate) {
      const start = new Date(selection.startDate);
      const end = new Date(selection.endDate);
      const dates: Date[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      
      setSelectedDates(dates);
    }
  }, []);

  // 날짜별 상태 토글 핸들러 (즉시 저장)
  const handleDateStatusToggle = useCallback(async (date: string, currentStatus: 'sale' | 'closed') => {
    // 현재 상태의 반대로 토글
    const newStatus = currentStatus === 'sale' ? 'closed' : 'sale';
    
    // 초이스가 선택된 경우 해당 초이스의 날짜 상태 업데이트
    if (selectedChoiceId) {
      setChoiceDateStatusMap(prev => ({
        ...prev,
        [selectedChoiceId]: {
          ...(prev[selectedChoiceId] || {}),
          [date]: newStatus
        }
      }));

      // 즉시 저장
      try {
        const dateObj = new Date(date);
        const choiceStatusMapForSave: Record<string, boolean> = {
          [selectedChoiceId]: newStatus === 'sale'
        };
        await onSave([dateObj], newStatus, choiceStatusMapForSave);
      } catch (error) {
        console.error('초이스별 상태 저장 실패:', error);
      }
    } else {
      // 전체 상품 날짜 상태 업데이트
      setDateStatusMap(prev => ({
        ...prev,
        [date]: newStatus
      }));

      // 즉시 저장
      try {
        const dateObj = new Date(date);
        await onSave([dateObj], newStatus);
      } catch (error) {
        console.error('상태 저장 실패:', error);
      }
    }
  }, [onSave, selectedChoiceId]);

  // 초이스 선택 핸들러
  const handleChoiceSelect = useCallback((choiceId: string) => {
    setSelectedChoiceId(prev => prev === choiceId ? null : choiceId);
  }, []);

  // 초이스별 날짜 상태 토글 핸들러
  const handleChoiceDateStatusToggle = useCallback(async (date: string, currentStatus: 'sale' | 'closed') => {
    if (!selectedChoiceId) return;
    
    const newStatus = currentStatus === 'sale' ? 'closed' : 'sale';
    
    setChoiceDateStatusMap(prev => ({
      ...prev,
      [selectedChoiceId]: {
        ...(prev[selectedChoiceId] || {}),
        [date]: newStatus
      }
    }));

    // 즉시 저장
    try {
      const dateObj = new Date(date);
      const choiceStatusMapForSave: Record<string, boolean> = {
        [selectedChoiceId]: newStatus === 'sale'
      };
      await onSave([dateObj], 'sale', choiceStatusMapForSave);
    } catch (error) {
      console.error('초이스별 날짜 상태 저장 실패:', error);
    }
  }, [selectedChoiceId, onSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>판매 상태 설정</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 판매 상태 토글 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              {t('saleStatus')}
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSaleStatus('sale')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  saleStatus === 'sale'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {saleStatus === 'sale' ? (
                  <ToggleRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
                <span>판매</span>
              </button>
              <button
                onClick={() => setSaleStatus('closed')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  saleStatus === 'closed'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {saleStatus === 'closed' ? (
                  <ToggleRight className="h-5 w-5 text-red-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
                <span>{t('closed')}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              {t('applyDates')}
            </label>
            <DateRangeSelector
              initialSelection={dateRangeSelection}
              onDateRangeSelect={handleDateRangeSelection}
              saleStatus={saleStatus}
              showStatusOnCalendar={true}
              onDateStatusToggle={handleDateStatusToggle}
              dateStatusMap={dateStatusMap}
              disableDateSelection={true}
            />
            
            {/* 상태 범례 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>판매중</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>마감</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                💡 날짜를 더블클릭하여 판매/마감 상태를 토글하고 즉시 저장됩니다
              </div>
            </div>
          </div>

          {/* 초이스별 판매 상태 설정 */}
          {choiceCombinations.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                {t('choiceSaleStatusSetting')}
              </label>
              
              {/* 초이스 목록 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 mb-4">
                  {choiceCombinations.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => handleChoiceSelect(choice.id)}
                      className={`w-full flex items-center justify-between p-3 bg-white rounded-lg border-2 transition-all ${
                        selectedChoiceId === choice.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {choice.combination_name_ko || choice.combination_name}
                        </div>
                        {choice.combination_key && (
                          <div className="text-xs text-gray-500 mt-1">
                            {choice.combination_key}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedChoiceId === choice.id && (
                          <span className="text-xs text-blue-600 font-medium">{t('selectedLegend')}</span>
                        )}
                        <ChevronRight className={`h-4 w-4 transition-transform ${
                          selectedChoiceId === choice.id ? 'text-blue-600 rotate-90' : 'text-gray-400'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* 선택된 초이스의 달력 */}
                {selectedChoiceId && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {choiceCombinations.find(c => c.id === selectedChoiceId)?.combination_name_ko || 
                         choiceCombinations.find(c => c.id === selectedChoiceId)?.combination_name || 
                         '초이스'} 달력
                      </h4>
                      <p className="text-xs text-gray-500">
                        날짜를 더블클릭하여 판매/마감 상태를 토글하세요
                      </p>
                    </div>
                    <DateRangeSelector
                      initialSelection={dateRangeSelection}
                      onDateRangeSelect={handleDateRangeSelection}
                      saleStatus={saleStatus}
                      showStatusOnCalendar={true}
                      onDateStatusToggle={handleChoiceDateStatusToggle}
                      dateStatusMap={choiceDateStatusMap[selectedChoiceId] || {}}
                      disableDateSelection={true}
                    />
                    <div className="mt-3 flex items-center space-x-4 text-xs text-gray-600">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{t('onSale')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{t('closed')}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {!selectedChoiceId && (
                  <div className="text-xs text-gray-500 text-center py-4">
                    💡 {t('choiceCalendarHint')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 선택된 날짜 미리보기 */}
          {selectedDates.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                선택된 날짜 ({selectedDates.length}일)
              </label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {selectedDates.map((date, index) => (
                    <div key={index} className="text-gray-600">
                      {date.toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
});
