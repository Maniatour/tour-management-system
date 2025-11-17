import React, { memo } from 'react';
import { Calculator, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { RealTimePriceCalculation, PricingConfig } from '@/lib/types/dynamic-pricing';
import { findHomepageChoiceData } from '@/utils/homepagePriceCalculator';

interface Channel {
  id: string;
  name: string;
  commission_percent?: number;
  [key: string]: unknown;
}

interface PriceCalculatorProps {
  calculation: RealTimePriceCalculation | null | undefined;
  pricingConfig: PricingConfig | null | undefined;
  choiceCalculations?: Record<string, RealTimePriceCalculation>;
  choiceCombinations?: any[];
  selectedChannel?: {
    id: string;
    name: string;
    commission_base_price_only?: boolean;
    [key: string]: unknown;
  } | null;
  channels?: Channel[];
  productBasePrice?: {
    adult: number;
    child: number;
    infant: number;
  };
  homepagePricingConfig?: {
    markup_amount: number;
    markup_percent: number;
    choices_pricing: Record<string, any>;
  };
}

export const PriceCalculator = memo(function PriceCalculator({
  calculation,
  pricingConfig,
  choiceCalculations = {},
  choiceCombinations = [],
  selectedChannel,
  channels = [],
  productBasePrice = { adult: 0, child: 0, infant: 0 },
  homepagePricingConfig = { markup_amount: 0, markup_percent: 0, choices_pricing: {} }
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
       {/* 초이스별 가격 계산 제거 - 더 이상 표시하지 않음 */}
       {false && hasChoices && (() => {
         // 채널이 OTA인지 확인
         const isOTAChannel = selectedChannel && (
           (selectedChannel as any).type?.toLowerCase() === 'ota' || 
           (selectedChannel as any).category === 'OTA'
         );
         
         // 홈페이지 채널 찾기
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

         return (
           <div className="bg-white border border-gray-200 rounded-lg p-4">
             <h4 className="text-md font-semibold text-gray-900 mb-4">
               초이스별 가격 계산
             </h4>
             
             {/* 홈페이지 Net Price - 초이스별 표시 */}
             {homepageChannel && calculation && pricingConfig && (() => {
               const homepageCommissionPercent = homepageChannel.commission_percent || 0;
               const homepageCommissionRate = homepageCommissionPercent / 100;
               const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
               const isSinglePrice = pricingType === 'single';

               return (
                 <div className="mb-3">
                   <div className="flex items-center justify-between mb-1">
                     <h5 className="text-xs font-semibold text-purple-700">
                       홈페이지 가격 정보 (20%할인)
                     </h5>
                     <div className="text-xs text-purple-600">
                       * 참고용
                     </div>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-xs bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-400 shadow-md">
                       <thead>
                         <tr className="border-b border-purple-500 bg-purple-600">
                           <th className="text-left py-1 px-2 font-bold text-white text-xs">초이스</th>
                           <th className="text-right py-1 px-2 font-bold text-white text-xs">기본</th>
                           <th className="text-right py-1 px-2 font-bold text-white text-xs">초이스</th>
                           <th className="text-right py-1 px-2 font-bold text-white text-xs">판매가</th>
                           <th className="text-right py-1 px-2 font-bold text-white text-xs">Net</th>
                         </tr>
                       </thead>
                       <tbody>
                        {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                          const combination = choiceCombinations.find(c => c.id === choiceId);
                          const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                          
                          // 홈페이지 가격 계산
                          // 홈페이지 가격은 홈페이지(M00001) 채널에 설정된 고정 가격이어야 하므로,
                          // M00001 채널의 가격 설정을 사용
                          const baseProductPrice = {
                            adult: productBasePrice.adult || 0,
                            child: productBasePrice.child || 0,
                            infant: productBasePrice.infant || 0
                          };
                           
                          // 공통 함수를 사용하여 초이스 가격 찾기
                          let homepageChoiceData = findHomepageChoiceData(
                            combination || { id: choiceId },
                            homepagePricingConfig || { choices_pricing: {} }
                          );
                          
                          // homepagePricingConfig에서 찾지 못한 경우, choiceCombinations의 가격을 사용 (fallback)
                          const hasHomepageConfigData = Object.keys(homepagePricingConfig?.choices_pricing || {}).length > 0;
                          
                          if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0 || 
                               (homepageChoiceData.adult_price === 0 && homepageChoiceData.child_price === 0 && homepageChoiceData.infant_price === 0)) && 
                              combination) {
                            // homepagePricingConfig에 데이터가 없거나 찾지 못한 경우, combination의 가격 사용
                            if (!hasHomepageConfigData || 
                                (combination.adult_price !== undefined || combination.child_price !== undefined || combination.infant_price !== undefined)) {
                              homepageChoiceData = {
                                adult_price: combination.adult_price || 0,
                                child_price: combination.child_price || 0,
                                infant_price: combination.infant_price || 0
                              };
                            }
                          }
                          
                          // 디버깅: 초이스 가격 로드 확인
                          const foundInHomepageConfig = homepagePricingConfig?.choices_pricing?.[choiceId] || 
                                                         homepagePricingConfig?.choices_pricing?.[combination?.combination_key || ''];
                          const source = foundInHomepageConfig ? 'homepagePricingConfig' : 'combination';
                          
                          // 디버깅: 문제가 있는 경우에만 로그 출력
                          if (hasHomepageConfigData && source === 'combination' && 
                              (homepageChoiceData.adult_price === 0 && homepageChoiceData.child_price === 0 && homepageChoiceData.infant_price === 0)) {
                            console.warn('⚠️ 홈페이지 초이스 가격 키 불일치:', {
                              choiceId,
                              combination_key: combination?.combination_key,
                              homepagePricingConfig_keys: Object.keys(homepagePricingConfig?.choices_pricing || {}),
                              homepagePricingConfig_sample: Object.entries(homepagePricingConfig?.choices_pricing || {}).slice(0, 2)
                            });
                          }
                          
                          // homepagePricingConfig에서 찾지 못했거나 0인 경우, choiceCombinations 사용하지 않음
                          // (choiceCombinations는 현재 선택된 채널의 가격을 포함할 수 있음)
                          if (source === 'combination' && hasHomepageConfigData && 
                              (homepageChoiceData.adult_price === 0 && homepageChoiceData.child_price === 0 && homepageChoiceData.infant_price === 0)) {
                            // homepagePricingConfig에 데이터가 있지만 키가 일치하지 않는 경우
                            // 빈 객체로 설정하여 0으로 표시
                            console.warn('홈페이지 초이스 가격 키 불일치 (M00001 채널):', {
                              choiceId,
                              combination_key: combination?.combination_key,
                              availableKeys: Object.keys(homepagePricingConfig?.choices_pricing || {}),
                              homepagePricingConfig_sample: Object.entries(homepagePricingConfig?.choices_pricing || {}).slice(0, 3)
                            });
                            homepageChoiceData = {};
                          }
                          
                          // 찾은 homepageChoiceData를 사용하여 가격 계산
                          const choicePrice = {
                            adult_price: homepageChoiceData?.adult_price || homepageChoiceData?.adult || 0,
                            child_price: homepageChoiceData?.child_price || homepageChoiceData?.child || 0,
                            infant_price: homepageChoiceData?.infant_price || homepageChoiceData?.infant || 0
                          };
                           
                           // 기본: 상품 기본가격 (마크업 적용 전)
                           const basePrice = {
                             adult: baseProductPrice.adult,
                             child: baseProductPrice.child,
                             infant: baseProductPrice.infant
                           };
                           
                           // 초이스: 초이스별 가격 (M00001 채널의 고정값)
                           const choicePriceValue = {
                             adult: choicePrice.adult_price || 0,
                             child: choicePrice.child_price || 0,
                             infant: choicePrice.infant_price || 0
                           };
                           
                           // 판매가: 상품 기본가격 + 초이스별 가격
                           const salePrice = {
                             adult: basePrice.adult + choicePriceValue.adult,
                             child: basePrice.child + choicePriceValue.child,
                             infant: basePrice.infant + choicePriceValue.infant
                           };
                           
                           // Net: 판매가에서 20% 할인가격
                           const netPrice = {
                             adult: salePrice.adult * 0.8,
                             child: salePrice.child * 0.8,
                             infant: salePrice.infant * 0.8
                           };
                           
                           // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                           const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                           const rowClass = isLowerAntelope ? 'bg-purple-200 hover:bg-purple-300' : 'bg-pink-200 hover:bg-pink-300';
                           const textClass = isLowerAntelope ? 'text-purple-900 font-semibold' : 'text-pink-900 font-semibold';
                           
                           return (
                             <tr key={choiceId} className={`border-b border-purple-300 ${rowClass} transition-colors`}>
                               <td className={`py-1 px-2 font-semibold ${textClass} text-xs`}>
                                 {combinationName}
                               </td>
                               <td className="py-1 px-2 text-right text-purple-900 text-xs">
                                 {formatPrice(basePrice.adult)}
                               </td>
                               <td className="py-1 px-2 text-right text-purple-900 text-xs">
                                 {formatPrice(choicePriceValue.adult)}
                               </td>
                               <td className="py-1 px-2 text-right font-semibold text-purple-900 text-xs">
                                 {formatPrice(salePrice.adult)}
                               </td>
                               <td className="py-1 px-2 text-right font-bold text-purple-900 text-xs">
                                 {formatPrice(netPrice.adult)}
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                 </div>
               );
             })()}
             
             <div className="space-y-6">
               {/* 최대 판매가 (기본가격 + 초이스 가격 + 업차지) - OTA 채널이 아닐 때만 표시 */}
               {!isOTAChannel && (() => {
                 // 동적 가격의 불포함 금액 사용
                 const notIncludedPrice = (pricingConfig as any)?.not_included_price || 0;
                 const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
                 const isSinglePrice = pricingType === 'single';
                 const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                 
                 // 불포함 금액이 있으면 항상 표시
                 const showNotIncludedColumn = notIncludedPrice > 0;
                 // 불포함 금액이 설정되어 있으면 항상 계산 과정 표시
                 const showCalculationProcess = showNotIncludedColumn;
                 
                 // 테이블 형식 결정: 조건에 맞으면 할인 가격처럼 가로 형식 (성인/아동/유아 별도 컬럼)
                 // 조건: pricing_type === 'separate' && commission_base_price_only === false && not_included_price === 0
                 const useColumnFormat = !isSinglePrice && !commissionBasePriceOnly && !showNotIncludedColumn;
                 
                 return (
                   <div>
                     <h5 className="text-sm font-semibold text-green-600 mb-3">
                       최대 판매가 (기본가격 + 초이스 가격 + 업차지)
                     </h5>
                     <div className="overflow-x-auto">
                       <table className="w-full text-xs bg-green-50">
                         <thead>
                           <tr className="border-b border-gray-200">
                             <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                             {useColumnFormat ? (
                               <>
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                               </>
                             ) : (
                               <>
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">기본 가격</th>
                                 {showNotIncludedColumn && (
                                   <th className="text-right py-1 px-2 font-medium text-gray-700">불포함 금액 / 초이스</th>
                                 )}
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">최종 가격</th>
                               </>
                             )}
                           </tr>
                         </thead>
                         <tbody>
                           {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                             const combination = choiceCombinations.find(c => c.id === choiceId);
                             const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                             const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                             const rowClass = isLowerAntelope ? 'bg-blue-50' : 'bg-green-50';
                             const textClass = isLowerAntelope ? 'text-blue-700' : 'text-green-700';
                             
                             // 최종 가격 (마크업 적용 후) - 단일 가격 모드면 성인 가격만 사용
                             const totalPrice = isSinglePrice 
                               ? (choiceCalc.markupPrice.adult || 0)
                               : null;
                             const totalAdultPrice = isSinglePrice ? totalPrice : (choiceCalc.markupPrice.adult || 0);
                             const totalChildPrice = isSinglePrice ? totalPrice : (choiceCalc.markupPrice.child || 0);
                             const totalInfantPrice = isSinglePrice ? totalPrice : (choiceCalc.markupPrice.infant || 0);
                             
                             if (useColumnFormat) {
                               // 할인 가격처럼 가로 형식 (성인/아동/유아 별도 컬럼)
                               return (
                                 <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                                   <td className={`py-1 px-2 font-medium ${textClass}`}>
                                     {combinationName}
                                   </td>
                                   <td className="py-1 px-2 text-right font-bold text-green-600">
                                     {formatPrice(totalAdultPrice)}
                                   </td>
                                   <td className="py-1 px-2 text-right font-bold text-green-600">
                                     {formatPrice(totalChildPrice)}
                                   </td>
                                   <td className="py-1 px-2 text-right font-bold text-green-600">
                                     {formatPrice(totalInfantPrice)}
                                   </td>
                                 </tr>
                               );
                             } else {
                               // 기존 세로 형식
                               // 기본 가격 (마크업 적용 전) - 단일 가격 모드면 성인 가격만 사용
                               const basePrice = isSinglePrice 
                                 ? (choiceCalc.basePrice?.adult || 0)
                                 : null;
                               const baseAdultPrice = isSinglePrice ? basePrice : (choiceCalc.basePrice?.adult || 0);
                               const baseChildPrice = isSinglePrice ? basePrice : (choiceCalc.basePrice?.child || 0);
                               const baseInfantPrice = isSinglePrice ? basePrice : (choiceCalc.basePrice?.infant || 0);
                               
                               // 초이스 가격 - 단일 가격 모드면 성인 가격만 사용
                               const choicePricing = pricingConfig?.choicePricing[choiceId];
                               const choicePrice = isSinglePrice 
                                 ? (choicePricing?.adult_price || 0)
                                 : null;
                               const choiceAdultPrice = isSinglePrice ? choicePrice : (choicePricing?.adult_price || 0);
                               const choiceChildPrice = isSinglePrice ? choicePrice : (choicePricing?.child_price || 0);
                               const choiceInfantPrice = isSinglePrice ? choicePrice : (choicePricing?.infant_price || 0);
                               
                               // 불포함 금액 및 초이스 계산
                               let notIncludedAmount = 0;
                               let notIncludedAdult = 0;
                               let notIncludedChild = 0;
                               let notIncludedInfant = 0;
                               
                               if (showNotIncludedColumn) {
                                 if (notIncludedType === 'amount_only') {
                                   notIncludedAmount = notIncludedPrice;
                                   notIncludedAdult = notIncludedPrice;
                                   notIncludedChild = notIncludedPrice;
                                   notIncludedInfant = notIncludedPrice;
                                 } else if (notIncludedType === 'amount_and_choice') {
                                   notIncludedAmount = notIncludedPrice + (isSinglePrice ? choicePrice : 0);
                                   notIncludedAdult = notIncludedPrice + choiceAdultPrice;
                                   notIncludedChild = notIncludedPrice + choiceChildPrice;
                                   notIncludedInfant = notIncludedPrice + choiceInfantPrice;
                                 }
                               }
                               
                               return (
                                 <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                                   <td className={`py-1 px-2 font-medium ${textClass}`}>
                                     {combinationName}
                                   </td>
                                   <td className="py-1 px-2 text-right font-medium text-gray-900">
                                     {isSinglePrice ? (
                                       <div>{formatPrice(basePrice)}</div>
                                     ) : (
                                       <>
                                         <div>성인: {formatPrice(baseAdultPrice)}</div>
                                         <div>아동: {formatPrice(baseChildPrice)}</div>
                                         <div>유아: {formatPrice(baseInfantPrice)}</div>
                                       </>
                                     )}
                                   </td>
                                   {showNotIncludedColumn && (
                                     <td className="py-1 px-2 text-right font-medium text-gray-700">
                                       {isSinglePrice ? (
                                         <div>{formatPrice(notIncludedAmount)}</div>
                                       ) : (
                                         <>
                                           <div>성인: {formatPrice(notIncludedAdult)}</div>
                                           <div>아동: {formatPrice(notIncludedChild)}</div>
                                           <div>유아: {formatPrice(notIncludedInfant)}</div>
                                         </>
                                       )}
                                     </td>
                                   )}
                                   <td className="py-1 px-2 text-right font-bold text-blue-600">
                                     {isSinglePrice ? (
                                       <div>{formatPrice((totalPrice || 0) + (showNotIncludedColumn ? notIncludedAmount : 0))}</div>
                                     ) : (
                                       <>
                                         <div>성인: {formatPrice(totalAdultPrice + (showNotIncludedColumn ? notIncludedAdult : 0))}</div>
                                         <div>아동: {formatPrice(totalChildPrice + (showNotIncludedColumn ? notIncludedChild : 0))}</div>
                                         <div>유아: {formatPrice(totalInfantPrice + (showNotIncludedColumn ? notIncludedInfant : 0))}</div>
                                       </>
                                     )}
                                   </td>
                                 </tr>
                               );
                             }
                           })}
                         </tbody>
                       </table>
                     </div>
                   </div>
                 );
               })()}

             {/* 할인 가격 (최대 판매가 × 쿠폰%) - OTA 채널이 아닐 때만 표시 */}
             {!isOTAChannel && (() => {
               const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
               const isSinglePrice = pricingType === 'single';
               
               return (
                 <div>
                 <h5 className="text-sm font-semibold text-orange-600 mb-3">
                   할인 가격 (최대 판매가 × 쿠폰%)
                 </h5>
                 <div className="overflow-x-auto">
                   <table className="w-full text-xs bg-orange-50">
                     <thead>
                       <tr className="border-b border-gray-200">
                         <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                         {isSinglePrice ? (
                           <th className="text-right py-1 px-2 font-medium text-gray-700">단일 가격</th>
                         ) : (
                           <>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                           </>
                         )}
                       </tr>
                     </thead>
                     <tbody>
                       {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                         const combination = choiceCombinations.find(c => c.id === choiceId);
                         // choiceCalc.discountPrice는 이미 (상품 기본 가격 + 초이스 가격 + 마크업)에 할인이 적용된 값
                         // 단일 가격 모드면 성인 가격만 사용
                         const discountedPrice = isSinglePrice 
                           ? (choiceCalc.discountPrice.adult || 0)
                           : null;
                         const discountedAdultPrice = isSinglePrice ? discountedPrice : (choiceCalc.discountPrice.adult || 0);
                         const discountedChildPrice = isSinglePrice ? discountedPrice : (choiceCalc.discountPrice.child || 0);
                         const discountedInfantPrice = isSinglePrice ? discountedPrice : (choiceCalc.discountPrice.infant || 0);
                         
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
                             {isSinglePrice ? (
                               <td className="py-1 px-2 text-right font-bold text-orange-600">
                                 {formatPrice(discountedPrice)}
                               </td>
                             ) : (
                               <>
                                 <td className="py-1 px-2 text-right font-bold text-orange-600">
                                   {formatPrice(discountedAdultPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-orange-600">
                                   {formatPrice(discountedChildPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-orange-600">
                                   {formatPrice(discountedInfantPrice)}
                                 </td>
                               </>
                             )}
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
                 </div>
               );
             })()}

             {/* Net Price (할인가격 - 커미션) - 항상 표시 */}
             <div>
               <h5 className="text-sm font-semibold text-blue-600 mb-3">
                 Net Price (할인가격 - 커미션)
               </h5>
               <div className="overflow-x-auto">
                 {(() => {
                   // 동적 가격의 불포함 금액 우선, 없으면 채널의 불포함 금액 사용
                   const dynamicNotIncludedPrice = (pricingConfig as any)?.not_included_price || 0;
                   const channelNotIncludedPrice = (selectedChannel as any)?.not_included_price || 0;
                   const notIncludedPrice = dynamicNotIncludedPrice > 0 ? dynamicNotIncludedPrice : channelNotIncludedPrice;
                   
                   const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
                   const hasNotIncludedPrice = (selectedChannel as any)?.has_not_included_price || false;
                   const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
                   const isSinglePrice = pricingType === 'single';
                   const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                   // 불포함 금액이 설정되어 있으면 항상 표시
                   const showNotIncludedColumn = dynamicNotIncludedPrice > 0 || (notIncludedType === 'amount_only' || notIncludedType === 'amount_and_choice');
                   // 불포함 금액이 설정되어 있으면 항상 계산 과정 표시
                   const showCalculationProcess = showNotIncludedColumn;
                   
                   // 테이블 형식 결정: 조건에 맞으면 할인 가격처럼 가로 형식 (성인/아동/유아 별도 컬럼)
                   // 조건: pricing_type === 'separate' && commission_base_price_only === false && not_included_type === 'none'
                   const useColumnFormat = !isSinglePrice && !commissionBasePriceOnly && notIncludedType === 'none' && !showNotIncludedColumn;
                   
                   return (
                     <table className="w-full text-xs bg-blue-50">
                       <thead>
                         <tr className="border-b border-gray-200">
                           <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                           {useColumnFormat ? (
                             <>
                               <th className="text-right py-1 px-2 font-medium text-gray-700">성인</th>
                               <th className="text-right py-1 px-2 font-medium text-gray-700">아동</th>
                               <th className="text-right py-1 px-2 font-medium text-gray-700">유아</th>
                             </>
                           ) : (
                             <>
                               <th className="text-right py-1 px-2 font-medium text-gray-700">Net Price</th>
                               {showNotIncludedColumn && (
                                 <th className="text-right py-1 px-2 font-medium text-gray-700">불포함 금액</th>
                               )}
                               <th className="text-right py-1 px-2 font-medium text-gray-700">최종 가격</th>
                             </>
                           )}
                         </tr>
                       </thead>
                       <tbody>
                         {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                           const combination = choiceCombinations.find(c => c.id === choiceId);
                           const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                           const commissionRate = (pricingConfig?.commission_percent || 0) / 100;
                           
                           let netPrice, netAdultPrice, netChildPrice, netInfantPrice;
                           let notIncludedAmount = 0, notIncludedAdult = 0, notIncludedChild = 0, notIncludedInfant = 0;
                           let choicePrice = null, choiceAdultPrice = 0, choiceChildPrice = 0, choiceInfantPrice = 0;
                           
                           // OTA 채널이고 판매가격에만 커미션 적용이 체크되어 있으면
                           if (isOTAChannel && commissionBasePriceOnly) {
                             // 기본 가격만 수수료 적용 - 단일 가격 모드면 성인 가격만 사용
                             const basePrice = isSinglePrice 
                               ? (calculation?.basePrice?.adult || 0)
                               : null;
                             const baseAdultPrice = isSinglePrice ? basePrice : (calculation?.basePrice?.adult || 0);
                             const baseChildPrice = isSinglePrice ? basePrice : (calculation?.basePrice?.child || 0);
                             const baseInfantPrice = isSinglePrice ? basePrice : (calculation?.basePrice?.infant || 0);
                             
                             // 초이스 가격 - 단일 가격 모드면 성인 가격만 사용
                             const choicePricing = pricingConfig?.choicePricing[choiceId];
                             choicePrice = isSinglePrice 
                               ? (choicePricing?.adult_price || 0)
                               : null;
                             choiceAdultPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.adult_price || 0);
                             choiceChildPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.child_price || 0);
                             choiceInfantPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.infant_price || 0);
                             
                             // 불포함 금액 계산
                             if (showNotIncludedColumn) {
                               if (notIncludedType === 'amount_only') {
                                 notIncludedAmount = notIncludedPrice;
                                 notIncludedAdult = notIncludedPrice;
                                 notIncludedChild = notIncludedPrice;
                                 notIncludedInfant = notIncludedPrice;
                               } else if (notIncludedType === 'amount_and_choice') {
                                 notIncludedAmount = notIncludedPrice + (choicePrice || 0);
                                 notIncludedAdult = notIncludedPrice + choiceAdultPrice;
                                 notIncludedChild = notIncludedPrice + choiceChildPrice;
                                 notIncludedInfant = notIncludedPrice + choiceInfantPrice;
                               }
                             }
                             
                             // Net Price 계산
                             // not_included_type이 'amount_and_choice'일 때는 초이스 가격을 Net Price에 포함하지 않음
                             // (초이스 가격은 불포함 금액에 포함됨)
                             if (notIncludedType === 'amount_and_choice') {
                               // Net Price = 기본 가격 * (1 - 수수료%) (초이스 가격 제외)
                               netPrice = isSinglePrice 
                                 ? (basePrice * (1 - commissionRate))
                                 : null;
                               netAdultPrice = isSinglePrice ? netPrice : (baseAdultPrice * (1 - commissionRate));
                               netChildPrice = isSinglePrice ? netPrice : (baseChildPrice * (1 - commissionRate));
                               netInfantPrice = isSinglePrice ? netPrice : (baseInfantPrice * (1 - commissionRate));
                             } else {
                               // Net Price = 기본 가격 * (1 - 수수료%) + 초이스 가격
                               netPrice = isSinglePrice 
                                 ? (basePrice * (1 - commissionRate) + (choicePrice || 0))
                                 : null;
                               netAdultPrice = isSinglePrice ? netPrice : (baseAdultPrice * (1 - commissionRate) + choiceAdultPrice);
                               netChildPrice = isSinglePrice ? netPrice : (baseChildPrice * (1 - commissionRate) + choiceChildPrice);
                               netInfantPrice = isSinglePrice ? netPrice : (baseInfantPrice * (1 - commissionRate) + choiceInfantPrice);
                             }
                           } else {
                             // choiceCalc.netPrice는 이미 (상품 기본 가격 + 초이스 가격 + 마크업)에 할인과 커미션이 적용된 값
                             // 단일 가격 모드면 성인 가격만 사용
                             netPrice = isSinglePrice 
                               ? (choiceCalc.netPrice.adult || 0)
                               : null;
                             netAdultPrice = isSinglePrice ? netPrice : (choiceCalc.netPrice.adult || 0);
                             netChildPrice = isSinglePrice ? netPrice : (choiceCalc.netPrice.child || 0);
                             netInfantPrice = isSinglePrice ? netPrice : (choiceCalc.netPrice.infant || 0);
                             
                             // 초이스 가격 (계산 과정 표시용)
                             const choicePricing = pricingConfig?.choicePricing[choiceId];
                             choicePrice = isSinglePrice 
                               ? (choicePricing?.adult_price || 0)
                               : null;
                             choiceAdultPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.adult_price || 0);
                             choiceChildPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.child_price || 0);
                             choiceInfantPrice = isSinglePrice ? (choicePrice || 0) : (choicePricing?.infant_price || 0);
                             
                             // 불포함 금액 계산
                             if (showNotIncludedColumn) {
                               if (notIncludedType === 'amount_only') {
                                 notIncludedAmount = notIncludedPrice;
                                 notIncludedAdult = notIncludedPrice;
                                 notIncludedChild = notIncludedPrice;
                                 notIncludedInfant = notIncludedPrice;
                               } else if (notIncludedType === 'amount_and_choice') {
                                 notIncludedAmount = notIncludedPrice + (choicePrice || 0);
                                 notIncludedAdult = notIncludedPrice + choiceAdultPrice;
                                 notIncludedChild = notIncludedPrice + choiceChildPrice;
                                 notIncludedInfant = notIncludedPrice + choiceInfantPrice;
                               }
                             }
                           }
                           
                           // 최종 가격 = Net Price + 불포함 금액
                           const finalPrice = isSinglePrice 
                             ? ((netPrice || 0) + notIncludedAmount)
                             : null;
                           const finalAdultPrice = isSinglePrice ? finalPrice : (netAdultPrice + notIncludedAdult);
                           const finalChildPrice = isSinglePrice ? finalPrice : (netChildPrice + notIncludedChild);
                           const finalInfantPrice = isSinglePrice ? finalPrice : (netInfantPrice + notIncludedInfant);
                           
                           // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                           const combinationName = combination?.combination_name_ko || combination?.combination_name || choiceId;
                           const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                           const rowClass = isLowerAntelope ? 'bg-blue-50' : 'bg-green-50';
                           const textClass = isLowerAntelope ? 'text-blue-700' : 'text-green-700';
                           
                           if (useColumnFormat) {
                             // 할인 가격처럼 가로 형식 (성인/아동/유아 별도 컬럼)
                             return (
                               <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                                 <td className={`py-1 px-2 font-medium ${textClass}`}>
                                   {combinationName}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-blue-600">
                                   {formatPrice(netAdultPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-blue-600">
                                   {formatPrice(netChildPrice)}
                                 </td>
                                 <td className="py-1 px-2 text-right font-bold text-blue-600">
                                   {formatPrice(netInfantPrice)}
                                 </td>
                               </tr>
                             );
                           } else {
                             // 기존 세로 형식
                             return (
                               <tr key={choiceId} className={`border-b border-gray-100 ${rowClass}`}>
                                 <td className={`py-1 px-2 font-medium ${textClass}`}>
                                   {combinationName}
                                 </td>
                                 <td className="py-1 px-2 text-right">
                                   {isSinglePrice ? (
                                     <div className="font-medium text-gray-900">{formatPrice(netPrice)}</div>
                                   ) : (
                                     <>
                                       <div className="font-medium text-gray-900">성인: {formatPrice(netAdultPrice)}</div>
                                       <div className="font-medium text-gray-900">아동: {formatPrice(netChildPrice)}</div>
                                       <div className="font-medium text-gray-900">유아: {formatPrice(netInfantPrice)}</div>
                                     </>
                                   )}
                                 </td>
                                 {showNotIncludedColumn && (
                                   <td className="py-1 px-2 text-right">
                                     {isSinglePrice ? (
                                       <div className="text-orange-600">{formatPrice(notIncludedAmount)}</div>
                                     ) : (
                                       <>
                                         <div className="text-orange-600">{formatPrice(notIncludedAdult)}</div>
                                         <div className="text-orange-600">{formatPrice(notIncludedChild)}</div>
                                         <div className="text-orange-600">{formatPrice(notIncludedInfant)}</div>
                                       </>
                                     )}
                                   </td>
                                 )}
                                 <td className="py-1 px-2 text-right font-bold text-green-600">
                                   {isSinglePrice ? (
                                     <div>{formatPrice(finalPrice || 0)}</div>
                                   ) : (
                                     <>
                                       <div>성인: {formatPrice(finalAdultPrice)}</div>
                                       <div>아동: {formatPrice(finalChildPrice)}</div>
                                       <div>유아: {formatPrice(finalInfantPrice)}</div>
                                     </>
                                   )}
                                 </td>
                               </tr>
                             );
                           }
                         })}
                       </tbody>
                     </table>
                   );
                 })()}
               </div>
             </div>

             {/* OTA 판매가 (최대 판매가 × 0.8 / (1 - 수수료%)) - OTA 채널일 때만 표시 */}
             {isOTAChannel && (
               <div>
               <h5 className="text-sm font-semibold text-purple-600 mb-3">
                 OTA 판매가 (최대 판매가 × 0.8 / (1 - 수수료%))
               </h5>
               <div className="overflow-x-auto">
                 {/* 수수료 계산을 테이블 바깥에서 수행 */}
                 {(() => {
                   const commissionPercent = pricingConfig?.commission_percent || 0;
                   const commissionRate = commissionPercent / 100;
                   const couponPercent = pricingConfig?.coupon_percent || 0;
                   
                   // 동적 가격의 불포함 금액 우선, 없으면 채널의 불포함 금액 사용
                   const dynamicNotIncludedPrice = (pricingConfig as any)?.not_included_price || 0;
                   const channelNotIncludedPrice = (selectedChannel as any)?.not_included_price || 0;
                   const notIncludedPrice = dynamicNotIncludedPrice > 0 ? dynamicNotIncludedPrice : channelNotIncludedPrice;
                   
                   const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
                   const hasNotIncludedPrice = (selectedChannel as any)?.has_not_included_price || false;
                   const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
                   const isSinglePrice = pricingType === 'single';
                   // 불포함 금액이 설정되어 있으면 항상 표시
                   const showNotIncludedColumn = dynamicNotIncludedPrice > 0 || (notIncludedType === 'amount_only' || notIncludedType === 'amount_and_choice');
                   // 불포함 금액이 설정되어 있으면 항상 계산 과정 표시
                   const showCalculationProcess = showNotIncludedColumn;
                   
                   return (
                     <>
                       <table className="w-full text-xs bg-purple-50">
                         <thead>
                           <tr className="border-b border-gray-200">
                             <th className="text-left py-1 px-2 font-medium text-gray-700">초이스</th>
                             <th className="text-right py-1 px-2 font-medium text-gray-700">OTA 판매가</th>
                             {showNotIncludedColumn && (
                               <th className="text-right py-1 px-2 font-medium text-gray-700">불포함 금액</th>
                             )}
                             <th className="text-right py-1 px-2 font-medium text-gray-700">최종 가격</th>
                           </tr>
                         </thead>
                         <tbody>
                           {Object.entries(choiceCalculations).map(([choiceId, choiceCalc]) => {
                             const combination = choiceCombinations.find(c => c.id === choiceId);
                             const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false;
                             
                             // 판매가격에만 커미션 적용이 체크되어 있으면 기본가격만 사용, 아니면 기본가격 + 초이스가격
                             // choiceCalc.basePrice는 이미 (상품 기본 가격 + 초이스 가격)입니다
                             // commissionBasePriceOnly일 때는 상품 기본 가격만 사용 (calculation.basePrice는 상품 기본 가격)
                             // 단일 가격 모드면 성인 가격만 사용
                             const maxPrice = isSinglePrice 
                               ? (commissionBasePriceOnly 
                                   ? (calculation?.basePrice?.adult || 0)
                                   : (choiceCalc.markupPrice.adult || 0))
                               : null;
                             const maxAdultPrice = isSinglePrice ? maxPrice : (commissionBasePriceOnly 
                               ? (calculation?.basePrice?.adult || 0)
                               : (choiceCalc.markupPrice.adult || 0));
                             const maxChildPrice = isSinglePrice ? maxPrice : (commissionBasePriceOnly
                               ? (calculation?.basePrice?.child || 0)
                               : (choiceCalc.markupPrice.child || 0));
                             const maxInfantPrice = isSinglePrice ? maxPrice : (commissionBasePriceOnly
                               ? (calculation?.basePrice?.infant || 0)
                               : (choiceCalc.markupPrice.infant || 0));
                             
                             // 판매가격에만 커미션 적용이 체크되어 있으면 20% 할인 제외, 기본 가격에서 직접 수수료 역산
                             const commissionDenominator = 1 - commissionRate;
                             const couponPercent = pricingConfig?.coupon_percent || 0;
                             const couponRate = couponPercent / 100;
                             const couponDenominator = 1 - couponRate;
                             let otaPrice, otaAdultPrice, otaChildPrice, otaInfantPrice;
                             
                             if (commissionBasePriceOnly) {
                               // 기본 가격에서 직접 수수료 역산 (20% 할인 없음, 쿠폰 할인 없음)
                               otaPrice = isSinglePrice 
                                 ? (commissionDenominator > 0 && commissionDenominator !== 0 ? maxPrice / commissionDenominator : maxPrice)
                                 : null;
                               otaAdultPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? maxAdultPrice / commissionDenominator : maxAdultPrice);
                               otaChildPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? maxChildPrice / commissionDenominator : maxChildPrice);
                               otaInfantPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? maxInfantPrice / commissionDenominator : maxInfantPrice);
                             } else {
                               // 최대 판매가 × 0.8 (20% 할인 고정값)
                               const priceAfter20PercentDiscount = isSinglePrice 
                                 ? (maxPrice * 0.8)
                                 : null;
                               const priceAfter20PercentDiscountAdult = isSinglePrice ? priceAfter20PercentDiscount : (maxAdultPrice * 0.8);
                               const priceAfter20PercentDiscountChild = isSinglePrice ? priceAfter20PercentDiscount : (maxChildPrice * 0.8);
                               const priceAfter20PercentDiscountInfant = isSinglePrice ? priceAfter20PercentDiscount : (maxInfantPrice * 0.8);
                               
                               // 쿠폰 할인 역산: 할인된 가격을 원래 가격으로 복원
                               const priceAfterCouponReverse = isSinglePrice 
                                 ? (couponDenominator > 0 && couponDenominator !== 0 ? (priceAfter20PercentDiscount || 0) / couponDenominator : (priceAfter20PercentDiscount || 0))
                                 : null;
                               const priceAfterCouponReverseAdult = isSinglePrice ? priceAfterCouponReverse : (couponDenominator > 0 && couponDenominator !== 0 ? priceAfter20PercentDiscountAdult / couponDenominator : priceAfter20PercentDiscountAdult);
                               const priceAfterCouponReverseChild = isSinglePrice ? priceAfterCouponReverse : (couponDenominator > 0 && couponDenominator !== 0 ? priceAfter20PercentDiscountChild / couponDenominator : priceAfter20PercentDiscountChild);
                               const priceAfterCouponReverseInfant = isSinglePrice ? priceAfterCouponReverse : (couponDenominator > 0 && couponDenominator !== 0 ? priceAfter20PercentDiscountInfant / couponDenominator : priceAfter20PercentDiscountInfant);
                               
                               // OTA 판매가 = (최대 판매가 × 0.8) / (1 - 쿠폰 할인%) / (1 - 수수료율)
                               otaPrice = isSinglePrice 
                                 ? (commissionDenominator > 0 && commissionDenominator !== 0 ? (priceAfterCouponReverse || 0) / commissionDenominator : (priceAfterCouponReverse || 0))
                                 : null;
                               otaAdultPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? priceAfterCouponReverseAdult / commissionDenominator : priceAfterCouponReverseAdult);
                               otaChildPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? priceAfterCouponReverseChild / commissionDenominator : priceAfterCouponReverseChild);
                               otaInfantPrice = isSinglePrice ? otaPrice : (commissionDenominator > 0 && commissionDenominator !== 0 ? priceAfterCouponReverseInfant / commissionDenominator : priceAfterCouponReverseInfant);
                             }
                             
                             // 불포함 금액 계산
                             let notIncludedAmount = 0, notIncludedAdult = 0, notIncludedChild = 0, notIncludedInfant = 0;
                             let choicePriceForDisplay = null;
                             let choiceAdultPriceForDisplay = 0, choiceChildPriceForDisplay = 0, choiceInfantPriceForDisplay = 0;
                             if (showNotIncludedColumn) {
                               if (notIncludedType === 'amount_only') {
                                 notIncludedAmount = notIncludedPrice;
                                 notIncludedAdult = notIncludedPrice;
                                 notIncludedChild = notIncludedPrice;
                                 notIncludedInfant = notIncludedPrice;
                               } else if (notIncludedType === 'amount_and_choice') {
                                 const choicePricing = pricingConfig?.choicePricing[choiceId];
                                 choicePriceForDisplay = isSinglePrice 
                                   ? (choicePricing?.adult_price || 0)
                                   : null;
                                 choiceAdultPriceForDisplay = isSinglePrice ? (choicePriceForDisplay || 0) : (choicePricing?.adult_price || 0);
                                 choiceChildPriceForDisplay = isSinglePrice ? (choicePriceForDisplay || 0) : (choicePricing?.child_price || 0);
                                 choiceInfantPriceForDisplay = isSinglePrice ? (choicePriceForDisplay || 0) : (choicePricing?.infant_price || 0);
                                 notIncludedAmount = notIncludedPrice + (choicePriceForDisplay || 0);
                                 notIncludedAdult = notIncludedPrice + choiceAdultPriceForDisplay;
                                 notIncludedChild = notIncludedPrice + choiceChildPriceForDisplay;
                                 notIncludedInfant = notIncludedPrice + choiceInfantPriceForDisplay;
                               }
                             }
                             
                             // 최종 가격 = OTA 판매가 + 불포함 금액
                             const finalPrice = isSinglePrice 
                               ? ((otaPrice || 0) + notIncludedAmount)
                               : null;
                             const finalAdultPrice = isSinglePrice ? finalPrice : (otaAdultPrice + notIncludedAdult);
                             const finalChildPrice = isSinglePrice ? finalPrice : (otaChildPrice + notIncludedChild);
                             const finalInfantPrice = isSinglePrice ? finalPrice : (otaInfantPrice + notIncludedInfant);
                             
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
                                 <td className="py-1 px-2 text-right">
                                   {isSinglePrice ? (
                                     <div className="font-medium text-gray-900">{formatPrice(otaPrice)}</div>
                                   ) : (
                                     <>
                                       <div className="font-medium text-gray-900">성인: {formatPrice(otaAdultPrice)}</div>
                                       <div className="font-medium text-gray-900">아동: {formatPrice(otaChildPrice)}</div>
                                       <div className="font-medium text-gray-900">유아: {formatPrice(otaInfantPrice)}</div>
                                     </>
                                   )}
                                 </td>
                                 {showNotIncludedColumn && (
                                   <td className="py-1 px-2 text-right">
                                     {isSinglePrice ? (
                                       <div className="text-orange-600">{formatPrice(notIncludedAmount)}</div>
                                     ) : (
                                       <>
                                         <div className="text-orange-600">{formatPrice(notIncludedAdult)}</div>
                                         <div className="text-orange-600">{formatPrice(notIncludedChild)}</div>
                                         <div className="text-orange-600">{formatPrice(notIncludedInfant)}</div>
                                       </>
                                     )}
                                   </td>
                                 )}
                                 <td className="py-1 px-2 text-right font-bold text-purple-700">
                                   {isSinglePrice ? (
                                     <div>{formatPrice(finalPrice || 0)}</div>
                                   ) : (
                                     <>
                                       <div>성인: {formatPrice(finalAdultPrice)}</div>
                                       <div>아동: {formatPrice(finalChildPrice)}</div>
                                       <div>유아: {formatPrice(finalInfantPrice)}</div>
                                     </>
                                   )}
                                 </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                       <div className="mt-2 text-xs text-gray-600 px-2">
                         {selectedChannel?.commission_base_price_only ? (
                           <>
                             기본 가격만 사용 (초이스 가격 제외, 20% 할인 제외, 쿠폰 할인 제외) / (1 - {commissionPercent}%) = OTA 판매가<br/>
                             <span className="text-orange-600 font-medium">※ 초이스 가격과 불포함 금액은 OTA 판매가 계산에서 제외되며 밸런스로 처리됩니다</span>
                           </>
                         ) : (
                           <>최대 판매가 × 0.8 (20% 할인 고정) / (1 - {couponPercent}% 쿠폰 할인) / (1 - {commissionPercent}% 수수료) = OTA 판매가</>
                         )}
                       </div>
                     </>
                   );
                 })()}
               </div>
               </div>
               )}
             </div>
           </div>
         );
       })()}

      {/* 설정 요약 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">현재 설정</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>불포함 금액: {formatPrice(pricingConfig?.not_included_price)}</div>
          <div>마크업: {pricingConfig?.markup_amount || 0}$ + {pricingConfig?.markup_percent || 0}%</div>
          <div>쿠폰 할인: {pricingConfig?.coupon_percent || 0}%</div>
          <div>수수료: {pricingConfig?.commission_percent || 0}%</div>
        </div>
        
        {/* 채널 설정 상세 설명 */}
        {selectedChannel && (() => {
          const pricingType = (selectedChannel as any)?.pricing_type || 'separate';
          const notIncludedType = (selectedChannel as any)?.not_included_type || 'none';
          const notIncludedPrice = (selectedChannel as any)?.not_included_price || 0;
          const dynamicNotIncludedPrice = (pricingConfig as any)?.not_included_price || 0;
          const finalNotIncludedPrice = dynamicNotIncludedPrice > 0 ? dynamicNotIncludedPrice : notIncludedPrice;
          
          return (
            <div className="mt-3 pt-3 border-t border-gray-300 space-y-3">
              {/* 가격 판매 방식 */}
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <h5 className="text-xs font-semibold text-green-900 mb-2 flex items-center">
                  <span className="mr-1">💰</span>
                  가격 판매 방식
                </h5>
                <div className="text-xs text-green-800 space-y-1">
                  {pricingType === 'single' ? (
                    <>
                      <div className="font-medium text-green-900">✓ 단일 가격 모드</div>
                      <div className="pl-2 border-l-2 border-green-300">
                        <div>• 성인, 아동, 유아 구분 없이 하나의 통일된 가격으로 판매합니다</div>
                        <div>• 모든 연령대에 동일한 가격이 적용됩니다</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-green-900">✓ 분리 가격 모드</div>
                      <div className="pl-2 border-l-2 border-green-300">
                        <div>• 성인, 아동, 유아 가격을 각각 별도로 관리합니다</div>
                        <div>• 각 연령대별로 다른 가격을 설정할 수 있습니다</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 커미션 계산 방식 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h5 className="text-xs font-semibold text-blue-900 mb-2 flex items-center">
                  <span className="mr-1">📋</span>
                  {selectedChannel.name} 채널 커미션 계산 방식
                </h5>
                <div className="text-xs text-blue-800 space-y-1.5">
                  {selectedChannel.commission_base_price_only ? (
                    <>
                      <div className="font-medium text-blue-900">✓ 판매가격에만 커미션 & 쿠폰 적용</div>
                      <div className="pl-2 border-l-2 border-blue-300">
                        <div>• 커미션 및 쿠폰 할인은 동적 가격의 기본 가격(판매가격)에만 적용됩니다</div>
                        <div>• 초이스 가격과 불포함 금액은 커미션 및 쿠폰 할인에서 제외됩니다</div>
                        <div>• 초이스 가격 + 불포함 금액은 밸런스로 처리되어 현금 수금됩니다</div>
                        <div className="mt-1 text-blue-700">
                          예: 판매가격($140) + 초이스($75) + 불포함($15) = 총 $230<br/>
                          커미션 10% = $14 (판매가격 $140에만 적용)<br/>
                          Net = ($140 - $14) + $75 + $15 = $216<br/>
                          Balance = $75 + $15 = $90
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-blue-900">✓ 전체 가격에 커미션 & 쿠폰 적용</div>
                      <div className="pl-2 border-l-2 border-blue-300">
                        <div>• 커미션 및 쿠폰 할인은 전체 가격(판매가격 + 초이스 + 불포함 금액)에 적용됩니다</div>
                        <div>• 모든 가격 구성 요소에 동일한 비율이 적용됩니다</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 불포함 금액 타입 */}
              {finalNotIncludedPrice > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <h5 className="text-xs font-semibold text-orange-900 mb-2 flex items-center">
                    <span className="mr-1">💵</span>
                    불포함 금액 타입
                  </h5>
                  <div className="text-xs text-orange-800 space-y-1">
                    {notIncludedType === 'amount_only' ? (
                      <>
                        <div className="font-medium text-orange-900">✓ 불포함 금액 입력값</div>
                        <div className="pl-2 border-l-2 border-orange-300">
                          <div>• 설정된 불포함 금액({formatPrice(finalNotIncludedPrice)})만 별도로 처리됩니다</div>
                          <div>• 불포함 금액은 커미션 계산에서 제외되며 밸런스로 처리됩니다</div>
                          <div>• 투어 종료 후 현금으로 수금됩니다</div>
                        </div>
                      </>
                    ) : notIncludedType === 'amount_and_choice' ? (
                      <>
                        <div className="font-medium text-orange-900">✓ 불포함 금액 입력값 + 초이스 값</div>
                        <div className="pl-2 border-l-2 border-orange-300">
                          <div>• 불포함 금액({formatPrice(finalNotIncludedPrice)})과 초이스 가격이 합산되어 처리됩니다</div>
                          <div>• 불포함 금액 + 초이스 가격은 모두 커미션 계산에서 제외됩니다</div>
                          <div>• 합산된 금액이 밸런스로 처리되어 투어 종료 후 현금으로 수금됩니다</div>
                          <div className="mt-1 text-orange-700">
                            예: 불포함 금액($15) + 초이스($75) = $90 (밸런스)
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-orange-900">✓ 불포함 금액 없음</div>
                        <div className="pl-2 border-l-2 border-orange-300">
                          <div>• 불포함 금액이 설정되지 않았습니다</div>
                          <div>• 모든 가격이 온라인 결제로 처리됩니다</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
});
