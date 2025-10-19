import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign } from 'lucide-react';
import { SimplePricingRule } from '@/lib/types/dynamic-pricing';

interface PricingCalendarProps {
  currentMonth: Date;
  dynamicPricingData: Array<{
    date: string;
    rules: SimplePricingRule[];
  }>;
  selectedDates: string[];
  onMonthChange: (month: Date) => void;
  onDateSelect: (date: string) => void;
  onDateRangeSelect: (startIndex: number, endIndex: number) => void;
}

export const PricingCalendar = memo(function PricingCalendar({
  currentMonth,
  dynamicPricingData,
  selectedDates,
  onMonthChange,
  onDateSelect,
  onDateRangeSelect
}: PricingCalendarProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const getDateString = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const getPricingForDate = (dateString: string) => {
    const dayData = dynamicPricingData.find(d => d.date === dateString);
    return dayData?.rules || [];
  };

  const isDateSelected = (dateString: string) => {
    return selectedDates.includes(dateString);
  };

  const handleDateClick = (day: number) => {
    const dateString = getDateString(day);
    onDateSelect(dateString);
  };

  const handleDateMouseDown = (day: number, index: number) => {
    const dateString = getDateString(day);
    // 범위 선택 로직은 부모 컴포넌트에서 처리
  };

  const renderDayCell = (day: number) => {
    const dateString = getDateString(day);
    const pricingRules = getPricingForDate(dateString);
    const isSelected = isDateSelected(dateString);
    const isToday = new Date().toDateString() === new Date(dateString).toDateString();

    return (
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        onMouseDown={() => handleDateMouseDown(day, 0)}
        className={`relative p-2 h-20 border border-gray-200 hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-100 border-blue-300' : ''
        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
      >
        <div className="text-sm font-medium text-gray-900">{day}</div>
        {pricingRules.length > 0 && (
          <div className="absolute bottom-1 right-1">
            <DollarSign className="h-3 w-3 text-green-600" />
          </div>
        )}
        {pricingRules.length > 1 && (
          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pricingRules.length}
          </div>
        )}
      </button>
    );
  };

  const renderEmptyCells = () => {
    return Array.from({ length: startingDayOfWeek }, (_, index) => (
      <div key={`empty-${index}`} className="p-2 h-20 border border-gray-200 bg-gray-50"></div>
    ));
  };

  const renderDays = () => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return renderDayCell(day);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </h3>
        </div>
        
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7">
        {renderEmptyCells()}
        {renderDays()}
      </div>

      {/* 범례 */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span>가격 설정됨</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              2
            </div>
            <span>다중 규칙</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>선택된 날짜</span>
          </div>
        </div>
      </div>
    </div>
  );
});
