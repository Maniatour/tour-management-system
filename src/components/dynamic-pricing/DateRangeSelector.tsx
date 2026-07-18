import { memo, useState, useCallback, useEffect, useMemo, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { DateRangeSelection, DAY_NAMES } from '@/lib/types/dynamic-pricing';

type CalendarCellVisual =
  | 'other-month'
  | 'status-sale'
  | 'status-closed'
  | 'disabled'
  | 'applied-endpoint'
  | 'applied-range'
  | 'excluded-range'
  | 'today'
  | 'default';

interface DateRangeSelectorProps {
  onDateRangeSelect: (selection: DateRangeSelection) => void;
  initialSelection?: DateRangeSelection;
  saleStatus?: 'sale' | 'closed';
  showStatusOnCalendar?: boolean;
  onDateStatusToggle?: (date: string, status: 'sale' | 'closed') => void;
  dateStatusMap?: Record<string, 'sale' | 'closed'>;
  disableDateSelection?: boolean;
  /** 실제 선택된 날짜(YYYY-MM-DD). 있으면 시 이 목록 기준으로 하이라이트 */
  selectedDates?: string[];
  /** Ctrl/Cmd+클릭으로 개별 날짜 추가·해제 */
  onDateToggle?: (date: string) => void;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DateRangeSelector = memo(function DateRangeSelector({
  onDateRangeSelect,
  initialSelection,
  saleStatus = 'sale',
  showStatusOnCalendar = false,
  onDateStatusToggle,
  dateStatusMap = {},
  disableDateSelection = false,
  selectedDates,
  onDateToggle,
}: DateRangeSelectorProps) {
  const t = useTranslations('products.dynamicPricingPage');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<string>(initialSelection?.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialSelection?.endDate || '');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    (initialSelection?.selectedDays || [0, 1, 2, 3, 4, 5, 6]).map(Number)
  );
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'calendar' | 'input'>('calendar');

  // 숫자/문자 혼입과 무관하게 요일 포함 여부 판별
  const selectedDaySet = useMemo(
    () => new Set(selectedDays.map((d) => Number(d))),
    [selectedDays]
  );

  const selectedDateSet = useMemo(
    () => new Set((selectedDates || []).map(String)),
    [selectedDates]
  );
  const useExplicitDates = Array.isArray(selectedDates);

  // 요일 선택 토글
  const toggleDay = useCallback((dayOfWeek: number) => {
    const day = Number(dayOfWeek);
    setSelectedDays((prev) => {
      const normalized = prev.map(Number);
      return normalized.includes(day)
        ? normalized.filter((d) => d !== day).sort((a, b) => a - b)
        : [...normalized, day].sort((a, b) => a - b);
    });
  }, []);
  
  // 요일이 변경되면 날짜 범위가 있으면 콜백 호출 (렌더링 후 실행)
  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) {
      onDateRangeSelect({
        startDate,
        endDate,
        selectedDays
      });
    }
  }, [selectedDays, startDate, endDate, onDateRangeSelect]);

  // 날짜 더블클릭 핸들러 (판매 상태 토글)
  const handleDateDoubleClick = useCallback((date: Date) => {
    if (onDateStatusToggle) {
      const dateString = toDateString(date);
      const currentStatus = dateStatusMap[dateString] || saleStatus;
      onDateStatusToggle(dateString, currentStatus);
    }
  }, [onDateStatusToggle, saleStatus, dateStatusMap]);

  // 날짜 클릭 핸들러 (달력 모드) — Ctrl/Cmd+클릭은 개별 토글
  const handleDateClick = useCallback((date: Date, event?: MouseEvent<HTMLButtonElement>) => {
    if (disableDateSelection) return;

    const dateString = toDateString(date);

    if (event && (event.ctrlKey || event.metaKey) && onDateToggle) {
      event.preventDefault();
      event.stopPropagation();
      onDateToggle(dateString);
      return;
    }
    
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
  }, [isSelectingRange, startDate, selectedDays, onDateRangeSelect, disableDateSelection, onDateToggle]);

  // 날짜 포맷팅 함수 (시간대 변환 없이)
  const formatDate = useCallback((dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${year}. ${parseInt(month).toString().padStart(2, '0')}. ${parseInt(day).toString().padStart(2, '0')}.`;
  }, []);

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
      {/* 선택 모드 토글 */}
      <div className="flex items-center justify-end">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectionMode('calendar')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md border transition-colors ${
              selectionMode === 'calendar'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>달력</span>
          </button>
          <button
            onClick={() => setSelectionMode('input')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md border transition-colors ${
              selectionMode === 'input'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Edit3 className="h-4 w-4" />
            <span>{t('input')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">{t('applyDaySelect')}</h4>
        <div className="flex space-x-2">
          {Object.entries(DAY_NAMES).map(([dayNum, dayName]) => {
            const dayOfWeek = parseInt(dayNum, 10);
            const isSelected = selectedDaySet.has(dayOfWeek);
            
            return (
              <button
                key={dayOfWeek}
                type="button"
                onClick={() => toggleDay(dayOfWeek)}
                aria-pressed={isSelected}
                className={`px-3 py-2 text-sm rounded-md border font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
            {Object.values(DAY_NAMES).map((dayName, index) => {
              const isDaySelected = selectedDaySet.has(index);
              return (
                <div
                  key={index}
                  className={`text-center text-sm font-medium py-2 ${
                    !isDaySelected
                      ? 'text-gray-300 line-through decoration-gray-400'
                      : index === 0
                        ? 'text-red-600'
                        : index === 6
                          ? 'text-blue-600'
                          : 'text-gray-600'
                  }`}
                >
                  {dayName}
                </div>
              );
            })}
          </div>

          {onDateToggle && !disableDateSelection && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t('ctrlClickDateHint')}
            </p>
          )}

          {/* 날짜 그리드 — selectedDays / selectedDates 변경 시 강제 갱신 */}
          <div
            key={`calendar-grid-${[...selectedDaySet].sort((a, b) => a - b).join('-')}-${selectedDateSet.size}`}
            className="grid grid-cols-7 gap-1"
          >
            {calendarDays.map(({ date, isCurrentMonth }) => {
              const dateString = toDateString(date);
              const dayOfWeek = date.getDay();
              const isDayApplied = selectedDaySet.has(dayOfWeek);
              
              const isStartDate = dateString === startDate;
              const isEndDate = dateString === endDate;
              const isInRange = Boolean(
                startDate && endDate && dateString >= startDate && dateString <= endDate
              );

              // 범위 선택이 완료된 뒤에는 selectedDates(Ctrl 토글 반영) 기준.
              // 범위 선택 중에는 범위+요일 미리보기.
              const preferExplicitDates =
                useExplicitDates && Boolean(endDate) && !isSelectingRange;
              const isPicked = preferExplicitDates
                ? selectedDateSet.has(dateString)
                : (isInRange && isDayApplied) ||
                  ((isStartDate || isEndDate) && isDayApplied && !disableDateSelection);

              const isAppliedEndpoint =
                isPicked && (isStartDate || isEndDate) && !disableDateSelection;
              const isAppliedInRange = isPicked && !isAppliedEndpoint;
              const isExcludedInRange = isInRange && !isPicked;
              
              const today = new Date();
              const isToday = dateString === toDateString(today);
              
              const dateStatus = dateStatusMap[dateString] !== undefined 
                ? dateStatusMap[dateString] 
                : 'closed';

              let visual: CalendarCellVisual = 'default';
              if (!isCurrentMonth) visual = 'other-month';
              else if (showStatusOnCalendar) visual = dateStatus === 'sale' ? 'status-sale' : 'status-closed';
              else if (disableDateSelection) visual = 'disabled';
              else if (isAppliedEndpoint) visual = 'applied-endpoint';
              else if (isAppliedInRange) visual = 'applied-range';
              else if (isExcludedInRange) visual = 'excluded-range';
              else if (isToday) visual = 'today';

              const visualClassName: Record<CalendarCellVisual, string> = {
                'other-month': 'text-gray-300 cursor-not-allowed bg-gray-50 border-gray-200',
                'status-sale': 'bg-green-50 text-green-800 hover:bg-green-100 border-gray-200',
                'status-closed': 'bg-red-50 text-red-800 hover:bg-red-100 border-gray-200',
                disabled: 'text-gray-700 hover:bg-gray-50 border-gray-200',
                'applied-endpoint': 'bg-blue-600 text-white font-semibold border-blue-600',
                'applied-range': 'bg-blue-100 text-blue-800 font-medium border-blue-200',
                'excluded-range':
                  'bg-white text-gray-400 border-dashed border-gray-300 line-through opacity-60',
                today: 'bg-gray-100 text-gray-900 font-semibold border-gray-200',
                default: 'text-gray-700 hover:bg-gray-100 border-gray-200',
              };

              const cellTitle = !isCurrentMonth
                ? undefined
                : onDateToggle && !disableDateSelection
                  ? (isPicked ? t('ctrlClickToDeselect') : t('ctrlClickToSelect'))
                  : isExcludedInRange
                    ? t('excludedByWeekday')
                    : undefined;
              
              return (
                <button
                  key={`${dateString}-${dayOfWeek}-${isPicked ? 'on' : 'off'}`}
                  type="button"
                  onClick={(e) => handleDateClick(date, e)}
                  onDoubleClick={() => handleDateDoubleClick(date)}
                  title={cellTitle}
                  data-day-applied={isDayApplied ? 'true' : 'false'}
                  data-date-picked={isPicked ? 'true' : 'false'}
                  data-excluded-in-range={isExcludedInRange ? 'true' : 'false'}
                  className={`h-12 text-sm transition-colors relative border ${visualClassName[visual]}`}
                  style={
                    isExcludedInRange
                      ? {
                          backgroundColor: '#ffffff',
                          color: '#9ca3af',
                          borderStyle: 'dashed',
                          borderColor: '#d1d5db',
                          textDecoration: 'line-through',
                          opacity: 0.55,
                        }
                      : isAppliedInRange
                        ? {
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderColor: '#bfdbfe',
                          }
                      : isAppliedEndpoint
                        ? {
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            borderColor: '#2563eb',
                          }
                        : undefined
                  }
                  disabled={!isCurrentMonth}
                >
                  <div
                    className={`absolute top-1 right-1 text-xs font-medium ${
                      isExcludedInRange ? 'text-gray-400 line-through' : ''
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  {isExcludedInRange && isCurrentMonth && !showStatusOnCalendar && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] font-medium text-gray-400 no-underline">
                        제외
                      </span>
                    </div>
                  )}
                  
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
              />
            </div>
          </div>
        </div>
      )}

      {/* 선택된 날짜 정보 */}
      {(startDate || endDate || (useExplicitDates && selectedDateSet.size > 0)) && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="text-sm font-medium text-primary mb-1">
            선택된 날짜 범위:
          </div>
          <div className="text-sm text-primary">
            {startDate && (
              <span>
                {formatDate(startDate)}
                {endDate ? ` ~ ${formatDate(endDate)}` : ` (${t('selectingEndDate')})`}
              </span>
            )}
          </div>
          {selectedDays.length > 0 && (
            <div className="text-sm text-primary mt-1">
              적용 요일: {selectedDays.map(day => DAY_NAMES[day]).join(', ')}
            </div>
          )}
          {useExplicitDates && (
            <div className="text-sm text-primary mt-1">
              {t('selectedDateCount', { count: selectedDateSet.size })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
