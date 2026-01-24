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
  category?: string;
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
  variantKey: string; // Variant 선택
  startDate: string;
  endDate: string;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  priceAdjustmentAdult: number;
  priceAdjustmentChild: number;
  priceAdjustmentInfant: number;
  commissionPercent: number;
  commissionAmount: number; // 수수료 금액 ($)
  couponPercent: number;
  markupAmount: number;
  markupPercent: number;
  notIncludedPrice: number;
  otaSalePrice: Record<string, number>; // OTA 판매가 (초이스별)
  choiceNotIncludedPrice: Record<string, number>; // 초이스별 불포함 금액
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
  
  // Variant 목록 상태 (채널별로 다를 수 있음)
  const [productVariants, setProductVariants] = useState<Array<{
    variant_key: string;
    variant_name_ko?: string | null;
    variant_name_en?: string | null;
  }>>([]);

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

        const productData = data as { adult_base_price?: number; child_base_price?: number; infant_base_price?: number } | null;
        setProductBasePrice({
          adult: productData?.adult_base_price || 0,
          child: productData?.child_base_price || 0,
          infant: productData?.infant_base_price || 0
        });
      } catch (error) {
        console.error('상품 기본 가격 로드 오류:', error);
      }
    };

    if (isOpen) {
      loadProductBasePrice();
    }
  }, [productId, isOpen]);


  // 모든 채널 사용 (OTA 채널만 필터링하지 않음)
  const allChannels = useMemo(() => {
    return channels;
  }, [channels]);
  
  // OTA 채널만 필터링 (기존 로직 유지)
  const otaChannels = useMemo(() => {
    return channels.filter(ch => {
      const type = ch.type?.toLowerCase() || '';
      const category = ch.category?.toLowerCase() || '';
      return type === 'ota' || category === 'ota';
    });
  }, [channels]);
  
  // Variant 목록 불러오기 (선택된 채널에 따라)
  useEffect(() => {
    const loadProductVariants = async () => {
      if (!productId || rows.length === 0) {
        setProductVariants([{ variant_key: 'default' }]);
        return;
      }

      // 첫 번째 행의 채널 ID 사용 (또는 모든 행의 채널 ID 수집)
      const channelIds = [...new Set(rows.map(row => row.channelId).filter(Boolean))];
      if (channelIds.length === 0) {
        setProductVariants([{ variant_key: 'default' }]);
        return;
      }

      try {
        // 첫 번째 채널의 variant만 로드 (또는 모든 채널의 variant 합치기)
        const { data, error } = await supabase
          .from('channel_products')
          .select('variant_key, variant_name_ko, variant_name_en')
          .eq('product_id', productId)
          .in('channel_id', channelIds)
          .eq('is_active', true)
          .order('variant_key');

        if (error) {
          console.error('Variant 목록 로드 실패:', error);
          setProductVariants([{ variant_key: 'default' }]);
          return;
        }

        const variants = ((data || []) as any[]).map((item: any) => ({
          variant_key: item.variant_key || 'default',
          variant_name_ko: item.variant_name_ko,
          variant_name_en: item.variant_name_en
        }));

        // 중복 제거
        const uniqueVariants = Array.from(
          new Map(variants.map(v => [v.variant_key, v])).values()
        );

        setProductVariants(uniqueVariants.length > 0 ? uniqueVariants : [{ variant_key: 'default' }]);
      } catch (error) {
        console.error('Variant 목록 로드 중 오류:', error);
        setProductVariants([{ variant_key: 'default' }]);
      }
    };

    if (isOpen) {
      loadProductVariants();
    }
  }, [productId, isOpen, rows]);

  // 행 추가
  const handleAddRow = useCallback(() => {
    const defaultChannel = allChannels.length > 0 ? allChannels[0] : null;
    const defaultCommissionPercent = defaultChannel?.commission_percent || 0;
    
    const newRow: BulkPricingRow = {
      id: `row-${Date.now()}`,
      channelId: defaultChannel?.id || '',
      channelName: defaultChannel?.name || '',
      variantKey: 'default',
      startDate: '',
      endDate: '',
      adultPrice: productBasePrice.adult,
      childPrice: productBasePrice.child,
      infantPrice: productBasePrice.infant,
      priceAdjustmentAdult: 0,
      priceAdjustmentChild: 0,
      priceAdjustmentInfant: 0,
      commissionPercent: defaultCommissionPercent,
      commissionAmount: 0,
      couponPercent: 0,
      markupAmount: 0,
      markupPercent: 0,
      notIncludedPrice: 0,
      otaSalePrice: {},
      choiceNotIncludedPrice: {},
      choicePricing: {}
    };
    setRows([...rows, newRow]);
  }, [rows, allChannels, productBasePrice]);

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
        // 날짜 문자열을 직접 파싱하여 시간대 문제 방지
        const [startYear = 0, startMonth = 0, startDay = 0] = row.startDate.split('-').map(Number);
        const [endYear = 0, endMonth = 0, endDay = 0] = row.endDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          // 로컬 시간대 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;
          
          // 초이스별 가격 구조 생성
          const choicesPricing: Record<string, {
            adult_price: number;
            child_price: number;
            infant_price: number;
            ota_sale_price?: number;
            not_included_price?: number;
          }> = {};

          // choiceCombinations를 순회하면서 각 초이스별로 가격 정보 수집
          if (choiceCombinations && choiceCombinations.length > 0) {
            choiceCombinations.forEach((choice) => {
              const choiceId = choice.id;
              
              // OTA 판매가 또는 불포함 금액이 있으면 choices_pricing에 추가
              const otaSalePrice = row.otaSalePrice[choiceId];
              const choiceNotIncludedPrice = row.choiceNotIncludedPrice[choiceId];
              
              // OTA 판매가가 있거나 불포함 금액이 있으면 초이스 정보 추가
              if ((otaSalePrice !== undefined && otaSalePrice !== null && otaSalePrice > 0) ||
                  (choiceNotIncludedPrice !== undefined && choiceNotIncludedPrice !== null && choiceNotIncludedPrice > 0)) {
                
                // 초이스의 기본 가격 정보 가져오기 (choiceCombination에서 또는 row.choicePricing에서)
                const choicePricingData = row.choicePricing[choiceId];
                const adultPrice = choicePricingData?.adult ?? choice.adult_price ?? 0;
                const childPrice = choicePricingData?.child ?? choice.child_price ?? 0;
                const infantPrice = choicePricingData?.infant ?? choice.infant_price ?? 0;
                
                choicesPricing[choiceId] = {
                  adult_price: adultPrice,
                  child_price: childPrice,
                  infant_price: infantPrice
                };
                
                // OTA 판매가가 있으면 추가
                if (otaSalePrice !== undefined && otaSalePrice !== null && otaSalePrice > 0) {
                  choicesPricing[choiceId].ota_sale_price = otaSalePrice;
                }
                
                // 초이스별 불포함 금액이 있으면 추가
                if (choiceNotIncludedPrice !== undefined && choiceNotIncludedPrice !== null && choiceNotIncludedPrice > 0) {
                  choicesPricing[choiceId].not_included_price = choiceNotIncludedPrice;
                }
              }
            });
          }

          // 초이스가 없을 때 OTA 판매가 처리
          const noChoiceKey = 'no_choice';
          const noChoiceOtaSalePrice = row.otaSalePrice[noChoiceKey];
          const noChoiceNotIncludedPrice = row.choiceNotIncludedPrice[noChoiceKey];
          
          // 초이스가 없고 (OTA 판매가가 있거나 불포함 금액이 있으면) 기본 가격 구조에 추가
          if ((noChoiceOtaSalePrice !== undefined && noChoiceOtaSalePrice !== null && noChoiceOtaSalePrice > 0) ||
              (noChoiceNotIncludedPrice !== undefined && noChoiceNotIncludedPrice !== null && noChoiceNotIncludedPrice > 0)) {
            const noChoicePricing: {
              adult_price: number;
              child_price: number;
              infant_price: number;
              ota_sale_price?: number;
              not_included_price?: number;
            } = {
              adult_price: row.adultPrice || 0,
              child_price: row.childPrice || 0,
              infant_price: row.infantPrice || 0
            };
            
            if (noChoiceOtaSalePrice !== undefined && noChoiceOtaSalePrice !== null && noChoiceOtaSalePrice > 0) {
              noChoicePricing.ota_sale_price = noChoiceOtaSalePrice;
            }
            
            if (noChoiceNotIncludedPrice !== undefined && noChoiceNotIncludedPrice !== null && noChoiceNotIncludedPrice > 0) {
              noChoicePricing.not_included_price = noChoiceNotIncludedPrice;
            }
            
            choicesPricing[''] = noChoicePricing;
          }

          const ruleData: SimplePricingRuleDto = {
            product_id: productId,
            channel_id: row.channelId,
            date: dateString,
            variant_key: row.variantKey || 'default',
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
            choices_pricing: Object.keys(choicesPricing).length > 0 ? choicesPricing : {}
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
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2} style={{ minWidth: '120px', width: '120px' }}>
                        Variant
                      </th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2} style={{ minWidth: '100px', width: '100px' }}>
                        시작일
                      </th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2} style={{ minWidth: '100px', width: '100px' }}>
                        종료일
                      </th>
                      {/* OTA 채널은 단일가격/증차감 컬럼 제거 */}
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-yellow-50" rowSpan={2}>
                        초이스명
                      </th>
                      {(() => {
                        // OTA 채널은 단일 가격 모드
                        return (
                          <>
                            {/* OTA 판매가 컬럼 */}
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-pink-50" rowSpan={2}>
                              OTA 판매가
                            </th>
                            {/* 불포함 금액 컬럼 (초이스별) */}
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-orange-50" rowSpan={2}>
                              불포함 금액 ($)
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-cyan-50" rowSpan={2}>
                              수수료 (%)
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-cyan-50" rowSpan={2}>
                              수수료 ($)
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-cyan-50" rowSpan={2}>
                              쿠폰 할인 (%)
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-cyan-50" rowSpan={2}>
                              불포함 금액 ($)
                            </th>
                            <th 
                              className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-indigo-50 cursor-help" 
                              rowSpan={2}
                              title="OTA 판매가에서 쿠폰 할인 적용"
                            >
                              Gross Price
                            </th>
                            <th 
                              className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-green-50 cursor-help" 
                              rowSpan={2}
                              title="Gross에서 수수료 적용"
                            >
                              Net Price
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-orange-50" colSpan={5}>
                              홈페이지 가격 정보 (20% 할인) 참고용
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-purple-50" rowSpan={2}>
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
                        return (
                          <>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">기본</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">초이스</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">판매가</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50 border-r border-gray-300">Gross</th>
                            <th className="px-2 py-1 text-xs font-medium text-gray-600 bg-orange-50">Net</th>
                          </>
                        );
                      })()}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                          <div className="space-y-2">
                            <p>행이 없습니다. &quot;행 추가&quot; 버튼을 클릭하여 행을 추가하세요.</p>
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
                                  {allChannels.map((channel, channelIndex) => (
                                    <option key={`channel-${channel.id}-${channelIndex}`} value={channel.id}>
                                      {channel.name}
                                    </option>
                                  ))}
                                </select>
                                {/* 채널 정보 표시 */}
                                {(() => {
                                  const selectedChannel = allChannels.find(ch => ch.id === row.channelId);
                                  if (!selectedChannel) return null;
                                  
                                  const notIncludedType = selectedChannel?.not_included_type || 'none';
                                  const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                                  
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
                            {/* Variant 선택 */}
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50" rowSpan={rowSpanValue} style={{ minWidth: '120px', width: '120px' }}>
                              <select
                                value={row.variantKey || 'default'}
                                onChange={(e) => handleUpdateRow(row.id, 'variantKey', e.target.value)}
                                className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {productVariants.map((variant) => (
                                  <option key={variant.variant_key} value={variant.variant_key}>
                                    {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                                  </option>
                                ))}
                              </select>
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
                            {/* OTA 채널은 증차감 컬럼 제거 */}
                            {/* 초이스별 가격 입력 및 계산 결과 - 첫 번째 초이스 또는 기본 가격 */}
                            {choiceCombinations.length > 0 ? (() => {
                              const firstChoice = choiceCombinations[0];
                              
                              // 계산식 업데이트
                              // Gross Price = 판매가 × 0.8 (20% 할인) - 여기서 판매가는 기본 가격 + 초이스 가격
                              // Net Price = Gross - 초이스 가격 (또는 commission_base_price_only와 not_included_type에 따라 다름)
                              // 홈페이지 = (기본 가격 + 초이스 가격) × 0.8
                              // 차액 = Net Price - 홈페이지
                              
                              const selectedChannel = allChannels.find(ch => ch.id === row.channelId);
                              const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                              const notIncludedType = selectedChannel?.not_included_type || 'none';
                              
                              // 단일 가격 모드: adult 가격 사용
                              const basePrice = row.adultPrice || 0;
                              const choicePrice = row.choicePricing[firstChoice.id]?.adult || 0;
                              const salePrice = basePrice + choicePrice;

                              const commissionRate = row.commissionPercent / 100;
                              const couponRate = row.couponPercent / 100;

                              // Gross Price와 Net Price 계산
                              const currentOtaSalePrice = row.otaSalePrice[firstChoice.id] || 0;
                              let grossPrice = 0;
                              let netPrice = 0;

                              if (currentOtaSalePrice > 0) {
                                // OTA 판매가가 입력되어 있으면
                                // Gross Price = OTA 판매가 × (1 - 쿠폰%)
                                grossPrice = currentOtaSalePrice * (1 - couponRate);
                                
                                // Net Price = Gross × (1 - 수수료%)
                                netPrice = grossPrice * (1 - commissionRate);
                                
                                // commissionBasePriceOnly와 notIncludedType에 따라 조정
                                if (commissionBasePriceOnly && notIncludedType === 'amount_and_choice') {
                                  const notIncludedPrice = row.notIncludedPrice || 0;
                                  netPrice = grossPrice * (1 - commissionRate) + notIncludedPrice + choicePrice;
                                }
                              } else {
                                // OTA 판매가가 없으면 기본 계산
                                // Gross Price = 판매가 × 0.8 (20% 할인)
                                grossPrice = salePrice * 0.8;
                                
                                // Net Price = Gross - 초이스 가격
                                netPrice = grossPrice - choicePrice;
                              }

                              // 홈페이지 가격 정보 (20% 할인) 참고용
                              // 초이스의 기본 성인 가격 사용
                              const homepageBasePrice = basePrice;
                              const homepageChoicePrice = firstChoice.adult_price || 0;
                              const homepageSalePrice = homepageBasePrice + homepageChoicePrice;
                              const homepageGross = homepageSalePrice * 0.8;
                              const homepageNet = homepageGross - homepageChoicePrice;

                              // 차액 계산: 불포함 금액 타입에 따라 다름
                              // 불포함 금액 없음('none')이면 Net Price와 홈페이지 Gross 비교
                              // 그 외에는 Net Price와 홈페이지 Net 비교
                              const priceDifference = notIncludedType === 'none' 
                                ? netPrice - homepageGross 
                                : netPrice - homepageNet;
                              
                              return (
                                <>
                                  {/* 초이스명 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-yellow-50 font-medium">
                                    {firstChoice.combination_name_ko || firstChoice.combination_name}
                                  </td>
                                  {/* OTA 판매가 입력 필드 */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-pink-50" style={{ minWidth: '80px', width: '80px' }}>
                                    <input
                                      type="text"
                                      value={(() => {
                                        const price = row.otaSalePrice[firstChoice.id];
                                        return price === undefined || price === null || price === 0 ? '' : String(price);
                                      })()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              otaSalePrice: {
                                                ...r.otaSalePrice,
                                                [firstChoice.id]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              otaSalePrice: {
                                                ...r.otaSalePrice,
                                                [firstChoice.id]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="OTA 판매가"
                                    />
                                  </td>
                                  {/* 불포함 금액 입력 필드 (초이스별) */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50" style={{ minWidth: '80px', width: '80px' }}>
                                    <input
                                      type="text"
                                      value={(() => {
                                        const price = row.choiceNotIncludedPrice[firstChoice.id];
                                        return price === undefined || price === null || price === 0 ? '' : String(price);
                                      })()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              choiceNotIncludedPrice: {
                                                ...r.choiceNotIncludedPrice,
                                                [firstChoice.id]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              choiceNotIncludedPrice: {
                                                ...r.choiceNotIncludedPrice,
                                                [firstChoice.id]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  {/* 수수료/쿠폰/불포함 금액 입력 필드 */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.commissionPercent || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'commissionPercent', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.commissionAmount || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'commissionAmount', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.couponPercent || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'couponPercent', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.notIncludedPrice || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'notIncludedPrice', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  {/* Gross Price - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                    ${grossPrice.toFixed(2)}
                                  </td>
                                  {/* Net Price - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                    ${netPrice.toFixed(2)}
                                  </td>
                                  {/* 홈페이지 가격 정보 (20% 할인) 참고용 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageBasePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageChoicePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageSalePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageGross.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-orange-50 font-medium text-center">
                                    ${homepageNet.toFixed(2)}
                                  </td>
                                  {/* 차액 - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                    <span className={priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
                                    </span>
                                  </td>
                                </>
                              );
                            })() : (() => {
                              // 초이스가 없을 때 계산 - 단일 가격 모드
                              const selectedChannel = otaChannels.find(ch => ch.id === row.channelId);
                              const notIncludedType = selectedChannel?.not_included_type || 'none';
                              
                              const basePrice = productBasePrice.adult || 0;
                              const choicePrice = 0;
                              const salePrice = basePrice + choicePrice;
                              
                              const commissionRate = row.commissionPercent / 100;
                              const couponRate = row.couponPercent / 100;

                              // Gross Price와 Net Price 계산
                              const noChoiceKey = 'no_choice';
                              const currentOtaSalePrice = row.otaSalePrice[noChoiceKey] || 0;
                              let grossPrice = 0;
                              let netPrice = 0;

                              if (currentOtaSalePrice > 0) {
                                // OTA 판매가가 입력되어 있으면
                                // Gross Price = OTA 판매가 × (1 - 쿠폰%)
                                grossPrice = currentOtaSalePrice * (1 - couponRate);
                                
                                // Net Price = Gross × (1 - 수수료%)
                                netPrice = grossPrice * (1 - commissionRate);
                              } else {
                                // OTA 판매가가 없으면 기본 계산
                                // Gross Price = 판매가 × 0.8 (20% 할인)
                                grossPrice = salePrice * 0.8;
                                
                                // Net Price = Gross - 초이스 가격
                                netPrice = grossPrice - choicePrice;
                              }
                              
                              // 홈페이지 가격 정보 (20% 할인) 참고용
                              // 초이스가 없을 때는 초이스 가격이 0
                              const homepageBasePrice = basePrice;
                              const homepageChoicePrice = 0;
                              const homepageSalePrice = homepageBasePrice + homepageChoicePrice;
                              const homepageGross = homepageSalePrice * 0.8;
                              const homepageNet = homepageGross - homepageChoicePrice;
                              
                              // 차액 계산: 불포함 금액 타입에 따라 다름
                              // 불포함 금액 없음('none')이면 Net Price와 홈페이지 Gross 비교
                              // 그 외에는 Net Price와 홈페이지 Net 비교
                              const priceDifference = notIncludedType === 'none' 
                                ? netPrice - homepageGross 
                                : netPrice - homepageNet;
                              
                              return (
                                <>
                                  {/* 초이스명 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-gray-50 font-medium">
                                    기본 가격
                                  </td>
                                  {/* OTA 판매가 입력 필드 */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-pink-50" style={{ minWidth: '80px', width: '80px' }}>
                                    <input
                                      type="text"
                                      value={(() => {
                                        const price = row.otaSalePrice[noChoiceKey];
                                        return price === undefined || price === null || price === 0 ? '' : String(price);
                                      })()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              otaSalePrice: {
                                                ...r.otaSalePrice,
                                                [noChoiceKey]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              otaSalePrice: {
                                                ...r.otaSalePrice,
                                                [noChoiceKey]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="OTA 판매가"
                                    />
                                  </td>
                                  {/* 불포함 금액 입력 필드 (초이스 없음) */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50" style={{ minWidth: '80px', width: '80px' }}>
                                    <input
                                      type="text"
                                      value={(() => {
                                        const price = row.choiceNotIncludedPrice[noChoiceKey];
                                        return price === undefined || price === null || price === 0 ? '' : String(price);
                                      })()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              choiceNotIncludedPrice: {
                                                ...r.choiceNotIncludedPrice,
                                                [noChoiceKey]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value;
                                        const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                        setRows(rows.map(r => {
                                          if (r.id === row.id) {
                                            return { 
                                              ...r, 
                                              choiceNotIncludedPrice: {
                                                ...r.choiceNotIncludedPrice,
                                                [noChoiceKey]: isNaN(numValue) ? 0 : numValue
                                              }
                                            };
                                          }
                                          return r;
                                        }));
                                      }}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  {/* 수수료/쿠폰/불포함 금액 입력 필드 */}
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.commissionPercent || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'commissionPercent', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.commissionAmount || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'commissionAmount', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.couponPercent || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'couponPercent', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                    <input
                                      type="number"
                                      value={row.notIncludedPrice || ''}
                                      onChange={(e) => handleUpdateRow(row.id, 'notIncludedPrice', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                      placeholder="0"
                                    />
                                  </td>
                                  {/* Gross Price - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                    ${grossPrice.toFixed(2)}
                                  </td>
                                  {/* Net Price - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                    ${netPrice.toFixed(2)}
                                  </td>
                                  {/* 홈페이지 가격 정보 (20% 할인) 참고용 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageBasePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageChoicePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageSalePrice.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                    ${homepageGross.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-orange-50 font-medium text-center">
                                    ${homepageNet.toFixed(2)}
                                  </td>
                                  {/* 차액 - 단일 가격 */}
                                  <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                    <span className={priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
                                    </span>
                                  </td>
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
                            // 계산식 업데이트 (첫 번째 초이스와 동일) - 단일 가격 모드
                            const selectedChannel = allChannels.find(ch => ch.id === row.channelId);
                            const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                            const notIncludedType = selectedChannel?.not_included_type || 'none';
                            
                            // 단일 가격 모드: adult 가격 사용
                            const basePrice = row.adultPrice || 0;
                            const choicePrice = row.choicePricing[choice.id]?.adult || 0;
                            const salePrice = basePrice + choicePrice;
                            
                            const commissionRate = row.commissionPercent / 100;
                            const couponRate = row.couponPercent / 100;

                            // Gross Price와 Net Price 계산
                            const currentOtaSalePrice = row.otaSalePrice[choice.id] || 0;
                            let grossPrice = 0;
                            let netPrice = 0;

                            if (currentOtaSalePrice > 0) {
                              // OTA 판매가가 입력되어 있으면
                              // Gross Price = OTA 판매가 × (1 - 쿠폰%)
                              grossPrice = currentOtaSalePrice * (1 - couponRate);
                              
                              // Net Price = Gross × (1 - 수수료%)
                              netPrice = grossPrice * (1 - commissionRate);
                              
                              // commissionBasePriceOnly와 notIncludedType에 따라 조정
                              if (commissionBasePriceOnly && notIncludedType === 'amount_and_choice') {
                                const notIncludedPrice = row.notIncludedPrice || 0;
                                netPrice = grossPrice * (1 - commissionRate) + notIncludedPrice + choicePrice;
                              }
                            } else {
                              // OTA 판매가가 없으면 기본 계산
                              // Gross Price = 판매가 × 0.8 (20% 할인)
                              grossPrice = salePrice * 0.8;
                              
                              // Net Price = Gross - 초이스 가격
                              netPrice = grossPrice - choicePrice;
                            }
                            
                            // 홈페이지 가격 정보 (20% 할인) 참고용
                            // 초이스의 기본 성인 가격 사용
                            const homepageBasePrice = basePrice;
                            const homepageChoicePrice = choice.adult_price || 0;
                            const homepageSalePrice = homepageBasePrice + homepageChoicePrice;
                            const homepageGross = homepageSalePrice * 0.8;
                            const homepageNet = homepageGross - homepageChoicePrice;
                            
                              // 차액 계산: 불포함 금액 타입에 따라 다름
                              // 불포함 금액 없음('none')이면 Net Price와 홈페이지 Gross 비교
                              // 그 외에는 Net Price와 홈페이지 Net 비교
                              const priceDifference = notIncludedType === 'none' 
                                ? netPrice - homepageGross 
                                : netPrice - homepageNet;
                            
                            return (
                              <tr key={`${row.id}-${choice.id}-${choiceIndex}`} className="hover:bg-gray-50">
                                {/* 초이스명 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-yellow-50 font-medium">
                                  {choice.combination_name_ko || choice.combination_name}
                                </td>
                                {/* OTA 판매가 입력 필드 */}
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-pink-50" style={{ minWidth: '80px', width: '80px' }}>
                                  <input
                                    type="text"
                                    value={(() => {
                                      const price = row.otaSalePrice[choice.id];
                                      return price === undefined || price === null || price === 0 ? '' : String(price);
                                    })()}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                      setRows(rows.map(r => {
                                        if (r.id === row.id) {
                                          return { 
                                            ...r, 
                                            otaSalePrice: {
                                              ...r.otaSalePrice,
                                              [choice.id]: isNaN(numValue) ? 0 : numValue
                                            }
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    onBlur={(e) => {
                                      const value = e.target.value;
                                      const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                      setRows(rows.map(r => {
                                        if (r.id === row.id) {
                                          return { 
                                            ...r, 
                                            otaSalePrice: {
                                              ...r.otaSalePrice,
                                              [choice.id]: isNaN(numValue) ? 0 : numValue
                                            }
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="OTA 판매가"
                                  />
                                </td>
                                {/* 불포함 금액 입력 필드 (초이스별) */}
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50" style={{ minWidth: '80px', width: '80px' }}>
                                  <input
                                    type="text"
                                    value={(() => {
                                      const price = row.choiceNotIncludedPrice[choice.id];
                                      return price === undefined || price === null || price === 0 ? '' : String(price);
                                    })()}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                      setRows(rows.map(r => {
                                        if (r.id === row.id) {
                                          return { 
                                            ...r, 
                                            choiceNotIncludedPrice: {
                                              ...r.choiceNotIncludedPrice,
                                              [choice.id]: isNaN(numValue) ? 0 : numValue
                                            }
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    onBlur={(e) => {
                                      const value = e.target.value;
                                      const numValue = value === '' || value === '-' ? 0 : parseFloat(value.replace(/[^\d.-]/g, ''));
                                      setRows(rows.map(r => {
                                        if (r.id === row.id) {
                                          return { 
                                            ...r, 
                                            choiceNotIncludedPrice: {
                                              ...r.choiceNotIncludedPrice,
                                              [choice.id]: isNaN(numValue) ? 0 : numValue
                                            }
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="0"
                                  />
                                </td>
                                {/* 수수료/쿠폰/불포함 금액 입력 필드 */}
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                  <input
                                    type="number"
                                    value={row.commissionPercent || ''}
                                    onChange={(e) => handleUpdateRow(row.id, 'commissionPercent', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                  <input
                                    type="number"
                                    value={row.commissionAmount || ''}
                                    onChange={(e) => handleUpdateRow(row.id, 'commissionAmount', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                  <input
                                    type="number"
                                    value={row.couponPercent || ''}
                                    onChange={(e) => handleUpdateRow(row.id, 'couponPercent', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 bg-cyan-50" style={{ minWidth: '70px', width: '70px' }}>
                                  <input
                                    type="number"
                                    value={row.notIncludedPrice || ''}
                                    onChange={(e) => handleUpdateRow(row.id, 'notIncludedPrice', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                    placeholder="0"
                                  />
                                </td>
                                {/* Gross Price - 단일 가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-indigo-50 font-medium text-center">
                                  ${grossPrice.toFixed(2)}
                                </td>
                                {/* Net Price - 단일 가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-green-50 font-medium text-center">
                                  ${netPrice.toFixed(2)}
                                </td>
                                {/* 홈페이지 가격 정보 (20% 할인) 참고용 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                  ${homepageBasePrice.toFixed(2)}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                  ${homepageChoicePrice.toFixed(2)}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                  ${homepageSalePrice.toFixed(2)}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-300 bg-orange-50 font-medium text-center">
                                  ${homepageGross.toFixed(2)}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-orange-50 font-medium text-center">
                                  ${homepageNet.toFixed(2)}
                                </td>
                                {/* 차액 - 단일 가격 */}
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs bg-purple-50 font-medium text-center">
                                  <span className={priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
                                  </span>
                                </td>
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

