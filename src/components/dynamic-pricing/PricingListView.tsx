import React, { memo } from 'react';
import { DollarSign, Calendar, Edit, Trash2 } from 'lucide-react';
import { SimplePricingRule } from '@/lib/types/dynamic-pricing';

interface PricingListViewProps {
  dynamicPricingData: Array<{
    date: string;
    rules: SimplePricingRule[];
  }>;
  onEditRule: (rule: SimplePricingRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export const PricingListView = memo(function PricingListView({
  dynamicPricingData,
  onEditRule,
  onDeleteRule
}: PricingListViewProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(price);
  };

  const getChannelName = (channelId: string) => {
    // 실제로는 채널 데이터에서 가져와야 함
    return `채널 ${channelId}`;
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
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {getChannelName(rule.channel_id)}
                          </span>
                          {rule.is_sale_available && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              세일 중
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">성인</span>
                            <div className="font-semibold text-gray-900">
                              {formatPrice(rule.adult_price)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">아동</span>
                            <div className="font-semibold text-gray-900">
                              {formatPrice(rule.child_price)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">유아</span>
                            <div className="font-semibold text-gray-900">
                              {formatPrice(rule.infant_price)}
                            </div>
                          </div>
                        </div>

                        {(rule.commission_percent > 0 || rule.markup_amount > 0 || rule.coupon_percent > 0) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                              {rule.commission_percent > 0 && (
                                <div>
                                  <span>수수료: </span>
                                  <span className="font-medium">{rule.commission_percent}%</span>
                                </div>
                              )}
                              {rule.markup_amount > 0 && (
                                <div>
                                  <span>마크업: </span>
                                  <span className="font-medium">{formatPrice(rule.markup_amount)}</span>
                                </div>
                              )}
                              {rule.coupon_percent > 0 && (
                                <div>
                                  <span>쿠폰 할인: </span>
                                  <span className="font-medium">{rule.coupon_percent}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => onEditRule(rule)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="편집"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteRule(rule.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
