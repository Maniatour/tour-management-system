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
  productBasePrice?: {
    adult: number;
    child: number;
    infant: number;
  };
  selectedVariant?: string;
  productId?: string;
  onDateClick?: (date: string) => void;
  /** 해당 채널의 쿠폰 목록 (캘린더 상단 쿠폰 선택기용) */
  channelCoupons?: Array<{
    id: string;
    coupon_code: string;
    percentage_value?: number | null;
    fixed_value?: number | null;
    discount_type?: string | null;
  }>;
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
  channelInfo,
  productBasePrice = { adult: 0, child: 0, infant: 0 },
  selectedVariant = 'default',
  productId,
  onDateClick,
  channelCoupons = []
}: PricingCalendarProps) {
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [selectedPriceTypes, setSelectedPriceTypes] = useState<Set<string>>(
    new Set(['maxSalePrice', 'discountPrice', 'netPrice']) // 기본값: 모두 선택
  );
  /** 캘린더 상단 쿠폰 선택 (선택 시 해당 쿠폰 %로 손님 지불가/Net Price 재계산) */
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  /** 날짜 셀 호버 시 가격 계산식 툴팁용 */
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

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

    // 먼저 채널로 필터링
    let filteredRules = rules;
    
    if (selectedChannelId) {
      const mappedChannelId = mapChannelId(selectedChannelId);
      filteredRules = rules.filter(r => r.channel_id === mappedChannelId);
      // 특정 채널이 선택된 경우, 필터링 결과가 없으면 undefined 반환
      if (filteredRules.length === 0) {
        // 디버깅: 필터링 결과가 없는 경우
        console.log(`채널 ${selectedChannelId} (매핑: ${mappedChannelId})에 대한 규칙을 찾을 수 없음:`, {
          totalRules: rules.length,
          availableChannels: [...new Set(rules.map(r => r.channel_id))],
          rules: rules.map(r => ({ id: r.id, channel_id: r.channel_id, date: r.date }))
        });
        return undefined;
      }
    } else if (selectedChannelType === 'SELF') {
      filteredRules = rules.filter(r => r.channel_id?.startsWith('B'));
      if (filteredRules.length === 0) {
        return undefined;
      }
    } else if (selectedChannelType === 'OTA') {
      filteredRules = rules.filter(r => !r.channel_id?.startsWith('B'));
      if (filteredRules.length === 0) {
        return undefined;
      }
    }

    // variant_key로 필터링 (null/빈 문자열은 'default'로 정규화하여 비교)
    const normSelected = (selectedVariant ?? '').toString().trim() || 'default';
    filteredRules = filteredRules.filter(r => {
      const normRuleKey = (r.variant_key ?? '').toString().trim() || 'default';
      return normRuleKey === normSelected;
    });
    if (filteredRules.length === 0) {
      return undefined;
    }

    // 항상 첫 번째 규칙 반환 (필터링 없음)
    return filteredRules[0];
  }, [selectedChannelId, selectedChannelType, selectedVariant]);

  // 쿠폰 선택 시 적용할 할인 % (percentage 타입만 반영, 없으면 rule 값 사용)
  const effectiveCouponPercent = selectedCouponId && channelCoupons?.length
    ? (() => {
        const c = channelCoupons.find(c => c.id === selectedCouponId);
        return c?.discount_type === 'percentage' && c?.percentage_value != null ? c.percentage_value : null;
      })()
    : null;

  // 날짜별 단일 가격 정보 가져오기 (최대 판매가, 할인 가격, Net Price) + 툴팁용 breakdown
  // 쿠폰 선택기가 있으면 해당 쿠폰 %로 손님 지불가·Net Price 계산
  const getSinglePriceForDate = useCallback((date: string): {
    maxSalePrice: number;
    discountPrice: number;
    netPrice: number;
    isOTA: boolean;
    /** 마우스 오버 툴팁용: OTA판매가, 불포함, 수수료%, 적용 쿠폰%, 손님 지불가, Net Price */
    breakdown?: {
      otaSalePrice: number;
      notIncludedPrice: number;
      commissionPercent: number;
      couponPercentUsed: number;
      customerPay: number;
      netPrice: number;
    };
  } | null => {
    // 1. 날짜 정규화 및 데이터 찾기
    const pricingRules = getPricingForDate(date);
    if (!pricingRules || pricingRules.length === 0) {
      return null;
    }
    
    const rule = pickRuleForChannel(pricingRules);
    if (!rule) {
      // 디버깅: 규칙을 찾지 못한 경우
      if (selectedChannelId) {
        console.log(`날짜 ${date} - 선택된 채널 ${selectedChannelId}에 대한 규칙을 찾을 수 없음:`, {
          availableRules: pricingRules.map(r => ({
            id: r.id,
            channel_id: r.channel_id,
            date: r.date
          }))
        });
      }
      return null;
    }
    
    // 선택된 채널이 있는 경우, 규칙의 채널 ID가 일치하는지 확인
    if (selectedChannelId) {
      const mappedChannelId = mapChannelId(selectedChannelId);
      if (rule.channel_id !== mappedChannelId) {
        console.warn(`날짜 ${date} - 규칙의 채널 ID(${rule.channel_id})가 선택된 채널(${mappedChannelId})과 일치하지 않음`);
        return null;
      }
    }
    
    // 3. OTA 채널 여부 확인
    const isOTA = selectedChannelType === 'OTA' || 
                  (channelInfo && (channelInfo as any).type?.toLowerCase() === 'ota');
    
    // 4. 초이스 가격 정보 가져오기 (OTA 판매가·불포함 금액 모두 초이스별 설정에서 로드)
    // 기본 가격의 불포함 금액은 "초이스가 없는 상품"에서만 사용. 초이스가 있으면 반드시 초이스별 값을 사용.
    let otaSalePrice = 0;
    let choicePrice = 0;
    let notIncludedPrice = rule.not_included_price ?? 0; // 초이스 없을 때만 사용
    // rule.adult_price는 증차감 금액(price_adjustment)이므로, 실제 기본 가격은 상품 기본 가격을 사용
    const priceAdjustment = rule.adult_price || 0;
    const basePrice = productBasePrice.adult + priceAdjustment;
    
    if (rule.choices_pricing) {
      try {
        const choicesData = typeof rule.choices_pricing === 'string' 
          ? JSON.parse(rule.choices_pricing) 
          : rule.choices_pricing;
        
        // 초이스가 없는 경우 (no_choice) — 기본 가격/불포함 사용
        if (choicesData['no_choice']) {
          if (selectedChoice && selectedChoice !== '' && selectedChoice !== 'no_choice') {
            return null;
          }
          const noChoiceData = choicesData['no_choice'];
          otaSalePrice = noChoiceData?.ota_sale_price ?? 0;
          choicePrice = 0;
          // no_choice = 초이스 없는 상품 → 기본 가격 쪽 불포함 금액 사용
          notIncludedPrice = noChoiceData?.not_included_price ?? rule.not_included_price ?? 0;
        } else {
          // 초이스가 있는 상품 — 반드시 초이스별 가격 설정에서 OTA 판매가·불포함 금액 로드
          let choiceId = selectedChoice;
          if (choiceId && choiceId !== '' && choicesData[choiceId]) {
            // 매칭된 초이스 사용
          } else if (choiceId && choiceId !== '') {
            const firstChoiceId = Object.keys(choicesData).find(k => k !== 'no_choice');
            if (firstChoiceId) choiceId = firstChoiceId;
          } else {
            const firstChoiceId = Object.keys(choicesData).find(k => k !== 'no_choice');
            if (firstChoiceId) choiceId = firstChoiceId;
          }
          
          if (choiceId && choicesData[choiceId]) {
            const choiceData = choicesData[choiceId];
            otaSalePrice = choiceData?.ota_sale_price ?? 0;
            choicePrice = choiceData?.adult_price ?? choiceData?.adult ?? 0;
            // 초이스별 가격 설정에 있는 불포함 금액 사용 (기본 가격 불포함은 초이스 없는 상품 전용)
            notIncludedPrice = choiceData?.not_included_price ?? 0;
          } else if (selectedChoice && selectedChoice !== '' && Object.keys(choicesData).filter(k => k !== 'no_choice').length === 0) {
            return null;
          }
        }
      } catch (e) {
        console.warn('choices_pricing 파싱 오류:', e);
      }
    } else if (selectedChoice && selectedChoice !== '') {
      return null;
    }
    
    // 6. 최대 판매가 계산
    // choices_pricing이 있으면 basePrice + choicePrice를 사용, 없으면 basePrice만 사용
    // 홈페이지 채널(M00001)의 경우: 기본가격이 0이고 초이스 가격만 있는 경우도 처리
    const totalBasePrice = basePrice + choicePrice;
    let maxSalePrice = 0;
    
    // 홈페이지 채널 확인
    const isHomepageChannel = selectedChannelId === 'M00001' || 
                              selectedChannelId?.toLowerCase() === 'm00001' ||
                              (channelInfo && (channelInfo as any).id === 'M00001');
    
    if ((isOTA || isHomepageChannel) && otaSalePrice > 0) {
      // OTA 채널 또는 홈페이지 채널이고 판매가가 있으면 판매가 사용
      maxSalePrice = otaSalePrice;
    } else {
      // 기본 가격 + 초이스 가격 + 마크업
      // 기본가격이 0이고 초이스 가격만 있는 경우도 처리 (홈페이지 채널 등)
      const markupAmount = rule.markup_amount || 0;
      const markupPercent = rule.markup_percent || 0;
      if (totalBasePrice > 0) {
        maxSalePrice = totalBasePrice + markupAmount + (totalBasePrice * markupPercent / 100);
      } else if (choicePrice > 0) {
        // 기본가격이 0이고 초이스 가격만 있는 경우 (홈페이지 채널 등)
        maxSalePrice = choicePrice + markupAmount + (choicePrice * markupPercent / 100);
      }
    }
    
    // 7. 적용 쿠폰 % (캘린더 쿠폰 선택기 우선, 없으면 rule 값)
    const couponPercentUsed = effectiveCouponPercent !== null ? effectiveCouponPercent : (rule.coupon_percent || 0);
    // 할인 가격 = 최대 판매가 × (1 - 쿠폰%)
    const discountPrice = maxSalePrice * (1 - couponPercentUsed / 100);

    // 8. Net Price 계산
    let netPrice = 0;
    const commissionPercent = rule.commission_percent || 0;
    const commissionBasePriceOnly = channelInfo?.commission_base_price_only || false;

    if ((isOTA || isHomepageChannel) && otaSalePrice > 0) {
      // OTA/홈페이지: OTA판매가 × (1 - 쿠폰%) × (1 - 수수료%) + 불포함
      const baseNetPrice = otaSalePrice * (1 - couponPercentUsed / 100) * (1 - commissionPercent / 100);
      netPrice = baseNetPrice + notIncludedPrice;
    } else {
      const baseNetPrice = discountPrice * (1 - commissionPercent / 100);
      netPrice = baseNetPrice + notIncludedPrice;
    }

    // 손님 지불가 = (OTA 판매가 × (1 - 쿠폰%) 또는 OTA 판매가) + 불포함 금액
    const customerPay = (otaSalePrice * (1 - couponPercentUsed / 100)) + notIncludedPrice;

    // 9. 결과 반환 (소수점 2자리) + 툴팁용 breakdown
    return {
      maxSalePrice: Math.round(maxSalePrice * 100) / 100,
      discountPrice: Math.round(discountPrice * 100) / 100,
      netPrice: Math.round(netPrice * 100) / 100,
      isOTA,
      breakdown: {
        otaSalePrice: Math.round(otaSalePrice * 100) / 100,
        notIncludedPrice: Math.round(notIncludedPrice * 100) / 100,
        commissionPercent,
        couponPercentUsed,
        customerPay: Math.round(customerPay * 100) / 100,
        netPrice: Math.round(netPrice * 100) / 100
      }
    };
  }, [selectedChoice, selectedVariant, pickRuleForChannel, getPricingForDate, channelInfo, productBasePrice, selectedChannelId, selectedChannelType, effectiveCouponPercent]);

  /** 날짜 셀 호버 시 가격 계산식 툴팁 텍스트 */
  const getBreakdownTooltipText = useCallback((b: { otaSalePrice: number; notIncludedPrice: number; commissionPercent: number; couponPercentUsed: number; customerPay: number; netPrice: number } | undefined) => {
    if (!b) return '';
    const { otaSalePrice, notIncludedPrice, commissionPercent, couponPercentUsed, customerPay, netPrice } = b;
    const head = [`OTA 판매가 = $${otaSalePrice.toFixed(2)}`, `불포함 금액 = $${notIncludedPrice.toFixed(2)}`, `수수료(%) = ${commissionPercent}%`];
    if (couponPercentUsed > 0) head.push(`쿠폰(%) = ${couponPercentUsed}%`);
    if (couponPercentUsed > 0) {
      const afterCoupon = otaSalePrice * (1 - couponPercentUsed / 100);
      return [...head, '', `손님 지불가: $${otaSalePrice.toFixed(2)} × (1 - ${couponPercentUsed}%) + $${notIncludedPrice.toFixed(2)} = $${afterCoupon.toFixed(2)} + $${notIncludedPrice.toFixed(2)} = $${customerPay.toFixed(2)}`, `Net Price: $${afterCoupon.toFixed(2)} × (1 - ${commissionPercent}%) + $${notIncludedPrice.toFixed(2)} = $${netPrice.toFixed(2)}`].join('\n');
    }
    return [...head, '', `손님 지불가: $${otaSalePrice.toFixed(2)} + $${notIncludedPrice.toFixed(2)} = $${customerPay.toFixed(2)}`, `Net Price: $${otaSalePrice.toFixed(2)} × (1 - ${commissionPercent}%) + $${notIncludedPrice.toFixed(2)} = $${netPrice.toFixed(2)}`].join('\n');
  }, []);

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

  const handleDateClick = (day: number, event: React.MouseEvent) => {
    const dateString = getDateString(day);
    
    // 날짜 클릭 시 히스토리 모달 열기 (onDateClick이 있는 경우)
    if (onDateClick && typeof onDateClick === 'function') {
      onDateClick(dateString);
    } else {
      // onDateClick이 없으면 기존 동작 (날짜 선택)
      onDateSelect(dateString);
    }
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
    
    // dynamicPricingData에서 해당 날짜에 데이터가 있는지 확인 (필터 고려)
    const normalizedSearchDate = normalizeDateValue(dateString);
    let hasDataForDate = false;
    let hasRuleButNoPrice = false; // 규칙은 있지만 선택된 초이스/variant에 맞는 가격이 없는 경우
    
    if (normalizedSearchDate && normalizedPricingMap[normalizedSearchDate]) {
      const rulesForDate = normalizedPricingMap[normalizedSearchDate];
      
      // 항상 모든 규칙이 있으면 데이터 있음
      hasDataForDate = rulesForDate.length > 0;
      
      // 규칙은 있지만 선택된 초이스나 variant에 맞는 가격이 없는 경우
      if (hasDataForDate && !singlePrice) {
        hasRuleButNoPrice = true;
      }
    }

    const breakdownTooltipText = singlePrice?.breakdown ? getBreakdownTooltipText(singlePrice.breakdown) : '';

    return (
      <button
        key={day}
        type="button"
        onClick={(e) => handleDateClick(day, e)}
        onMouseDown={() => handleDateMouseDown(day, 0)}
        onMouseEnter={() => setHoveredDate(dateString)}
        onMouseLeave={() => setHoveredDate(null)}
        title={hasDataForDate ? '클릭: 가격 히스토리 보기' : '날짜 선택'}
        className={`relative p-2 h-20 border border-gray-200 hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-100 border-blue-300' : ''
        } ${isToday ? 'ring-2 ring-blue-500' : ''} ${hasDataForDate ? 'cursor-pointer' : ''}`}
      >
        {/* 마우스 오버 시 가격 계산식 툴팁 */}
        {hoveredDate === dateString && breakdownTooltipText && (
          <div className="absolute bottom-full left-0 right-0 mb-1 z-[100] p-3 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none min-w-[300px] w-max max-w-[90vw]">
            <div className="space-y-1">
              {breakdownTooltipText.split('\n').map((line, i) => (
                <div key={i} className="whitespace-nowrap leading-tight">{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        )}
        {/* 날짜를 오른쪽 상단에 작은 글씨로 표시 */}
        <div className="absolute top-1 right-1 text-xs text-gray-500">{day}</div>
        
        {/* 가격 표시 (선택된 항목만 표시) */}
        {hasDataForDate || hasRuleButNoPrice ? (
          <div className="absolute bottom-1 left-1 text-xs space-y-0.5">
            {singlePrice ? (
              <>
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
              </>
            ) : (
              /* 선택된 초이스나 variant에 맞는 가격이 없을 때 */
              <div className="text-gray-400 text-[10px]">가격 없음</div>
            )}
          </div>
        ) : (
          /* 데이터가 없을 때만 표시 */
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
      {/* 초이스 선택 드롭다운 및 불포함 사항 필터 */}
      {choiceCombinations.length > 0 && (selectedChannelId || selectedChannelType) && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedChoice}
                onChange={(e) => setSelectedChoice(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-2 py-1 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">초이스를 선택하세요</option>
                {choiceCombinations.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.combination_name_ko || choice.combination_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
            {/* 해당 채널 쿠폰 선택 (선택 시 손님 지불가 / Net Price에 반영) */}
            {selectedChannelId && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">쿠폰</label>
                <div className="relative">
                  <select
                    value={selectedCouponId}
                    onChange={(e) => setSelectedCouponId(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 rounded-md px-2 py-1 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    title="쿠폰 선택 시 손님 지불가·Net Price가 해당 할인률로 재계산됩니다"
                  >
                    <option value="">쿠폰 없음</option>
                    {(channelCoupons || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.coupon_code}
                        {c.discount_type === 'percentage' && c.percentage_value != null ? ` (${c.percentage_value}%)` : ''}
                        {c.discount_type === 'fixed' && c.fixed_value != null ? ` ($${c.fixed_value})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
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
