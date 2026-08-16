'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Grid, Table } from 'lucide-react';
import { formatTicketBookingStatusLabel } from '@/lib/ticketBookingStatus';
import {
  getCancelDueDateForTicketBooking,
  isTicketBookingCancelDueStaleBeforeCheckIn,
  localDateYmd,
  type SeasonDate,
} from '@/lib/ticketBookingCancelDue';
import TicketBookingAxisSummary from '@/components/booking/TicketBookingAxisSummary';
import TicketBookingCardView, {
  type TicketBookingCardViewRow,
} from '@/components/booking/TicketBookingCardView';
import { normalizeTicketBookingTourIds } from '@/lib/ticketBookingTourIds';
import {
  buildLinkedLxMismatchDateGroups,
  formatCanyonLxPair,
  ticketBookingCanyonKeyFromBooking,
  type LinkedLxMismatchBooking,
  type LinkedLxMismatchDateGroup,
} from '@/lib/ticketBookingDateView';

type SeasonSlice = { season_dates: SeasonDate[] | null };

export type TicketBookingNeedCheckRow = TicketBookingCardViewRow & LinkedLxMismatchBooking;

type Props = {
  open: boolean;
  onClose: () => void;
  bookings: TicketBookingNeedCheckRow[];
  supplierProductsMap: Map<string, SeasonSlice>;
  onEdit: (booking: TicketBookingNeedCheckRow) => void;
};

type NeedCheckTab = 'no_tour' | 'cancel_due' | 'lx_mismatch';
type NeedCheckViewMode = 'card' | 'table';
type NoTourSubTab = 'upcoming2w' | 'all' | 'past';
type CheckInSort = 'asc' | 'desc';

function isCancelled(b: TicketBookingNeedCheckRow): boolean {
  return String(b.status || '').toLowerCase() === 'cancelled';
}

function hasNoTour(b: TicketBookingNeedCheckRow): boolean {
  return normalizeTicketBookingTourIds(b.tour_ids, b.tour_id).length === 0;
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

function ymdInSubTab(ymd: string, sub: NoTourSubTab): boolean {
  const today = localDateYmd();
  const endInclusive = addCalendarDaysLocal(today, 13);
  if (!ymd) return sub === 'all';
  switch (sub) {
    case 'upcoming2w':
      return ymd >= today && ymd <= endInclusive;
    case 'past':
      return ymd < today;
    default:
      return true;
  }
}

function filterNoTourBySub(rows: TicketBookingNeedCheckRow[], sub: NoTourSubTab): TicketBookingNeedCheckRow[] {
  return rows.filter((b) => ymdInSubTab(checkInYmd(b), sub));
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

function resolveNeedCheckCardRow(
  raw: LinkedLxMismatchBooking,
  byId: Map<string, TicketBookingNeedCheckRow>
): TicketBookingNeedCheckRow {
  const full = byId.get(raw.id);
  if (full) return full;
  return {
    ...raw,
    check_in_date: raw.check_in_date || '',
    company: raw.company || '',
    category: raw.category || '',
    time: raw.time || '',
    ea: Number(raw.ea) || 0,
  };
}

export default function TicketBookingsNeedCheckModal({
  open,
  onClose,
  bookings,
  supplierProductsMap,
  onEdit,
}: Props) {
  const t = useTranslations('booking.calendar');
  const locale = useLocale();
  const [tab, setTab] = useState<NeedCheckTab>('no_tour');
  const [noTourSub, setNoTourSub] = useState<NoTourSubTab>('upcoming2w');
  const [checkInSort, setCheckInSort] = useState<CheckInSort>('asc');
  const [viewMode, setViewMode] = useState<NeedCheckViewMode>('card');

  useEffect(() => {
    if (!open) return;
    setTab('no_tour');
    setNoTourSub('upcoming2w');
    setCheckInSort('asc');
  }, [open]);

  const tourFallback = locale.startsWith('ko') ? '투어' : 'Tour';

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

  const lxMismatchGroupsAll = useMemo(
    () => buildLinkedLxMismatchDateGroups(bookings, locale, tourFallback),
    [bookings, locale, tourFallback]
  );

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

  const lxSubCounts = useMemo(() => {
    const today = localDateYmd();
    const endInclusive = addCalendarDaysLocal(today, 13);
    let upcoming = 0;
    let past = 0;
    for (const g of lxMismatchGroupsAll) {
      if (g.dateYmd >= today && g.dateYmd <= endInclusive) upcoming++;
      if (g.dateYmd < today) past++;
    }
    return { upcoming, past, all: lxMismatchGroupsAll.length };
  }, [lxMismatchGroupsAll]);

  const filteredNoTour = useMemo(
    () => filterNoTourBySub(rowsNoTour, noTourSub),
    [rowsNoTour, noTourSub]
  );

  const filteredLxGroups = useMemo(() => {
    const filtered = lxMismatchGroupsAll.filter((g) => ymdInSubTab(g.dateYmd, noTourSub));
    const sorted = [...filtered];
    sorted.sort((a, b) =>
      checkInSort === 'asc' ? a.dateYmd.localeCompare(b.dateYmd) : b.dateYmd.localeCompare(a.dateYmd)
    );
    return sorted;
  }, [lxMismatchGroupsAll, noTourSub, checkInSort]);

  const displayRows = useMemo(() => {
    const base = tab === 'no_tour' ? filteredNoTour : rowsCancelDue;
    return sortByCheckIn(base, checkInSort);
  }, [tab, filteredNoTour, rowsCancelDue, checkInSort]);

  const bookingById = useMemo(() => {
    const map = new Map<string, TicketBookingNeedCheckRow>();
    for (const b of bookings) map.set(b.id, b);
    return map;
  }, [bookings]);

  if (!open) return null;

  const showDateSubTabs = tab === 'no_tour' || tab === 'lx_mismatch';
  const subCounts = tab === 'lx_mismatch' ? lxSubCounts : noTourSubCounts;

  const empty =
    tab === 'lx_mismatch'
      ? noTourSub !== 'all' && lxMismatchGroupsAll.length > 0 && filteredLxGroups.length === 0
        ? t('ticketNeedCheckEmptyLxMismatchSub')
        : t('ticketNeedCheckEmptyLxMismatch')
      : tab === 'no_tour'
        ? noTourSub !== 'all' && rowsNoTour.length > 0 && filteredNoTour.length === 0
          ? t('ticketNeedCheckEmptyNoTourSub')
          : t('ticketNeedCheckEmptyNoTour')
        : t('ticketNeedCheckEmptyCancelDue');

  const hint =
    tab === 'lx_mismatch' ? t('ticketNeedCheckHintLx') : t('ticketNeedCheckHint');

  const tabBtn = (id: NeedCheckTab, activeClass: string, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors sm:px-3 sm:text-sm ${
        tab === id ? activeClass : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
      <span className="ml-1 tabular-nums text-gray-500">({count})</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-need-check-title"
      onClick={() => onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
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
          <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-0.5">
            {tabBtn(
              'no_tour',
              'bg-white text-primary shadow-sm',
              t('ticketNeedCheckTabNoTour'),
              rowsNoTour.length
            )}
            {tabBtn(
              'lx_mismatch',
              'bg-white text-amber-800 shadow-sm',
              t('ticketNeedCheckTabLxMismatch'),
              lxMismatchGroupsAll.length
            )}
            {tabBtn(
              'cancel_due',
              'bg-white text-red-700 shadow-sm',
              t('ticketNeedCheckTabCancelDue'),
              rowsCancelDue.length
            )}
          </div>

          {showDateSubTabs && (
            <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setNoTourSub('upcoming2w')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'upcoming2w'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubUpcoming2w')}
                <span className="ml-1 tabular-nums opacity-80">({subCounts.upcoming})</span>
              </button>
              <button
                type="button"
                onClick={() => setNoTourSub('all')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'all' ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubAll')}
                <span className="ml-1 tabular-nums opacity-80">({subCounts.all})</span>
              </button>
              <button
                type="button"
                onClick={() => setNoTourSub('past')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  noTourSub === 'past' ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('ticketNeedCheckNoTourSubPast')}
                <span className="ml-1 tabular-nums opacity-80">({subCounts.past})</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p className="text-xs text-gray-500">{hint}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex rounded-lg bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'card' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={t('ticketNeedCheckViewCard')}
                  aria-pressed={viewMode === 'card'}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'table' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={t('ticketNeedCheckViewTable')}
                  aria-pressed={viewMode === 'table'}
                >
                  <Table className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCheckInSort((o) => (o === 'asc' ? 'desc' : 'asc'))}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 sm:text-sm"
                title={checkInSort === 'asc' ? t('ticketNeedCheckSortDesc') : t('ticketNeedCheckSortAsc')}
              >
                {t('ticketNeedCheckSortCheckIn')}:{' '}
                {checkInSort === 'asc' ? t('ticketNeedCheckSortAsc') : t('ticketNeedCheckSortDesc')}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {tab === 'lx_mismatch' ? (
            filteredLxGroups.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500 sm:px-5">{empty}</p>
            ) : (
              <LxMismatchDateList
                groups={filteredLxGroups}
                locale={locale}
                t={t}
                viewMode={viewMode}
                allBookings={bookings}
                bookingById={bookingById}
                supplierProductsMap={supplierProductsMap}
                onEdit={(b) => {
                  onEdit(b);
                  onClose();
                }}
              />
            )
          ) : displayRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 sm:px-5">{empty}</p>
          ) : viewMode === 'card' ? (
            <div className="px-4 py-3 sm:px-5">
              <NeedCheckBookingCards
                rows={displayRows}
                allBookings={bookings}
                locale={locale}
                dateSort={checkInSort}
                supplierProductsMap={supplierProductsMap}
                onOpen={(b) => {
                  onEdit(b);
                  onClose();
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-[1] bg-gray-50 text-gray-700">
                  <tr className="border-b border-gray-200">
                    <th className="whitespace-nowrap px-3 py-2 font-medium sm:px-4">
                      <button
                        type="button"
                        onClick={() => setCheckInSort((o) => (o === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center gap-1 rounded hover:text-primary"
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
                        <td className="max-w-[min(100vw,14rem)] px-3 py-2 sm:max-w-[16rem] sm:px-4">
                          <div className="whitespace-nowrap">
                            {b.status
                              ? formatTicketBookingStatusLabel(b.status, t, locale)
                              : '—'}
                          </div>
                          <TicketBookingAxisSummary booking={b} variant="inline" className="mt-0.5" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums sm:px-4">{b.ea ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                          <button
                            type="button"
                            onClick={() => {
                              onEdit(b);
                              onClose();
                            }}
                            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
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

function NeedCheckBookingCards({
  rows,
  allBookings,
  locale,
  dateSort,
  supplierProductsMap,
  onOpen,
  density = 'default',
  flat = false,
}: {
  rows: TicketBookingNeedCheckRow[];
  allBookings: TicketBookingNeedCheckRow[];
  locale: string;
  dateSort: CheckInSort;
  supplierProductsMap: Map<string, SeasonSlice>;
  onOpen: (booking: TicketBookingNeedCheckRow) => void;
  density?: 'default' | 'compact';
  flat?: boolean;
}) {
  return (
    <TicketBookingCardView
      bookings={rows}
      tourLinkSourceBookings={allBookings}
      locale={locale}
      todayYmd={localDateYmd()}
      dateSort={dateSort}
      density={density}
      flat={flat}
      allowOpenWhenFlat={flat}
      hideAmounts={false}
      getCancelDueDate={(b) => getCancelDueDateForTicketBooking(b, supplierProductsMap.get(b.id))}
      getSupplierProduct={(b) => supplierProductsMap.get(b.id) ?? null}
      onOpenBooking={onOpen}
    />
  );
}

function LxMismatchDateList({
  groups,
  locale,
  t,
  viewMode,
  allBookings,
  bookingById,
  supplierProductsMap,
  onEdit,
}: {
  groups: LinkedLxMismatchDateGroup[];
  locale: string;
  t: (key: string) => string;
  viewMode: NeedCheckViewMode;
  allBookings: TicketBookingNeedCheckRow[];
  bookingById: Map<string, TicketBookingNeedCheckRow>;
  supplierProductsMap: Map<string, SeasonSlice>;
  onEdit: (booking: TicketBookingNeedCheckRow) => void;
}) {
  return (
    <div className="divide-y divide-amber-100">
      {groups.map((g) => (
        <section key={g.dateYmd} className="px-4 py-3 sm:px-5">
          <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold tabular-nums text-gray-900">{g.dateYmd}</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 ring-1 ring-red-300">
              {t('ticketNeedCheckLxMismatchBadge')}
            </span>
            {g.clusters.length === 1 ? (
              <>
                <span className="text-xs font-medium text-red-800 tabular-nums">
                  {t('ticketNeedCheckLxTour')}: {formatCanyonLxPair(g.clusters[0]!.tourChoiceTotals)}
                </span>
                <span className="text-xs font-medium text-red-800 tabular-nums">
                  {t('ticketNeedCheckLxTicket')}: {formatCanyonLxPair(g.clusters[0]!.ticketChoiceTotals)}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-amber-900">
                {t('ticketNeedCheckLxCluster')} {g.clusters.length}
              </span>
            )}
          </header>

          {g.clusters.map((cluster, idx) => (
            <div
              key={cluster.key}
              className="mb-3 last:mb-0 rounded-lg border border-amber-200/80 bg-amber-50/40 p-2.5"
            >
              {g.clusters.length > 1 ? (
                <p className="mb-1.5 text-[11px] font-semibold text-amber-900">
                  {t('ticketNeedCheckLxCluster')} {idx + 1}
                  <span className="ml-2 font-medium tabular-nums">
                    {formatCanyonLxPair(cluster.tourChoiceTotals)} ≠ {formatCanyonLxPair(cluster.ticketChoiceTotals)}
                  </span>
                </p>
              ) : null}

              <div className="mb-2 rounded-md border border-slate-200/90 bg-white/80 px-2 py-1.5">
                <div className="mb-0.5 text-[10px] font-semibold text-slate-600">
                  {t('ticketNeedCheckLxToursThisDay')}
                </div>
                <ul className="space-y-0.5 text-[11px] text-slate-800">
                  {cluster.tours.map((tr) => (
                    <li key={tr.tourId} className="leading-snug">
                      <span className="font-medium">{tr.label}</span>
                      <span className="ml-1 tabular-nums text-slate-600">
                        — {formatCanyonLxPair(tr.choiceCounts)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {viewMode === 'card' ? (
                <NeedCheckBookingCards
                  rows={cluster.bookings.map((b) => resolveNeedCheckCardRow(b, bookingById))}
                  allBookings={allBookings}
                  locale={locale}
                  dateSort="asc"
                  supplierProductsMap={supplierProductsMap}
                  onOpen={onEdit}
                  density="compact"
                  flat
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-xs">
                    <thead className="text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColCanyon')}</th>
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColCompany')}</th>
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColCategory')}</th>
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColRn')}</th>
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColStatus')}</th>
                        <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('ticketNeedCheckColEa')}</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white/70">
                      {cluster.bookings.map((b) => {
                        const canyon = ticketBookingCanyonKeyFromBooking(b);
                        const row = resolveNeedCheckCardRow(b, bookingById);
                        return (
                          <tr key={b.id} className="hover:bg-white">
                            <td className="whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums">
                              {canyon === 'L' || canyon === 'X' ? canyon : '—'}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-1.5">{b.company || '—'}</td>
                            <td className="max-w-[120px] truncate px-2 py-1.5">{b.category || '—'}</td>
                            <td className="max-w-[100px] truncate px-2 py-1.5 font-mono text-[11px]">
                              {b.rn_number?.trim() || '—'}
                            </td>
                            <td className="max-w-[14rem] px-2 py-1.5">
                              <div className="whitespace-nowrap">
                                {b.status ? formatTicketBookingStatusLabel(b.status, t, locale) : '—'}
                              </div>
                              <TicketBookingAxisSummary booking={b} variant="inline" className="mt-0.5" />
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{b.ea ?? '—'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => onEdit(row)}
                                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
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
          ))}
        </section>
      ))}
    </div>
  );
}
