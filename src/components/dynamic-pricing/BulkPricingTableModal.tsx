'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, Save, Calculator } from 'lucide-react';
import { SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { supabase } from '@/lib/supabase';

interface Channel {
  id: string;
  name: string;
  type: string;
  pricing_type?: 'separate' | 'single';
  commission_percent?: number;
  commission_base_price_only?: boolean;
  not_included_type?: 'none' | 'amount_only' | 'amount_and_choice';
}

interface ChoiceCombination {
  id: string;
  combination_name: string;
  combination_name_ko?: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
}

interface BulkPricingRow {
  id: string;
  channelId: string;
  channelName: string;
  startDate: string;
  endDate: string;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  priceAdjustmentAdult: number;
  priceAdjustmentChild: number;
  priceAdjustmentInfant: number;
  commissionPercent: number;
  couponPercent: number;
  markupAmount: number;
  markupPercent: number;
  notIncludedPrice: number;
  choicePricing: Record<string, {
    adult: number;
    child: number;
    infant: number;
  }>;
}

interface BulkPricingTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  channels: Channel[];
  choiceCombinations: ChoiceCombination[];
  onSave?: () => void;
}

export default function BulkPricingTableModal({
  isOpen,
  onClose,
  productId,
  channels,
  choiceCombinations,
  onSave
}: BulkPricingTableModalProps) {
  const [rows, setRows] = useState<BulkPricingRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [productBasePrice, setProductBasePrice] = useState<{
    adult: number;
    child: number;
    infant: number;
  }>({
    adult: 0,
    child: 0,
    infant: 0
  });

  const { savePricingRulesBatch } = useDynamicPricing({
    productId,
    onSave: () => {
      setSaveMessage('가격 규칙이 성공적으로 저장되었습니다.');
      setTimeout(() => {
        setSaveMessage('');
        if (onSave) onSave();
      }, 2000);
    }
  });

  // 상품 기본 가격 불러오기
  useEffect(() => {
    const loadProductBasePrice = async () => {
      if (!productId) return;
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select('adult_base_price, child_base_price, infant_base_price')
          .eq('id', productId)
          .single();

        if (error) throw error;

        setProductBasePrice({
          adult: data?.adult_base_price || 0,
          child: data?.child_base_price || 0,
          infant: data?.infant_base_price || 0
        });
      } catch (error) {
        console.error('상품 기본 가격 로드 오류:', error);
      }
    };

    if (isOpen) {
      loadProductBasePrice();
    }
  }, [productId, isOpen]);

  // 모든 채널이 단일 가격인지 확인
  const isAllSinglePrice = useMemo(() => {
    if (channels.length === 0) return false;
    const allSingle = channels.every(channel => {
      const pricingType = (channel as any).pricing_type;
      return pricingType === 'single';
    });
    console.log('BulkPricingTableModal - isAllSinglePrice 계산:', {
      channelsCount: channels.length,
      channels: channels.map(ch => ({ id: ch.id, name: ch.name, pricing_type: (ch as any).pricing_type })),
      isAllSinglePrice: allSingle
    });
    return allSingle;
  }, [channels]);

  // 행 추가
  const handleAddRow = useCallback(() => {
    const defaultChannel = channels.length > 0 ? channels[0] : null;
    const defaultCommissionPercent = defaultChannel?.commission_percent || 0;
    
    const newRow: BulkPricingRow = {
      id: `row-${Date.now()}`,
      channelId: defaultChannel?.id || '',
      channelName: defaultChannel?.name || '',
      startDate: '',
      endDate: '',
      adultPrice: productBasePrice.adult,
      childPrice: productBasePrice.child,
      infantPrice: productBasePrice.infant,
      priceAdjustmentAdult: 0,
      priceAdjustmentChild: 0,
      priceAdjustmentInfant: 0,
      commissionPercent: defaultCommissionPercent,
      couponPercent: 0,
      markupAmount: 0,
      markupPercent: 0,
      notIncludedPrice: 0,
      choicePricing: {}
    };
    setRows([...rows, newRow]);
  }, [rows, channels, productBasePrice]);

  // 행 삭제
  const handleDeleteRow = useCallback((rowId: string) => {
    setRows(rows.filter(row => row.id !== rowId));
  }, [rows]);

  // 행 업데이트
  const handleUpdateRow = useCallback((rowId: string, field: keyof BulkPricingRow, value: unknown) => {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        if (field === 'channelId') {
          const channel = channels.find(c => c.id === value);
          const channelCommissionPercent = channel?.commission_percent || 0;
          return {
            ...row,
            channelId: value as string,
            channelName: channel?.name || '',
            commissionPercent: channelCommissionPercent // 채널 변경 시 수수료 %도 업데이트
          };
        }
        // 증차감 업데이트 시 최종 가격 자동 계산
        if (field === 'priceAdjustmentAdult') {
          return {
            ...row,
            priceAdjustmentAdult: value as number,
            adultPrice: productBasePrice.adult + (value as number)
          };
        }
        if (field === 'priceAdjustmentChild') {
          return {
            ...row,
            priceAdjustmentChild: value as number,
            childPrice: productBasePrice.child + (value as number)
          };
        }
        if (field === 'priceAdjustmentInfant') {
          return {
            ...row,
            priceAdjustmentInfant: value as number,
            infantPrice: productBasePrice.infant + (value as number)
          };
        }
        return { ...row, [field]: value };
      }
      return row;
    }));
  }, [rows, channels, productBasePrice]);

  // 초이스 가격 업데이트
  const handleUpdateChoicePricing = useCallback((
    rowId: string,
    choiceId: string,
    priceType: 'adult' | 'child' | 'infant',
    value: number,
    isSinglePriceMode?: boolean
  ) => {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        // 단일 가격 모드이고 성인 가격을 업데이트하는 경우, child와 infant도 동일하게 설정
        const updatedChoicePricing = {
          ...row.choicePricing,
          [choiceId]: {
            ...row.choicePricing[choiceId],
            [priceType]: value,
            ...(isSinglePriceMode && priceType === 'adult' ? {
              child: value,
              infant: value
            } : {})
          }
        };
        return { ...row, choicePricing: updatedChoicePricing };
      }
      return row;
    }));
  }, [rows]);

  // 가격 계산 함수 (초이스별 가격 포함)
  const calculatePrices = useCallback((row: BulkPricingRow, choiceId?: string) => {
    // 선택된 채널 정보 확인
    const selectedChannel = channels.find(ch => ch.id === row.channelId);
    const isOTAChannel = selectedChannel && (
      selectedChannel.type?.toLowerCase() === 'ota' || 
      selectedChannel.category === 'OTA'
    );

    // 단일 가격 모드 확인
    const isSinglePrice = (selectedChannel as any)?.pricing_type === 'single';

    // 성인 가격에만 수수료/쿠폰 할인 적용하는 플랫폼인지 확인
    // 하위 호환성: 특정 플랫폼 이름으로 판단
    const commissionAdultOnly = selectedChannel && (
      selectedChannel.name?.toLowerCase().includes('getyourguide') ||
      selectedChannel.name?.toLowerCase().includes('viator') ||
      selectedChannel.id?.toLowerCase().includes('gyg') ||
      selectedChannel.id?.toLowerCase().includes('viator')
    );

    // 판매가격에만 커미션 & 쿠폰 적용 여부 확인
    const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false;

    // 기본 가격 (불포함 금액은 계산식에 포함하지 않음)
    let basePrice = {
      adult: row.adultPrice,
      child: row.childPrice,
      infant: row.infantPrice
    };

    // 초이스별 가격 저장 (나중에 밸런스 계산에 사용)
    let choicePrice = {
      adult: 0,
      child: 0,
      infant: 0
    };

    // 초이스별 가격이 있으면 저장
    if (choiceId && row.choicePricing[choiceId]) {
      const choicePricing = row.choicePricing[choiceId];
      // 단일 가격 모드: adult 가격만 사용하고, child와 infant는 adult와 동일하게 설정
      if (isSinglePrice) {
        const singleChoicePrice = choicePricing.adult || 0;
        choicePrice = {
          adult: singleChoicePrice,
          child: singleChoicePrice,
          infant: singleChoicePrice
        };
      } else {
        choicePrice = {
          adult: choicePricing.adult || 0,
          child: choicePricing.child || 0,
          infant: choicePricing.infant || 0
        };
      }
      
      // 판매가격에만 커미션 적용이 체크되어 있지 않으면 기본 가격에 초이스 가격 추가
      if (!commissionBasePriceOnly) {
        basePrice = {
          adult: basePrice.adult + choicePrice.adult,
          child: basePrice.child + choicePrice.child,
          infant: basePrice.infant + choicePrice.infant
        };
      }
    }

    // 마크업 적용
    const markupPrice = {
      adult: basePrice.adult + row.markupAmount + (basePrice.adult * row.markupPercent / 100),
      child: basePrice.child + row.markupAmount + (basePrice.child * row.markupPercent / 100),
      infant: basePrice.infant + row.markupAmount + (basePrice.infant * row.markupPercent / 100)
    };

    // 최대 판매가 계산
    // commissionBasePriceOnly가 true이면 초이스 가격은 basePrice에 포함되지 않았으므로, 최대 판매가에 초이스 가격 추가
    let maxPrice = {
      adult: markupPrice.adult,
      child: markupPrice.child,
      infant: markupPrice.infant
    };
    
    // commissionBasePriceOnly가 true이고 초이스 가격이 있으면, 최대 판매가에 초이스 가격 추가
    if (commissionBasePriceOnly && choiceId && row.choicePricing[choiceId]) {
      maxPrice = {
        adult: markupPrice.adult + choicePrice.adult,
        child: markupPrice.child + choicePrice.child,
        infant: markupPrice.infant + choicePrice.infant
      };
    }

    // 할인 적용 (쿠폰 퍼센트)
    // 성인 가격에만 적용하는 플랫폼인 경우
    const discountPrice = commissionAdultOnly ? {
      adult: maxPrice.adult * (1 - row.couponPercent / 100),
      child: maxPrice.child, // 아동/유아는 할인 없음
      infant: maxPrice.infant // 아동/유아는 할인 없음
    } : {
      adult: maxPrice.adult * (1 - row.couponPercent / 100),
      child: maxPrice.child * (1 - row.couponPercent / 100),
      infant: maxPrice.infant * (1 - row.couponPercent / 100)
    };

    // OTA 판매가 계산
    const commissionRate = row.commissionPercent / 100;
    const couponDiscountRate = row.couponPercent / 100;
    const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
    
    let otaPrice;
    
    if (commissionBasePriceOnly) {
      // 판매가격에만 커미션 적용: 기본 가격에서 직접 수수료 역산 (20% 할인 제외, 쿠폰 할인 제외)
      // not_included_type이 'amount_and_choice'일 때는 초이스 가격을 제외한 기본 가격만 역산
      const priceForCommission = notIncludedType === 'amount_and_choice' 
        ? markupPrice  // 초이스 가격 제외
        : maxPrice;    // 초이스 가격 포함
      
      const commissionDenominator = 1 - commissionRate;
      otaPrice = {
        adult: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceForCommission.adult / commissionDenominator 
          : priceForCommission.adult,
        child: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceForCommission.child / commissionDenominator 
          : priceForCommission.child,
        infant: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceForCommission.infant / commissionDenominator 
          : priceForCommission.infant
      };
    } else {
      // 기존 로직: OTA 판매가 = (최대 판매가 × 0.8) / ((1 - 쿠폰 할인%) × (1 - 수수료율))
      // 20% 할인 적용 후, 쿠폰 할인과 수수료를 역산하여 OTA 판매가 계산
      
      // 최대 판매가에 20% 할인 적용
      const priceAfter20PercentDiscount = {
        adult: maxPrice.adult * 0.8,
        child: maxPrice.child * 0.8,
        infant: maxPrice.infant * 0.8
      };
      
      // 쿠폰 할인 역산: 할인된 가격을 원래 가격으로 복원
      // 성인 가격에만 적용하는 플랫폼인 경우
      const couponDenominator = 1 - couponDiscountRate;
      const priceAfterCouponReverse = commissionAdultOnly ? {
        adult: couponDenominator > 0 && couponDenominator !== 0
          ? priceAfter20PercentDiscount.adult / couponDenominator
          : priceAfter20PercentDiscount.adult,
        child: priceAfter20PercentDiscount.child, // 아동/유아는 쿠폰 할인 역산 없음
        infant: priceAfter20PercentDiscount.infant // 아동/유아는 쿠폰 할인 역산 없음
      } : {
        adult: couponDenominator > 0 && couponDenominator !== 0
          ? priceAfter20PercentDiscount.adult / couponDenominator
          : priceAfter20PercentDiscount.adult,
        child: couponDenominator > 0 && couponDenominator !== 0
          ? priceAfter20PercentDiscount.child / couponDenominator
          : priceAfter20PercentDiscount.child,
        infant: couponDenominator > 0 && couponDenominator !== 0
          ? priceAfter20PercentDiscount.infant / couponDenominator
          : priceAfter20PercentDiscount.infant
      };
      
      // 수수료 역산
      // 성인 가격에만 적용하는 플랫폼인 경우
      const commissionDenominator = 1 - commissionRate;
      otaPrice = commissionAdultOnly ? {
        adult: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceAfterCouponReverse.adult / commissionDenominator 
          : priceAfterCouponReverse.adult,
        child: priceAfterCouponReverse.child, // 아동/유아는 수수료 역산 없음
        infant: priceAfterCouponReverse.infant // 아동/유아는 수수료 역산 없음
      } : {
        adult: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceAfterCouponReverse.adult / commissionDenominator 
          : priceAfterCouponReverse.adult,
        child: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceAfterCouponReverse.child / commissionDenominator 
          : priceAfterCouponReverse.child,
        infant: commissionDenominator > 0 && commissionDenominator !== 0 
          ? priceAfterCouponReverse.infant / commissionDenominator 
          : priceAfterCouponReverse.infant
      };
    }

    // Net Price 계산
    let netPrice;
    if (isOTAChannel && commissionBasePriceOnly) {
      // OTA 채널이고 판매가격에만 커미션 적용이 체크되어 있으면
      const baseAdultPrice = basePrice.adult;
      const baseChildPrice = basePrice.child;
      const baseInfantPrice = basePrice.infant;
      
      const notIncludedPrice = row.notIncludedPrice || 0;
      const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
      
      // not_included_type이 'amount_and_choice'일 때는 초이스 가격을 Net Price에 포함하지 않음
      // (초이스 가격은 불포함 금액에 포함됨)
      if (notIncludedType === 'amount_and_choice') {
        // Net Price = 기본 가격 × (1 - 수수료%) (초이스 가격 제외)
        netPrice = {
          adult: baseAdultPrice * (1 - commissionRate),
          child: baseChildPrice * (1 - commissionRate),
          infant: baseInfantPrice * (1 - commissionRate)
        };
      } else {
        // Net Price = 기본 가격 × (1 - 수수료%) + 초이스 가격 + 불포함 가격
        netPrice = {
          adult: baseAdultPrice * (1 - commissionRate) + choicePrice.adult + notIncludedPrice,
          child: baseChildPrice * (1 - commissionRate) + choicePrice.child + notIncludedPrice,
          infant: baseInfantPrice * (1 - commissionRate) + choicePrice.infant + notIncludedPrice
        };
      }
    } else if (isOTAChannel) {
      // OTA 채널: OTA 판매가에 쿠폰 할인 적용 후 수수료 적용
      // 성인 가격에만 적용하는 플랫폼인 경우
      const otaPriceAfterCoupon = commissionAdultOnly ? {
        adult: otaPrice.adult * (1 - row.couponPercent / 100),
        child: otaPrice.child, // 아동/유아는 쿠폰 할인 없음
        infant: otaPrice.infant // 아동/유아는 쿠폰 할인 없음
      } : {
        adult: otaPrice.adult * (1 - row.couponPercent / 100),
        child: otaPrice.child * (1 - row.couponPercent / 100),
        infant: otaPrice.infant * (1 - row.couponPercent / 100)
      };
      netPrice = commissionAdultOnly ? {
        adult: otaPriceAfterCoupon.adult * (1 - row.commissionPercent / 100),
        child: otaPriceAfterCoupon.child, // 아동/유아는 수수료 없음
        infant: otaPriceAfterCoupon.infant // 아동/유아는 수수료 없음
      } : {
        adult: otaPriceAfterCoupon.adult * (1 - row.commissionPercent / 100),
        child: otaPriceAfterCoupon.child * (1 - row.commissionPercent / 100),
        infant: otaPriceAfterCoupon.infant * (1 - row.commissionPercent / 100)
      };
    } else {
      // 일반 채널: 할인 가격에 수수료 적용
      // 성인 가격에만 적용하는 플랫폼인 경우
      netPrice = commissionAdultOnly ? {
        adult: discountPrice.adult * (1 - row.commissionPercent / 100),
        child: discountPrice.child, // 아동/유아는 수수료 없음
        infant: discountPrice.infant // 아동/유아는 수수료 없음
      } : {
        adult: discountPrice.adult * (1 - row.commissionPercent / 100),
        child: discountPrice.child * (1 - row.commissionPercent / 100),
        infant: discountPrice.infant * (1 - row.commissionPercent / 100)
      };
    }

    return {
      maxPrice,
      netPrice,
      otaPrice
    };
  }, [channels]);

  // 저장
  const handleSave = useCallback(async () => {
    if (rows.length === 0) {
      setSaveMessage('저장할 데이터가 없습니다.');
      return;
    }

    setSaving(true);
    setSaveMessage('');

    try {
      const rulesData: SimplePricingRuleDto[] = [];

      for (const row of rows) {
        if (!row.channelId || !row.startDate || !row.endDate) {
          continue;
        }

        // 시작일부터 종료일까지 모든 날짜 생성
        const startDate = new Date(row.startDate);
        const endDate = new Date(row.endDate);
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dateString = date.toISOString().split('T')[0];
          
          // 초이스별 가격 구조 생성
          const choicesPricing: Record<string, {
            adult_price: number;
            child_price: number;
            infant_price: number;
          }> = {};

          Object.entries(row.choicePricing).forEach(([choiceId, prices]) => {
            choicesPricing[choiceId] = {
              adult_price: prices.adult || 0,
              child_price: prices.child || 0,
              infant_price: prices.infant || 0
            };
          });

          const ruleData: SimplePricingRuleDto = {
            product_id: productId,
            channel_id: row.channelId,
            date: dateString,
            adult_price: row.adultPrice,
            child_price: row.childPrice,
            infant_price: row.infantPrice,
            price_adjustment_adult: row.priceAdjustmentAdult,
            price_adjustment_child: row.priceAdjustmentChild,
            price_adjustment_infant: row.priceAdjustmentInfant,
            commission_percent: row.commissionPercent,
            markup_amount: row.markupAmount,
            coupon_percent: row.couponPercent,
            is_sale_available: true,
            not_included_price: row.notIncludedPrice,
            markup_percent: row.markupPercent,
            choices_pricing: Object.keys(choicesPricing).length > 0 ? choicesPricing : undefined
          };

          rulesData.push(ruleData);
        }
      }

      if (rulesData.length === 0) {
        setSaveMessage('유효한 데이터가 없습니다.');
        return;
      }

      await savePricingRulesBatch(rulesData);
      setSaveMessage(`${rulesData.length}개 가격 규칙이 성공적으로 저장되었습니다.`);
      
      setTimeout(() => {
        onClose();
        if (onSave) onSave();
      }, 2000);
    } catch (error) {
      console.error('가격 규칙 저장 실패:', error);
      setSaveMessage('가격 규칙 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [rows, productId, savePricingRulesBatch, onClose, onSave]);

  // 모달이 열릴 때 로그 출력
  useEffect(() => {
    if (isOpen) {
      console.log('🔵 BulkPricingTableModal 열림');
      console.log('channels 개수:', channels.length);
      console.log('channels:', channels.map(ch => ({ id: ch.id, name: ch.name })));
      console.log('rows 개수:', rows.length);
      console.log('choiceCombinations 개수:', choiceCombinations.length);
    }
  }, [isOpen, channels, rows, choiceCombinations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle" style={{ width: '90vw', maxWidth: '90vw', height: '90vh', maxHeight: '90vh' }}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6" style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Calculator className="h-4 w-4 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">가격 일괄 추가 테이블 뷰</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 테이블 컨테이너 */}
            <div className="overflow-x-auto flex-1" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky left-0 bg-gray-50 z-10" rowSpan={2} style={{ minWidth: '150px', width: '150px' }}>
                        채널명
                      </th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2} style={{ minWidth: '100px', width: '100px' }}>
                        시작일
                      </th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2} style={{ minWidth: '100px', width: '100px' }}>
                        종료일
                      </th>
                      {/* 헤더는 첫 번째 행의 채널 타입에 따라 결정 (또는 모든 채널이 단일 가격인 경우) */}
                      {(() => {
                        // 첫 번째 행이 있으면 그 행의 채널 타입 사용, 없으면 isAllSinglePrice 사용
                        const firstRowChannel = rows.length > 0 ? channels.find(ch => ch.id === rows[0].channelId) : null;
                        const headerIsSinglePrice = firstRowChannel 
                          ? ((firstRowChannel as any)?.pricing_type === 'single')
                          : isAllSinglePrice;
                        return headerIsSinglePrice ? (
                          <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                            단일가격
                          </th>
                        ) : (
                          <>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                              성인가격
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                              아동가격
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                              유아가격
                            </th>
                          </>
                        );
                      })()}
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-yellow-50" rowSpan={2}>
                        초이스명
                      </th>
                      {(() => {
                        // 첫 번째 행이 있으면 그 행의 채널 타입 사용, 없으면 isAllSinglePrice 사용
                        const firstRowChannel = rows.length > 0 ? channels.find(ch => ch.id === rows[0].channelId) : null;
                        const headerIsSinglePrice = firstRowChannel 
                          ? ((firstRowChannel as any)?.pricing_type === 'single')
                          : isAllSinglePrice;
                        return (
                          <>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-blue-50" colSpan={headerIsSinglePrice ? 1 : 3}>
                              초이스별 가격
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-indigo-50" colSpan={headerIsSinglePrice ? 1 : 3}>
                              Gross Price
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-green-50" colSpan={headerIsSinglePrice ? 1 : 3}>
                              Net Price
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-orange-50" colSpan={headerIsSinglePrice ? 1 : 3}>
                              홈페이지
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-purple-50" colSpan={headerIsSinglePrice ? 1 : 3}>
                              차액
                            </th>
                          </>
                        );
                      })()}
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-700 uppercase tracking-wider" rowSpan={2}>
                        작업
                      </th>
                    </tr>
                    {/* 서브 헤더 */}
                    <tr>
                      {(() => {
                        // 첫 번째 행이 있으면 그 행의 채널 타입 사용, 없으면 isAllSinglePrice 사용
                        const firstRowChannel = rows.length > 0 ? channels.find(ch => ch.id === rows[0].channelId) : null;
                        const headerIsSinglePrice = firstRowChannel 
                          ? ((firstRowChannel as any)?.pricing_type === 'single')
                          : isAllSinglePrice;
                        return headerIsSinglePrice ? (
                          <>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-blue-50 border-r border-gray-300">단일 가격</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-indigo-50 border-r border-gray-300">단일 가격</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-green-50 border-r border-gray-300">단일 가격</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">단일 가격</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-purple-50">단일 가격</th>
                          </>
                        ) : (
                          <>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-blue-50 border-r border-gray-300">성인</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-blue-50 border-r border-gray-300">아동</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-blue-50 border-r border-gray-300">유아</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-indigo-50 border-r border-gray-300">성인</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-indigo-50 border-r border-gray-300">아동</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-indigo-50 border-r border-gray-300">유아</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-green-50 border-r border-gray-300">성인</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-green-50 border-r border-gray-300">아동</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-green-50 border-r border-gray-300">유아</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">성인</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">아동</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">유아</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-purple-50 border-r border-gray-300">성인</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-purple-50 border-r border-gray-300">아동</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-purple-50">유아</th>
                          </>
                        );
                      })()}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                          <div className="space-y-2">
                            <p>행이 없습니다. "행 추가" 버튼을 클릭하여 행을 추가하세요.</p>
                            {(() => {
                              const homepageChannel = channels.find(ch => {
                                const id = ch.id?.toLowerCase() || '';
                                const name = ch.name?.toLowerCase() || '';
                                return id === 'm00001' || 
                                       id === 'homepage' ||
                                       name.includes('홈페이지') ||
                                       name.includes('homepage') ||
                                       name.includes('website') ||
                                       name.includes('웹사이트');
                              });
                              console.log('🔍 rows가 비어있을 때 홈페이지 채널 확인:', homepageChannel ? '✅ 찾음' : '❌ 없음', homepageChannel);
                              return (
                                <p className="text-xs text-gray-400">
                                  홈페이지 채널: {homepageChannel ? `✅ ${homepageChannel.name} (${homepageChannel.id})` : '❌ 없음'}
                                </p>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        // 메인 행 (기본 정보)
                        // rowSpan 계산: 메인 행 1개 + 서브 행 (choiceCombinations.length - 1)개 = choiceCombinations.length개
                        const rowSpanValue = Math.max(choiceCombinations.length, 1);
                        // 현재 행의 채널이 단일 가격인지 확인
                        const selectedChannel = channels.find(ch => ch.id === row.channelId);
                        const isRowSinglePrice = (selectedChannel as any)?.pricing_type === 'single';
                        // 행이 없거나 채널이 선택되지 않았으면 isAllSinglePrice 사용
                        const useSinglePrice = rows.length === 0 ? isAllSinglePrice : (selectedChannel ? isRowSinglePrice : isAllSinglePrice);
                        // 홈페이지 채널 찾기 (더 넓은 조건)
                        const homepageChannel = channels.find(ch => {
                          const id = ch.id?.toLowerCase() || '';
                          const name = ch.name?.toLowerCase() || '';
                          return id === 'm00001' || 
                                 id === 'homepage' ||
                                 name.includes('홈페이지') ||
                                 name.includes('homepage') ||
                                 name.includes('website') ||
                                 name.includes('웹사이트');
                        });
                        
                        // 디버깅: 홈페이지 채널 찾기 확인 (한 번만 로그)
                        if (row.id === rows[0]?.id) {
                          if (!homepageChannel) {
                            console.warn('⚠️ 홈페이지 채널을 찾을 수 없습니다. channels:', channels.map(ch => ({ id: ch.id, name: ch.name, type: ch.type })));
                          } else {
                            console.log('✅ 홈페이지 채널 찾음:', { id: homepageChannel.id, name: homepageChannel.name, commission_percent: homepageChannel.commission_percent });
                          }
                        }
                      
                      return (
                        <React.Fragment key={row.id}>
                          {/* 메인 행 */}
                          <tr className="hover:bg-gray-50 bg-gray-50">
                            {/* 채널명 */}
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 sticky left-0 bg-gray-50 z-10" rowSpan={rowSpanValue} style={{ minWidth: '150px', width: '150px' }}>
                              <div className="space-y-1">
                                <select
                                  value={row.channelId}
                                  onChange={(e) => handleUpdateRow(row.id, 'channelId', e.target.value)}
                                  className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">선택</option>
                                  {channels.map((channel, channelIndex) => (
                                    <option key={`channel-${channel.id}-${channelIndex}`} value={channel.id}>
                                      {channel.name}
                                    </option>
                                  ))}
                                </select>
                                {/* 채널 정보 표시 */}
                                {(() => {
                                  const selectedChannel = channels.find(ch => ch.id === row.channelId);
                                  if (!selectedChannel) return null;
                                  
                                  const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
                                  const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false;
                                  
                                  const notIncludedTypeLabels: Record<string, string> = {
                                    'none': '불포함 금액 없음',
                                    'amount_only': '입력값만',
                                    'amount_and_choice': '입력값 + 초이스 값'
                                  };
                                  
                                  return (
                                    <div className="text-xs text-gray-600 space-y-0.5 mt-1">
                                      <div className="font-medium text-gray-700">
                                        불포함 금액 타입: {notIncludedTypeLabels[notIncludedType] || notIncludedType}
                                      </div>
                                      {commissionBasePriceOnly && (
                                        <div className="text-blue-600 font-medium">
                                          판매가격에만 커미션 & 쿠폰 적용
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            {/* 시작일 */}
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue} style={{ minWidth: '100px', width: '100px' }}>
                              <input
                                type="date"
                                value={row.startDate}
                                onChange={(e) => handleUpdateRow(row.id, 'startDate', e.target.value)}
                                className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            {/* 종료일 */}
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue} style={{ minWidth: '100px', width: '100px' }}>
                              <input
                                type="date"
                                value={row.endDate}
                                onChange={(e) => handleUpdateRow(row.id, 'endDate', e.target.value)}
                                className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            {useSinglePrice ? (
                              /* 단일가격 */
                              <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue}>
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 mb-1">
                                    기본: ${productBasePrice.adult.toFixed(2)}
                                  </div>
                                  <input
                                    type="number"
                                    placeholder="증차감"
                                    value={row.priceAdjustmentAdult || ''}
                                    onChange={(e) => {
                                      const adjustment = Number(e.target.value) || 0;
                                      const finalPrice = productBasePrice.adult + adjustment;
                                      // 단일 가격이므로 모든 가격을 동일하게 설정
                                      setRows(rows.map(r => {
                                        if (r.id === row.id) {
                                          return {
                                            ...r,
                                            priceAdjustmentAdult: adjustment,
                                            priceAdjustmentChild: adjustment,
                                            priceAdjustmentInfant: adjustment,
                                            adultPrice: finalPrice,
                                            childPrice: finalPrice,
                                            infantPrice: finalPrice
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                  />
                                  <div className="text-xs font-medium text-gray-700 mt-1">
                                    최종: ${row.adultPrice.toFixed(2)}
                                  </div>
                                </div>
                              </td>
                            ) : (
                              <>
                                {/* 성인가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue}>
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-500 mb-1">
                                      기본: ${productBasePrice.adult.toFixed(2)}
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="증차감"
                                      value={row.priceAdjustmentAdult || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'priceAdjustmentAdult', Number(e.target.value) || 0)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                    <div className="text-xs font-medium text-gray-700 mt-1">
                                      최종: ${row.adultPrice.toFixed(2)}
                                    </div>
                                  </div>
                                </td>
                                {/* 아동가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue}>
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-500 mb-1">
                                      기본: ${productBasePrice.child.toFixed(2)}
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="증차감"
                                      value={row.priceAdjustmentChild || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'priceAdjustmentChild', Number(e.target.value) || 0)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                    <div className="text-xs font-medium text-gray-700 mt-1">
                                      최종: ${row.childPrice.toFixed(2)}
                                    </div>
                                  </div>
                                </td>
                                {/* 유아가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue}>
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-500 mb-1">
                                      기본: ${productBasePrice.infant.toFixed(2)}
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="증차감"
                                      value={row.priceAdjustmentInfant || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'priceAdjustmentInfant', Number(e.target.value) || 0)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                    <div className="text-xs font-medium text-gray-700 mt-1">
                                      최종: ${row.infantPrice.toFixed(2)}
                                    </div>
                                  </div>
                                </td>
                              </>
                            )}
                            {/* 초이스별 가격 입력 및 계산 결과 - 첫 번째 초이스 또는 기본 가격 */}
                            {choiceCombinations.length > 0 ? (() => {
                              const firstChoice = choiceCombinations[0];
                              const calculated = calculatePrices(row, firstChoice.id);
                              
                              // 계산식 업데이트
                              // Gross Price = 판매가 × 0.8 (20% 할인) - 여기서 판매가는 기본 가격 + 초이스 가격
                              // Net Price = Gross - 초이스 가격 (또는 commission_base_price_only와 not_included_type에 따라 다름)
                              // 홈페이지 = (기본 가격 + 초이스 가격) × 0.8
                              // 차액 = Net Price - 홈페이지
                              
                              const selectedChannel = channels.find(ch => ch.id === row.channelId);
                              const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false;
                              const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
                              
                              // 기본 가격 (상품 기본 가격)
                              const basePrice = {
                                adult: productBasePrice.adult || 0,
                                child: productBasePrice.child || 0,
                                infant: productBasePrice.infant || 0
                              };
                              
                              // 초이스 가격
                              const choicePrice = {
                                adult: row.choicePricing[firstChoice.id]?.adult || 0,
                                child: row.choicePricing[firstChoice.id]?.child || 0,
                                infant: row.choicePricing[firstChoice.id]?.infant || 0
                              };
                              
                              // 판매가 = 기본 가격 + 초이스 가격
                              const salePrice = {
                                adult: basePrice.adult + choicePrice.adult,
                                child: basePrice.child + choicePrice.child,
                                infant: basePrice.infant + choicePrice.infant
                              };
                              
                              // Gross Price = 판매가 × 0.8 (20% 할인)
                              const grossPrice = {
                                adult: salePrice.adult * 0.8,
                                child: salePrice.child * 0.8,
                                infant: salePrice.infant * 0.8
                              };
                              
                              // Net Price 계산
                              let netPrice;
                              if (commissionBasePriceOnly && notIncludedType === 'amount_and_choice') {
                                // Net Price = (OTA 판매가 × (1 - 쿠폰%) × (1 - 수수료%)) + 불포함 금액 + 초이스 가격
                                const otaSalePrice = calculated.otaPrice;
                                const notIncludedPrice = row.notIncludedPrice || 0;
                                netPrice = {
                                  adult: otaSalePrice.adult * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.adult,
                                  child: otaSalePrice.child * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.child,
                                  infant: otaSalePrice.infant * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.infant
                                };
                              } else {
                                // Net Price = Gross - 초이스 가격
                                netPrice = {
                                  adult: grossPrice.adult - choicePrice.adult,
                                  child: grossPrice.child - choicePrice.child,
                                  infant: grossPrice.infant - choicePrice.infant
                                };
                              }
                              
                              // 홈페이지 = (기본 가격 + 초이스 가격) × 0.8
                              const homepagePrice = {
                                adult: salePrice.adult * 0.8,
                                child: salePrice.child * 0.8,
                                infant: salePrice.infant * 0.8
                              };
                              
                              // 차액 = Net Price - 홈페이지
                              const priceDifference = {
                                adult: netPrice.adult - homepagePrice.adult,
                                child: netPrice.child - homepagePrice.child,
                                infant: netPrice.infant - homepagePrice.infant
                              };
                              
                              return (
                                <>
                                  {/* 초이스명 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-yellow-50 font-medium">
                                    {firstChoice.combination_name_ko || firstChoice.combination_name}
                                  </td>
                                  {useSinglePrice ? (
                                    <>
                                      {/* 초이스별 가격 입력 - 단일 가격 (성인 가격만 입력) */}
                                      <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                        <input
                                          type="number"
                                          value={row.choicePricing[firstChoice.id]?.adult || ''}
                                          onChange={(e) => {
                                            const value = Number(e.target.value) || 0;
                                            // 단일 가격 모드: 성인 가격만 입력하고, 자동으로 child와 infant도 동일하게 설정
                                            handleUpdateChoicePricing(row.id, firstChoice.id, 'adult', value, true);
                                          }}
                                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          step="0.01"
                                        />
                                      </td>
                                      {/* Gross Price - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.adult.toFixed(2)}
                                      </td>
                                      {/* Net Price - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.adult.toFixed(2)}
                                      </td>
                                      {/* 홈페이지 - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.adult.toFixed(2)}
                                      </td>
                                      {/* 차액 - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                        </span>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      {/* 초이스별 가격 입력 */}
                                      <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                        <input
                                          type="number"
                                          value={row.choicePricing[firstChoice.id]?.adult || ''}
                                          onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'adult', Number(e.target.value) || 0)}
                                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          step="0.01"
                                        />
                                      </td>
                                      <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                        <input
                                          type="number"
                                          value={row.choicePricing[firstChoice.id]?.child || ''}
                                          onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'child', Number(e.target.value) || 0)}
                                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          step="0.01"
                                        />
                                      </td>
                                      <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                        <input
                                          type="number"
                                          value={row.choicePricing[firstChoice.id]?.infant || ''}
                                          onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'infant', Number(e.target.value) || 0)}
                                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                          step="0.01"
                                        />
                                      </td>
                                      {/* Gross Price */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.infant.toFixed(2)}
                                      </td>
                                      {/* Net Price */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.infant.toFixed(2)}
                                      </td>
                                      {/* 홈페이지 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.infant.toFixed(2)}
                                      </td>
                                      {/* 차액 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.child >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.child >= 0 ? '+' : ''}${priceDifference.child.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.infant >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.infant >= 0 ? '+' : ''}${priceDifference.infant.toFixed(2)}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                </>
                              );
                            })() : (() => {
                              // 초이스가 없을 때 계산
                              const basePrice = {
                                adult: productBasePrice.adult || 0,
                                child: productBasePrice.child || 0,
                                infant: productBasePrice.infant || 0
                              };
                              
                              const choicePrice = { adult: 0, child: 0, infant: 0 };
                              
                              const salePrice = {
                                adult: basePrice.adult + choicePrice.adult,
                                child: basePrice.child + choicePrice.child,
                                infant: basePrice.infant + choicePrice.infant
                              };
                              
                              const grossPrice = {
                                adult: salePrice.adult * 0.8,
                                child: salePrice.child * 0.8,
                                infant: salePrice.infant * 0.8
                              };
                              
                              const netPrice = {
                                adult: grossPrice.adult - choicePrice.adult,
                                child: grossPrice.child - choicePrice.child,
                                infant: grossPrice.infant - choicePrice.infant
                              };
                              
                              const homepagePrice = {
                                adult: salePrice.adult * 0.8,
                                child: salePrice.child * 0.8,
                                infant: salePrice.infant * 0.8
                              };
                              
                              const priceDifference = {
                                adult: netPrice.adult - homepagePrice.adult,
                                child: netPrice.child - homepagePrice.child,
                                infant: netPrice.infant - homepagePrice.infant
                              };
                              
                              return (
                                <>
                                  {/* 초이스명 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50 font-medium">
                                    기본 가격
                                  </td>
                                  {useSinglePrice ? (
                                    <>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50">
                                        초이스 없음
                                      </td>
                                      {/* Gross Price - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.adult.toFixed(2)}
                                      </td>
                                      {/* Net Price - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.adult.toFixed(2)}
                                      </td>
                                      {/* 홈페이지 - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.adult.toFixed(2)}
                                      </td>
                                      {/* 차액 - 단일 가격 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                        </span>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" colSpan={3}>
                                        초이스 없음
                                      </td>
                                      {/* Gross Price */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                        ${grossPrice.infant.toFixed(2)}
                                      </td>
                                      {/* Net Price */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                        ${netPrice.infant.toFixed(2)}
                                      </td>
                                      {/* 홈페이지 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.adult.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.child.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                        ${homepagePrice.infant.toFixed(2)}
                                      </td>
                                      {/* 차액 */}
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.child >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.child >= 0 ? '+' : ''}${priceDifference.child.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                        <span className={priceDifference.infant >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          {priceDifference.infant >= 0 ? '+' : ''}${priceDifference.infant.toFixed(2)}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            {/* 작업 버튼 */}
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center bg-gray-50" rowSpan={rowSpanValue}>
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {/* 초이스별 서브 행들 */}
                          {choiceCombinations.slice(1).map((choice, choiceIndex) => {
                            const calculated = calculatePrices(row, choice.id);
                            
                            // 계산식 업데이트 (첫 번째 초이스와 동일)
                            const selectedChannel = channels.find(ch => ch.id === row.channelId);
                            const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false;
                            const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
                            
                            const basePrice = {
                              adult: productBasePrice.adult || 0,
                              child: productBasePrice.child || 0,
                              infant: productBasePrice.infant || 0
                            };
                            
                            const choicePrice = {
                              adult: row.choicePricing[choice.id]?.adult || 0,
                              child: row.choicePricing[choice.id]?.child || 0,
                              infant: row.choicePricing[choice.id]?.infant || 0
                            };
                            
                            const salePrice = {
                              adult: basePrice.adult + choicePrice.adult,
                              child: basePrice.child + choicePrice.child,
                              infant: basePrice.infant + choicePrice.infant
                            };
                            
                            const grossPrice = {
                              adult: salePrice.adult * 0.8,
                              child: salePrice.child * 0.8,
                              infant: salePrice.infant * 0.8
                            };
                            
                            let netPrice;
                            if (commissionBasePriceOnly && notIncludedType === 'amount_and_choice') {
                              const otaSalePrice = calculated.otaPrice;
                              const notIncludedPrice = row.notIncludedPrice || 0;
                              netPrice = {
                                adult: otaSalePrice.adult * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.adult,
                                child: otaSalePrice.child * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.child,
                                infant: otaSalePrice.infant * (1 - row.couponPercent / 100) * (1 - row.commissionPercent / 100) + notIncludedPrice + choicePrice.infant
                              };
                            } else {
                              netPrice = {
                                adult: grossPrice.adult - choicePrice.adult,
                                child: grossPrice.child - choicePrice.child,
                                infant: grossPrice.infant - choicePrice.infant
                              };
                            }
                            
                            const homepagePrice = {
                              adult: salePrice.adult * 0.8,
                              child: salePrice.child * 0.8,
                              infant: salePrice.infant * 0.8
                            };
                            
                            const priceDifference = {
                              adult: netPrice.adult - homepagePrice.adult,
                              child: netPrice.child - homepagePrice.child,
                              infant: netPrice.infant - homepagePrice.infant
                            };
                            
                            return (
                              <tr key={`${row.id}-${choice.id}-${choiceIndex}`} className="hover:bg-gray-50">
                                {/* 초이스명 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-yellow-50 font-medium">
                                  {choice.combination_name_ko || choice.combination_name}
                                </td>
                                {useSinglePrice ? (
                                  <>
                                    {/* 초이스별 가격 입력 - 단일 가격 (성인 가격만 입력) */}
                                    <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                      <input
                                        type="number"
                                        value={row.choicePricing[choice.id]?.adult || ''}
                                        onChange={(e) => {
                                          const value = Number(e.target.value) || 0;
                                          // 단일 가격 모드: 성인 가격만 입력하고, 자동으로 child와 infant도 동일하게 설정
                                          handleUpdateChoicePricing(row.id, choice.id, 'adult', value, true);
                                        }}
                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        step="0.01"
                                      />
                                    </td>
                                    {/* Gross Price - 단일 가격 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                      ${grossPrice.adult.toFixed(2)}
                                    </td>
                                    {/* Net Price - 단일 가격 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                      ${netPrice.adult.toFixed(2)}
                                    </td>
                                    {/* 홈페이지 - 단일 가격 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                      ${homepagePrice.adult.toFixed(2)}
                                    </td>
                                    {/* 차액 - 단일 가격 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                      <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                      </span>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {/* 초이스별 가격 입력 */}
                                    <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                      <input
                                        type="number"
                                        value={row.choicePricing[choice.id]?.adult || ''}
                                        onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'adult', Number(e.target.value) || 0)}
                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        step="0.01"
                                      />
                                    </td>
                                    <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                      <input
                                        type="number"
                                        value={row.choicePricing[choice.id]?.child || ''}
                                        onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'child', Number(e.target.value) || 0)}
                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        step="0.01"
                                      />
                                    </td>
                                    <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-blue-50" style={{ minWidth: '70px', width: '70px' }}>
                                      <input
                                        type="number"
                                        value={row.choicePricing[choice.id]?.infant || ''}
                                        onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'infant', Number(e.target.value) || 0)}
                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        step="0.01"
                                      />
                                    </td>
                                    {/* Gross Price */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                      ${grossPrice.adult.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                      ${grossPrice.child.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                      ${grossPrice.infant.toFixed(2)}
                                    </td>
                                    {/* Net Price */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                      ${netPrice.adult.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                      ${netPrice.child.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                      ${netPrice.infant.toFixed(2)}
                                    </td>
                                    {/* 홈페이지 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                      ${homepagePrice.adult.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                      ${homepagePrice.child.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                      ${homepagePrice.infant.toFixed(2)}
                                    </td>
                                    {/* 차액 */}
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                      <span className={priceDifference.adult >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {priceDifference.adult >= 0 ? '+' : ''}${priceDifference.adult.toFixed(2)}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-purple-50 font-medium text-center">
                                      <span className={priceDifference.child >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {priceDifference.child >= 0 ? '+' : ''}${priceDifference.child.toFixed(2)}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                      <span className={priceDifference.infant >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {priceDifference.infant >= 0 ? '+' : ''}${priceDifference.infant.toFixed(2)}
                                      </span>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={handleAddRow}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>행 추가</span>
              </button>

              <div className="flex items-center space-x-2">
                {saveMessage && (
                  <div className={`px-3 py-1.5 rounded text-xs ${
                    saveMessage.includes('성공') 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {saveMessage}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || rows.length === 0}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                    saving || rows.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? '저장 중...' : '저장'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

