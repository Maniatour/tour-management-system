'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Save, Calculator } from 'lucide-react';
import { SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';

interface Channel {
  id: string;
  name: string;
  type: string;
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

  // 행 추가
  const handleAddRow = useCallback(() => {
    const newRow: BulkPricingRow = {
      id: `row-${Date.now()}`,
      channelId: channels.length > 0 ? channels[0].id : '',
      channelName: channels.length > 0 ? channels[0].name : '',
      startDate: '',
      endDate: '',
      adultPrice: 0,
      childPrice: 0,
      infantPrice: 0,
      commissionPercent: 0,
      couponPercent: 0,
      markupAmount: 0,
      markupPercent: 0,
      notIncludedPrice: 0,
      choicePricing: {}
    };
    setRows([...rows, newRow]);
  }, [rows, channels]);

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
          return {
            ...row,
            channelId: value as string,
            channelName: channel?.name || ''
          };
        }
        return { ...row, [field]: value };
      }
      return row;
    }));
  }, [rows, channels]);

  // 초이스 가격 업데이트
  const handleUpdateChoicePricing = useCallback((
    rowId: string,
    choiceId: string,
    priceType: 'adult' | 'child' | 'infant',
    value: number
  ) => {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        const updatedChoicePricing = {
          ...row.choicePricing,
          [choiceId]: {
            ...row.choicePricing[choiceId],
            [priceType]: value
          }
        };
        return { ...row, choicePricing: updatedChoicePricing };
      }
      return row;
    }));
  }, [rows]);

  // 가격 계산 함수 (초이스별 가격 포함)
  const calculatePrices = useCallback((row: BulkPricingRow, choiceId?: string) => {
    // 기본 가격 (불포함 금액 차감)
    let basePrice = {
      adult: Math.max(0, row.adultPrice - row.notIncludedPrice),
      child: Math.max(0, row.childPrice - row.notIncludedPrice),
      infant: Math.max(0, row.infantPrice - row.notIncludedPrice)
    };

    // 초이스별 가격이 있으면 추가
    if (choiceId && row.choicePricing[choiceId]) {
      const choicePrice = row.choicePricing[choiceId];
      basePrice = {
        adult: basePrice.adult + (choicePrice.adult || 0),
        child: basePrice.child + (choicePrice.child || 0),
        infant: basePrice.infant + (choicePrice.infant || 0)
      };
    }

    // 마크업 적용
    const markupPrice = {
      adult: basePrice.adult + row.markupAmount + (basePrice.adult * row.markupPercent / 100),
      child: basePrice.child + row.markupAmount + (basePrice.child * row.markupPercent / 100),
      infant: basePrice.infant + row.markupAmount + (basePrice.infant * row.markupPercent / 100)
    };

    // 최대 판매가 (기본 가격 + 초이스 가격 + 마크업)
    const maxPrice = {
      adult: markupPrice.adult,
      child: markupPrice.child,
      infant: markupPrice.infant
    };

    // 할인 적용 (쿠폰 퍼센트)
    const discountPrice = {
      adult: maxPrice.adult * (1 - row.couponPercent / 100),
      child: maxPrice.child * (1 - row.couponPercent / 100),
      infant: maxPrice.infant * (1 - row.couponPercent / 100)
    };

    // Net Price (할인 가격 - 수수료)
    const netPrice = {
      adult: discountPrice.adult * (1 - row.commissionPercent / 100),
      child: discountPrice.child * (1 - row.commissionPercent / 100),
      infant: discountPrice.infant * (1 - row.commissionPercent / 100)
    };

    // OTA 판매가 = (최대 판매가 × 0.8) / (1 - 수수료율)
    const commissionRate = row.commissionPercent / 100;
    const denominator = 1 - commissionRate;
    const otaPrice = {
      adult: denominator > 0 && denominator !== 0 
        ? (maxPrice.adult * 0.8) / denominator 
        : maxPrice.adult * 0.8,
      child: denominator > 0 && denominator !== 0 
        ? (maxPrice.child * 0.8) / denominator 
        : maxPrice.child * 0.8,
      infant: denominator > 0 && denominator !== 0 
        ? (maxPrice.infant * 0.8) / denominator 
        : maxPrice.infant * 0.8
    };

    return {
      maxPrice,
      netPrice,
      otaPrice
    };
  }, []);

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
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-[10px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky left-0 bg-gray-50 z-10" rowSpan={2}>
                        채널명
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        시작일
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        종료일
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        성인가격
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        아동가격
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        유아가격
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        수수료%
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        쿠폰 할인%
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        마크업($)
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        마크업(%)
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" rowSpan={2}>
                        불포함금액
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-blue-50" colSpan={3}>
                        초이스별 가격
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-green-50" colSpan={3}>
                        최대 판매가
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-blue-50" colSpan={3}>
                        Net Price
                      </th>
                      <th className="px-1.5 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider bg-purple-50" colSpan={3}>
                        OTA 판매가
                      </th>
                      <th className="px-1.5 py-1 text-center text-[10px] font-medium text-gray-700 uppercase tracking-wider" rowSpan={2}>
                        작업
                      </th>
                    </tr>
                    {/* 서브 헤더 */}
                    <tr>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">성인</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">아동</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">유아</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-green-50 border-r border-gray-300">성인</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-green-50 border-r border-gray-300">아동</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-green-50 border-r border-gray-300">유아</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">성인</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">아동</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-blue-50 border-r border-gray-300">유아</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-purple-50 border-r border-gray-300">성인</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-purple-50 border-r border-gray-300">아동</th>
                      <th className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-purple-50">유아</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row) => {
                      // 메인 행 (기본 정보)
                      return (
                        <React.Fragment key={row.id}>
                          {/* 메인 행 */}
                          <tr className="hover:bg-gray-50 bg-gray-50">
                            {/* 채널명 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 sticky left-0 bg-gray-50 z-10" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <select
                                value={row.channelId}
                                onChange={(e) => handleUpdateRow(row.id, 'channelId', e.target.value)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">선택</option>
                                {channels.map((channel, channelIndex) => (
                                  <option key={`channel-${channel.id}-${channelIndex}`} value={channel.id}>
                                    {channel.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {/* 시작일 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="date"
                                value={row.startDate}
                                onChange={(e) => handleUpdateRow(row.id, 'startDate', e.target.value)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            {/* 종료일 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="date"
                                value={row.endDate}
                                onChange={(e) => handleUpdateRow(row.id, 'endDate', e.target.value)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            {/* 성인가격 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.adultPrice || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'adultPrice', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 아동가격 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.childPrice || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'childPrice', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 유아가격 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.infantPrice || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'infantPrice', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 수수료% */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.commissionPercent || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'commissionPercent', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 쿠폰 할인% */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.couponPercent || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'couponPercent', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 마크업($) */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.markupAmount || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'markupAmount', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 마크업(%) */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.markupPercent || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'markupPercent', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 불포함금액 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <input
                                type="number"
                                value={row.notIncludedPrice || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'notIncludedPrice', Number(e.target.value) || 0)}
                                className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                step="0.01"
                              />
                            </td>
                            {/* 초이스별 가격 입력 및 계산 결과 - 첫 번째 초이스 또는 기본 가격 */}
                            {choiceCombinations.length > 0 ? (() => {
                              const firstChoice = choiceCombinations[0];
                              const calculated = calculatePrices(row, firstChoice.id);
                              return (
                                <>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                    <input
                                      type="number"
                                      value={row.choicePricing[firstChoice.id]?.adult || ''}
                                      onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'adult', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                    <input
                                      type="number"
                                      value={row.choicePricing[firstChoice.id]?.child || ''}
                                      onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'child', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                    <input
                                      type="number"
                                      value={row.choicePricing[firstChoice.id]?.infant || ''}
                                      onChange={(e) => handleUpdateChoicePricing(row.id, firstChoice.id, 'infant', Number(e.target.value) || 0)}
                                      className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      step="0.01"
                                    />
                                  </td>
                                  {/* 최대 판매가 */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.infant.toFixed(2)}
                                  </td>
                                  {/* Net Price */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.infant.toFixed(2)}
                                  </td>
                                  {/* OTA 판매가 */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                    ${calculated.otaPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                    ${calculated.otaPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] bg-purple-50 font-medium">
                                    ${calculated.otaPrice.infant.toFixed(2)}
                                  </td>
                                </>
                              );
                            })() : (() => {
                              const calculated = calculatePrices(row);
                              return (
                                <>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-gray-50" colSpan={3}>
                                    초이스 없음
                                  </td>
                                  {/* 최대 판매가 */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                    ${calculated.maxPrice.infant.toFixed(2)}
                                  </td>
                                  {/* Net Price */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                    ${calculated.netPrice.infant.toFixed(2)}
                                  </td>
                                  {/* OTA 판매가 */}
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                    ${calculated.otaPrice.adult.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                    ${calculated.otaPrice.child.toFixed(2)}
                                  </td>
                                  <td className="px-1.5 py-1 whitespace-nowrap text-[10px] bg-purple-50 font-medium">
                                    ${calculated.otaPrice.infant.toFixed(2)}
                                  </td>
                                </>
                              );
                            })()}
                            {/* 작업 버튼 */}
                            <td className="px-1.5 py-1 whitespace-nowrap text-[10px] text-center bg-gray-50" rowSpan={Math.max(choiceCombinations.length, 1) + 1}>
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                          {/* 초이스별 서브 행들 */}
                          {choiceCombinations.slice(1).map((choice, choiceIndex) => {
                            const calculated = calculatePrices(row, choice.id);
                            return (
                              <tr key={`${row.id}-${choice.id}-${choiceIndex}`} className="hover:bg-gray-50">
                                {/* 초이스별 가격 입력 */}
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                  <input
                                    type="number"
                                    value={row.choicePricing[choice.id]?.adult || ''}
                                    onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'adult', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                  />
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                  <input
                                    type="number"
                                    value={row.choicePricing[choice.id]?.child || ''}
                                    onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'child', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                  />
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50">
                                  <input
                                    type="number"
                                    value={row.choicePricing[choice.id]?.infant || ''}
                                    onChange={(e) => handleUpdateChoicePricing(row.id, choice.id, 'infant', Number(e.target.value) || 0)}
                                    className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    step="0.01"
                                  />
                                </td>
                                {/* 최대 판매가 */}
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                  ${calculated.maxPrice.adult.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                  ${calculated.maxPrice.child.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-green-50 font-medium">
                                  ${calculated.maxPrice.infant.toFixed(2)}
                                </td>
                                {/* Net Price */}
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                  ${calculated.netPrice.adult.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                  ${calculated.netPrice.child.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-blue-50 font-medium">
                                  ${calculated.netPrice.infant.toFixed(2)}
                                </td>
                                {/* OTA 판매가 */}
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                  ${calculated.otaPrice.adult.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] border-r border-gray-300 bg-purple-50 font-medium">
                                  ${calculated.otaPrice.child.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 whitespace-nowrap text-[10px] bg-purple-50 font-medium">
                                  ${calculated.otaPrice.infant.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={handleAddRow}
                className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>행 추가</span>
              </button>

              <div className="flex items-center space-x-2">
                {saveMessage && (
                  <div className={`px-2 py-1 rounded text-[10px] ${
                    saveMessage.includes('성공') 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {saveMessage}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || rows.length === 0}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                    saving || rows.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  <Save className="h-3 w-3" />
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

