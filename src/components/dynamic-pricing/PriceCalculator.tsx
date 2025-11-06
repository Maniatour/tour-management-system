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
             {/* 최대 판매가 (기본가격 + 초이스 가격 + 업차지) */}
             <div>
               <h5 className="text-sm font-semibold text-green-600 mb-3">
                 최대 판매가 (기본가격 + 초이스 가격 + 업차지)
               </h5>
               <div className="overflow-x-auto">
                 <table className="w-full text-xs bg-green-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       // 기본가격 + 초이스가격 계산
                       const totalAdultPrice = (calculation?.basePrice?.adult || 0) + (choiceCalc.markupPrice.adult || 0);
                       const totalChildPrice = (calculation?.basePrice?.child || 0) + (choiceCalc.markupPrice.child || 0);
                       const totalInfantPrice = (calculation?.basePrice?.infant || 0) + (choiceCalc.markupPrice.infant || 0);
                       
                       // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                       const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                       const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                       const rowClass = isLowerAntelope ? 'bg-blue-50' : 'bg-green-50';
                       const textClass = isLowerAntelope ? 'text-blue-700' : 'text-green-700';
                       
                       return (
                         <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                           <td className={`py-1 px-2 font-medium ${textClass}`}>
                             {combinationName}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-blue-600">
                             {formatPrice(totalAdultPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-blue-600">
                             {formatPrice(totalChildPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-blue-600">
                             {formatPrice(totalInfantPrice)}
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
                 <table className="w-full text-xs bg-orange-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       // 기본가격 + 초이스가격에 할인 적용
                       const totalAdultPrice = (calculation?.basePrice?.adult || 0) + (choiceCalc.markupPrice.adult || 0);
                       const totalChildPrice = (calculation?.basePrice?.child || 0) + (choiceCalc.markupPrice.child || 0);
                       const totalInfantPrice = (calculation?.basePrice?.infant || 0) + (choiceCalc.markupPrice.infant || 0);
                       
                       const discountRate = (pricingConfig?.coupon_percent || 0) / 100;
                       const discountedAdultPrice = totalAdultPrice * (1 - discountRate);
                       const discountedChildPrice = totalChildPrice * (1 - discountRate);
                       const discountedInfantPrice = totalInfantPrice * (1 - discountRate);
                       
                       // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                       const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                       const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                       const rowClass = isLowerAntelope ? 'bg-blue-50' : 'bg-green-50';
                       const textClass = isLowerAntelope ? 'text-blue-700' : 'text-green-700';
                       
                       return (
                         <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                           <td className={`py-1 px-2 font-medium ${textClass}`}>
                             {combinationName}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-orange-600">
                             {formatPrice(discountedAdultPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-orange-600">
                             {formatPrice(discountedChildPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-medium text-orange-600">
                             {formatPrice(discountedInfantPrice)}
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
                 <table className="w-full text-xs bg-blue-50">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                       <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                       const combination = choiceCombinations.find(c => c.id === choiceId);
                       // 기본가격 + 초이스가격에 할인 적용 후 커미션 차감
                       const totalAdultPrice = (calculation?.basePrice?.adult || 0) + (choiceCalc.markupPrice.adult || 0);
                       const totalChildPrice = (calculation?.basePrice?.child || 0) + (choiceCalc.markupPrice.child || 0);
                       const totalInfantPrice = (calculation?.basePrice?.infant || 0) + (choiceCalc.markupPrice.infant || 0);
                       
                       const discountRate = (pricingConfig?.coupon_percent || 0) / 100;
                       const commissionRate = (pricingConfig?.commission_percent || 0) / 100;
                       
                       const discountedAdultPrice = totalAdultPrice * (1 - discountRate);
                       const discountedChildPrice = totalChildPrice * (1 - discountRate);
                       const discountedInfantPrice = totalInfantPrice * (1 - discountRate);
                       
                       const netAdultPrice = discountedAdultPrice * (1 - commissionRate);
                       const netChildPrice = discountedChildPrice * (1 - commissionRate);
                       const netInfantPrice = discountedInfantPrice * (1 - commissionRate);
                       
                       // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                       const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                       const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                       const rowClass = isLowerAntelope ? 'bg-blue-50' : 'bg-green-50';
                       const textClass = isLowerAntelope ? 'text-blue-700' : 'text-green-700';
                       
                       return (
                         <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                           <td className={`py-1 px-2 font-medium ${textClass}`}>
                             {combinationName}
                           </td>
                           <td className="py-1 px-2 text-right font-bold text-green-600">
                             {formatPrice(netAdultPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-bold text-green-600">
                             {formatPrice(netChildPrice)}
                           </td>
                           <td className="py-1 px-2 text-right font-bold text-green-600">
                             {formatPrice(netInfantPrice)}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* OTA 판매가 (최대 판매가 × 0.8 / (1 - 수수료%)) */}
             <div>
               <h5 className="text-sm font-semibold text-purple-600 mb-3">
                 OTA 판매가 (최대 판매가 × 0.8 / (1 - 수수료%))
               </h5>
               <div className="overflow-x-auto">
                 {/* 수수료 계산을 테이블 바깥에서 수행 */}
                 {(() => {
                   const commissionPercent = pricingConfig?.commission_percent || 0;
                   const commissionRate = commissionPercent / 100;
                   
                   return (
                     <>
                       <table className="w-full text-xs bg-purple-50">
                         <thead>
                           <tr className="border-b border-gray-200">
                             <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                           </tr>
                         </thead>
                         <tbody>
                           {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                             const combination = choiceCombinations.find(c => c.id === choiceId);
                             // 최대 판매가 = 기본가격 + 초이스가격 (마크업 포함)
                             const maxAdultPrice = (calculation?.basePrice?.adult || 0) + (choiceCalc.markupPrice.adult || 0);
                             const maxChildPrice = (calculation?.basePrice?.child || 0) + (choiceCalc.markupPrice.child || 0);
                             const maxInfantPrice = (calculation?.basePrice?.infant || 0) + (choiceCalc.markupPrice.infant || 0);
                             
                             // 최대 판매가 × 0.8 (20% 할인 고정값)
                             const discountedAdultPrice = maxAdultPrice * 0.8;
                             const discountedChildPrice = maxChildPrice * 0.8;
                             const discountedInfantPrice = maxInfantPrice * 0.8;
                             
                             // OTA 판매가 = (최대 판매가 × 0.8) / (1 - 수수료율)
                             const denominator = 1 - commissionRate;
                             const otaAdultPrice = denominator > 0 && denominator !== 0 ? discountedAdultPrice / denominator : discountedAdultPrice;
                             const otaChildPrice = denominator > 0 && denominator !== 0 ? discountedChildPrice / denominator : discountedChildPrice;
                             const otaInfantPrice = denominator > 0 && denominator !== 0 ? discountedInfantPrice / denominator : discountedInfantPrice;
                             
                             // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                             const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                             const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                             const rowClass = isLowerAntelope ? 'bg-purple-100' : 'bg-purple-50';
                             const textClass = isLowerAntelope ? 'text-purple-800' : 'text-purple-700';
                             
                             return (
                               <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                                 <td className={`py-1 px-2 font-medium ${textClass}`}>
                                   {combinationName}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-purple-700">
                                   {formatPrice(otaAdultPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-purple-700">
                                   {formatPrice(otaChildPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-purple-700">
                                   {formatPrice(otaInfantPrice)}
                                 </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                       <div className="mt-2 text-xs text-gray-600 px-2">
                         최대 판매가 × 0.8 (20% 할인 고정) / (1 - {commissionPercent}%) = OTA 판매가
                       </div>
                     </>
                   );
                 })()}
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
