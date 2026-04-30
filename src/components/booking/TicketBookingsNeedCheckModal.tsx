'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getCancelDueDateForTicketBooking,
  isTicketBookingCancelDueStaleBeforeCheckIn,
  localDateYmd,
  type SeasonDate,
} from '@/lib/ticketBookingCancelDue';

type SeasonSlice = { season_dates: SeasonDate[] | null };

export type TicketBookingNeedCheckRow = {
  id: string;
  tour_id?: string | null;
  check_in_date: string;
  company: string;
  category?: string;
  rn_number?: string;
  status?: string;
  time?: string;
  ea?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  bookings: TicketBookingNeedCheckRow[];
  supplierProductsMap: Map<string, SeasonSlice>;
  onEdit: (booking: TicketBookingNeedCheckRow) => void;
};

type NoTourSubTab = 'upcoming2w' | 'all' | 'past';
type CheckInSort = 'asc' | 'desc';

function isCancelled(b: TicketBookingNeedCheckRow): boolean {
  return String(b.status || '').toLowerCase() === 'cancelled';
}

function hasNoTour(b: TicketBookingNeedCheckRow): boolean {
  const tid = b.tour_id;
  return tid == null || String(tid).trim() === '';
}

function checkInYmd(b: TicketBookingNeedCheckRow): string {
  const s = (b.check_in_date || '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** 로컬 달력 기준 YMD + 일수 (체크인 2주 구간용) */
function addCalendarDaysLocal(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function filterNoTourBySub(rows: TicketBookingNeedCheckRow[], sub: NoTourSubTab): TicketBookingNeedCheckRow[] {
  const today = localDateYmd();
  const endInclusive = addCalendarDaysLocal(today, 13);
  return rows.filter((b) => {
    const ymd = checkInYmd(b);
    if (!ymd) return sub === 'all';
    switch (sub) {
      case 'upcoming2w':
        return ymd >= today && ymd <= endInclusive;
      case 'past':
        return ymd < today;
      default:
        return true;
    }
  });
}

function sortByCheckIn(rows: TicketBookingNeedCheckRow[], order: CheckInSort): TicketBookingNeedCheckRow[] {
  const out = [...rows];
  out.sort((a, b) => {
    const ya = checkInYmd(a);
    const yb = checkInYmd(b);
    if (!ya && !yb) return 0;
    if (!ya) return 1;
    if (!yb) return -1;
    const cmp = ya.localeCompare(yb);
    return order === 'asc' ? cmp : -cmp;
  });
  return out;
}

export default function TicketBookingsNeedCheckModal({
  open,
  onClose,
  bookings,
  supplierProductsMap,
  onEdit,
}: Props) {
  const t = useTranslations('booking.calendar');
  const [tab, setTab] = useState<'no_tour' | 'cancel_due'>('no_tour');
  const [noTourSub, setNoTourSub] = useState<NoTourSubTab>('upcoming2w');
  const [checkInSort, setCheckInSort] = useState<CheckInSort>('asc');

  useEffect(() => {
    if (!open) return;
    setTab('no_tour');
    setNoTourSub('upcoming2w');
    setCheckInSort('asc');
  }, [open]);

  const rowsNoTour = useMemo(() => {
    return bookings.filter((b) => !isCancelled(b) && hasNoTour(b));
  }, [bookings]);

  const rowsCancelDue = useMemo(() => {
    return bookings.filter((b) => {
      if (isCancelled(b)) return false;
      const sp = supplierProductsMap.get(b.id);
      return isTicketBookingCancelDueStaleBeforeCheckIn(b, sp);
    });
  }, [bookings, supplierProductsMap]);

  const noTourSubCounts = useMemo(() => {
    const today = localDateYmd();
    const endInclusive = addCalendarDaysLocal(today, 13);
    let upcoming = 0;
    let past = 0;
    for (const b of rowsNoTour) {
      const ymd = checkInYmd(b);
      if (!ymd) continue;
      if (ymd >= today && ymd <= endInclusive) upcoming++;
      if (ymd < today) past++;
    }
    return { upcoming, past, all: rowsNoTour.length };
  }, [rowsNoTour]);

  const filteredNoTour = useMemo(
    () => filterNoTourBySub(rowsNoTour, noTourSub),
    [rowsNoTour, noTourSub]
  );

  const displayRows = useMemo(() => {
    const base = tab === 'no_tour' ? filteredNoTour : rowsCancelDue;
    return sortByCheckIn(base, checkInSort);
  }, [tab, filteredNoTour, rowsCancelDue, checkInSort]);

  if (!open) return null;

  const emptyBase =
    tab === 'no_tour' ? t('ticketNeedCheckEmptyNoTour') : t('ticketNeedCheckEmptyCancelDue');
  const empty =
    tab === 'no_tour' && noTourSub !== 'all' && rowsNoTour.length > 0 && filteredNoTour.length === 0
      ? t('ticketNeedCheckEmptyNoTourSub')
      : emptyBase;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-need-check-title"
      onClick={() => onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
          <h2 id="ticket-need-check-title" className="text-lg font-semibold text-gray-900">
            {t('ticketNeedCheckTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-gray-100 px-4 pt-3 sm:px-5">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => setTab('no_tour')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                tab === 'no_tour'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('ticketNeedCheckTabNoTour')}
              <span className="ml-1 tabular-nums text-gray-500">({rowsNoTour.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('cancel_due')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                tab === 'cancel_due'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('ticketNeedCheckTabCancelDue')}
              <span className="ml-1 tabular-nums text-gray-500">({rowsCancelDue.length})</span>
            </button>
          </div>

          {tab === 'no_tour' && (
            <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setNoTourSub('upcoming2w')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'upcoming2w'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubUpcoming2w')}
                <span className="ml-1 tabular-nums opacity-80">({noTourSubCounts.upcoming})</span>
              </button>
              <button
                type="button"
                onClick={() => setNoTourSub('all')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'all' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubAll')}
                <span className="ml-1 tabular-nums opacity-80">({noTourSubCounts.all})</span>
              </button>
              <button
                type="button"
                onClick={() => setNoTourSub('past')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'past' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubPast')}
                <span className="ml-1 tabular-nums opacity-80">({noTourSubCounts.past})</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p className="text-xs text-gray-500">{t('ticketNeedCheckHint')}</p>
            <button
              type="button"
              onClick={() => setCheckInSort((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 sm:text-sm"
              title={checkInSort === 'asc' ? t('ticketNeedCheckSortDesc') : t('ticketNeedCheckSortAsc')}
            >
              {t('ticketNeedCheckSortCheckIn')}:{' '}
              {checkInSort === 'asc' ? t('ticketNeedCheckSortAsc') : t('ticketNeedCheckSortDesc')}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {displayRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 sm:px-5">{empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-[1] bg-gray-50 text-gray-700">
                  <tr className="border-b border-gray-200">
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      <button
                        type="button"
                        onClick={() => setCheckInSort((o) => (o === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center gap-1 rounded hover:text-blue-700"
                      >
                        {t('ticketNeedCheckColCheckIn')}
                        <span className="tabular-nums text-gray-400" aria-hidden>
                          {checkInSort === 'asc' ? '↑' : '↓'}
                        </span>
                      </button>
                    </th>
                    {tab === 'cancel_due' && (
                      <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                        {t('ticketNeedCheckColCancelDue')}
                      </th>
                    )}
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColCompany')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColCategory')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColRn')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColStatus')}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      {t('ticketNeedCheckColEa')}
                    </th>
                    <th className="px-3 py-2 font-medium sm:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayRows.map((b) => {
                    const sp = supplierProductsMap.get(b.id);
                    const due = getCancelDueDateForTicketBooking(b, sp);
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/80">
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums sm:px-4">
                          {b.check_in_date || '—'}
                        </td>
                        {tab === 'cancel_due' && (
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-red-700 tabular-nums sm:px-4">
                            {due || '—'}
                          </td>
                        )}
                        <td className="max-w-[140px] truncate px-3 py-2 sm:max-w-[180px] sm:px-4">
                          {b.company || '—'}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 sm:px-4">{b.category || '—'}</td>
                        <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[11px] sm:px-4">
                          {b.rn_number?.trim() || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 sm:px-4">{b.status || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums sm:px-4">{b.ea ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                          <button
                            type="button"
                            onClick={() => {
                              onEdit(b);
                              onClose();
                            }}
                            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            {t('ticketNeedCheckOpenEdit')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
