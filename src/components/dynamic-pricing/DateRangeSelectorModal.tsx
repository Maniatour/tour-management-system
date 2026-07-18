'use client';

import { memo, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';
import { DateRangeSelection, DAY_NAMES } from '@/lib/types/dynamic-pricing';
import { DateRangeSelector } from './DateRangeSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DateRangeSelectorModalProps {
  onDateRangeSelect: (selection: DateRangeSelection) => void;
  initialSelection?: DateRangeSelection;
  selectedDates?: string[];
  onDateToggle?: (date: string) => void;
  isSaleAvailable: boolean;
  onSaleAvailableToggle: () => void;
}

function formatDateLabel(dateString: string) {
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${year}. ${parseInt(month, 10).toString().padStart(2, '0')}. ${parseInt(day, 10).toString().padStart(2, '0')}.`;
}

export const DateRangeSelectorModal = memo(function DateRangeSelectorModal({
  onDateRangeSelect,
  initialSelection,
  selectedDates,
  onDateToggle,
  isSaleAvailable,
  onSaleAvailableToggle,
}: DateRangeSelectorModalProps) {
  const t = useTranslations('products.dynamicPricingPage');
  const [open, setOpen] = useState(false);

  const selectedDays = initialSelection?.selectedDays ?? [0, 1, 2, 3, 4, 5, 6];
  const startDate = initialSelection?.startDate || '';
  const endDate = initialSelection?.endDate || '';
  const selectedCount = selectedDates?.length ?? 0;

  const summaryText = useMemo(() => {
    if (selectedCount > 0 && startDate && endDate) {
      return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)} · ${t('selectedDateCount', { count: selectedCount })}`;
    }
    if (startDate && endDate) {
      return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`;
    }
    if (startDate) {
      return `${formatDateLabel(startDate)} (${t('selectingEndDate')})`;
    }
    return t('dateRangeNotSelected');
  }, [selectedCount, startDate, endDate, t]);

  const daysSummary = useMemo(() => {
    if (!selectedDays.length) return '';
    return selectedDays.map((day) => DAY_NAMES[day]).join(', ');
  }, [selectedDays]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-gray-900">{t('dateAndDaySelect')}</h4>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">
            {isSaleAvailable ? t('onSale') : t('saleStopped')}
          </span>
          <button
            type="button"
            onClick={onSaleAvailableToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
              isSaleAvailable ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={isSaleAvailable}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSaleAvailable ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium text-foreground">
            {t('openDateRangeSelector')}
          </div>
          <div className="text-sm text-muted-foreground truncate">{summaryText}</div>
          {daysSummary ? (
            <div className="text-xs text-muted-foreground">
              {t('applyDaysLabel')}: {daysSummary}
            </div>
          ) : null}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          stackLevel="nested"
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{t('dateAndDaySelect')}</DialogTitle>
            <DialogDescription>{t('dateRangeModalDescription')}</DialogDescription>
          </DialogHeader>

          <DateRangeSelector
            onDateRangeSelect={onDateRangeSelect}
            initialSelection={initialSelection || { startDate: '', endDate: '', selectedDays: [0, 1, 2, 3, 4, 5, 6] }}
            {...(selectedDates !== undefined ? { selectedDates } : {})}
            {...(onDateToggle !== undefined ? { onDateToggle } : {})}
          />

          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
