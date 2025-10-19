'use client';

import React, { useState, useCallback, memo } from 'react';
import { X, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { DateRangeSelection } from '@/lib/types/dynamic-pricing';
import { DateRangeSelector } from './DateRangeSelector';

interface SaleStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dates: Date[], status: 'sale' | 'closed') => void;
  initialDates?: Date[];
  initialStatus?: 'sale' | 'closed';
}

export const SaleStatusModal = memo(function SaleStatusModal({
  isOpen,
  onClose,
  onSave,
  initialDates = [],
  initialStatus = 'sale'
}: SaleStatusModalProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>(initialDates);
  const [saleStatus, setSaleStatus] = useState<'sale' | 'closed'>(initialStatus);
  const [dateRangeSelection, setDateRangeSelection] = useState<DateRangeSelection>({
    startDate: '',
    endDate: '',
    selectedDays: [0, 1, 2, 3, 4, 5, 6]
  });

  // 날짜 범위 선택 핸들러
  const handleDateRangeSelection = useCallback((selection: DateRangeSelection) => {
    setDateRangeSelection(selection);
    
    if (selection.startDate && selection.endDate) {
      const start = new Date(selection.startDate);
      const end = new Date(selection.endDate);
      const dates: Date[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      
      setSelectedDates(dates);
    }
  }, []);

  // 저장 핸들러
  const handleSave = useCallback(() => {
    onSave(selectedDates, saleStatus);
    onClose();
  }, [selectedDates, saleStatus, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>판매 상태 설정</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 판매 상태 토글 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              판매 상태
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSaleStatus('sale')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  saleStatus === 'sale'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {saleStatus === 'sale' ? (
                  <ToggleRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
                <span>판매</span>
              </button>
              <button
                onClick={() => setSaleStatus('closed')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  saleStatus === 'closed'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {saleStatus === 'closed' ? (
                  <ToggleRight className="h-5 w-5 text-red-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
                <span>마감</span>
              </button>
            </div>
          </div>

          {/* 날짜 선택 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              적용할 날짜
            </label>
            <DateRangeSelector
              initialSelection={dateRangeSelection}
              onDateRangeSelect={handleDateRangeSelection}
              saleStatus={saleStatus}
              showStatusOnCalendar={true}
            />
            
            {/* 상태 범례 */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>판매중</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>마감</span>
              </div>
            </div>
          </div>

          {/* 선택된 날짜 미리보기 */}
          {selectedDates.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                선택된 날짜 ({selectedDates.length}일)
              </label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {selectedDates.map((date, index) => (
                    <div key={index} className="text-gray-600">
                      {date.toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={selectedDates.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
});
