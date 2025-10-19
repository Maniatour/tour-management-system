import React, { memo } from 'react';
import { DollarSign, Percent, ToggleLeft, ToggleRight } from 'lucide-react';

interface ChoiceCombination {
  id: string;
  combination_key: string;
  combination_name: string;
  combination_name_ko?: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
}

interface ChoicePricingPanelProps {
  choiceCombinations: ChoiceCombination[];
  showCombinationPricing: boolean;
  onToggleCombinationPricing: () => void;
  onUpdatePrice: (combinationId: string, priceType: 'adult_price' | 'child_price' | 'infant_price', value: number) => void;
}

export const ChoicePricingPanel = memo(function ChoicePricingPanel({
  choiceCombinations,
  showCombinationPricing,
  onToggleCombinationPricing,
  onUpdatePrice
}: ChoicePricingPanelProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(price);
  };

  if (!showCombinationPricing) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">초이스 조합 가격</h3>
          </div>
          <button
            onClick={onToggleCombinationPricing}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ToggleRight className="h-4 w-4" />
            <span>초이스 가격 설정</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          초이스 조합별로 개별 가격을 설정할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">초이스 조합 가격 설정</h3>
          </div>
          <button
            onClick={onToggleCombinationPricing}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <ToggleLeft className="h-4 w-4" />
            <span>닫기</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {choiceCombinations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">초이스 조합이 없습니다</p>
            <p className="text-sm">먼저 초이스 그룹을 설정해주세요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {choiceCombinations.map((combination) => (
              <div
                key={combination.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-1">
                    {combination.combination_name_ko || combination.combination_name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {combination.combination_name}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* 성인 가격 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      성인 가격
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={combination.adult_price}
                        onChange={(e) => onUpdatePrice(combination.id, 'adult_price', Number(e.target.value))}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* 아동 가격 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      아동 가격
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={combination.child_price}
                        onChange={(e) => onUpdatePrice(combination.id, 'child_price', Number(e.target.value))}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* 유아 가격 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      유아 가격
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={combination.infant_price}
                        onChange={(e) => onUpdatePrice(combination.id, 'infant_price', Number(e.target.value))}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* 가격 미리보기 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-gray-500">성인</div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(combination.adult_price)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500">아동</div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(combination.child_price)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500">유아</div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(combination.infant_price)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
