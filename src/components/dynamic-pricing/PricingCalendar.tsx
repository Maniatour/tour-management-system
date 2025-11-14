import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, ChevronDown } from 'lucide-react';
import { SimplePricingRule } from '@/lib/types/dynamic-pricing';

const DATE_CAPTURE_REGEX = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/;
const YYYYMMDD_REGEX = /^\d{8}$/;
const NUMERIC_TIMESTAMP_REGEX = /^-?\d{10,}$/;

const formatDateParts = (year: string | number, month: string | number, day: string | number) => {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeDateValue = (value: string | number | Date | null | undefined): string => {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    const normalizedNumber = value.toString().length === 10 ? value * 1000 : value;
    const dateFromNumber = new Date(normalizedNumber);
    if (!isNaN(dateFromNumber.getTime())) {
      return formatDateParts(dateFromNumber.getFullYear(), dateFromNumber.getMonth() + 1, dateFromNumber.getDate());
    }
  }

  if (value === null || value === undefined) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (YYYYMMDD_REGEX.test(trimmed)) {
    return formatDateParts(trimmed.slice(0, 4), trimmed.slice(4, 6), trimmed.slice(6, 8));
  }

  const isoCandidate = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed.split(' ')[0];
  const isoMatch = isoCandidate.match(DATE_CAPTURE_REGEX);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return formatDateParts(year, month, day);
  }

  const generalMatch = trimmed.match(DATE_CAPTURE_REGEX);
  if (generalMatch) {
    const [, year, month, day] = generalMatch;
    return formatDateParts(year, month, day);
  }

  if (NUMERIC_TIMESTAMP_REGEX.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
      const timestamp = trimmed.length === 10 ? numericValue * 1000 : numericValue;
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return '';
};

interface PricingCalendarProps {
  currentMonth: Date;
  dynamicPricingData: Array<{
    date: string;
    rules: SimplePricingRule[];
  }>;
  selectedDates: string[];
  onMonthChange: (month: Date) => void;
  onDateSelect: (date: string) => void;
  onDateRangeSelect: (startIndex: number, endIndex: number) => void;
  choiceCombinations?: Array<{
    id: string;
    combination_name: string;
    combination_name_ko?: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>;
  selectedChannelId?: string;
  selectedChannelType?: 'OTA' | 'SELF' | '';
  channelInfo?: {
    id: string;
    not_included_type?: 'none' | 'amount_only' | 'amount_and_choice';
    not_included_price?: number;
    commission_base_price_only?: boolean;
    [key: string]: unknown;
  } | null;
}

export const PricingCalendar = memo(function PricingCalendar({
  currentMonth,
  dynamicPricingData,
  selectedDates,
  onMonthChange,
  onDateSelect,
  onDateRangeSelect,
  choiceCombinations = [],
  selectedChannelId,
  selectedChannelType,
  channelInfo
}: PricingCalendarProps) {
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [selectedPriceTypes, setSelectedPriceTypes] = useState<Set<string>>(
    new Set(['maxSalePrice', 'discountPrice', 'netPrice']) // 기본값: 모두 선택
  );

  // 초이스 조합이 로드되면 첫 번째 초이스를 기본값으로 선택
  useEffect(() => {
    if (choiceCombinations.length > 0 && !selectedChoice) {
      setSelectedChoice(choiceCombinations[0].id);
    }
  }, [choiceCombinations, selectedChoice]);

  // 가격 타입 토글 함수
  const togglePriceType = (priceType: string) => {
    setSelectedPriceTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(priceType)) {
        newSet.delete(priceType);
      } else {
        newSet.add(priceType);
      }
      return newSet;
    });
  };

  // 채널 ID 매핑 함수
  const mapChannelId = (channelId: string): string => {
    // 실제로는 매핑이 필요 없을 수도 있음 - 데이터베이스에서 이미 올바른 ID 사용
    // 만약 UI에서 다른 ID를 사용한다면 여기서 매핑
    const channelMapping: Record<string, string> = {
      // 'GetYourGuide': 'Partner5', // UI 이름 -> DB ID
      // 'Partner5': 'Partner5', // 이미 올바른 ID
    };
    
    return channelMapping[channelId] || channelId;
  };

  const normalizedPricingMap = useMemo(() => {
    return dynamicPricingData.reduce((acc, { date, rules }) => {
      const normalized = normalizeDateValue(date);
      if (!normalized) {
        return acc;
      }

      const currentRules = acc[normalized] || [];
      const nextRules = Array.isArray(rules) ? rules : [];
      acc[normalized] = currentRules.length ? [...currentRules, ...nextRules] : [...nextRules];
      return acc;
    }, {} as Record<string, SimplePricingRule[]>);
  }, [dynamicPricingData]);

  const normalizedSelectedDates = useMemo(() => {
    const set = new Set<string>();
    selectedDates.forEach(date => {
      const normalized = normalizeDateValue(date);
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [selectedDates]);

  const todayString = useMemo(() => normalizeDateValue(new Date()), []);
  const priceTooltip = useMemo(
    () =>
      [
        '최대 판매가 : OTA 사이트에서 판매가',
        '할인 가격 : OTA 사이트에서 쿠폰 적용 후 실 손님 구매가',
        'Net Price  : 수수료 제하고, 우리에게 실제 입금되는 가격'
      ].join('\n'),
    []
  );

  const getPricingForDate = useCallback((dateString: string): SimplePricingRule[] => {
    const normalizedSearchDate = normalizeDateValue(dateString);
    if (!normalizedSearchDate) {
      return [];
    }

    const direct = normalizedPricingMap[normalizedSearchDate];
    if (direct && direct.length > 0) {
      return direct;
    }

    // 데이터 구조가 예상과 다를 경우를 대비한 보조 검색
    const fallbackEntry = dynamicPricingData.find(({ date }) => normalizeDateValue(date) === normalizedSearchDate);
    return fallbackEntry?.rules || [];
  }, [dynamicPricingData, normalizedPricingMap]);

  const pickRuleForChannel = useCallback((rules: SimplePricingRule[]): SimplePricingRule | undefined => {
    if (!rules || rules.length === 0) return undefined;

    if (selectedChannelId) {
      const mappedChannelId = mapChannelId(selectedChannelId);
      const channelRule = rules.find(r => r.channel_id === mappedChannelId);
      if (channelRule) {
        return channelRule;
      }
    }

    if (selectedChannelType === 'SELF') {
      const selfRule = rules.find(r => r.channel_id?.startsWith('B'));
      if (selfRule) return selfRule;
    } else if (selectedChannelType === 'OTA') {
      const otaRule = rules.find(r => !r.channel_id?.startsWith('B'));
      if (otaRule) return otaRule;
    }

    return rules[0];
  }, [selectedChannelId, selectedChannelType]);

  // 날짜별 단일 가격 정보 가져오기 (최대 판매가, 할인 가격, Net Price)
  // 초이스 선택 및 필터 기능 포함
  const getSinglePriceForDate = (date: string): {
    maxSalePrice: number;
    discountPrice: number;
    netPrice: number;
    isOTA: boolean;
  } | null => {
    // 1. 날짜 정규화 및 데이터 찾기
    const pricingRules = getPricingForDate(date);
    if (!pricingRules || pricingRules.length === 0) {
      return null;
    }
    
    const rule = pickRuleForChannel(pricingRules);
    if (!rule) {
      return null;
    }
    
    // 3. OTA 채널 여부 확인
    const isOTA = selectedChannelType === 'OTA' || 
                  (channelInfo && (channelInfo as any).type?.toLowerCase() === 'ota');
    
    // 4. 초이스 가격 정보 가져오기
    let otaSalePrice = 0;
    let choicePrice = 0;
    const basePrice = rule.adult_price || 0;
    
    if (rule.choices_pricing) {
      try {
        // choices_pricing 파싱
        const choicesData = typeof rule.choices_pricing === 'string' 
          ? JSON.parse(rule.choices_pricing) 
          : rule.choices_pricing;
        
        // 선택된 초이스 ID 결정 (선택된 초이스가 있으면 사용, 없으면 첫 번째 초이스)
        const choiceId = selectedChoice || Object.keys(choicesData)[0];
        
        if (choiceId && choicesData[choiceId]) {
          const choiceData = choicesData[choiceId];
          otaSalePrice = choiceData?.ota_sale_price || 0;
          choicePrice = choiceData?.adult_price || choiceData?.adult || 0;
        }
      } catch (e) {
        console.warn('choices_pricing 파싱 오류:', e);
      }
    }
    
    // 5. 불포함 금액 확인
    const notIncludedType = channelInfo?.not_included_type || 'none';
    const notIncludedPrice = (notIncludedType !== 'none' && channelInfo?.not_included_price) 
      ? channelInfo.not_included_price 
      : (rule.not_included_price || 0);
    
    // 6. 최대 판매가 계산
    let maxSalePrice = 0;
    if (isOTA && otaSalePrice > 0) {
      // OTA 채널이고 OTA 판매가가 있으면 OTA 판매가 사용
      maxSalePrice = otaSalePrice;
    } else {
      // 기본 가격 + 마크업
      const markupAmount = rule.markup_amount || 0;
      const markupPercent = rule.markup_percent || 0;
      maxSalePrice = basePrice + markupAmount + (basePrice * markupPercent / 100);
    }
    
    // 7. 할인 가격 계산 (최대 판매가 × (1 - 쿠폰%))
    const couponPercent = rule.coupon_percent || 0;
    const discountPrice = maxSalePrice * (1 - couponPercent / 100);
    
    // 8. Net Price 계산
    let netPrice = 0;
    const commissionPercent = rule.commission_percent || 0;
    const commissionBasePriceOnly = channelInfo?.commission_base_price_only || false;
    
    if (isOTA && otaSalePrice > 0) {
      // OTA 채널인 경우
      if (commissionBasePriceOnly && notIncludedType === 'amount_and_choice') {
        // 수수료가 기본 가격에만 적용되고, 불포함 금액과 초이스 값이 별도로 추가되는 경우
        const baseNetPrice = otaSalePrice * (1 - couponPercent / 100) * (1 - commissionPercent / 100);
        netPrice = baseNetPrice + notIncludedPrice + choicePrice;
      } else {
        // 기본 계산: OTA 판매가 × (1 - 쿠폰 할인%) × (1 - 수수료%)
        netPrice = otaSalePrice * (1 - couponPercent / 100) * (1 - commissionPercent / 100);
      }
    } else {
      // 일반 채널: 할인 가격 × (1 - 수수료%)
      netPrice = discountPrice * (1 - commissionPercent / 100);
    }
    
    // 9. 결과 반환 (소수점 2자리로 반올림)
    return {
      maxSalePrice: Math.round(maxSalePrice * 100) / 100,
      discountPrice: Math.round(discountPrice * 100) / 100,
      netPrice: Math.round(netPrice * 100) / 100,
      isOTA
    };
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const getDateString = (day: number): string => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const isDateSelected = (dateString: string) => {
    const normalizedSearchDate = normalizeDateValue(dateString);
    if (!normalizedSearchDate) return false;
    return normalizedSelectedDates.has(normalizedSearchDate);
  };

  const handleDateClick = (day: number) => {
    const dateString = getDateString(day);
    onDateSelect(dateString);
  };

  const handleDateMouseDown = (day: number, index: number) => {
    const dateString = getDateString(day);
    // 범위 선택 로직은 부모 컴포넌트에서 처리
  };

  const renderDayCell = (day: number) => {
    const dateString = getDateString(day);
    
    const pricingRules = getPricingForDate(dateString);
    const isSelected = isDateSelected(dateString);
    const isToday = normalizeDateValue(dateString) === todayString;
    const singlePrice = getSinglePriceForDate(dateString);

    return (
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        onMouseDown={() => handleDateMouseDown(day, 0)}
        className={`relative p-2 h-20 border border-gray-200 hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-100 border-blue-300' : ''
        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
      >
        {/* 날짜를 오른쪽 상단에 작은 글씨로 표시 */}
        <div className="absolute top-1 right-1 text-xs text-gray-500">{day}</div>
        
        {/* 가격 표시 (선택된 항목만 표시) */}
        {singlePrice && (
          <div className="absolute bottom-1 left-1 text-xs space-y-0.5">
            {selectedPriceTypes.has('maxSalePrice') && singlePrice.maxSalePrice > 0 && (
              <div className="text-green-600 font-semibold">${singlePrice.maxSalePrice.toFixed(2)}</div>
            )}
            {selectedPriceTypes.has('discountPrice') && singlePrice.discountPrice > 0 && (
              <div className="text-blue-600">${singlePrice.discountPrice.toFixed(2)}</div>
            )}
            {selectedPriceTypes.has('netPrice') && singlePrice.netPrice > 0 && (
              <div className="text-purple-600 font-bold">${singlePrice.netPrice.toFixed(2)}</div>
            )}
            {/* 가격이 모두 0이거나 선택되지 않은 경우에도 표시 */}
            {singlePrice.maxSalePrice === 0 && singlePrice.discountPrice === 0 && singlePrice.netPrice === 0 && (
              <div className="text-gray-400 text-[10px]">가격 없음</div>
            )}
          </div>
        )}
        
        {/* 데이터가 없을 때 표시 */}
        {!singlePrice && (
          <div className="absolute bottom-1 left-1 text-xs text-gray-400">
            데이터 없음
          </div>
        )}
        
        {/* 기존 가격 표시 아이콘 */}
        {pricingRules.length > 0 && !selectedChoice && !singlePrice && (
          <div className="absolute bottom-1 right-1">
            <DollarSign className="h-3 w-3 text-green-600" />
          </div>
        )}
        {pricingRules.length > 1 && !selectedChoice && !singlePrice && (
          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pricingRules.length}
          </div>
        )}
      </button>
    );
  };

  const renderEmptyCells = () => {
    return Array.from({ length: startingDayOfWeek }, (_, index) => (
      <div key={`empty-${index}`} className="p-2 h-20 border border-gray-200 bg-gray-50"></div>
    ));
  };

  const renderDays = () => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return renderDayCell(day);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 초이스 선택 드롭다운 */}
      {choiceCombinations.length > 0 && (selectedChannelId || selectedChannelType) && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">초이스 선택:</label>
            <div className="relative">
              <select
                value={selectedChoice}
                onChange={(e) => setSelectedChoice(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">초이스를 선택하세요</option>
                {choiceCombinations.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.combination_name_ko || choice.combination_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          {/* 가격 범례 (다중 선택 가능) */}
          <div className="mt-3 flex items-center space-x-4 text-xs">
            <button
              type="button"
              onClick={() => togglePriceType('maxSalePrice')}
              title={priceTooltip}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                selectedPriceTypes.has('maxSalePrice')
                  ? 'bg-green-100 border border-green-600'
                  : 'bg-gray-100 border border-gray-300 opacity-50'
              }`}
            >
              <div className={`w-3 h-3 rounded ${selectedPriceTypes.has('maxSalePrice') ? 'bg-green-600' : 'bg-gray-400'}`}></div>
              <span className="text-gray-600">최대 판매가</span>
            </button>
            <button
              type="button"
              onClick={() => togglePriceType('discountPrice')}
              title={priceTooltip}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                selectedPriceTypes.has('discountPrice')
                  ? 'bg-blue-100 border border-blue-600'
                  : 'bg-gray-100 border border-gray-300 opacity-50'
              }`}
            >
              <div className={`w-3 h-3 rounded ${selectedPriceTypes.has('discountPrice') ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
              <span className="text-gray-600">할인 가격</span>
            </button>
            <button
              type="button"
              onClick={() => togglePriceType('netPrice')}
              title={priceTooltip}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                selectedPriceTypes.has('netPrice')
                  ? 'bg-purple-100 border border-purple-600'
                  : 'bg-gray-100 border border-gray-300 opacity-50'
              }`}
            >
              <div className={`w-3 h-3 rounded ${selectedPriceTypes.has('netPrice') ? 'bg-purple-600' : 'bg-gray-400'}`}></div>
              <span className="text-gray-600">Net Price</span>
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </h3>
        </div>
        
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7">
        {renderEmptyCells()}
        {renderDays()}
      </div>

      {/* 범례 */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span>가격 설정됨</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              2
            </div>
            <span>다중 규칙</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>선택된 날짜</span>
          </div>
        </div>
      </div>
    </div>
  );
});
