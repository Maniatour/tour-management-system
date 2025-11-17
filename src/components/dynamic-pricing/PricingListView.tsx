import React, { memo, useState } from 'react';
import { DollarSign, Calendar, Edit, Trash2, Save, X } from 'lucide-react';
import { SimplePricingRule, SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';
import { supabase } from '@/lib/supabase';

interface ChoiceCombination {
  id: string;
  combination_key: string;
  combination_name: string;
  combination_name_ko?: string;
}

interface PricingListViewProps {
  dynamicPricingData: Array<{
    date: string;
    rules: SimplePricingRule[];
  }>;
  onEditRule: (rule: SimplePricingRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onRefresh?: () => void;
  choiceCombinations?: ChoiceCombination[];
  channels?: Array<{ id: string; pricing_type?: string; [key: string]: any }>;
}

export const PricingListView = memo(function PricingListView({
  dynamicPricingData,
  onEditRule,
  onDeleteRule,
  onRefresh,
  choiceCombinations = [],
  channels = []
}: PricingListViewProps) {
  // 편집 중인 초이스 상태 관리: { ruleId: string, choiceId: string }
  const [editingChoice, setEditingChoice] = useState<{ ruleId: string; choiceId: string } | null>(null);
  const [editValues, setEditValues] = useState<{ salePrice: number; notIncludedPrice: number }>({ salePrice: 0, notIncludedPrice: 0 });
  const [saving, setSaving] = useState(false);
  const formatDate = (dateString: string) => {
    // 날짜 문자열을 직접 파싱하여 시간대 변환 방지 (YYYY-MM-DD 형식)
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const monthName = months[parseInt(month) - 1];
    
    return `${year}년 ${monthName} ${day}일 ${weekday}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const getChoiceName = (choiceId: string): string => {
    // choiceCombinations에서 찾기
    const combination = choiceCombinations.find(c => c.combination_key === choiceId || c.id === choiceId);
    if (combination) {
      return combination.combination_name_ko || combination.combination_name || choiceId;
    }
    return choiceId;
  };

  const isSinglePrice = (channelId: string): boolean => {
    const channel = channels.find(c => c.id === channelId);
    return channel?.pricing_type === 'single';
  };

  // 초이스 가격 저장 함수
  const handleSaveChoice = async (rule: SimplePricingRule, choiceId: string) => {
    if (!editingChoice) return;
    
    setSaving(true);
    try {
      // 기존 choices_pricing 파싱
      let choicesPricing: Record<string, any> = {};
      if (rule.choices_pricing) {
        try {
          choicesPricing = typeof rule.choices_pricing === 'string'
            ? JSON.parse(rule.choices_pricing)
            : rule.choices_pricing;
        } catch (e) {
          console.warn('choices_pricing 파싱 오류:', e);
        }
      }

      // 편집한 초이스의 가격 업데이트
      if (!choicesPricing[choiceId]) {
        choicesPricing[choiceId] = {};
      }
      
      choicesPricing[choiceId] = {
        ...choicesPricing[choiceId],
        ota_sale_price: editValues.salePrice > 0 ? editValues.salePrice : undefined,
        not_included_price: editValues.notIncludedPrice > 0 ? editValues.notIncludedPrice : undefined
      };

      // 빈 값 제거
      if (choicesPricing[choiceId].ota_sale_price === undefined) {
        delete choicesPricing[choiceId].ota_sale_price;
      }
      if (choicesPricing[choiceId].not_included_price === undefined) {
        delete choicesPricing[choiceId].not_included_price;
      }

      // 규칙 업데이트
      const { error } = await supabase
        .from('dynamic_pricing')
        .update({
          choices_pricing: choicesPricing
        })
        .eq('id', rule.id);

      if (error) throw error;

      // 편집 모드 종료
      setEditingChoice(null);
      
      // 목록 새로고침
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('초이스 가격 저장 실패:', error);
      alert('가격 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 편집 시작
  const handleStartEdit = (rule: SimplePricingRule, choiceId: string, choiceData: any) => {
    setEditingChoice({ ruleId: rule.id, choiceId });
    setEditValues({
      salePrice: choiceData.ota_sale_price || 0,
      notIncludedPrice: choiceData.not_included_price || 0
    });
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingChoice(null);
    setEditValues({ salePrice: 0, notIncludedPrice: 0 });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">가격 규칙 목록</h3>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {dynamicPricingData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">설정된 가격 규칙이 없습니다</p>
            <p className="text-sm">새로운 가격 규칙을 추가해보세요.</p>
          </div>
        ) : (
          dynamicPricingData.map(({ date, rules }) => (
            <div key={date} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-900">
                  {formatDate(date)}
                </h4>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {rules.length}개 규칙
                </span>
              </div>

              <div className="space-y-3">
                {(() => {
                  // 같은 날짜의 모든 규칙에서 초이스를 수집하고 중복 제거
                  const allChoicesMap = new Map<string, any>();
                  
                  rules.forEach((rule) => {
                    let choicesPricing: Record<string, any> = {};
                    if (rule.choices_pricing) {
                      try {
                        choicesPricing = typeof rule.choices_pricing === 'string'
                          ? JSON.parse(rule.choices_pricing)
                          : rule.choices_pricing;
                      } catch (e) {
                        console.warn('choices_pricing 파싱 오류:', e);
                      }
                    }
                    
                    Object.entries(choicesPricing).forEach(([choiceId, choiceData]: [string, any]) => {
                      const hasOtaSalePrice = choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price > 0;
                      const hasNotIncludedPrice = choiceData.not_included_price !== undefined && choiceData.not_included_price > 0;
                      
                      if (!hasOtaSalePrice && !hasNotIncludedPrice) {
                        return; // OTA 판매가와 불포함 금액이 모두 없으면 표시하지 않음
                      }
                      
                      // 같은 초이스 ID가 이미 있으면, 불포함 금액이 있는 것을 우선
                      if (!allChoicesMap.has(choiceId)) {
                        allChoicesMap.set(choiceId, choiceData);
                      } else {
                        const existing = allChoicesMap.get(choiceId);
                        const existingHasNotIncluded = existing.not_included_price !== undefined && existing.not_included_price > 0;
                        // 기존에 불포함 금액이 없고 새로운 것에 있으면 업데이트
                        if (!existingHasNotIncluded && hasNotIncludedPrice) {
                          allChoicesMap.set(choiceId, choiceData);
                        }
                      }
                    });
                  });
                  
                  // 초이스가 없으면 기본 가격만 표시 (첫 번째 규칙 사용)
                  if (allChoicesMap.size === 0 && rules.length > 0) {
                    const firstRule = rules[0];
                    const singlePrice = isSinglePrice(firstRule.channel_id);
                    
                    return (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {!singlePrice && (
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">성인</span>
                                  <div className="font-semibold text-gray-900">
                                    {formatPrice(firstRule.adult_price)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">아동</span>
                                  <div className="font-semibold text-gray-900">
                                    {formatPrice(firstRule.child_price)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">유아</span>
                                  <div className="font-semibold text-gray-900">
                                    {formatPrice(firstRule.infant_price)}
                                  </div>
                                </div>
                              </div>
                            )}
                            {singlePrice && (
                              <div className="text-sm">
                                <span className="text-gray-500">가격: </span>
                                <span className="font-semibold text-gray-900">
                                  {formatPrice(firstRule.adult_price)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => onEditRule(firstRule)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="편집"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onDeleteRule(firstRule.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // 불포함 금액 유무로 분리
                  const choicesWithNotIncluded: Array<[string, any]> = [];
                  const choicesWithoutNotIncluded: Array<[string, any]> = [];
                  
                  allChoicesMap.forEach((choiceData, choiceId) => {
                    const hasNotIncludedPrice = choiceData.not_included_price !== undefined && choiceData.not_included_price > 0;
                    
                    if (hasNotIncludedPrice) {
                      choicesWithNotIncluded.push([choiceId, choiceData]);
                    } else {
                      choicesWithoutNotIncluded.push([choiceId, choiceData]);
                    }
                  });
                  
                  const renderChoice = (choiceId: string, choiceData: any) => {
                    const choiceName = getChoiceName(choiceId);
                    const hasOtaSalePrice = choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price > 0;
                    const hasNotIncludedPrice = choiceData.not_included_price !== undefined && choiceData.not_included_price > 0;
                    
                    // 편집 버튼을 위한 첫 번째 규칙 찾기
                    const firstRuleWithChoice = rules.find(rule => {
                      let choicesPricing: Record<string, any> = {};
                      if (rule.choices_pricing) {
                        try {
                          choicesPricing = typeof rule.choices_pricing === 'string'
                            ? JSON.parse(rule.choices_pricing)
                            : rule.choices_pricing;
                        } catch (e) {
                          return false;
                        }
                      }
                      return choicesPricing[choiceId] !== undefined;
                    });
                    
                    // 규칙을 찾지 못하면 첫 번째 규칙 사용
                    const ruleForEdit = firstRuleWithChoice || rules[0];
                    
                    if (!ruleForEdit) {
                      return null;
                    }
                    
                    // 편집 모드인지 확인
                    const isEditing = editingChoice?.ruleId === ruleForEdit.id && editingChoice?.choiceId === choiceId;
                    
                    // 가격 계산
                    const salePrice = isEditing ? editValues.salePrice : (hasOtaSalePrice ? choiceData.ota_sale_price : 0);
                    const notIncludedPrice = isEditing ? editValues.notIncludedPrice : (hasNotIncludedPrice ? choiceData.not_included_price : 0);
                    const customerPrice = salePrice + notIncludedPrice;
                    
                    // Net 가격 계산: 판매가 × (1 - 쿠폰 할인%) × (1 - 수수료%) + 불포함 금액
                    const couponPercent = ruleForEdit.coupon_percent || 0;
                    const commissionPercent = ruleForEdit.commission_percent || 0;
                    const netPrice = salePrice > 0
                      ? salePrice * (1 - couponPercent / 100) * (1 - commissionPercent / 100) + notIncludedPrice
                      : 0;

                    return (
                      <div
                        key={choiceId}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-800">
                            {choiceName}
                          </div>
                          <div className="flex items-center space-x-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveChoice(ruleForEdit, choiceId)}
                                  disabled={saving}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                                  title="저장"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  className="p-2 text-gray-400 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
                                  title="취소"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(ruleForEdit, choiceId, choiceData)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="편집"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (ruleForEdit) {
                                      onDeleteRule(ruleForEdit.id);
                                    }
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {isEditing ? (
                              // 편집 모드
                              <div className="space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center min-w-0">
                                    <span className="text-gray-600 mr-2 whitespace-nowrap text-xs">판매가</span>
                                    <input
                                      type="number"
                                      value={editValues.salePrice || ''}
                                      onChange={(e) => setEditValues(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="flex items-center min-w-0">
                                    <span className="text-gray-600 mr-2 whitespace-nowrap text-xs">불포함 금액</span>
                                    <input
                                      type="number"
                                      value={editValues.notIncludedPrice || ''}
                                      onChange={(e) => setEditValues(prev => ({ ...prev, notIncludedPrice: parseFloat(e.target.value) || 0 }))}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                  <div>손님가: {formatPrice(customerPrice)}</div>
                                  <div>Net: {formatPrice(netPrice)}</div>
                                </div>
                              </div>
                            ) : (
                              // 읽기 모드
                              <div className="space-y-2 text-sm">
                                {/* 판매가와 불포함 금액 같은 줄 */}
                                <div className="flex items-center space-x-4">
                                  {salePrice > 0 && (
                                    <div className="flex items-center">
                                      <span className="text-gray-600 mr-2">판매가</span>
                                      <span className="font-semibold text-gray-900">
                                        {formatPrice(salePrice)}
                                      </span>
                                    </div>
                                  )}
                                  {hasNotIncludedPrice && (
                                    <div className="flex items-center">
                                      <span className="text-gray-600 mr-2">불포함 금액</span>
                                      <span className="font-semibold text-gray-900">
                                        {formatPrice(notIncludedPrice)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {/* 손님가와 Net 같은 줄 */}
                                <div className="flex items-center space-x-4">
                                  {customerPrice > 0 && (
                                    <div className="flex items-center">
                                      <span className="text-gray-600 mr-2">손님가</span>
                                      <span className="font-semibold text-blue-600">
                                        {formatPrice(customerPrice)}
                                      </span>
                                    </div>
                                  )}
                                  {netPrice > 0 && (
                                    <div className="flex items-center">
                                      <span className="text-gray-600 mr-2">Net</span>
                                      <span className="font-semibold text-green-600">
                                        {formatPrice(netPrice)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };
                  
                  return (
                    <div className="space-y-4">
                      {/* 불포함 금액이 있는 초이스 */}
                      {choicesWithNotIncluded.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-700 mb-2 px-2">
                            불포함 금액 있음
                          </div>
                          {choicesWithNotIncluded.map(([choiceId, choiceData]) => 
                            renderChoice(choiceId, choiceData)
                          )}
                        </div>
                      )}
                      
                      {/* 불포함 금액이 없는 초이스 */}
                      {choicesWithoutNotIncluded.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-700 mb-2 px-2">
                            불포함 금액 없음
                          </div>
                          {choicesWithoutNotIncluded.map(([choiceId, choiceData]) => 
                            renderChoice(choiceId, choiceData)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
