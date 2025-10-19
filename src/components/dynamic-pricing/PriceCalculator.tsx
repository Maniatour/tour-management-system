import React, { memo } from 'react';
import { Calculator, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { RealTimePriceCalculation, PricingConfig } from '@/lib/types/dynamic-pricing';

interface PriceCalculatorProps {
  calculation: RealTimePriceCalculation | null | undefined;
  pricingConfig: PricingConfig | null | undefined;
  choiceCalculations?: Record<string, RealTimePriceCalculation>;
  choiceCombinations?: any[];
}

export const PriceCalculator = memo(function PriceCalculator({
  calculation,
  pricingConfig,
  choiceCalculations = {},
  choiceCombinations = []
}: PriceCalculatorProps) {
  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) {
      return '$0.00';
    }
    return `$${price.toFixed(2)}`;
  };

  // calculation이 없거나 유효하지 않은 경우 기본값 제공
  if (!calculation) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Calculator className="h-5 w-5" />
          <span>실시간 가격 계산</span>
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center text-gray-500 py-8">
            가격 설정을 입력하면 실시간 계산 결과가 표시됩니다.
          </div>
        </div>
      </div>
    );
  }

  // 초이스가 있는지 확인
  const hasChoices = Object.keys(choiceCalculations).length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
        <Calculator className="h-5 w-5" />
        <span>실시간 가격 계산</span>
      </h3>

      {/* 초이스가 없을 때만 기본 가격 계산 표시 */}
      {!hasChoices && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <DollarSign className="h-4 w-4" />
            <span>기본 가격 계산</span>
          </h4>

          <div className="space-y-3">
            {/* 기본 가격 */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">기본 가격 (불포함 금액 차감)</span>
              <div className="text-right">
                <div className="text-sm font-medium">
                  성인 {formatPrice(calculation.basePrice.adult)} | 
                  아동 {formatPrice(calculation.basePrice.child)} | 
                  유아 {formatPrice(calculation.basePrice.infant)}
                </div>
              </div>
            </div>

            {/* 마크업 적용 */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600 flex items-center space-x-1">
                <TrendingUp className="h-3 w-3" />
                <span>마크업 적용</span>
              </span>
              <div className="text-right">
                <div className="text-sm font-medium">
                  성인 {formatPrice(calculation.markupPrice.adult)} | 
                  아동 {formatPrice(calculation.markupPrice.child)} | 
                  유아 {formatPrice(calculation.markupPrice.infant)}
                </div>
                <div className="text-xs text-gray-500">
                  +{pricingConfig?.markup_amount || 0}$ + {pricingConfig?.markup_percent || 0}%
                </div>
              </div>
            </div>

            {/* 할인 적용 */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600 flex items-center space-x-1">
                <TrendingDown className="h-3 w-3" />
                <span>할인 적용</span>
              </span>
              <div className="text-right">
                <div className="text-sm font-medium">
                  성인 {formatPrice(calculation.discountPrice.adult)} | 
                  아동 {formatPrice(calculation.discountPrice.child)} | 
                  유아 {formatPrice(calculation.discountPrice.infant)}
                </div>
                <div className="text-xs text-gray-500">
                  -{pricingConfig?.coupon_percent || 0}% 쿠폰
                </div>
              </div>
            </div>

            {/* 최종 판매가 */}
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">최종 판매가</span>
              <div className="text-right">
                <div className="text-sm font-bold text-green-600">
                  성인 {formatPrice(calculation.finalPrice.adult)} | 
                  아동 {formatPrice(calculation.finalPrice.child)} | 
                  유아 {formatPrice(calculation.finalPrice.infant)}
                </div>
              </div>
            </div>

            {/* 수수료 */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">수수료</span>
              <div className="text-right">
                <div className="text-sm font-medium text-red-600">
                  성인 -{formatPrice(calculation.commission.adult)} | 
                  아동 -{formatPrice(calculation.commission.child)} | 
                  유아 -{formatPrice(calculation.commission.infant)}
                </div>
                <div className="text-xs text-gray-500">
                  {pricingConfig?.commission_percent || 0}%
                </div>
              </div>
            </div>

            {/* 순수익 */}
            <div className="flex justify-between items-center py-3 bg-green-50 rounded-md px-3">
              <span className="text-sm font-semibold text-green-800">순수익</span>
              <div className="text-right">
                <div className="text-sm font-bold text-green-700">
                  성인 {formatPrice(calculation.netPrice.adult)} | 
                  아동 {formatPrice(calculation.netPrice.child)} | 
                  유아 {formatPrice(calculation.netPrice.infant)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* 초이스가 있을 때만 초이스별 가격 계산 표시 */}
       {hasChoices && (
         <div className="bg-white border border-gray-200 rounded-lg p-4">
           <h4 className="text-md font-semibold text-gray-900 mb-4">
             초이스별 가격 계산
           </h4>
           
           <div className="space-y-6">
             {/* 최대 판매가 (초이스 가격 + 업차지) */}
             <div>
               <h5 className="text-sm font-semibold text-green-600 mb-3">
                 최대 판매가 (초이스 가격 + 업차지)
               </h5>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm bg-green-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       return (
                         <tr key={choiceId} className="border-b border-gray-100">
                           <td className="py-2 text-gray-700">
                             {combination?.combination_name_ko || combination?.combination_name || choiceId}
                           </td>
                           <td className="py-2 text-right font-medium text-blue-600">
                             {formatPrice(choiceCalc.markupPrice.adult)}
                           </td>
                           <td className="py-2 text-right font-medium text-blue-600">
                             {formatPrice(choiceCalc.markupPrice.child)}
                           </td>
                           <td className="py-2 text-right font-medium text-blue-600">
                             {formatPrice(choiceCalc.markupPrice.infant)}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* 할인 가격 (최대 판매가 × 쿠폰%) */}
             <div>
               <h5 className="text-sm font-semibold text-orange-600 mb-3">
                 할인 가격 (최대 판매가 × 쿠폰%)
               </h5>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm bg-orange-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       return (
                         <tr key={choiceId} className="border-b border-gray-100">
                           <td className="py-2 text-gray-700">
                             {combination?.combination_name_ko || combination?.combination_name || choiceId}
                           </td>
                           <td className="py-2 text-right font-medium text-orange-600">
                             {formatPrice(choiceCalc.discountPrice.adult)}
                           </td>
                           <td className="py-2 text-right font-medium text-orange-600">
                             {formatPrice(choiceCalc.discountPrice.child)}
                           </td>
                           <td className="py-2 text-right font-medium text-orange-600">
                             {formatPrice(choiceCalc.discountPrice.infant)}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* Net Price (할인가격 - 커미션) */}
             <div>
               <h5 className="text-sm font-semibold text-blue-600 mb-3">
                 Net Price (할인가격 - 커미션)
               </h5>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm bg-blue-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       return (
                         <tr key={choiceId} className="border-b border-gray-100">
                           <td className="py-2 text-gray-700">
                             {combination?.combination_name_ko || combination?.combination_name || choiceId}
                           </td>
                           <td className="py-2 text-right font-bold text-green-600">
                             {formatPrice(choiceCalc.netPrice.adult)}
                           </td>
                           <td className="py-2 text-right font-bold text-green-600">
                             {formatPrice(choiceCalc.netPrice.child)}
                           </td>
                           <td className="py-2 text-right font-bold text-green-600">
                             {formatPrice(choiceCalc.netPrice.infant)}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
         </div>
       )}

      {/* 설정 요약 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">현재 설정</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>불포함 금액: {formatPrice(pricingConfig?.not_included_price)}</div>
          <div>마크업: {pricingConfig?.markup_amount || 0}$ + {pricingConfig?.markup_percent || 0}%</div>
          <div>쿠폰 할인: {pricingConfig?.coupon_percent || 0}%</div>
          <div>수수료: {pricingConfig?.commission_percent || 0}%</div>
        </div>
      </div>
    </div>
  );
});
