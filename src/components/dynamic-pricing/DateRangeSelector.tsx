import React, { memo, useState, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { DateRangeSelection, DAY_NAMES } from '@/lib/types/dynamic-pricing';

interface DateRangeSelectorProps {
  onDateRangeSelect: (selection: DateRangeSelection) => void;
  initialSelection?: DateRangeSelection;
  saleStatus?: 'sale' | 'closed';
  showStatusOnCalendar?: boolean;
  onDateStatusToggle?: (date: string, status: 'sale' | 'closed') => void;
  dateStatusMap?: Record<string, 'sale' | 'closed'>;
}

export const DateRangeSelector = memo(function DateRangeSelector({
  onDateRangeSelect,
  initialSelection,
  saleStatus = 'sale',
  showStatusOnCalendar = false,
  onDateStatusToggle,
  dateStatusMap = {}
}: DateRangeSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<string>(initialSelection?.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialSelection?.endDate || '');
  const [selectedDays, setSelectedDays] = useState<number[]>(initialSelection?.selectedDays || [0, 1, 2, 3, 4, 5, 6]);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'calendar' | 'input'>('calendar');

  // 요일 선택 토글
  const toggleDay = useCallback((dayOfWeek: number) => {
    setSelectedDays(prev => 
      prev.includes(dayOfWeek) 
        ? prev.filter(day => day !== dayOfWeek)
        : [...prev, dayOfWeek].sort()
    );
  }, []);

  // 날짜 더블클릭 핸들러 (판매 상태 토글)
  const handleDateDoubleClick = useCallback((date: Date) => {
    if (onDateStatusToggle) {
      const dateString = date.toISOString().split('T')[0];
      const newStatus = saleStatus === 'sale' ? 'closed' : 'sale';
      onDateStatusToggle(dateString, newStatus);
    }
  }, [onDateStatusToggle, saleStatus]);

  // 날짜 클릭 핸들러 (달력 모드)
  const handleDateClick = useCallback((date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    
    if (!isSelectingRange) {
      // 시작일 설정
      setStartDate(dateString);
      setEndDate('');
      setIsSelectingRange(true);
    } else {
      // 종료일 설정
      if (dateString >= startDate) {
        setEndDate(dateString);
        setIsSelectingRange(false);
        
        // 날짜 범위 선택 완료 시 콜백 호출
        onDateRangeSelect({
          startDate,
          endDate: dateString,
          selectedDays
        });
      } else {
        // 시작일보다 이전 날짜면 시작일로 설정
        setStartDate(dateString);
        setEndDate('');
      }
    }
  }, [isSelectingRange, startDate, selectedDays, onDateRangeSelect]);

  // 입력 모드에서 날짜 변경 핸들러
  const handleInputDateChange = useCallback(() => {
    if (startDate && endDate && startDate <= endDate) {
      onDateRangeSelect({
        startDate,
        endDate,
        selectedDays
      });
    }
  }, [startDate, endDate, selectedDays, onDateRangeSelect]);

  // 월 변경
  const changeMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  }, []);

  // 달력 날짜 생성
  const generateCalendarDays = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDateOfWeek = firstDay.getDay();
    
    const days = [];
    
    // 이전 달의 마지막 날들
    for (let i = startDateOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // 현재 달의 날들
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true });
    }
    
    // 다음 달의 첫 날들 (42개 셀을 채우기 위해)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  }, [currentMonth]);

  const calendarDays = generateCalendarDays();

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">날짜 및 요일 선택</h3>
        
        {/* 선택 모드 토글 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectionMode('calendar')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
              selectionMode === 'calendar'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>달력</span>
          </button>
          <button
            onClick={() => setSelectionMode('input')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
              selectionMode === 'input'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Edit3 className="h-4 w-4" />
            <span>입력</span>
          </button>
        </div>
      </div>

      {/* 요일 선택 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">적용 요일 선택</h4>
        <div className="flex space-x-2">
          {Object.entries(DAY_NAMES).map(([dayNum, dayName]) => {
            const dayOfWeek = parseInt(dayNum);
            const isSelected = selectedDays.includes(dayOfWeek);
            
            return (
              <button
                key={dayOfWeek}
                onClick={() => toggleDay(dayOfWeek)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {dayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* 달력 모드 */}
      {selectionMode === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => changeMonth('prev')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </span>
            <button
              onClick={() => changeMonth('next')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Object.values(DAY_NAMES).map((dayName, index) => (
              <div
                key={index}
                className={`text-center text-sm font-medium py-2 ${
                  index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const dateString = date.toISOString().split('T')[0];
              const isStartDate = dateString === startDate;
              const isEndDate = dateString === endDate;
              const isInRange = startDate && endDate && dateString >= startDate && dateString <= endDate;
              const isToday = dateString === new Date().toISOString().split('T')[0];
              
              // 날짜별 상태 확인 (우선순위: 개별 설정 > 전역 설정)
              const dateStatus = dateStatusMap[dateString] || saleStatus;
              
              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  onDoubleClick={() => handleDateDoubleClick(date)}
                  className={`h-12 text-sm transition-colors relative border border-gray-200 ${
                    !isCurrentMonth
                      ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                      : showStatusOnCalendar
                      ? dateStatus === 'sale'
                        ? 'bg-green-50 text-green-800 hover:bg-green-100'
                        : 'bg-red-50 text-red-800 hover:bg-red-100'
                      : isStartDate || isEndDate
                      ? 'bg-blue-500 text-white font-semibold'
                      : isInRange
                      ? 'bg-blue-100 text-blue-700'
                      : isToday
                      ? 'bg-gray-100 text-gray-900 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  disabled={!isCurrentMonth}
                >
                  {/* 날짜를 우상단에 배치 */}
                  <div className="absolute top-1 right-1 text-xs font-medium">
                    {date.getDate()}
                  </div>
                  
                  {/* 판매 상태 표시 (바탕색으로) */}
                  {showStatusOnCalendar && isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`text-xs font-medium ${
                        dateStatus === 'sale' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dateStatus === 'sale' ? '판매' : '마감'}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 입력 모드 */}
      {selectionMode === 'input' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value && endDate && e.target.value <= endDate) {
                    onDateRangeSelect({
                      startDate: e.target.value,
                      endDate,
                      selectedDays
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (startDate && e.target.value && startDate <= e.target.value) {
                    onDateRangeSelect({
                      startDate,
                      endDate: e.target.value,
                      selectedDays
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 선택된 날짜 정보 */}
      {(startDate || endDate) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-700 mb-1">
            선택된 날짜 범위:
          </div>
          <div className="text-sm text-blue-600">
            {startDate && (
              <span>
                {new Date(startDate).toLocaleDateString('ko-KR')}
                {endDate ? ` ~ ${new Date(endDate).toLocaleDateString('ko-KR')}` : ' (종료일 선택 중...)'}
              </span>
            )}
          </div>
          {selectedDays.length > 0 && (
            <div className="text-sm text-blue-600 mt-1">
              적용 요일: {selectedDays.map(day => DAY_NAMES[day]).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
