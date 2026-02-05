import React, { memo, useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DollarSign, Calendar, Edit, Trash2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const t = useTranslations('products.dynamicPricingPage');
  // 디버깅: choiceCombinations 로드 확인
  useEffect(() => {
    if (choiceCombinations.length > 0) {
      console.log('PricingListView - choiceCombinations 로드됨:', choiceCombinations.map(c => ({
        id: c.id,
        combination_key: c.combination_key,
        name: c.combination_name_ko || c.combination_name
      })));
    } else {
      console.warn('PricingListView - choiceCombinations가 비어있음');
    }
  }, [choiceCombinations]);

  // 날짜 필터: 'past' = 지난 날짜만, 'future' = 오늘 포함 앞으로만
  const [dateFilter, setDateFilter] = useState<'past' | 'future'>('future');
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 편집 중인 초이스 상태 관리: { ruleId: string, choiceId: string }
  const [editingChoice, setEditingChoice] = useState<{ ruleId: string; choiceId: string } | null>(null);
  const [editValues, setEditValues] = useState<{ salePrice: number; notIncludedPrice: number }>({ salePrice: 0, notIncludedPrice: 0 });
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 날짜 필터 적용
  const filteredByDate = useMemo(() => {
    return dynamicPricingData.filter(({ date }) => {
      if (dateFilter === 'past') return date < today;
      return date >= today;
    });
  }, [dynamicPricingData, dateFilter, today]);

  const totalPages = Math.max(1, Math.ceil(filteredByDate.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredByDate.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredByDate, currentPage, ITEMS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter]);
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
    // choiceCombinations에서 찾기 (여러 방법으로 시도)
    let combination = choiceCombinations.find(c => 
      c.id === choiceId || 
      c.combination_key === choiceId ||
      c.id?.includes(choiceId) ||
      c.combination_key?.includes(choiceId)
    );
    
    if (combination) {
      return combination.combination_name_ko || combination.combination_name || choiceId;
    }
    
    // 찾지 못한 경우 디버깅 로그
    if (choiceCombinations.length > 0) {
      console.warn(`초이스 이름을 찾을 수 없음: choiceId=${choiceId}`, {
        availableIds: choiceCombinations.map(c => ({ id: c.id, key: c.combination_key, name: c.combination_name })),
        choiceCombinationsCount: choiceCombinations.length
      });
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

  // 초이스 카드 삭제: 해당 규칙에서 이 초이스만 제거 (규칙 전체 삭제 아님)
  const handleDeleteChoiceFromRule = async (rule: SimplePricingRule, choiceId: string) => {
    if (!confirm(`이 초이스의 가격 설정만 삭제할까요? (해당 날짜의 다른 초이스는 유지됩니다)`)) return;
    setSaving(true);
    try {
      let choicesPricing: Record<string, any> = {};
      if (rule.choices_pricing) {
        try {
          choicesPricing = typeof rule.choices_pricing === 'string'
            ? JSON.parse(rule.choices_pricing)
            : { ...rule.choices_pricing };
        } catch (e) {
          console.warn('choices_pricing 파싱 오류:', e);
        }
      }
      delete choicesPricing[choiceId];
      const { error } = await supabase
        .from('dynamic_pricing')
        .update({ choices_pricing: choicesPricing })
        .eq('id', rule.id);
      if (error) throw error;
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('초이스 가격 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col max-h-[75vh]">
      <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">{t('priceRuleList')}</h3>
          </div>
          <div className="flex items-center gap-0.5 rounded border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setDateFilter('past')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                dateFilter === 'past'
                  ? 'bg-white text-blue-700 shadow border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('viewPastDates')}
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('future')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                dateFilter === 'future'
                  ? 'bg-white text-blue-700 shadow border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('viewTodayAndFuture')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {filteredByDate.length === 0 ? (
          <div className="p-4 text-center text-gray-500 flex-shrink-0">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium">설정된 가격 규칙이 없습니다</p>
            <p className="text-xs">
              {dateFilter === 'past' ? '지난 날짜의 가격 규칙이 없습니다.' : '오늘 이후의 가격 규칙이 없습니다. 새로운 가격 규칙을 추가해보세요.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200 min-h-0">
              {paginatedData.map(({ date, rules }) => (
            <div key={date} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-sm font-semibold text-gray-900">
                  {formatDate(date)}
                </h4>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">
                  {t('rulesCount', { count: rules.length })}
                </span>
              </div>

              <div className="space-y-2">
                {(() => {
                  // 같은 날 규칙들에서 초이스별 가장 최신값만 사용 (updated_at 기준)
                  const ruleUpdatedAt = (r: SimplePricingRule) => r.updated_at || '';
                  const rulesByNewest = [...rules].sort((a, b) => ruleUpdatedAt(b).localeCompare(ruleUpdatedAt(a)));

                  const latestByChoice = new Map<string, { choiceId: string; choiceData: any; rule: SimplePricingRule }>();
                  for (const rule of rulesByNewest) {
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
                    for (const [choiceId, choiceData] of Object.entries(choicesPricing)) {
                      if (!latestByChoice.has(choiceId)) {
                        latestByChoice.set(choiceId, { choiceId, choiceData, rule });
                      }
                    }
                  }

                  const latestChoices = Array.from(latestByChoice.values());

                  // 초이스가 전혀 없는 규칙들 중 가장 최신 규칙 하나만 기본 가격으로 표시
                  const rulesWithNoChoices = rules.filter(r => {
                    let cp: Record<string, any> = {};
                    if (r.choices_pricing) {
                      try {
                        cp = typeof r.choices_pricing === 'string' ? JSON.parse(r.choices_pricing) : r.choices_pricing;
                      } catch (_) {}
                    }
                    return Object.keys(cp).length === 0;
                  });
                  const latestRuleWithoutChoices = rulesWithNoChoices.length > 0
                    ? rulesWithNoChoices.sort((a, b) => ruleUpdatedAt(b).localeCompare(ruleUpdatedAt(a)))[0]
                    : null;
                  
                  const renderChoice = (choiceId: string, choiceData: any, rule: SimplePricingRule) => {
                    const choiceName = getChoiceName(choiceId);
                    const adultPrice = choiceData.adult_price ?? choiceData.adult ?? 0;
                    const childPrice = choiceData.child_price ?? choiceData.child ?? 0;
                    const infantPrice = choiceData.infant_price ?? choiceData.infant ?? 0;
                    const hasOtaSalePrice = choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price > 0;
                    const hasNotIncludedPrice = choiceData.not_included_price !== undefined && choiceData.not_included_price > 0;

                    // 전달받은 rule 사용
                    const ruleForEdit = rule;
                    
                    if (!ruleForEdit) {
                      return null;
                    }
                    
                    // 편집 모드인지 확인 (rule.id와 choiceId로 구분)
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
                        key={`${rule.id}_${choiceId}`}
                        className="px-2 py-1.5 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-xs font-medium text-gray-800 truncate min-w-0">
                            {choiceName}
                          </div>
                          <div className="flex items-center space-x-0.5 flex-shrink-0">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveChoice(ruleForEdit, choiceId)}
                                  disabled={saving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="저장"
                                >
                                  <Save className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  className="p-1 text-gray-400 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                                  title={t('cancel')}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(ruleForEdit, choiceId, choiceData)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="편집"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (ruleForEdit) {
                                      handleDeleteChoiceFromRule(ruleForEdit, choiceId);
                                    }
                                  }}
                                  disabled={saving}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title={t('delete')}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="space-y-1 text-[11px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center min-w-0">
                                    <span className="text-gray-600 mr-1 whitespace-nowrap">판매가</span>
                                    <input
                                      type="number"
                                      value={editValues.salePrice || ''}
                                      onChange={(e) => setEditValues(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                                      className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-[11px]"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="flex items-center min-w-0">
                                    <span className="text-gray-600 mr-1 whitespace-nowrap">{t('notIncludedAmount')}</span>
                                    <input
                                      type="number"
                                      value={editValues.notIncludedPrice || ''}
                                      onChange={(e) => setEditValues(prev => ({ ...prev, notIncludedPrice: parseFloat(e.target.value) || 0 }))}
                                      className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-[11px]"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-gray-500">
                                  <span>손님가: {formatPrice(customerPrice)}</span>
                                  <span>Net: {formatPrice(netPrice)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5 text-[11px]">
                                {!isSinglePrice(ruleForEdit.channel_id) && (adultPrice > 0 || childPrice > 0 || infantPrice > 0) && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0">
                                    {adultPrice >= 0 && <span><span className="text-gray-500">{t('adult')}:</span> <span className="font-medium">{formatPrice(adultPrice)}</span></span>}
                                    {childPrice >= 0 && <span><span className="text-gray-500">아동:</span> <span className="font-medium">{formatPrice(childPrice)}</span></span>}
                                    {infantPrice >= 0 && <span><span className="text-gray-500">{t('infant')}:</span> <span className="font-medium">{formatPrice(infantPrice)}</span></span>}
                                  </div>
                                )}
                                {isSinglePrice(ruleForEdit.channel_id) && (adultPrice > 0 || childPrice > 0 || infantPrice > 0) && (
                                  <div><span className="text-gray-500">단일:</span> <span className="font-medium">{formatPrice(adultPrice || childPrice || infantPrice)}</span></div>
                                )}
                                <div className="flex flex-wrap gap-x-2 gap-y-0">
                                  <span><span className="text-gray-500">{t('salePrice')}</span> <span className="font-medium">{salePrice > 0 ? formatPrice(salePrice) : '-'}</span></span>
                                  <span><span className="text-gray-500">불포함</span> <span className="font-medium">{hasNotIncludedPrice ? formatPrice(notIncludedPrice) : '-'}</span></span>
                                  <span><span className="text-gray-500">손님가</span> <span className="font-medium text-blue-600">{customerPrice > 0 ? formatPrice(customerPrice) : '-'}</span></span>
                                  <span><span className="text-gray-500">Net</span> <span className="font-medium text-green-600">{netPrice > 0 ? formatPrice(netPrice) : '-'}</span></span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };
                  
                  // 초이스가 없는 경우 기본 가격 표시
                  const renderRuleWithoutChoices = (rule: SimplePricingRule) => {
                    const singlePrice = isSinglePrice(rule.channel_id);
                    return (
                      <div key={rule.id} className="px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-xs font-medium text-gray-800">{t('basePrice')}</div>
                          <div className="flex items-center space-x-0.5">
                            <button onClick={() => onEditRule(rule)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="편집"><Edit className="h-3 w-3" /></button>
                            <button onClick={() => onDeleteRule(rule.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title={t('delete')}><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                        <div className="flex-1 text-[11px]">
                          {!singlePrice && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0">
                              <span><span className="text-gray-500">{t('adult')}</span> <span className="font-medium text-gray-900">{formatPrice(rule.adult_price)}</span></span>
                              <span><span className="text-gray-500">아동</span> <span className="font-medium text-gray-900">{formatPrice(rule.child_price)}</span></span>
                              <span><span className="text-gray-500">{t('infant')}</span> <span className="font-medium text-gray-900">{formatPrice(rule.infant_price)}</span></span>
                            </div>
                          )}
                          {singlePrice && (
                            <div><span className="text-gray-500">가격</span> <span className="font-medium text-gray-900">{formatPrice(rule.adult_price)}</span></div>
                          )}
                        </div>
                      </div>
                    );
                  };
                  
                  return (
                    <div className="space-y-1">
                      {latestChoices.map(({ choiceId, choiceData, rule }) => renderChoice(choiceId, choiceData, rule))}
                      {latestRuleWithoutChoices && renderRuleWithoutChoices(latestRuleWithoutChoices)}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
            </div>

            {totalPages > 1 && (
              <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-600">
                  {t('pageInfo', {
                    start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    end: Math.min(currentPage * ITEMS_PER_PAGE, filteredByDate.length),
                    total: filteredByDate.length
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('prevPage')}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1.5 text-xs text-gray-600">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('nextPage')}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
