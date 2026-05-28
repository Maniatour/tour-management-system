'use client';

import React, { useState, useEffect, useCallback, useRef, Fragment, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdminActor } from '@/lib/superAdmin';
import {
  filterTicketBookingsExcludedFromMainUi,
  canShowTicketBookingSoftDeleteUi,
  isTicketBookingOffsetOrCancelRow,
} from '@/lib/ticketBookingSoftDelete';
import {
  countTicketBookingMultiRnGroups,
  isTicketBookingLegacyOffsetRnGroup,
  legacyOffsetRowIdsToSoftDelete,
  pickPrimaryRowForLegacyOffsetMerge,
  ticketBookingIdsInMultiRnGroups,
  ticketBookingRnGroupKey,
  ticketBookingRnGroupSoftDeleteCandidateIds,
  isTicketBookingRowBookingConfirmed,
} from '@/lib/ticketBookingLegacyOffsetGroup';
import TicketBookingDeletionReviewModal from '@/components/booking/TicketBookingDeletionReviewModal';
import { supabase, isAbortLikeError } from '@/lib/supabase';
import TicketBookingForm from './TicketBookingForm';
import TicketBookingBulkAddModal from './TicketBookingBulkAddModal';
import TicketBookingAxisSummary from '@/components/booking/TicketBookingAxisSummary';
import TicketInvoiceUploadModal from './TicketInvoiceUploadModal';
import BookingHistory from './BookingHistory';
import TicketBookingReservationDetailModal, {
  type TicketBookingReservationDetailRow,
} from './TicketBookingReservationDetailModal';
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal';
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries';
import {
  unlinkExpenseReconciliationMatch,
  type ExpenseStatementReconContext,
} from '@/lib/expense-reconciliation-similar-lines';
import type { TicketBookingStatementReconDisplay } from '@/lib/ticket-booking-statement-recon';
import {
  buildTicketBookingStatementReconContextResolved,
  fetchTicketBookingStatementReconDisplayByBookingId,
  isTicketBookingStatementReconDisabled,
} from '@/lib/ticket-booking-statement-recon';
import { TicketBookingStatementReconCell } from '@/components/booking/TicketBookingStatementReconCell';
import { BookingAuditCell } from '@/components/booking/BookingAuditCell';
import {
  buildBookingAuditPatch,
  fetchTeamAuditProfile,
  updateBookingAudit,
  type TeamAuditProfile,
} from '@/lib/bookingAudit';
import { TicketBookingTourDisplay } from '@/components/booking/TicketBookingTourDisplay';
import { formatTicketBookingTourHeadline } from '@/lib/ticket-booking-tour-display';
import { TicketBookingChangeStack } from '@/components/booking/TicketBookingChangeStack';
import {
  getTicketBookingExpenseStack,
  getTicketBookingQtyStack,
  getTicketBookingTimeStack,
} from '@/lib/ticket-booking-change-display';
import {
  Grid,
  Calendar as CalendarIcon,
  Plus,
  ListPlus,
  Search,
  Calendar,
  Table,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Paperclip,
  ImageOff,
  Trash2,
  Archive,
  FileUp,
  AlertTriangle,
  PencilLine,
  Check,
  ListChecks,
  Merge,
  X,
} from 'lucide-react';
import TicketBookingsNeedCheckModal from './TicketBookingsNeedCheckModal';
import TicketBookingAxisDiagram from './TicketBookingAxisDiagram';
import {
  TicketBookingAxesEditorDialog,
  normalizeTicketBookingAxisPatchFromSnapshot,
} from './TicketBookingAxesEditor';
import TicketBookingQtyTimeChangeModal from './TicketBookingQtyTimeChangeModal';
import TicketBookingPaymentCompleteModal from './TicketBookingPaymentCompleteModal';
import TicketBookingVendorConfirmModal from './TicketBookingVendorConfirmModal';
import TicketBookingVendorPartialChangeConfirmModal from './TicketBookingVendorPartialChangeConfirmModal';
import TicketBookingStatusMultiFilter from './TicketBookingStatusMultiFilter';
import {
  ticketBookingMatchesStatusFilters,
  type TicketBookingStatusFilterKey,
} from '@/lib/ticketBookingStatusFilter';
import TicketBookingLinkTourModal from './TicketBookingLinkTourModal';
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent';
import {
  getCancelDeadlineDays,
  getCancelDueDateForTicketBooking,
  isTicketBookingCancelDueStaleBeforeCheckIn,
  type SeasonDate,
} from '@/lib/ticketBookingCancelDue';
import { normalizeReservationIds, isReservationCancelledStatus } from '@/utils/tourUtils';
import { isTourCancelled } from '@/utils/tourStatusUtils';
import {
  aggregateTourChoiceCounts,
  choiceLabelToTourCountKey,
  tourChoiceCountsHasDisplayable,
  type ReservationChoiceRow,
  type TourChoiceCounts,
} from '@/lib/tourChoiceCounts';
import {
  buildTicketDateViewGroups,
  formatCanyonCountsInline,
  type TicketDateViewBookingRow,
  type TicketDateViewGroup,
} from '@/lib/ticketBookingDateView';
import { TICKET_BOOKING_STATEMENT_DAY_WINDOW } from '@/lib/expense-reconciliation-similar-lines';
import {
  fetchTicketDateViewReconForDates,
  type DateViewLedgerRow,
  type TicketDateViewReconBundle,
} from '@/lib/ticketBookingDateViewRecon';
import { TicketBookingDateViewReconPanel } from '@/components/booking/TicketBookingDateViewReconPanel';
import { ticketBookingLineTotalUsd } from '@/lib/bookingSettlement';
import { computeTicketBookingVendorPeriodStats } from '@/lib/ticketBookingVendorPeriodStats';
import TicketBookingVendorPeriodStatsPanel from '@/components/booking/TicketBookingVendorPeriodStatsPanel';
import { fetchUploadApi } from '@/lib/uploadClient';
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState';
import type { TicketBookingLike } from '@/utils/ticketInvoiceParse';
import {
  SCHEDULE_COLOR_PRESETS,
  getScheduleProductDisplayProps,
} from '@/lib/scheduleProductColorPresets';
import {
  TICKET_BOOKING_STATUS_VALUES,
  formatTicketBookingStatusLabel,
  getTicketBookingStatusBadgeClass,
} from '@/lib/ticketBookingStatus';
import {
  applyTicketBookingSetAxes,
  applyTicketBookingWorkflowAction,
  type TicketBookingAxisPatch,
} from '@/lib/ticketBookingActions';
import {
  TICKET_BOOKING_AXIS_SELECT_ORDER,
  formatTicketBookingAxisLabel,
  getBookingAxisStatusBadgeClass,
  getChangeAxisStatusBadgeClass,
  getVendorAxisStatusBadgeClass,
} from '@/lib/ticketBookingAxisLabels';
import {
  TicketBookingBookingStatusIcon,
  TicketBookingVendorStatusIcon,
} from '@/components/booking/ticketBookingAxisStatusIcons';
import {
  formatEaMarginUsdArrow,
  formatExpenseArrow,
  formatQtyArrow,
  formatTimeArrow,
  isTicketBookingPendingRequestState,
  isWorkflowInitialPhase,
  showChangeRequestButton,
  showPaymentCompleteButton,
  showRefundLineManagement,
  showVendorChangeActions,
  showVendorInitialActions,
  ticketBookingHasMultiplePendingChanges,
  ticketBookingPendingExpenseDiffers,
  ticketBookingPendingQtyDiffers,
  ticketBookingPendingTimeDiffers,
} from '@/lib/ticketBookingWorkflow';

/** 로컬 달력 YYYY-MM-DD (달력 칸 기준과 투어 기간 교차 판별용) */
function localYmdFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [yRaw, moRaw, dRaw] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(yRaw || 1970, (moRaw || 1) - 1, dRaw || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return localYmdFromDate(dt);
}

function ymdFromDbDate(s: string | null | undefined): string {
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function localYmdFromTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return localYmdFromDate(d);
}

/**
 * 그랜드서클 멀티나잇 상품: 달력 칸 수를 DB 종료일과 무관하게 고정 (1박2일→2칸 …).
 * ScheduleView `getMultiDayTourDays`와 동일한 product_id 규칙.
 */
function ticketCalendarTourFixedSpanDays(productId: string | null | undefined): number | null {
  const pid = (productId || '').trim();
  if (!pid) return null;
  if (pid.startsWith('MNGC1N') || pid.startsWith('MNM1')) return 2;
  if (pid.startsWith('MNGC2N')) return 3;
  if (pid.startsWith('MNGC3N')) return 4;
  return null;
}

function tourCalendarSpanEndYmd(tour: {
  tour_date: string;
  tour_end_datetime?: string | null;
  product_id?: string | null;
}): string {
  const start = ymdFromDbDate(tour.tour_date);
  if (!start) return '';

  const fixedDays = ticketCalendarTourFixedSpanDays(tour.product_id);
  if (fixedDays !== null && fixedDays >= 1) {
    return addCalendarDaysYmd(start, fixedDays - 1);
  }

  if (tour.tour_end_datetime) {
    const end = localYmdFromTimestamp(String(tour.tour_end_datetime));
    if (!end) return start;
    return end < start ? start : end;
  }
  return start;
}

function tourOverlapsCalendarYmd(
  tour: { tour_date: string; tour_end_datetime?: string | null; product_id?: string | null },
  dateYmd: string
): boolean {
  const start = ymdFromDbDate(tour.tour_date);
  const end = tourCalendarSpanEndYmd(tour);
  if (!start || !end || !dateYmd) return false;
  return dateYmd >= start && dateYmd <= end;
}

function tourSpanIntersectsGrid(
  tour: { tour_date: string; tour_end_datetime?: string | null; product_id?: string | null },
  gridStartYmd: string,
  gridEndYmd: string
): boolean {
  const start = ymdFromDbDate(tour.tour_date);
  const end = tourCalendarSpanEndYmd(tour);
  if (!start || !end) return false;
  return start <= gridEndYmd && end >= gridStartYmd;
}

/** 입장권 부킹 달력에 표시하는 투어(상품 product_id)만 */
const TICKET_CALENDAR_TOUR_PRODUCT_IDS: string[] = [
  'MDGCSUNRISE',
  'MDGC1D',
  'MNGC1N',
  'MNGC2N',
  'MNGC3N',
  'MNCUSTOM',
  'MNM1',
  'MDGC1DPRVT',
  'MDGCSUNRPRVT',
  'MNGC1NPRVT',
  'MNGC2NPRVT',
];

/** RN#별 테이블 뷰에서 그룹을 시각적으로 구분 */
const RN_TABLE_GROUP_STYLES: Array<{
  headerRow: string;
  rowStripe: string;
  mobileSection: string;
  mobileHeader: string;
}> = [
  {
    headerRow: 'bg-indigo-100 border-y border-indigo-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-indigo-600',
    mobileSection: 'rounded-xl border-2 border-indigo-200 bg-indigo-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-indigo-100 border-b-2 border-indigo-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-emerald-100 border-y border-emerald-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-emerald-600',
    mobileSection: 'rounded-xl border-2 border-emerald-200 bg-emerald-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-emerald-100 border-b-2 border-emerald-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-amber-100 border-y border-amber-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-amber-600',
    mobileSection: 'rounded-xl border-2 border-amber-200 bg-amber-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-amber-100 border-b-2 border-amber-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-rose-100 border-y border-rose-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-rose-600',
    mobileSection: 'rounded-xl border-2 border-rose-200 bg-rose-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-rose-100 border-b-2 border-rose-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-violet-100 border-y border-violet-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-violet-600',
    mobileSection: 'rounded-xl border-2 border-violet-200 bg-violet-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-violet-100 border-b-2 border-violet-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-sky-100 border-y border-sky-200 shadow-sm',
    rowStripe: 'border-l-[6px] border-sky-600',
    mobileSection: 'rounded-xl border-2 border-sky-200 bg-sky-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-sky-100 border-b-2 border-sky-300 px-3 py-2.5',
  },
];

interface TicketBooking {
  id: string;
  tour_id?: string;
  /** `reservations.id` — 예약자명은 별도 조회해 `reservation_name`에 채움 */
  reservation_id?: string | null;
  submit_on: string;
  check_in_date: string;
  time: string;
  category: string;
  ea: number;
  /** UI용: `reservation_id` → customers.name 조회 결과 (DB 컬럼 아님) */
  reservation_name?: string;
  submitted_by: string;
  /** UI 호환: ticket_bookings에 cc 컬럼 없음 — 미설정 시 배지만 기본값 */
  cc?: string;
  /** UI 호환: DB 컬럼 없음 — income/paid_amount 등에서 파생 */
  unit_price?: number;
  total_price?: number;
  expense?: number;
  income?: number;
  paid_amount?: number | null;
  payment_method: string;
  /** UI 호환: ticket_bookings에 website 컬럼 없음 */
  website?: string;
  rn_number: string;
  note?: string | null;
  invoice_number?: string;
  /** Zelle 결제 시 Confirmation 번호 */
  zelle_confirmation_number?: string | null;
  uploaded_file_urls?: string[] | null;
  status: string;
  /** 액션 엔진 다축 상태 (마이그레이션 후 DB 컬럼) */
  booking_status?: string | null;
  vendor_status?: string | null;
  change_status?: string | null;
  payment_status?: string | null;
  refund_status?: string | null;
  operation_status?: string | null;
  pending_ea?: number | null;
  pending_time?: string | null;
  booking_status_before_change?: string | null;
  company: string;
  created_at: string;
  updated_at: string;
  /** `TicketBookingLike` 및 exactOptionalPropertyTypes와 동일한 형태 유지 */
  tours?: {
    tour_date: string;
    total_people?: number;
    products?: {
      name?: string;
      name_ko?: string;
      name_en?: string;
    };
    guide_display_name?: string;
    assistant_display_name?: string;
    vehicle_display_name?: string;
    choice_counts?: TourChoiceCounts;
  };
  deletion_requested_at?: string | null;
  deletion_requested_by?: string | null;
  audited?: boolean | null;
  audited_at?: string | null;
  audited_by_email?: string | null;
  audited_by_name?: string | null;
  audited_by_nick_name?: string | null;
}

function bookingCheckInYmd(booking: TicketBooking): string {
  const raw = (booking.check_in_date ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return localYmdFromDate(d);
}

function bookingSubmitOnYmd(booking: TicketBooking): string {
  const raw = (booking.submit_on ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return localYmdFromTimestamp(raw);
}

type TicketBookingDateRangeBasis = 'check_in' | 'submit_on';

function bookingPeriodYmd(booking: TicketBooking, basis: TicketBookingDateRangeBasis): string {
  return basis === 'submit_on' ? bookingSubmitOnYmd(booking) : bookingCheckInYmd(booking);
}

/** 체크인 기간 필터 — 연도 프리셋 (입장권 부킹 관리) */
const TICKET_CHECK_IN_YEAR_PRESETS = [2025, 2026] as const;

function ticketCheckInYearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function isTicketCheckInYearPresetActive(from: string, to: string, year: number): boolean {
  const { from: yFrom, to: yTo } = ticketCheckInYearRange(year);
  return from === yFrom && to === yTo;
}

/** ticket_bookings에는 unit_price/total_price 컬럼 없음 — 목록·합계용으로 파생 */
function deriveTicketBookingListFields(row: TicketBooking): TicketBooking {
  const n = (v: unknown): number | null => {
    const x = typeof v === 'number' ? v : v != null ? Number(v) : NaN;
    return Number.isFinite(x) ? x : null;
  };
  const eaNum = Math.max(1, n(row.ea) ?? 1);
  let total = n(row.total_price);
  if (total == null) {
    const line = ticketBookingLineTotalUsd(row);
    if (line !== 0) total = line;
  }
  let unit = n(row.unit_price);
  if (unit == null && total != null) unit = total / eaNum;
  if (total == null && unit == null) return row;
  return {
    ...row,
    ...(total != null ? { total_price: total } : {}),
    ...(unit != null ? { unit_price: unit } : {}),
  };
}

function isTicketBookingCountingStatus(booking: TicketBooking): boolean {
  const s = String(booking.status || '').toLowerCase();
  return s !== 'cancelled' && s !== 'canceled';
}

/** company + Invoice# 로 인보이스 첨부를 묶는 키 */
function makeInvoiceKey(company: string, invoiceNumber: string): string {
  return `${company.trim()}\u0000${invoiceNumber.trim()}`;
}

/** ticket_invoice_attachments 조회/저장 시 company 문자열을 한 방식으로 맞춤 (trim 불일치 시 .in()으로 행을 못 찾는 문제 방지) */
function invoiceCompanyNorm(company: string | null | undefined): string {
  return (company ?? '').trim();
}

/** RN 그룹 헤더·구분선 colSpan (명세 열 포함) */
const TICKET_DESKTOP_TABLE_COL_COUNT = 17
const TICKET_TABLE_TH =
  'px-2 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap'
const TICKET_TABLE_TD = 'align-middle px-2 py-2 text-[11px] text-gray-900'
const TICKET_TABLE_CELL = TICKET_TABLE_TD
const TICKET_TABLE_CLIP = 'block min-w-0 max-w-full truncate'

/** 데스크톱 행 Cancel Due 날짜별 배경·호버 (테이블·상세 모달 공통) */
const TICKET_TABLE_CANCEL_DUE_BG = [
  'bg-white',
  'bg-blue-50',
  'bg-green-50',
  'bg-yellow-50',
  'bg-purple-50',
  'bg-pink-50',
  'bg-indigo-50',
  'bg-cyan-50',
] as const
const TICKET_TABLE_CANCEL_DUE_HOVER = [
  'hover:bg-gray-50',
  'hover:bg-blue-100',
  'hover:bg-green-100',
  'hover:bg-yellow-100',
  'hover:bg-purple-100',
  'hover:bg-pink-100',
  'hover:bg-indigo-100',
  'hover:bg-cyan-100',
] as const

export type TicketRefundLineRow = {
  id: string
  anchor_booking_id: string
  status: string
  amount: number | null
  ea: number | null
  note: string | null
}

function normalizeDbFileUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw))
    return raw.filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  return [];
}

/** Ctrl+V 붙여넣기: 클립보드에서 파일(스크린샷 이미지 등)만 추출 */
function isImageAttachmentUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
}

function clipboardFilesFromPasteEvent(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = e.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (out.length === 0 && e.clipboardData?.files?.length) {
    return Array.from(e.clipboardData.files);
  }
  return out;
}

/** Invoice# 입력 후 첨부 조회까지 대기 (타이핑마다 Supabase·부모 리렌더 방지) */
const INVOICE_DRAFT_LOAD_DEBOUNCE_MS = 650;

type TicketInvoiceDraftInputProps = {
  initialInvoice: string;
  draftRef: React.MutableRefObject<string>;
  company: string;
  disabled?: boolean;
  onDebouncedLoad: (company: string, draft: string) => void | Promise<void>;
  onEnterSave: () => void;
};

function TicketInvoiceDraftInput({
  initialInvoice,
  draftRef,
  company,
  disabled,
  onDebouncedLoad,
  onEnterSave,
}: TicketInvoiceDraftInputProps) {
  const inv0 = initialInvoice?.trim() || '';
  const [value, setValue] = useState(inv0);
  useEffect(() => {
    draftRef.current = value;
  }, [value, draftRef]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      void onDebouncedLoad(company, value);
    }, INVOICE_DRAFT_LOAD_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [company, value, onDebouncedLoad]);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      placeholder="Invoice 번호"
      autoFocus
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnterSave();
      }}
    />
  );
}

type TicketInvoiceInlineCellProps = {
  bookingId: string;
  initialInvoice: string;
  saving?: boolean;
  onSave: (bookingId: string, invoiceNumber: string) => void | Promise<void>;
};

/** 테이블 Inv# 셀 — 클릭 시 편집 모달 없이 숫자만 바로 입력 */
function TicketInvoiceInlineCell({
  bookingId,
  initialInvoice,
  saving,
  onSave,
}: TicketInvoiceInlineCellProps) {
  const inv0 = initialInvoice?.trim() || '';
  const [value, setValue] = useState(inv0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setValue(inv0);
  }, [inv0, focused]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed === inv0) return;
    void onSave(bookingId, trimmed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        e.stopPropagation();
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={`w-full min-w-[3.5rem] max-w-[6.5rem] rounded border px-1.5 py-0.5 tabular-nums text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${
        value.trim() ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
      }`}
      placeholder="—"
      title="Invoice # (숫자 입력 · Enter 또는 포커스 아웃 시 저장)"
      aria-label="Invoice number"
    />
  );
}

function sortBookingsByCheckInThenTime(a: TicketBooking, b: TicketBooking): number {
  const da = a.check_in_date ? new Date(a.check_in_date).getTime() : 0;
  const db = b.check_in_date ? new Date(b.check_in_date).getTime() : 0;
  if (da !== db) return da - db;
  const c = (a.time || '').localeCompare(b.time || '');
  if (c !== 0) return c;
  return a.id.localeCompare(b.id);
}

/**
 * RN#별 테이블: 체크인 날짜·시간 순으로 정렬한 뒤 RN#으로 묶음.
 * RN#이 비어 있으면 행마다 별도 그룹(라벨은 모두 "RN# 없음").
 */
function buildTicketRnGroups(bookings: TicketBooking[]): { key: string; label: string; rows: TicketBooking[] }[] {
  const dateSorted = [...bookings].sort(sortBookingsByCheckInThenTime);

  const map = new Map<string, TicketBooking[]>();
  for (const b of dateSorted) {
    const k = ticketBookingRnGroupKey(b);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  }

  const groups = [...map.entries()].map(([key, rows]) => {
    const rowsSorted = [...rows].sort(sortBookingsByCheckInThenTime);
    const label = key.startsWith('__empty_rn__:') ? 'RN# 없음' : key;
    const first = rowsSorted[0];
    const groupSortKey = `${first.check_in_date || ''}\0${first.time || ''}\0${first.id}\0${key}`;
    return { key, label, rows: rowsSorted, groupSortKey };
  });

  groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
  return groups.map(({ key, label, rows }) => ({ key, label, rows }));
}

/** 투어별 테이블: `tour_id`로 묶음. 미연결 행은 한 그룹으로 표시 */
function buildTicketTourGroups(
  bookings: TicketBooking[],
  locale: string,
  tourFallback: string
): { key: string; label: string; rows: TicketBooking[] }[] {
  const dateSorted = [...bookings].sort(sortBookingsByCheckInThenTime);
  const linked = new Map<string, TicketBooking[]>();
  const unlinked: TicketBooking[] = [];

  for (const b of dateSorted) {
    const tid = b.tour_id?.trim();
    if (!tid) {
      unlinked.push(b);
      continue;
    }
    if (!linked.has(tid)) linked.set(tid, []);
    linked.get(tid)!.push(b);
  }

  const groups: { key: string; label: string; rows: TicketBooking[]; groupSortKey: string }[] = [];

  for (const [tid, rows] of linked.entries()) {
    const rowsSorted = [...rows].sort(sortBookingsByCheckInThenTime);
    const first = rowsSorted[0]!;
    const headline =
      formatTicketBookingTourHeadline(locale, first.tours, tourFallback, { appendPeople: true }) ||
      (locale.startsWith('ko') ? `투어 (${tid.slice(0, 8)}…)` : `Tour (${tid.slice(0, 8)}…)`);
    const groupSortKey = `${first.tours?.tour_date || first.check_in_date || ''}\0${headline}\0${tid}`;
    groups.push({ key: `tour:${tid}`, label: headline, rows: rowsSorted, groupSortKey });
  }

  if (unlinked.length > 0) {
    const rowsSorted = [...unlinked].sort(sortBookingsByCheckInThenTime);
    const label = locale.startsWith('ko') ? '투어 미연결' : 'Tour not linked';
    groups.push({
      key: '__unlinked__',
      label,
      rows: rowsSorted,
      groupSortKey: `\uffff${label}`,
    });
  }

  groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
  return groups.map(({ key, label, rows }) => ({ key, label, rows }));
}

interface TourEvent {
  id: string;
  tour_date: string;
  tour_end_datetime?: string | null;
  tour_status?: string | null;
  product_id?: string | null;
  reservation_ids: string[];
  total_reservations: number;
  total_people: number;
  adults: number;
  child: number;
  infant: number;
  tour_guide_id?: string | null;
  assistant_id?: string | null;
  /** team 조회 후 표시용 */
  guide_display_name?: string;
  assistant_display_name?: string;
  products?: {
    name: string;
    name_en?: string;
  };
}

/** 수량·시간 변경 요청 진행 중(`change_status === requested`) */
function isTicketBookingChangeRequestPending(booking: Pick<TicketBooking, 'change_status'>): boolean {
  return String(booking.change_status ?? 'none').toLowerCase().trim() === 'requested';
}

/** 변경 요청 중이면 예약(확정) 뱃지 대신 변경 축만 표시 */
function showChangeAxisInsteadOfBookingStatus(
  booking: Pick<TicketBooking, 'change_status' | 'booking_status' | 'vendor_status'>
): boolean {
  return isTicketBookingChangeRequestPending(booking);
}

function hasSecondaryChangeAxisBadge(
  booking: Pick<TicketBooking, 'change_status' | 'booking_status' | 'vendor_status'>
): boolean {
  if (showChangeAxisInsteadOfBookingStatus(booking)) return false;
  if (isWorkflowInitialPhase(booking)) return false;
  return String(booking.change_status ?? 'none').toLowerCase() !== 'none';
}

function ticketCalendarProductKey(tour: TourEvent): string {
  const pid = (tour.product_id || '').trim();
  if (pid) return `pid:${pid}`;
  const n = (tour.products?.name || tour.products?.name_en || '').trim();
  return `name:${n || '_'}`;
}

function ticketCalendarProductPaletteIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % SCHEDULE_COLOR_PRESETS.length;
}

/** 스케줄 뷰에 저장된 상품 색(프리셋 id 또는 레거시 클래스), 없으면 상품키 해시로 프리셋 선택 */
function ticketCalendarTourChipDisplayProps(
  tour: TourEvent,
  scheduleProductColors: Record<string, string>
): { style?: React.CSSProperties; className?: string } {
  const pk = ticketCalendarProductKey(tour);
  const pid = (tour.product_id || '').trim();
  const saved = pid ? scheduleProductColors[pid] : undefined;
  const props = getScheduleProductDisplayProps(saved);
  if (props.style || props.className) return props;
  const preset = SCHEDULE_COLOR_PRESETS[ticketCalendarProductPaletteIndex(pk)]!;
  return { style: { backgroundColor: preset.bgHex, color: preset.textHex } };
}

function ticketCalendarLegendChipDisplayProps(
  productId: string | null,
  legendKey: string,
  scheduleProductColors: Record<string, string>
): { style?: React.CSSProperties; className?: string } {
  const pid = (productId || '').trim();
  const saved = pid ? scheduleProductColors[pid] : undefined;
  const props = getScheduleProductDisplayProps(saved);
  if (props.style || props.className) return props;
  const preset = SCHEDULE_COLOR_PRESETS[ticketCalendarProductPaletteIndex(legendKey)]!;
  return { style: { backgroundColor: preset.bgHex, color: preset.textHex } };
}

/** 공급업체 이름이 See Canyon 계열이면 달력·목록 칩을 하늘색으로 고정 */
function isSeeCanyonSupplierCompany(company: string | null | undefined): boolean {
  const k = (company || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!k) return false;
  return k === 'see canyon' || k.includes('see canyon');
}

/** 티켓 부킹 공급처(company)별 구분색 — 스케줄 프리셋 팔레트와 동일 소스, 문자열 해시로 고정 */
function ticketBookingSupplierColors(company: string | null | undefined): {
  backgroundColor: string;
  color: string;
} {
  if (isSeeCanyonSupplierCompany(company)) {
    return { backgroundColor: '#e0f2fe', color: '#0c4a6e' };
  }
  const key = (company || '').trim().toLowerCase() || '__none__';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const preset = SCHEDULE_COLOR_PRESETS[h % SCHEDULE_COLOR_PRESETS.length]!;
  return { backgroundColor: preset.bgHex, color: preset.textHex };
}

/** 달력 주(0–5)별 투어 가로 세그먼트 — 멀티데이는 한 박스로 이어짐 */
type TicketCalendarWeekTourSeg = {
  tour: TourEvent;
  weekRow: number;
  startCol: number;
  endCol: number;
};

function intervalOverlapsCols(a0: number, a1: number, b0: number, b1: number): boolean {
  return !(a1 < b0 || b1 < a0);
}

function assignTicketCalendarTourLanes(
  segments: TicketCalendarWeekTourSeg[]
): Array<TicketCalendarWeekTourSeg & { lane: number }> {
  const sorted = [...segments].sort(
    (a, b) =>
      a.startCol - b.startCol || a.endCol - a.startCol - (b.endCol - b.startCol)
  );
  const laneIntervals: { startCol: number; endCol: number }[][] = [];
  const out: Array<TicketCalendarWeekTourSeg & { lane: number }> = [];
  for (const seg of sorted) {
    let laneIdx = 0;
    while (laneIdx < laneIntervals.length) {
      const lane = laneIntervals[laneIdx]!;
      const conflict = lane.some((iv) =>
        intervalOverlapsCols(iv.startCol, iv.endCol, seg.startCol, seg.endCol)
      );
      if (!conflict) break;
      laneIdx++;
    }
    if (laneIdx === laneIntervals.length) laneIntervals.push([]);
    laneIntervals[laneIdx]!.push({ startCol: seg.startCol, endCol: seg.endCol });
    out.push({ ...seg, lane: laneIdx });
  }
  return out;
}

function buildTicketCalendarTourSegmentsByWeek(
  tours: TourEvent[],
  calendarDays: Date[],
  gridStartYmd: string,
  gridEndYmd: string
): Map<number, TicketCalendarWeekTourSeg[]> {
  const byWeek = new Map<number, TicketCalendarWeekTourSeg[]>();
  for (let w = 0; w < 6; w++) byWeek.set(w, []);

  for (const tour of tours) {
    if (!tourSpanIntersectsGrid(tour, gridStartYmd, gridEndYmd)) continue;
    const start = ymdFromDbDate(tour.tour_date);
    const end = tourCalendarSpanEndYmd(tour);
    if (!start || !end) continue;
    const clipStart = start > gridStartYmd ? start : gridStartYmd;
    const clipEnd = end < gridEndYmd ? end : gridEndYmd;
    if (clipStart > clipEnd) continue;

    const indices: number[] = [];
    for (let i = 0; i < calendarDays.length; i++) {
      const ymd = localYmdFromDate(calendarDays[i]!);
      if (ymd >= clipStart && ymd <= clipEnd) indices.push(i);
    }
    if (indices.length === 0) continue;

    const byRow = new Map<number, number[]>();
    for (const i of indices) {
      const row = Math.floor(i / 7);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(i);
    }
    for (const [row, idxs] of byRow) {
      const cols = idxs.map((i) => i % 7);
      const startCol = Math.min(...cols);
      const endCol = Math.max(...cols);
      byWeek.get(row)!.push({ tour, weekRow: row, startCol, endCol });
    }
  }

  return byWeek;
}

const TICKET_CAL_DATE_ROW_PX = 22;
/** 오버레이 그리드 행 최소 높이 (예전 15px대에 맞춘 컴팩트 높이) */
const TICKET_CAL_TOUR_LANE_MIN_PX = 15;
/** 레인 사이 세로 간격 (그리드 row-gap과 cellPadTop 계산에 동일 적용) */
const TICKET_CAL_TOUR_LANE_GAP_PX = 2;
/**
 * 셀 paddingTop용 레인당 예약 높이. 라벨은 얇게 두되 minmax(MIN, auto) 확장·한 줄 줄바꿈 시에도 요약과 안 겹치게 소량 버퍼.
 */
const TICKET_CAL_TOUR_LANE_RESERVE_PX = 30;
/** 투어 스트립 아래 예약 블록까지 추가 간격 */
const TICKET_CAL_TOUR_STRIP_TAIL_PX = 8;

/** 부킹 관리 초기 로드: 오래된 행 제외(전량 스캔·전송 부담 완화). 약 2년+1개월. */
const TICKET_BOOKING_LIST_SUBMIT_ON_LOOKBACK_DAYS = 790;

function ticketBookingListSubmitOnLowerBoundYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - TICKET_BOOKING_LIST_SUBMIT_ON_LOOKBACK_DAYS);
  d.setHours(12, 0, 0, 0);
  return localYmdFromDate(d);
}

function ticketCalendarCellPadTopForTourStrip(stripRows: number): number {
  if (stripRows <= 0) return TICKET_CAL_DATE_ROW_PX + 4;
  const stripBody =
    stripRows * TICKET_CAL_TOUR_LANE_RESERVE_PX +
    Math.max(0, stripRows - 1) * TICKET_CAL_TOUR_LANE_GAP_PX +
    TICKET_CAL_TOUR_STRIP_TAIL_PX;
  return TICKET_CAL_DATE_ROW_PX + stripBody;
}

function mergeTicketBookingAxesFromRpcRow(
  b: TicketBooking,
  row: Record<string, unknown>
): TicketBooking {
  const next: TicketBooking = {
    ...b,
    rn_number:
      typeof row.rn_number === 'string'
        ? row.rn_number
        : row.rn_number === null
          ? ''
          : b.rn_number,
    status: typeof row.status === 'string' ? row.status : b.status,
    booking_status:
      typeof row.booking_status === 'string' ? row.booking_status : (b.booking_status ?? null),
    vendor_status:
      typeof row.vendor_status === 'string' ? row.vendor_status : (b.vendor_status ?? null),
    change_status:
      typeof row.change_status === 'string' ? row.change_status : (b.change_status ?? null),
    payment_status:
      typeof row.payment_status === 'string' ? row.payment_status : (b.payment_status ?? null),
    refund_status:
      typeof row.refund_status === 'string' ? row.refund_status : (b.refund_status ?? null),
    operation_status:
      typeof row.operation_status === 'string' ? row.operation_status : (b.operation_status ?? null),
    pending_ea:
      typeof row.pending_ea === 'number'
        ? row.pending_ea
        : row.pending_ea === null
          ? null
          : b.pending_ea,
    pending_time:
      typeof row.pending_time === 'string'
        ? row.pending_time
        : row.pending_time === null
          ? null
          : b.pending_time,
    booking_status_before_change:
      typeof row.booking_status_before_change === 'string'
        ? row.booking_status_before_change
        : row.booking_status_before_change === null
          ? null
          : b.booking_status_before_change,
    ea: typeof row.ea === 'number' ? row.ea : b.ea,
    time: typeof row.time === 'string' ? row.time : b.time,
  };
  if (typeof row.expense === 'number') next.expense = row.expense;
  if (typeof row.paid_amount === 'number') next.paid_amount = row.paid_amount;
  else if (row.paid_amount === null) next.paid_amount = null;
  return next;
}

/** 달력 RN 칩 호버: 테이블과 동일한 축 뱃지 + 변경 요청 시 시간·수량 전후 */
function TicketCalendarRnBookingChipTooltip({
  rows,
  locale,
  tAxis,
  tAct,
  titleLine,
  supplierStyle,
  chipClassName,
  onClick,
  children,
}: {
  rows: TicketBooking[];
  locale: string;
  tAxis: (key: string) => string;
  tAct: (key: string) => string;
  titleLine: string;
  supplierStyle: { backgroundColor: string; color: string };
  chipClassName: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const show = () => {
    clearHide();
    setOpen(true);
  };
  const hideSoon = () => {
    clearHide();
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    return () => clearHide();
  }, []);

  return (
    <div
      className={`relative min-w-0 ${open ? 'z-[40]' : 'z-0'}`}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        type="button"
        className={`font-inherit text-inherit ${chipClassName}`}
        style={{
          backgroundColor: supplierStyle.backgroundColor,
          color: supplierStyle.color,
        }}
        aria-label={titleLine}
        onClick={onClick}
      >
        {children}
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-[100] mb-1 min-w-[15rem] max-w-[min(94vw,22rem)]"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
        >
          <div
            className="rounded-lg border border-gray-200 bg-white p-2.5 text-left shadow-xl ring-1 ring-black/5"
            role="tooltip"
          >
            <div className="mb-2 border-b border-gray-100 pb-2 text-[10px] font-medium leading-snug text-gray-600">
              {titleLine}
            </div>
            <div className="space-y-3">
              {rows.map((b) => {
                const changePending = isTicketBookingChangeRequestPending(b);
                const cs = String(b.change_status ?? 'none').toLowerCase();
                const showChangeBadge = !isWorkflowInitialPhase(b) && cs !== 'none';
                return (
                  <div
                    key={b.id}
                    className="space-y-1.5 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      {changePending ? (
                        <span
                          className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getChangeAxisStatusBadgeClass(b.change_status)}`}
                        >
                          {formatTicketBookingAxisLabel(tAxis, 'change', b.change_status)}
                        </span>
                      ) : (
                        <>
                          <span
                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBookingAxisStatusBadgeClass(b.booking_status)}`}
                          >
                            <TicketBookingBookingStatusIcon
                              status={b.booking_status}
                              className="h-3 w-3 shrink-0"
                              title={formatTicketBookingAxisLabel(tAxis, 'booking', b.booking_status)}
                            />
                            <span className="truncate">
                              {formatTicketBookingAxisLabel(tAxis, 'booking', b.booking_status)}
                            </span>
                          </span>
                          <span
                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getVendorAxisStatusBadgeClass(b.vendor_status)}`}
                          >
                            <TicketBookingVendorStatusIcon
                              status={b.vendor_status}
                              className="h-3 w-3 shrink-0"
                              title={formatTicketBookingAxisLabel(tAxis, 'vendor', b.vendor_status)}
                            />
                            <span className="truncate">
                              {formatTicketBookingAxisLabel(tAxis, 'vendor', b.vendor_status)}
                            </span>
                          </span>
                          {showChangeBadge ? (
                            <span
                              className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getChangeAxisStatusBadgeClass(b.change_status)}`}
                            >
                              {formatTicketBookingAxisLabel(tAxis, 'change', b.change_status)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                    {changePending ? (
                      <div className="space-y-1 rounded-md bg-red-50 px-2 py-1.5 ring-1 ring-red-200">
                        <div className="text-[10px] font-semibold text-red-800">
                          {locale.startsWith('en') ? 'Pending changes' : '변경 내용'}
                        </div>
                        <div className="text-[10px] font-medium text-gray-900">
                          <span className="text-red-700">
                            {locale.startsWith('en') ? 'Time' : '시간'}
                          </span>{' '}
                          <span className="tabular-nums">{formatTimeArrow(b)}</span>
                        </div>
                        <div className="text-[10px] font-medium text-gray-900">
                          <span className="text-red-700">
                            {locale.startsWith('en') ? 'Quantity' : '수량'}
                          </span>{' '}
                          <span className="tabular-nums">{formatQtyArrow(b)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[10px] font-medium text-gray-900">
                        <div>
                          <span className="text-gray-500">
                            {locale.startsWith('en') ? 'Time' : '시간'}
                          </span>{' '}
                          <span className="tabular-nums">{formatTimeArrow(b)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">
                            {locale.startsWith('en') ? 'Quantity' : '수량'}
                          </span>{' '}
                          <span className="tabular-nums">{formatQtyArrow(b)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-gray-600">
                      <span>
                        {tAct('axisPayment')}{' '}
                        {formatTicketBookingAxisLabel(tAxis, 'payment', b.payment_status)}
                      </span>
                      <span>
                        {tAct('axisRefund')}{' '}
                        {formatTicketBookingAxisLabel(tAxis, 'refund', b.refund_status)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 테이블 축 드롭다운 저장 후 Ctrl+Z 되돌리기 스택 최대 길이 */
const TICKET_TABLE_AXES_UNDO_STACK_MAX = 50;

export default function TicketBookingList() {
  const locale = useLocale();
  const { user, userPosition, permissions } = useAuth();
  const canSuperDeleteTicketBooking = useMemo(
    () => isSuperAdminActor(user?.email, userPosition),
    [user?.email, userPosition]
  );
  const canBookingMgmtSoftDeleteUi = useMemo(
    () => canShowTicketBookingSoftDeleteUi(userPosition, permissions?.canManageBookings),
    [userPosition, permissions?.canManageBookings]
  );
  const t = useTranslations('booking.calendar');
  const tAudit = useTranslations('booking.audit');
  const tTbAxis = useTranslations('booking.calendar.ticketBookingAxis');
  const tTbActUi = useTranslations('booking.calendar.ticketBookingActions');
  /** useMemo 의존성용 — `t` 함수 참조는 렌더마다 바뀌어 무한 effect를 유발할 수 있음 */
  const tourFallbackLabel = locale.startsWith('ko') ? '투어' : 'Tour';
  const [bookings, setBookings] = useState<TicketBooking[]>([]);
  const bookingsRef = useRef<TicketBooking[]>([]);
  bookingsRef.current = bookings;
  const fetchBookingsRef = useRef<() => Promise<void>>(async () => {});
  const fetchBookingsGenRef = useRef(0);
  const tableAxesUndoStackRef = useRef<{ bookingId: string; patch: TicketBookingAxisPatch }[]>([]);
  const [loading, setLoading] = useState(true);
  /** 첫 페이지를 그린 뒤 나머지 페이지·메타 정보를 백그라운드에서 채우는 동안 true */
  const [enriching, setEnriching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletionReviewOpen, setDeletionReviewOpen] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TicketBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<
    Set<TicketBookingStatusFilterKey>
  >(() => new Set());
  const [checkInDateFrom, setCheckInDateFrom] = useState('');
  const [checkInDateTo, setCheckInDateTo] = useState('');
  const [tourFilter, setTourFilter] = useState('all'); // 'all', 'connected', 'unconnected'
  const [companyFilter, setCompanyFilter] = useRoutePersistedState<string>(
    'ticket-bookings-company-filter',
    'all'
  );
  const [dateRangeBasis, setDateRangeBasis] = useRoutePersistedState<TicketBookingDateRangeBasis>(
    'ticket-bookings-date-range-basis',
    'check_in'
  );
  const [futureEventFilter, setFutureEventFilter] = useState(false);
  const [cancelDeadlineFilter, setCancelDeadlineFilter] = useState(false);
  /** 예매 요청·변경 요청 등 벤더 응답 대기 행만 */
  const [pendingRequestOnlyFilter, setPendingRequestOnlyFilter] = useState(false);
  /** 동일 RN#에 부킹 행이 2건 이상인 것만 */
  const [multiRnOnlyFilter, setMultiRnOnlyFilter] = useState(false);
  /** 검수(확인) 완료된 부킹 숨김 */
  const [hideAuditedFilter, setHideAuditedFilter] = useState(false);
  /** 테이블 뷰 전용: 확정이면서 티켓 EA ≠ 연결 투어 총 인원 */
  const [needsReviewEaMismatch, setNeedsReviewEaMismatch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useRoutePersistedState<'card' | 'calendar' | 'table'>(
    'ticket-bookings-view',
    'calendar'
  );
  /** 테이블 뷰 전용: 전체 행 / RN# / 투어 / 날짜 그룹 */
  const [ticketTableLayout, setTicketTableLayout] = useRoutePersistedState<
    'flat' | 'byRn' | 'byTour' | 'byDate'
  >('ticket-bookings-table-layout', 'flat');
  const isGroupedTableLayout =
    ticketTableLayout === 'byRn' ||
    ticketTableLayout === 'byTour' ||
    ticketTableLayout === 'byDate';
  /** 날짜별: 투어 초이스 L/X 합 ≠ 티켓 EA L/X 합인 날짜만 */
  const [lxMismatchOnlyFilter, setLxMismatchOnlyFilter] = useState(false);
  /** 날짜별 뷰 — 앤텔롭 지출·명세 대조 (체크인일 키) */
  const [dateViewReconByDate, setDateViewReconByDate] = useState<
    Map<string, TicketDateViewReconBundle>
  >(() => new Map());
  const [dateViewReconLoading, setDateViewReconLoading] = useState(false);
  const showRnRowSelection =
    viewMode === 'table' && isGroupedTableLayout && canBookingMgmtSoftDeleteUi;
  const ticketDesktopColCount =
    TICKET_DESKTOP_TABLE_COL_COUNT + (showRnRowSelection ? 1 : 0);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(50);
  const [sortField, setSortField] = useState<'date' | 'submit_on' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [teamMemberMap, setTeamMemberMap] = useState<Map<string, string>>(new Map());
  const teamAuditProfileRef = useRef<TeamAuditProfile | null>(null);
  const [bookingAuditSavingId, setBookingAuditSavingId] = useState<string | null>(null);
  const [supplierProductsMap, setSupplierProductsMap] = useState<Map<string, { season_dates: SeasonDate[] | null }>>(new Map());
  const [axesDialogBooking, setAxesDialogBooking] = useState<TicketBooking | null>(null);
  const [refundLinesByBookingId, setRefundLinesByBookingId] = useState<
    Record<string, TicketRefundLineRow[]>
  >({});
  const [changeModalBooking, setChangeModalBooking] = useState<TicketBooking | null>(null);
  const [paymentModalBooking, setPaymentModalBooking] = useState<TicketBooking | null>(null);
  const [vendorConfirmModalBooking, setVendorConfirmModalBooking] = useState<TicketBooking | null>(
    null
  );
  const [vendorPartialChangeModalBooking, setVendorPartialChangeModalBooking] =
    useState<TicketBooking | null>(null);
  const [linkTourModalBooking, setLinkTourModalBooking] = useState<TicketBooking | null>(null);
  const [legacyOffsetConsolidatingKey, setLegacyOffsetConsolidatingKey] = useState<string | null>(
    null
  );
  const [rnGroupBulkDeletingKey, setRnGroupBulkDeletingKey] = useState<string | null>(null);
  const [rnGroupSelectedIds, setRnGroupSelectedIds] = useState<Set<string>>(() => new Set());
  const [workflowActionSavingId, setWorkflowActionSavingId] = useState<string | null>(null);
  const [openAxisDropdown, setOpenAxisDropdown] = useState<
    null | { bookingId: string; axis: 'booking' | 'vendor' }
  >(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const axisBadgeRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [tourDetailModalTourId, setTourDetailModalTourId] = useState<string | null>(null);
  const [invoiceQuickBooking, setInvoiceQuickBooking] = useState<TicketBooking | null>(null);
  /** 모달 Invoice# — ref로 두어 타이핑 시 부모(TicketBookingList) 전체 리렌더를 막음 */
  const invoiceQuickDraftRef = useRef('');
  const [invoiceQuickSaving, setInvoiceQuickSaving] = useState(false);
  const [invoiceInlineSavingId, setInvoiceInlineSavingId] = useState<string | null>(null);
  /** company\\0invoice_number → 공개 URL 목록 */
  const [invoiceAttachmentMap, setInvoiceAttachmentMap] = useState<Map<string, string[]>>(
    () => new Map()
  );
  /** 동일 Invoice#의 Zelle 확인 스크린샷 URL */
  const [zelleAttachmentMap, setZelleAttachmentMap] = useState<Map<string, string[]>>(
    () => new Map()
  );
  /** 투어관리 스케줄 뷰와 동일한 schedule_product_colors (공유 설정·localStorage) */
  const [scheduleProductColors, setScheduleProductColors] = useState<Record<string, string>>({});
  const [invoiceQuickPhotoUrls, setInvoiceQuickPhotoUrls] = useState<string[]>([]);
  const [zelleQuickPhotoUrls, setZelleQuickPhotoUrls] = useState<string[]>([]);
  const [invoicePhotoLoading, setInvoicePhotoLoading] = useState(false);
  const [invoicePhotoUploading, setInvoicePhotoUploading] = useState(false);
  const [zellePhotoUploading, setZellePhotoUploading] = useState(false);
  const [invoicePhotoRemoving, setInvoicePhotoRemoving] = useState(false);
  const invoicePhotoInputRef = useRef<HTMLInputElement>(null);
  const zellePhotoInputRef = useRef<HTMLInputElement>(null);
  const invoiceQuickPhotoUrlsRef = useRef<string[]>([]);
  const zelleQuickPhotoUrlsRef = useRef<string[]>([]);
  /** 디바운스 조회와 업로드가 겹칠 때 오래된 응답이 목록을 지우지 않도록 세대 관리 */
  const invoicePhotoLoadGenRef = useRef(0);
  const [invoiceLightbox, setInvoiceLightbox] = useState<{
    company: string;
    invoiceNumber: string;
    urls: string[];
    kind?: 'invoice' | 'zelle';
  } | null>(null);
  const [invoiceLightboxIndex, setInvoiceLightboxIndex] = useState(0);
  /** Invoice·Zelle 모달에서 Ctrl+V 붙여넣기 대상 (해당 박스를 클릭한 뒤에만 적용) */
  const [invoiceModalPasteTarget, setInvoiceModalPasteTarget] = useState<
    'invoice' | 'zelle' | null
  >(null);

  useEffect(() => {
    invoiceQuickPhotoUrlsRef.current = invoiceQuickPhotoUrls;
  }, [invoiceQuickPhotoUrls]);
  useEffect(() => {
    zelleQuickPhotoUrlsRef.current = zelleQuickPhotoUrls;
  }, [zelleQuickPhotoUrls]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parseColors = (raw: string | null): Record<string, string> | null => {
        if (!raw) return null;
        try {
          const o = JSON.parse(raw) as unknown;
          if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, string>;
        } catch {
          /* noop */
        }
        return null;
      };

      try {
        const { data, error } = await supabase
          .from('shared_settings')
          .select('setting_value')
          .eq('setting_key', 'schedule_product_colors')
          .maybeSingle();

        let merged: Record<string, string> | null = null;
        if (
          !error &&
          data?.setting_value &&
          typeof data.setting_value === 'object' &&
          !Array.isArray(data.setting_value)
        ) {
          merged = data.setting_value as Record<string, string>;
        }
        if (!merged && typeof window !== 'undefined') {
          merged =
            parseColors(localStorage.getItem('shared_schedule_product_colors')) ??
            parseColors(localStorage.getItem('schedule_product_colors'));
        }
        if (!cancelled && merged && Object.keys(merged).length > 0) {
          setScheduleProductColors(merged);
        }
      } catch {
        if (typeof window !== 'undefined' && !cancelled) {
          const fallback =
            parseColors(localStorage.getItem('shared_schedule_product_colors')) ??
            parseColors(localStorage.getItem('schedule_product_colors'));
          if (fallback && Object.keys(fallback).length > 0) setScheduleProductColors(fallback);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const attachmentModalBusy =
    invoiceQuickSaving ||
    invoicePhotoUploading ||
    zellePhotoUploading ||
    invoicePhotoRemoving;

  // 상품 이름을 로케일에 따라 반환하는 함수
  const getProductName = (product: { name?: string; name_en?: string; name_ko?: string } | undefined) => {
    if (!product) return t('tour');
    
    if (locale === 'en') {
      // 영어 로케일인 경우
      if (product.name_en && product.name_en !== product.name) {
        return product.name_en;
      }
      
      // name_en이 없거나 한국어와 동일한 경우, 한국어 이름을 영어로 변환
      const koreanToEnglish: { [key: string]: string } = {
        '야경투어': 'Night Tour',
        '그랜드서클': 'Grand Circle',
        '도깨비 그랜드캐년 일출 투어': 'Goblin Grand Canyon Sunrise Tour',
        '웨스트림': 'West Rim',
        '공항 픽업 서비스': 'Airport Pickup Service',
        '불의 계곡': 'Valley of Fire',
        '그랜드캐년': 'Grand Canyon',
        '자이언 캐니언': 'Zion Canyon',
        '브라이스 캐니언': 'Bryce Canyon',
        '라스베가스': 'Las Vegas',
        '앤텔롭 캐니언': 'Antelope Canyon',
        '후버댐': 'Hoover Dam',
        '데쓰밸리': 'Death Valley',
        '모뉴먼트 밸리': 'Monument Valley',
        '그랜드서클 1박 2일 투어': 'Grand Circle 1 Night 2 Days Tour',
        '그랜드서클 당일 투어': 'Grand Circle Day Tour',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤틸롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 X': 'Goblin Grand Canyon Sunrise Tour + Antelope X Canyon',
        '도깨비 프라이빗': 'Goblin Private Tour',
        '2박3일': '2 Nights 3 Days',
        '엔텔롭캐년': 'Antelope Canyon',
        '앤텔롭캐년': 'Antelope Canyon',
        '앤틸롭캐년': 'Antelope Canyon'
      };
      
      return koreanToEnglish[product.name || ''] || product.name || t('tour');
    } else {
      // 한국어 로케일인 경우
      return product.name || product.name_ko || t('tour');
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<TicketBooking[]>([]);
  const [statementReconciledIds, setStatementReconciledIds] = useState<Set<string>>(() => new Set());
  const [statementReconDisplay, setStatementReconDisplay] = useState<
    Map<string, TicketBookingStatementReconDisplay[]>
  >(() => new Map());
  const [stmtReconOpen, setStmtReconOpen] = useState(false);
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null);
  const [stmtReconUnlinkingId, setStmtReconUnlinkingId] = useState<string | null>(null);
  const statementReconScrollRef = useRef<{ x: number; y: number } | null>(null);
  const tStmtRecon = useTranslations('expenses.statementRecon');
  const [showInvoiceUploadModal, setShowInvoiceUploadModal] = useState(false);
  const [showNeedCheckModal, setShowNeedCheckModal] = useState(false);
  const [tourEvents, setTourEvents] = useState<TourEvent[]>([]);

  /** 상세 모달이 열린 채로 목록이 갱신되면(축 변경 등) 선택 행을 최신 `bookings`와 맞춤 */
  useEffect(() => {
    if (!showBookingModal) return
    setSelectedBookings((prev) => {
      if (prev.length === 0) return prev
      const byId = new Map(bookings.map((b) => [b.id, b]))
      const next = prev
        .map((b) => byId.get(b.id))
        .filter((b): b is TicketBooking => b != null)
      if (next.length === prev.length && next.every((b, i) => b === prev[i])) return prev
      return next
    })
  }, [bookings, showBookingModal])

  const openStatementRecon = useCallback(async (booking: TicketBooking) => {
    if (isTicketBookingStatementReconDisabled(booking)) return
    statementReconScrollRef.current = { x: window.scrollX, y: window.scrollY }
    const ctx = await buildTicketBookingStatementReconContextResolved(supabase, booking)
    if (!ctx) return
    setStmtReconCtx(ctx)
    setStmtReconOpen(true)
  }, [])

  const restoreStatementReconScroll = useCallback(() => {
    const saved = statementReconScrollRef.current
    if (!saved) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(saved.x, saved.y)
      })
    })
  }, [])

  const refreshStatementReconDisplay = useCallback(async (bookingIds: string[]) => {
    const ids = [...new Set(bookingIds.filter(Boolean))]
    if (ids.length === 0) return
    const [reconciled, displayMap] = await Promise.all([
      fetchReconciledSourceIdsBatched(supabase, 'ticket_bookings', ids),
      fetchTicketBookingStatementReconDisplayByBookingId(supabase, ids),
    ])
    setStatementReconciledIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (reconciled.has(id)) next.add(id)
        else next.delete(id)
      }
      return next
    })
    setStatementReconDisplay((prev) => {
      const next = new Map(prev)
      for (const id of ids) {
        const lines = displayMap.get(id)
        if (lines && lines.length > 0) next.set(id, lines)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const patchTicketBookingAfterStatementRecon = useCallback(async (bookingId: string) => {
    const { data, error } = await supabase
      .from('ticket_bookings')
      .select('id, expense, statement_line_id')
      .eq('id', bookingId)
      .maybeSingle()
    if (error || !data) return
    setBookings((prev) => {
      const idx = prev.findIndex((b) => b.id === bookingId)
      if (idx < 0) return prev
      const next = prev.slice()
      next[idx] = deriveTicketBookingListFields({
        ...next[idx]!,
        expense: data.expense,
        statement_line_id: data.statement_line_id,
      } as TicketBooking)
      return next
    })
  }, [])

  const unlinkStatementRecon = useCallback(
    async (booking: TicketBooking, line: TicketBookingStatementReconDisplay) => {
      const key = line.match_id || `${booking.id}:${line.statement_line_id}`
      if (stmtReconUnlinkingId) return
      const ok = window.confirm(tStmtRecon('unlinkStatementMatchConfirm'))
      if (!ok) return
      setStmtReconUnlinkingId(key)
      try {
        await unlinkExpenseReconciliationMatch(supabase, {
          sourceTable: 'ticket_bookings',
          sourceId: booking.id,
          matchId: line.match_id,
          statementLineId: line.statement_line_id,
        })
        await refreshStatementReconDisplay([booking.id])
        await patchTicketBookingAfterStatementRecon(booking.id)
      } catch (e) {
        console.error('명세 연결 해제 오류:', e)
        alert(e instanceof Error ? e.message : tStmtRecon('unlinkStatementMatchError'))
      } finally {
        setStmtReconUnlinkingId(null)
      }
    },
    [stmtReconUnlinkingId, tStmtRecon, refreshStatementReconDisplay, patchTicketBookingAfterStatementRecon]
  )

  const renderStatementReconCell = useCallback(
    (booking: TicketBooking, opts?: { compact?: boolean }) => (
      <TicketBookingStatementReconCell
        matched={statementReconciledIds.has(booking.id)}
        disabled={isTicketBookingStatementReconDisabled(booking)}
        lines={statementReconDisplay.get(booking.id) ?? []}
        titleMatched={tStmtRecon('matchedTitle')}
        titleUnmatched={tStmtRecon('unmatchedTitle')}
        titleDisabled={tStmtRecon('disabledTitle')}
        onOpenPicker={() => void openStatementRecon(booking)}
        onUnlink={(line) => void unlinkStatementRecon(booking, line)}
        unlinking={Boolean(
          stmtReconUnlinkingId &&
            (statementReconDisplay.get(booking.id) ?? []).some(
              (l) =>
                stmtReconUnlinkingId === (l.match_id || `${booking.id}:${l.statement_line_id}`)
            )
        )}
        unlinkTitle={tStmtRecon('unlinkStatementMatch')}
        unlinkAriaLabel={tStmtRecon('unlinkStatementMatchAria')}
        compact={opts?.compact === true}
      />
    ),
    [
      statementReconciledIds,
      statementReconDisplay,
      openStatementRecon,
      unlinkStatementRecon,
      stmtReconUnlinkingId,
      tStmtRecon,
    ]
  )

  const refreshInvoiceAttachmentMapForBookings = useCallback(
    async (list: TicketBooking[]) => {
      const companies = new Set<string>();
      for (const b of list) {
        const inv = b.invoice_number?.trim();
        const co = b.company?.trim();
        if (inv && co) companies.add(co);
      }
      if (companies.size === 0) {
        setInvoiceAttachmentMap(new Map());
        setZelleAttachmentMap(new Map());
        return;
      }
      const companyList = [...companies];
      /** PostgREST 기본 max-rows(보통 1000) 때문에 한 번에 가져오면 뒤쪽 행이 잘리며 맵이 비는 현상이 난다 → 페이지 순회 */
      const ATTACH_PAGE = 800;
      /** .in() URL 길이·서버 한도를 피하기 위해 회사 목록을 나눔 */
      const COMPANY_BATCH = 40;
      const m = new Map<string, string[]>();
      const zm = new Map<string, string[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ticket_invoice_attachments 타입 미정
      const sb = supabase as any;
      for (let ci = 0; ci < companyList.length; ci += COMPANY_BATCH) {
        const batch = companyList.slice(ci, ci + COMPANY_BATCH);
        let from = 0;
        for (;;) {
          const { data, error } = await sb
            .from('ticket_invoice_attachments')
            .select('company, invoice_number, file_urls, zelle_file_urls')
            .in('company', batch)
            .range(from, from + ATTACH_PAGE - 1);
          if (error) {
            console.warn('ticket_invoice_attachments 조회:', error);
            return;
          }
          const rows = (data || []) as {
            company: string;
            invoice_number: string;
            file_urls: unknown;
            zelle_file_urls?: unknown;
          }[];
          for (const row of rows) {
            const inv = row.invoice_number?.trim();
            if (!inv) continue;
            const key = makeInvoiceKey(row.company, inv);
            m.set(key, normalizeDbFileUrls(row.file_urls));
            zm.set(key, normalizeDbFileUrls(row.zelle_file_urls));
          }
          if (rows.length < ATTACH_PAGE) break;
          from += ATTACH_PAGE;
        }
      }
      setInvoiceAttachmentMap(m);
      setZelleAttachmentMap(zm);
    },
    []
  );

  const loadInvoicePhotosForDraft = useCallback(async (company: string, invoiceDraft: string) => {
    const co = invoiceCompanyNorm(company);
    const inv = invoiceDraft.trim();
    if (!inv || !co) {
      invoicePhotoLoadGenRef.current += 1;
      setInvoiceQuickPhotoUrls([]);
      setZelleQuickPhotoUrls([]);
      return;
    }
    const gen = ++invoicePhotoLoadGenRef.current;
    setInvoicePhotoLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ticket_invoice_attachments')
        .select('file_urls, zelle_file_urls')
        .eq('company', co)
        .eq('invoice_number', inv)
        .maybeSingle();
      if (error) throw error;
      if (gen !== invoicePhotoLoadGenRef.current) return;
      setInvoiceQuickPhotoUrls(normalizeDbFileUrls(data?.file_urls));
      setZelleQuickPhotoUrls(normalizeDbFileUrls(data?.zelle_file_urls));
    } catch (e) {
      console.error(e);
      if (gen !== invoicePhotoLoadGenRef.current) return;
      // 조회 실패 시 기존 목록을 비우지 않음(업로드 직후 잠깐 보였다 사라지는 현상 방지)
    } finally {
      if (gen === invoicePhotoLoadGenRef.current) setInvoicePhotoLoading(false);
    }
  }, []);

  const fetchBookings = async () => {
    const gen = ++fetchBookingsGenRef.current;
    try {
      setLoading(true);
      setEnriching(false);

      const submitOnSince = ticketBookingListSubmitOnLowerBoundYmd();

      // ticket_bookings 배치 조회 (기간 필터 + 큰 페이지로 왕복 횟수 축소)
      // 점진적 표시 전략: 첫 페이지를 받은 즉시 화면에 그리고(setLoading=false),
      // 나머지 페이지·메타 정보(투어/환불/공급사)는 enriching=true 상태에서 백그라운드 누적.
      // select * 대신 화면에서 사용하는 컬럼만 명시 → 페이로드/직렬화 비용 감소
      const TICKET_BOOKING_SELECT_COLUMNS = [
        'id',
        'tour_id',
        'reservation_id',
        'submit_on',
        'check_in_date',
        'time',
        'category',
        'ea',
        'submitted_by',
        'expense',
        'income',
        'paid_amount',
        'credit_amount',
        'payment_due_at',
        'hold_expires_at',
        'refund_amount',
        'payment_method',
        'rn_number',
        'note',
        'invoice_number',
        'zelle_confirmation_number',
        'uploaded_file_urls',
        'status',
        'booking_status',
        'vendor_status',
        'change_status',
        'payment_status',
        'refund_status',
        'operation_status',
        'pending_ea',
        'pending_time',
        'booking_status_before_change',
        'company',
        'created_at',
        'updated_at',
        'deletion_requested_at',
        'deletion_requested_by',
        'season',
        'statement_line_id',
        'vendor_confirmation_number',
        'audited',
        'audited_at',
        'audited_by_email',
        'audited_by_name',
        'audited_by_nick_name',
      ].join(', ');

      const PAGE_SIZE = 1000;
      const seenIds = new Set<string>();
      const accumulated: TicketBooking[] = [];

      // check_in_date 폴백을 row 단위 push 시점에 한 번만 적용 → row 참조가 페이지 진행 중에도 안정적.
      // (이전엔 setBookings 시 accumulated.map(spread) 로 모든 누적 row 를 매번 복제 → 카드 React.memo 무력화 + dev 환경에서 큰 리렌더 비용 발생.)
      const appendDedupedFiltered = (page: TicketBooking[]): TicketBooking[] => {
        const fresh: TicketBooking[] = [];
        for (const row of page) {
          if (!row?.id || seenIds.has(row.id)) continue;
          seenIds.add(row.id);
          // 폴백을 적용해야 할 때만 새 객체 생성, 그 외엔 원본 참조 그대로 사용
          const withCheckIn: TicketBooking = row.check_in_date
            ? row
            : ({ ...row, check_in_date: row.submit_on } as TicketBooking);
          fresh.push(deriveTicketBookingListFields(withCheckIn));
        }
        if (fresh.length === 0) return [];
        const filtered = filterTicketBookingsExcludedFromMainUi(fresh);
        for (const row of filtered) accumulated.push(row);
        return filtered;
      };

      // 큰 데이터셋에서 매 페이지마다 setBookings + useMemo 재계산이 누적되지 않도록
      // 추가 페이지의 화면 반영은 throttle(ms) — 마지막 페이지는 즉시 반영.
      const FLUSH_INTERVAL_MS = 350;
      let lastFlushAt = 0;
      const flushAccumulatedToState = (force: boolean) => {
        if (gen !== fetchBookingsGenRef.current) return;
        const now = Date.now();
        if (!force && now - lastFlushAt < FLUSH_INTERVAL_MS) return;
        lastFlushAt = now;
        // 동일 row 참조 유지(배열만 새 슬라이스) → 카드 메모이제이션 살아남음
        setBookings(accumulated.slice());
      };

      // 1) 첫 페이지: 즉시 화면에 표시(check_in_date 폴백만 적용)
      const { data: firstPage, error: firstErr } = await supabase
        .from('ticket_bookings')
        .select(TICKET_BOOKING_SELECT_COLUMNS)
        .gte('submit_on', submitOnSince)
        .order('submit_on', { ascending: false })
        .order('id', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (firstErr) throw firstErr;
      if (gen !== fetchBookingsGenRef.current) return;

      appendDedupedFiltered((firstPage ?? []) as unknown as TicketBooking[]);
      // 첫 페이지를 즉시 노출(메타 병합 전 상태)
      flushAccumulatedToState(true);
      setLoading(false);

      // 2) 추가 페이지가 더 있으면 백그라운드로 이어 받기
      if ((firstPage?.length ?? 0) >= PAGE_SIZE) {
        setEnriching(true);
        let offset = PAGE_SIZE;
        while (true) {
          const { data: page, error: pageError } = await supabase
            .from('ticket_bookings')
            .select(TICKET_BOOKING_SELECT_COLUMNS)
            .gte('submit_on', submitOnSince)
            .order('submit_on', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);
          if (gen !== fetchBookingsGenRef.current) return;
          if (pageError) throw pageError;
          if (!page?.length) break;
          appendDedupedFiltered(page as unknown as TicketBooking[]);
          const isLastPage = page.length < PAGE_SIZE;
          // throttle 로 화면 반영 — 마지막 페이지는 즉시 반영
          flushAccumulatedToState(isLastPage);
          if (isLastPage) break;
          offset += PAGE_SIZE;
        }
        // 루프 종료 후 마지막 강제 flush (throttle 사이 간격 보장)
        flushAccumulatedToState(true);
      }

      const bookingsData: TicketBooking[] = accumulated;

      const emptyRefundMap = (): Record<string, TicketRefundLineRow[]> => ({});

      const loadSupplierProductMap = async (
        list: TicketBooking[]
      ): Promise<Map<string, { season_dates: SeasonDate[] | null }>> => {
        const out = new Map<string, { season_dates: SeasonDate[] | null }>();
        if (!list.length) return out;
        try {
          const bookingIds = list.map((b) => b.id);
          const BATCH_SIZE = 120;
          const PARALLEL = 6;
          const batches: string[][] = [];
          for (let i = 0; i < bookingIds.length; i += BATCH_SIZE) {
            batches.push(bookingIds.slice(i, i + BATCH_SIZE));
          }
          let purchasesData: Array<{
            booking_id: string;
            supplier_products?: { season_dates: SeasonDate[] | null };
          }> = [];
          for (let i = 0; i < batches.length; i += PARALLEL) {
            const slice = batches.slice(i, i + PARALLEL);
            const pages = await Promise.all(
              slice.map((batch) =>
                supabase
                  .from('supplier_ticket_purchases')
                  .select(`
                    booking_id,
                    supplier_product_id,
                    supplier_products (
                      id,
                      season_dates
                    )
                  `)
                  .in('booking_id', batch)
                  .then(({ data }) => data ?? [])
              )
            );
            for (const p of pages) {
              purchasesData = purchasesData.concat(
                p as Array<{
                  booking_id: string;
                  supplier_products?: { season_dates: SeasonDate[] | null };
                }>
              );
            }
          }
          for (const purchase of purchasesData) {
            if (purchase.booking_id && purchase.supplier_products) {
              out.set(purchase.booking_id, {
                season_dates: purchase.supplier_products.season_dates,
              });
            }
          }
          return out;
        } catch (error) {
          console.warn('Supplier product 정보 조회 오류:', error);
          return out;
        }
      };

      const mergeToursRefundsAndBookings = async (
        list: TicketBooking[]
      ): Promise<{
        rows: TicketBooking[];
        refundMap: Record<string, TicketRefundLineRow[]>;
      }> => {
        const RES_LINK_BATCH = 100;
        const linkResIds = [
          ...new Set(
            list
              .map((b) => (typeof b.reservation_id === 'string' ? b.reservation_id.trim() : ''))
              .filter((id) => id.length > 0)
          ),
        ];
        const reservationNameById = new Map<string, string>();
        if (linkResIds.length > 0) {
          let allReservations: { id: string; customer_id: string | null }[] = [];
          for (let i = 0; i < linkResIds.length; i += RES_LINK_BATCH) {
            const chunk = linkResIds.slice(i, i + RES_LINK_BATCH);
            const { data: resPage, error: resErr } = await supabase
              .from('reservations')
              .select('id, customer_id')
              .in('id', chunk);
            if (resErr) {
              console.warn('입장권 연결 예약 조회 오류:', resErr.message ?? resErr);
              continue;
            }
            allReservations = allReservations.concat(
              (resPage ?? []) as { id: string; customer_id: string | null }[]
            );
          }
          const custIds = [
            ...new Set(
              allReservations
                .map((r) => r.customer_id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
            ),
          ];
          const customerNameById = new Map<string, string>();
          for (let i = 0; i < custIds.length; i += RES_LINK_BATCH) {
            const chunk = custIds.slice(i, i + RES_LINK_BATCH);
            const { data: custPage, error: custErr } = await supabase
              .from('customers')
              .select('id, name')
              .in('id', chunk);
            if (custErr) {
              console.warn('고객명 조회 오류:', custErr.message ?? custErr);
              continue;
            }
            for (const c of custPage ?? []) {
              const nm = typeof c.name === 'string' ? c.name.trim() : '';
              if (c.id && nm) customerNameById.set(c.id, nm);
            }
          }
          for (const r of allReservations) {
            if (!r.customer_id) continue;
            const nm = customerNameById.get(r.customer_id);
            if (nm) reservationNameById.set(r.id, nm);
          }
        }

        const attachReservationName = (booking: TicketBooking): TicketBooking => {
          const rid =
            typeof booking.reservation_id === 'string' && booking.reservation_id.trim()
              ? booking.reservation_id.trim()
              : '';
          if (!rid) return booking;
          const rn = reservationNameById.get(rid);
          if (!rn) return booking;
          return { ...booking, reservation_name: rn };
        };

        const withTour = list.filter((b) => b.tour_id);
        if (withTour.length === 0) {
          const rows = list.map((booking) =>
            attachReservationName({
              ...booking,
              check_in_date: booking.check_in_date || booking.submit_on,
            })
          );
          return { rows, refundMap: emptyRefundMap() };
        }
        const tourIds = [
          ...new Set(
            withTour.map((b) => b.tour_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
          ),
        ];
        let toursData: TourEvent[] = [];
        const TOUR_BATCH = 100;
        for (let i = 0; i < tourIds.length; i += TOUR_BATCH) {
          const batch = tourIds.slice(i, i + TOUR_BATCH);
          const { data: batchTours, error: batchError } = await supabase
            .from('tours')
            .select(`
            id,
            tour_date,
            tour_status,
            reservation_ids,
            tour_guide_id,
            assistant_id,
            tour_car_id,
            products (
              name,
              name_en,
              name_ko
            )
          `)
            .in('id', batch);
          if (batchError) {
            console.warn('투어 정보 조회 오류:', batchError);
            break;
          }
          if (batchTours?.length) {
            const activeOnly = batchTours.filter(
              (t: { tour_status?: string | null }) => !isTourCancelled(t.tour_status)
            );
            toursData = toursData.concat(activeOnly as unknown as TourEvent[]);
          }
        }
        type TourEnrichRow = TourEvent & {
          tour_car_id?: string | null;
        };
        const toursMap = new Map<string, TourEnrichRow>();
        for (const tour of toursData) {
          toursMap.set(tour.id, tour as TourEnrichRow);
        }

        const staffEmailSet = new Set<string>();
        const vehicleIdSet = new Set<string>();
        for (const tour of toursData) {
          const tr = tour as TourEnrichRow & {
            tour_guide_id?: string | null;
            assistant_id?: string | null;
            tour_car_id?: string | null;
          };
          const g = tr.tour_guide_id?.trim();
          const a = tr.assistant_id?.trim();
          if (g) staffEmailSet.add(g);
          if (a) staffEmailSet.add(a);
          const vid = tr.tour_car_id?.trim();
          if (vid) vehicleIdSet.add(vid);
        }
        const staffDisplayByEmailLower = new Map<string, string>();
        const staffEmails = [...staffEmailSet];
        const TEAM_STAFF_BATCH = 80;
        for (let si = 0; si < staffEmails.length; si += TEAM_STAFF_BATCH) {
          const chunk = staffEmails.slice(si, si + TEAM_STAFF_BATCH);
          const { data: teamRows, error: teamStaffErr } = await supabase
            .from('team')
            .select('email, name_ko, nick_name')
            .in('email', chunk);
          if (teamStaffErr) {
            console.warn('입장권 투어 staff(team) 조회:', teamStaffErr);
            continue;
          }
          for (const m of teamRows || []) {
            const em = m.email?.trim();
            if (!em) continue;
            const label = String(m.nick_name || m.name_ko || em).trim();
            staffDisplayByEmailLower.set(em.toLowerCase(), label || em);
          }
        }
        const resolveStaffDisplay = (raw: string | null | undefined): string => {
          const s = raw?.trim();
          if (!s) return '';
          return staffDisplayByEmailLower.get(s.toLowerCase()) || s;
        };

        const vehicleDisplayById = new Map<string, string>();
        const vehicleIds = [...vehicleIdSet];
        const VEHICLE_BATCH = 80;
        for (let vi = 0; vi < vehicleIds.length; vi += VEHICLE_BATCH) {
          const chunk = vehicleIds.slice(vi, vi + VEHICLE_BATCH);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: vehiclesData, error: vehErr } = await (supabase as any)
            .from('vehicles')
            .select('id, vehicle_number, nick')
            .in('id', chunk);
          if (vehErr) {
            console.warn('입장권 투어 vehicles 조회:', vehErr);
            continue;
          }
          for (const v of (vehiclesData || []) as {
            id: string;
            vehicle_number: string | null;
            nick?: string | null;
          }[]) {
            if (!v.id) continue;
            const label = (v.nick && String(v.nick).trim()) || v.vehicle_number || '';
            if (label) vehicleDisplayById.set(v.id, label);
          }
        }
        const allResIds = new Set<string>();
        for (const tour of toursData) {
          for (const rid of normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)) {
            allResIds.add(rid);
          }
        }
        const resIdList = [...allResIds];
        type ResPeopleRow = { id: string; total_people: number | null; status: string | null };
        let reservationsRows: ResPeopleRow[] = [];
        const RES_BATCH = 100;
        const RES_PARALLEL = 5;
        for (let i = 0; i < resIdList.length; i += RES_BATCH * RES_PARALLEL) {
          const slice = resIdList.slice(i, i + RES_BATCH * RES_PARALLEL);
          const chunks: string[][] = [];
          for (let j = 0; j < slice.length; j += RES_BATCH) {
            chunks.push(slice.slice(j, j + RES_BATCH));
          }
          const pages = await Promise.all(
            chunks.map((chunk) =>
              supabase
                .from('reservations')
                .select('id, total_people, status')
                .in('id', chunk)
                .then(({ data }) => data ?? [])
            )
          );
          for (const resPage of pages) {
            if (resPage.length) reservationsRows = reservationsRows.concat(resPage as ResPeopleRow[]);
          }
        }
        const resById = new Map<string, ResPeopleRow>();
        for (const r of reservationsRows) resById.set(r.id, r);
        const tourTotalPeopleByTourId = new Map<string, number>();
        for (const tour of toursData) {
          let sum = 0;
          for (const rid of normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)) {
            const r = resById.get(rid);
            if (!r || isReservationCancelledStatus(r.status)) continue;
            sum += Number(r.total_people) || 0;
          }
          tourTotalPeopleByTourId.set(tour.id, sum);
        }

        const choiceRowsByResId = new Map<string, ReservationChoiceRow[]>();
        if (resIdList.length > 0) {
          for (let i = 0; i < resIdList.length; i += RES_BATCH) {
            const batchIds = resIdList.slice(i, i + RES_BATCH);
            const { data: rcData, error: rcErr } = await supabase
              .from('reservation_choices')
              .select(
                'reservation_id, quantity, choice_options!inner(option_key, option_name_ko, option_name)'
              )
              .in('reservation_id', batchIds);
            if (rcErr) {
              console.warn('입장권 투어 초이스 조회:', rcErr);
              break;
            }
            for (const row of (rcData || []) as Array<{
              reservation_id: string | null;
              quantity?: number | null;
              choice_options?: {
                option_key?: string | null;
                option_name_ko?: string | null;
                option_name?: string | null;
              } | null;
            }>) {
              const rid = row.reservation_id?.trim();
              if (!rid) continue;
              const opt = row.choice_options;
              const choiceKey = choiceLabelToTourCountKey(
                opt?.option_name_ko ?? null,
                opt?.option_name ?? null,
                opt?.option_key ?? null
              );
              const list = choiceRowsByResId.get(rid) || [];
              list.push({ choiceKey, quantity: Number(row.quantity) || 1 });
              choiceRowsByResId.set(rid, list);
            }
          }
        }
        const tourChoiceCountsByTourId = new Map<string, TourChoiceCounts>();
        for (const tour of toursData) {
          const assignedResList: Array<{ id: string; total_people?: number | null }> = [];
          for (const rid of normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)) {
            const r = resById.get(rid);
            if (!r || isReservationCancelledStatus(r.status)) continue;
            assignedResList.push(r);
          }
          const counts = aggregateTourChoiceCounts(assignedResList, choiceRowsByResId);
          if (tourChoiceCountsHasDisplayable(counts)) {
            tourChoiceCountsByTourId.set(tour.id, counts);
          }
        }
        const rows = list.map((booking) => {
          const baseBooking = attachReservationName({
            ...booking,
            check_in_date: booking.check_in_date || booking.submit_on,
          });
          if (booking.tour_id && toursMap.has(booking.tour_id)) {
            const tour = toursMap.get(booking.tour_id);
            const tr = tour as TourEnrichRow & {
              tour_guide_id?: string | null;
              assistant_id?: string | null;
              tour_car_id?: string | null;
            };
            const toursPart: NonNullable<TicketBooking['tours']> = {
              tour_date: tour?.tour_date || '',
              total_people: tourTotalPeopleByTourId.get(booking.tour_id) ?? 0,
            };
            const guide = resolveStaffDisplay(tr.tour_guide_id);
            const asst = resolveStaffDisplay(tr.assistant_id);
            const carId = tr.tour_car_id?.trim();
            if (guide) toursPart.guide_display_name = guide;
            if (asst) toursPart.assistant_display_name = asst;
            if (carId) {
              const veh = vehicleDisplayById.get(carId);
              if (veh) toursPart.vehicle_display_name = veh;
            }
            if (tour?.products != null) {
              const p = tour.products;
              toursPart.products = {
                name: p.name,
                ...(typeof p.name_en === 'string' ? { name_en: p.name_en } : {}),
                ...(typeof (p as { name_ko?: string }).name_ko === 'string'
                  ? { name_ko: (p as { name_ko?: string }).name_ko }
                  : {}),
              };
            }
            const choiceCounts = tourChoiceCountsByTourId.get(booking.tour_id);
            if (choiceCounts) toursPart.choice_counts = choiceCounts;
            return { ...baseBooking, tours: toursPart };
          }
          return baseBooking;
        });
        const bookingIds = [
          ...new Set(list.map((b) => b.id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
        ];
        const refundMap: Record<string, TicketRefundLineRow[]> = {};
        if (bookingIds.length > 0) {
          try {
            const REFUND_ANCHOR_BATCH = 100;
            for (let i = 0; i < bookingIds.length; i += REFUND_ANCHOR_BATCH) {
              const batch = bookingIds.slice(i, i + REFUND_ANCHOR_BATCH);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: rlRows, error: rlErr } = await (supabase as any)
                .from('ticket_booking_refund_lines')
                .select('id, anchor_booking_id, status, amount, ea, note')
                .in('anchor_booking_id', batch);
              if (rlErr) {
                console.warn('환불 라인 조회 오류:', rlErr.message ?? rlErr);
                continue;
              }
              if (rlRows && Array.isArray(rlRows)) {
                for (const row of rlRows as unknown as TicketRefundLineRow[]) {
                  const k = row.anchor_booking_id;
                  if (!refundMap[k]) refundMap[k] = [];
                  refundMap[k].push(row);
                }
              }
            }
          } catch {
            /* 마이그레이션 미적용 등 */
          }
        }
        return { rows, refundMap };
      };

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        setRefundLinesByBookingId({});
        setInvoiceAttachmentMap(new Map());
        setZelleAttachmentMap(new Map());
        setEnriching(false);
        return;
      }

      // 3) 메타 정보(투어/환불/공급사) 병합도 백그라운드로 진행 후 결과 갱신
      setEnriching(true);
      const [supplierMap, merged] = await Promise.all([
        loadSupplierProductMap(bookingsData),
        mergeToursRefundsAndBookings(bookingsData),
      ]);

      if (gen !== fetchBookingsGenRef.current) return;

      setSupplierProductsMap(supplierMap);
      setRefundLinesByBookingId(merged.refundMap);
      setBookings(merged.rows);
      setEnriching(false);

      await refreshInvoiceAttachmentMapForBookings(merged.rows);

      // submitted_by 이메일로 team 테이블에서 name_ko 조회
      const submittedByEmails = [...new Set(
        (bookingsData || [])
          .map((booking: TicketBooking) => booking.submitted_by)
          .filter((email): email is string => !!email && typeof email === 'string' && email.includes('@'))
      )];

      if (submittedByEmails.length > 0) {
        try {
          // team 테이블에서 email 컬럼으로 검색 (대소문자 구분 없이)
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('email, name_ko')
            .in('email', submittedByEmails);

          if (!teamError && teamData) {
            const emailToNameMap = new Map<string, string>();
            (teamData || []).forEach((member: { email: string; name_ko: string | null }) => {
              if (member.email && member.name_ko) {
                // 이메일을 소문자로 변환하여 저장 (대소문자 구분 없이 매칭)
                emailToNameMap.set(member.email.toLowerCase(), member.name_ko);
              }
            });
            setTeamMemberMap(emailToNameMap);
          } else {
            console.warn('Team 정보 조회 오류:', teamError);
            setTeamMemberMap(new Map());
          }
        } catch (error) {
          console.error('Team 정보 조회 중 오류:', error);
          setTeamMemberMap(new Map());
        }
      } else {
        setTeamMemberMap(new Map());
      }
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('입장권 부킹 조회 오류:', error);
      }
    } finally {
      if (gen === fetchBookingsGenRef.current) {
        setLoading(false);
        setEnriching(false);
      }
    }
  };

  fetchBookingsRef.current = fetchBookings;

  useEffect(() => {
    if (!user?.email) {
      teamAuditProfileRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      const profile = await fetchTeamAuditProfile(supabase, user.email!, user.name);
      if (!cancelled) teamAuditProfileRef.current = profile;
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.name]);

  const patchTicketBookingAuditInList = useCallback(
    (bookingId: string, patch: ReturnType<typeof buildBookingAuditPatch>) => {
      const merge = <T extends { id: string }>(b: T): T =>
        b.id === bookingId ? { ...b, ...patch } : b;
      setBookings((prev) => prev.map(merge));
      setEditingBooking((prev) => (prev ? merge(prev) : prev));
      setSelectedBookings((prev) => prev.map(merge));
    },
    []
  );

  const handleToggleTicketBookingAudit = useCallback(
    async (booking: TicketBooking, nextAudited: boolean) => {
      if (!user?.email) {
        alert(tAudit('loginRequired'));
        return;
      }
      setBookingAuditSavingId(booking.id);
      try {
        let actor = teamAuditProfileRef.current;
        if (!actor) {
          actor = await fetchTeamAuditProfile(supabase, user.email, user.name);
          teamAuditProfileRef.current = actor;
        }
        const patch = buildBookingAuditPatch(nextAudited, actor);
        patchTicketBookingAuditInList(booking.id, patch);
        const { error } = await updateBookingAudit(
          supabase,
          'ticket_bookings',
          booking.id,
          patch
        );
        if (error) {
          patchTicketBookingAuditInList(booking.id, {
            audited: Boolean(booking.audited),
            audited_at: booking.audited_at ?? null,
            audited_by_email: booking.audited_by_email ?? null,
            audited_by_name: booking.audited_by_name ?? null,
            audited_by_nick_name: booking.audited_by_nick_name ?? null,
          });
          alert(tAudit('toggleFailed'));
        }
      } finally {
        setBookingAuditSavingId(null);
      }
    },
    [patchTicketBookingAuditInList, tAudit, user?.email, user?.name]
  );

  const performTableAxesUndo = useCallback(async () => {
    const stack = tableAxesUndoStackRef.current;
    const entry = stack.pop();
    if (!entry) return;
    try {
      const res = await applyTicketBookingSetAxes(entry.bookingId, entry.patch, user?.email ?? null);
      if (!res.ok) {
        stack.push(entry);
        alert(res.error ?? tTbActUi('unknownError'));
        return;
      }
      const payload = res.data as { booking?: Record<string, unknown> } | undefined;
      const row = payload?.booking;
      const booking = bookingsRef.current.find((b) => b.id === entry.bookingId);
      if (row && typeof row === 'object' && booking) {
        setBookings((prev) =>
          prev.map((b) => (b.id === entry.bookingId ? mergeTicketBookingAxesFromRpcRow(b, row) : b))
        );
      } else {
        await fetchBookingsRef.current();
      }
    } catch (err) {
      stack.push(entry);
      console.error(err);
      alert(locale === 'ko' ? '실행 취소 중 오류가 발생했습니다.' : 'Undo failed.');
    }
  }, [user?.email, locale, tTbActUi]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key !== 'z' || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (tableAxesUndoStackRef.current.length === 0) return;
      e.preventDefault();
      void performTableAxesUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performTableAxesUndo]);

  const runWorkflowRpc = async (
    booking: TicketBooking,
    action:
      | 'workflow_vendor_confirm_initial'
      | 'workflow_vendor_reject_initial'
      | 'workflow_submit_change'
      | 'workflow_vendor_confirm_change'
      | 'workflow_vendor_reject_change'
      | 'workflow_complete_payment',
    payload: Record<string, unknown> = {}
  ): Promise<boolean> => {
    setWorkflowActionSavingId(booking.id);
    try {
      const res = await applyTicketBookingWorkflowAction(
        booking.id,
        action,
        payload,
        user?.email ?? null
      );
      if (!res.ok) {
        alert(res.error ?? tTbActUi('unknownError'));
        return false;
      }
      const data = res.data as { booking?: Record<string, unknown> } | undefined;
      const row = data?.booking;
      if (row && typeof row === 'object') {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? mergeTicketBookingAxesFromRpcRow(b, row) : b))
        );
      } else {
        await fetchBookings();
      }
      return true;
    } catch (err) {
      console.error(err);
      alert(locale === 'ko' ? '처리 중 오류가 발생했습니다.' : 'Request failed.');
      return false;
    } finally {
      setWorkflowActionSavingId(null);
    }
  };

  const refundLineStatusLabel = (st: string) => {
    switch (st) {
      case 'requested':
        return '환불 요청';
      case 'rejected':
        return '환불 거절';
      case 'refunded':
        return '환불 완료';
      case 'credit_received':
        return '크레딧 받음';
      default:
        return st;
    }
  };

  const updateRefundLineStatus = async (lineId: string, status: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('ticket_booking_refund_lines')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', lineId);
      if (error) {
        alert(error.message);
        return;
      }
      await fetchBookings();
    } catch (e) {
      console.error(e);
    }
  };

  const addRefundLineForBooking = async (booking: TicketBooking) => {
    const amountStr = window.prompt('환불 금액 (USD)', String(booking.expense ?? ''));
    if (amountStr === null) return;
    const eaStr = window.prompt('환불 수량', String(booking.ea ?? ''));
    if (eaStr === null) return;
    const amount = parseFloat(amountStr);
    const ea = parseInt(eaStr, 10);
    if (Number.isNaN(amount) || Number.isNaN(ea)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('ticket_booking_refund_lines').insert({
        anchor_booking_id: booking.id,
        status: 'requested',
        amount,
        ea,
      });
      if (error) {
        alert(error.message);
        return;
      }
      await fetchBookings();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTourEvents = useCallback(async () => {
    try {
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      const firstDayMonth = new Date(currentYear, currentMonth, 1);
      const gridStart = new Date(firstDayMonth);
      gridStart.setDate(gridStart.getDate() - firstDayMonth.getDay());
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridEnd.getDate() + 41);
      const gridStartStr = localYmdFromDate(gridStart);
      const gridEndStr = localYmdFromDate(gridEnd);
      const tourFetchFromYmd = addCalendarDaysYmd(gridStartStr, -90);

      const { data: toursDataRaw, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_end_datetime,
          tour_status,
          product_id,
          reservation_ids,
          tour_guide_id,
          assistant_id,
          products (
            name
          )
        `)
        .in('product_id', TICKET_CALENDAR_TOUR_PRODUCT_IDS)
        .gte('tour_date', tourFetchFromYmd)
        .lte('tour_date', gridEndStr)
        .order('tour_date', { ascending: true });

      if (toursError) {
        if (isAbortLikeError(toursError)) return;
        console.error('투어 데이터 조회 오류:', toursError);
        throw toursError;
      }

      const toursData = (toursDataRaw || [])
        .filter((row: { tour_status?: string | null }) => !isTourCancelled(row.tour_status))
        .filter((row: { tour_date: string; tour_end_datetime?: string | null }) =>
          tourSpanIntersectsGrid(row, gridStartStr, gridEndStr)
        ) as TourEvent[];

      if (toursData.length === 0) {
        setTourEvents([]);
        return;
      }

      const staffEmailSet = new Set<string>();
      for (const row of toursData) {
        const g = row.tour_guide_id?.trim();
        const a = row.assistant_id?.trim();
        if (g) staffEmailSet.add(g);
        if (a) staffEmailSet.add(a);
      }
      const staffEmails = [...staffEmailSet];
      const staffDisplayByEmailLower = new Map<string, string>();
      const TEAM_STAFF_BATCH = 80;
      for (let si = 0; si < staffEmails.length; si += TEAM_STAFF_BATCH) {
        const chunk = staffEmails.slice(si, si + TEAM_STAFF_BATCH);
        const { data: teamRows, error: teamStaffErr } = await supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .in('email', chunk);
        if (teamStaffErr) {
          console.warn('입장권 달력 투어 staff(team) 조회:', teamStaffErr);
          continue;
        }
        for (const m of teamRows || []) {
          const em = m.email?.trim();
          if (!em) continue;
          const label = String(m.nick_name || m.name_ko || em).trim();
          staffDisplayByEmailLower.set(em.toLowerCase(), label || em);
        }
      }
      const resolveStaffDisplay = (raw: string | null | undefined): string => {
        const s = raw?.trim();
        if (!s) return '';
        return staffDisplayByEmailLower.get(s.toLowerCase()) || s;
      };

      type CalResRow = {
        id: string;
        adults?: number | null;
        child?: number | null;
        infant?: number | null;
        total_people?: number | null;
        status?: string | null;
      };

      const reservationIdSet = new Set<string>();
      for (const tour of toursData) {
        for (const rid of tour.reservation_ids || []) {
          if (rid) reservationIdSet.add(rid);
        }
      }
      const reservationIdList = [...reservationIdSet];
      const RES_BATCH = 250;
      const RES_PARALLEL = 5;
      const reservationById = new Map<string, CalResRow>();

      for (let i = 0; i < reservationIdList.length; i += RES_BATCH * RES_PARALLEL) {
        const slice = reservationIdList.slice(i, i + RES_BATCH * RES_PARALLEL);
        const batches: string[][] = [];
        for (let j = 0; j < slice.length; j += RES_BATCH) {
          batches.push(slice.slice(j, j + RES_BATCH));
        }
        const pages = await Promise.all(
          batches.map((batch) =>
            supabase
              .from('reservations')
              .select('id, adults, child, infant, total_people, status')
              .in('id', batch)
              .then(({ data, error }) => {
                if (error) throw error;
                return data ?? [];
              })
          )
        );
        for (const rows of pages) {
          for (const row of rows as CalResRow[]) {
            if (row?.id) reservationById.set(row.id, row);
          }
        }
      }

      const tourEventsWithReservations = toursData.map((tour: TourEvent) => {
        const ids = tour.reservation_ids || [];
        if (ids.length === 0) {
          return {
            ...tour,
            total_reservations: 0,
            total_people: 0,
            adults: 0,
            child: 0,
            infant: 0,
          };
        }

        const rows = ids
          .map((id) => reservationById.get(id))
          .filter((r): r is CalResRow => r != null);
        const activeReservations = rows.filter(
          (r) => !isReservationCancelledStatus(r.status)
        );

        const totalPeople = activeReservations.reduce(
          (sum, r) => sum + (Number(r.total_people) || 0),
          0
        );
        const totalAdults = activeReservations.reduce(
          (sum, r) => sum + (Number(r.adults) || 0),
          0
        );
        const totalChild = activeReservations.reduce(
          (sum, r) => sum + (Number(r.child) || 0),
          0
        );
        const totalInfant = activeReservations.reduce(
          (sum, r) => sum + (Number(r.infant) || 0),
          0
        );

        return {
          ...tour,
          total_reservations: activeReservations.length,
          total_people: totalPeople,
          adults: totalAdults,
          child: totalChild,
          infant: totalInfant,
        };
      });

      const tourEventsWithStaff = tourEventsWithReservations.map((ev) => ({
        ...ev,
        guide_display_name: resolveStaffDisplay(ev.tour_guide_id),
        assistant_display_name: resolveStaffDisplay(ev.assistant_id),
      }));

      setTourEvents(tourEventsWithStaff);
    } catch (error) {
      if (isAbortLikeError(error)) return;
      console.error('투어 이벤트 조회 오류:', error);
      setTourEvents([]);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!openAxisDropdown) return;

    const handleClickOutside = () => {
      setOpenAxisDropdown(null);
      setDropdownPosition(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openAxisDropdown]);

  useEffect(() => {
    if (!tourDetailModalTourId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourDetailModalTourId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourDetailModalTourId]);

  useEffect(() => {
    fetchTourEvents();
  }, [fetchTourEvents]);

  const TICKET_BOOKING_EDIT_FORM_COLUMNS = [
    'id',
    'category',
    'submitted_by',
    'check_in_date',
    'time',
    'company',
    'ea',
    'expense',
    'income',
    'payment_method',
    'rn_number',
    'invoice_number',
    'zelle_confirmation_number',
    'tour_id',
    'reservation_id',
    'note',
    'status',
    'season',
    'uploaded_file_urls',
    'booking_status',
    'vendor_status',
    'change_status',
    'payment_status',
    'refund_status',
    'operation_status',
    'submit_on',
    'updated_at',
  ].join(', ');

  const handleEdit = (booking: TicketBooking) => {
    void (async () => {
      setShowBookingModal(false);
      const listRow = bookingsRef.current.find((b) => b.id === booking.id) ?? booking;
      try {
        const { data, error } = await supabase
          .from('ticket_bookings')
          .select(TICKET_BOOKING_EDIT_FORM_COLUMNS)
          .eq('id', booking.id)
          .maybeSingle();
        if (error) throw error;
        setEditingBooking(
          data
            ? ({
                ...listRow,
                ...(data as unknown as TicketBooking),
                tours: listRow.tours,
                reservation_name: listRow.reservation_name,
                total_price: listRow.total_price,
                unit_price: listRow.unit_price,
              } as TicketBooking)
            : listRow
        );
      } catch (e) {
        console.error('입장권 부킹 편집 로드 오류:', e);
        setEditingBooking(listRow);
      }
      setShowForm(true);
    })();
  };

  const removeBookingsFromUi = useCallback((ids: readonly string[]) => {
    const idSet = new Set(ids);
    setBookings((prev) => prev.filter((b) => !idSet.has(b.id)));
    setSelectedBookings((prev) => prev.filter((b) => !idSet.has(b.id)));
    setRnGroupSelectedIds((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const removeBookingFromUi = useCallback(
    (id: string) => {
      removeBookingsFromUi([id]);
    },
    [removeBookingsFromUi]
  );

  useEffect(() => {
    setRnGroupSelectedIds(new Set());
  }, [ticketTableLayout, viewMode, listPage, multiRnOnlyFilter, lxMismatchOnlyFilter]);

  const handleDelete = async (id: string, opts?: { fromDetailModal?: boolean }) => {
    if (!canSuperDeleteTicketBooking) {
      alert(
        locale === 'ko'
          ? '영구 삭제는 SUPER 관리자만 할 수 있습니다.'
          : 'Only super admins can permanently delete booking rows.'
      );
      return;
    }
    if (!confirm('정말로 이 부킹을 영구 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('ticket_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      removeBookingFromUi(id);
      if (!opts?.fromDetailModal) {
        setShowForm(false);
        setEditingBooking(null);
      }
    } catch (error) {
      console.error('입장권 부킹 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRequestSoftDelete = async (id: string, opts?: { fromDetailModal?: boolean }) => {
    const email = user?.email || '';
    const row = bookings.find((b) => b.id === id) ?? selectedBookings.find((b) => b.id === id);
    const offsetRow = row ? isTicketBookingOffsetOrCancelRow(row) : false;
    const confirmMsg =
      locale === 'ko'
        ? offsetRow
          ? '이 조정/취소 부킹 행을 삭제 요청하시겠습니까? 목록·상세에서 숨겨지며, 본 건은 편집으로 수량을 맞춘 뒤 SUPER가 영구 삭제할 수 있습니다.'
          : '삭제를 요청하시겠습니까? 목록에서 숨겨지며 SUPER가 확인 후 영구 삭제합니다.'
        : offsetRow
          ? 'Request deletion for this adjustment/cancel row? It will be hidden; update the main row quantity, then a super admin can purge it.'
          : 'Request deletion? It will be hidden from the list until a super admin permanently deletes it.';
    if (!confirm(confirmMsg)) return;

    try {
      const { error } = await supabase
        .from('ticket_bookings')
        .update({
          deletion_requested_at: new Date().toISOString(),
          deletion_requested_by: email || null,
        })
        .eq('id', id);
      if (error) throw error;
      alert(
        locale === 'ko'
          ? '삭제 요청되었습니다. 목록에서 숨겨지며 SUPER가 확인 후 영구 삭제합니다.'
          : 'Deletion requested. It is hidden from the list until a super admin permanently deletes it.'
      );
      removeBookingFromUi(id);
      if (!opts?.fromDetailModal) {
        setShowForm(false);
        setEditingBooking(null);
      }
    } catch (error) {
      console.error('입장권 삭제 요청 오류:', error);
      alert(locale === 'ko' ? '삭제 요청 처리 중 오류가 발생했습니다.' : 'Failed to request deletion.');
    }
  };

  const handleViewHistory = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowHistory(true);
  };

  const handleConsolidateLegacyOffsetGroup = async (
    groupKey: string,
    groupRows: TicketBooking[]
  ) => {
    if (!canBookingMgmtSoftDeleteUi) {
      alert(
        locale === 'ko'
          ? '조정 행 정리는 부킹 관리 권한이 있는 직원만 할 수 있습니다.'
          : 'You need booking management permission to consolidate adjustment rows.'
      );
      return;
    }
    if (!isTicketBookingLegacyOffsetRnGroup(groupRows)) return;

    const primary = pickPrimaryRowForLegacyOffsetMerge(groupRows);
    if (!primary) return;
    const otherIds = legacyOffsetRowIdsToSoftDelete(groupRows, primary.id);
    const rnLabel = primary.rn_number?.trim() || groupRows[0]?.rn_number?.trim() || '—';

    const confirmMsg =
      locale === 'ko'
        ? `RN# ${rnLabel}\n\n· 본 행(수량 ${primary.ea ?? 0}개)을 0개로 바꿉니다.\n· 나머지 조정·취소 행 ${otherIds.length}건은 삭제 요청(목록에서 숨김)합니다.\n\n계속할까요?`
        : `RN# ${rnLabel}\n\nSet the main row (qty ${primary.ea ?? 0}) to 0 and soft-delete ${otherIds.length} adjustment/cancel row(s).\n\nContinue?`;

    if (!confirm(confirmMsg)) return;

    setLegacyOffsetConsolidatingKey(groupKey);
    const now = new Date().toISOString();
    const email = user?.email ?? null;

    try {
      const { error: updateErr } = await supabase
        .from('ticket_bookings')
        .update({
          ea: 0,
          expense: 0,
          updated_at: now,
        })
        .eq('id', primary.id);
      if (updateErr) throw updateErr;

      if (otherIds.length > 0) {
        const { error: hideErr } = await supabase
          .from('ticket_bookings')
          .update({
            deletion_requested_at: now,
            deletion_requested_by: email,
          })
          .in('id', otherIds);
        if (hideErr) throw hideErr;
      }

      setBookings((prev) =>
        prev
          .map((b) =>
            b.id === primary.id ? { ...b, ea: 0, expense: 0, updated_at: now } : b
          )
          .filter((b) => !otherIds.includes(b.id))
      );
      setSelectedBookings((prev) => prev.filter((b) => !otherIds.includes(b.id)));

      alert(
        locale === 'ko'
          ? `정리했습니다. 본 행 수량 0개, 조정 행 ${otherIds.length}건 삭제 요청됨.`
          : `Done. Main row set to qty 0; ${otherIds.length} adjustment row(s) hidden.`
      );
    } catch (err) {
      console.error('[TicketBookingList] legacy offset consolidate', err);
      alert(
        locale === 'ko'
          ? '조정 행 정리 중 오류가 발생했습니다.'
          : 'Failed to consolidate adjustment rows.'
      );
    } finally {
      setLegacyOffsetConsolidatingKey(null);
    }
  };

  const renderLegacyOffsetConsolidateButton = (
    groupKey: string,
    groupRows: TicketBooking[],
    variant: 'mobile' | 'desktop'
  ) => {
    if (!canBookingMgmtSoftDeleteUi || !isTicketBookingLegacyOffsetRnGroup(groupRows)) {
      return null;
    }
    const busy = legacyOffsetConsolidatingKey === groupKey;
    const otherCount = legacyOffsetRowIdsToSoftDelete(
      groupRows,
      pickPrimaryRowForLegacyOffsetMerge(groupRows)?.id ?? ''
    ).length;

    const btnClass =
      variant === 'desktop'
        ? 'ml-3 inline-flex items-center gap-1 rounded-md border border-violet-600 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50'
        : 'mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-600 bg-violet-50 px-2 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50';

    return (
      <button
        type="button"
        className={btnClass}
        disabled={busy}
        title={
          locale === 'ko'
            ? '본 행 수량 0개로 맞추고, +/− 조정·취소 행을 삭제 요청(숨김)합니다.'
            : 'Set main row to qty 0 and soft-delete offset/cancel rows.'
        }
        onClick={(e) => {
          e.stopPropagation();
          void handleConsolidateLegacyOffsetGroup(groupKey, groupRows);
        }}
      >
        <Merge className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {busy
          ? locale === 'ko'
            ? '처리 중…'
            : 'Working…'
          : locale === 'ko'
            ? `0개로 통합 (${otherCount}건 숨김)`
            : `Merge to 0 (${otherCount} hide)`}
      </button>
    );
  };

  const toggleRnGroupRowSelected = useCallback((id: string, selected: boolean) => {
    setRnGroupSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSoftDeleteTicketBookingIds = async (
    groupKey: string,
    ids: string[],
    confirmMsg: string
  ) => {
    if (!canBookingMgmtSoftDeleteUi || ids.length === 0) return;
    if (!confirm(confirmMsg)) return;

    setRnGroupBulkDeletingKey(groupKey);
    const now = new Date().toISOString();
    const email = user?.email ?? null;

    try {
      const { error } = await supabase
        .from('ticket_bookings')
        .update({
          deletion_requested_at: now,
          deletion_requested_by: email,
        })
        .in('id', ids);
      if (error) throw error;

      removeBookingsFromUi(ids);
      alert(
        locale === 'ko'
          ? `삭제 요청 ${ids.length}건 — 목록에서 숨겨집니다. SUPER가 확인 후 영구 삭제합니다.`
          : `${ids.length} row(s) marked for deletion and hidden from the list.`
      );
    } catch (err) {
      console.error('[TicketBookingList] RN group bulk soft delete', err);
      alert(
        locale === 'ko' ? '일괄 삭제 요청 중 오류가 발생했습니다.' : 'Failed to request bulk deletion.'
      );
    } finally {
      setRnGroupBulkDeletingKey(null);
    }
  };

  const handleSoftDeleteNonConfirmedInRnGroup = async (
    groupKey: string,
    groupRows: TicketBooking[],
    groupLabel: string
  ) => {
    const ids = ticketBookingRnGroupSoftDeleteCandidateIds(groupRows, { excludeConfirmed: true });
    if (ids.length === 0) {
      alert(
        locale === 'ko'
          ? '확정이 아닌 삭제 가능한 행이 없습니다.'
          : 'No non-confirmed rows available to delete.'
      );
      return;
    }
    const confirmMsg =
      locale === 'ko'
        ? `${groupLabel}\n\n확정(예약) 상태가 아닌 ${ids.length}건을 삭제 요청(목록에서 숨김)합니다.\n확정된 행은 유지됩니다.\n\n계속할까요?`
        : `${groupLabel}\n\nSoft-delete ${ids.length} non-confirmed row(s); confirmed rows stay.\n\nContinue?`;
    await handleSoftDeleteTicketBookingIds(groupKey, ids, confirmMsg);
  };

  const handleSoftDeleteSelectedInRnGroup = async (
    groupKey: string,
    groupRows: TicketBooking[],
    groupLabel: string
  ) => {
    const ids = ticketBookingRnGroupSoftDeleteCandidateIds(groupRows, {
      onlyIds: rnGroupSelectedIds,
    });
    if (ids.length === 0) {
      alert(
        locale === 'ko'
          ? '선택한 삭제 가능한 행이 없습니다. (확정 행은 선택·삭제할 수 없습니다)'
          : 'No deletable rows in your selection (confirmed rows cannot be deleted).'
      );
      return;
    }
    const confirmMsg =
      locale === 'ko'
        ? `${groupLabel}\n\n선택한 ${ids.length}건을 삭제 요청(목록에서 숨김)합니다.\n\n계속할까요?`
        : `${groupLabel}\n\nSoft-delete ${ids.length} selected row(s).\n\nContinue?`;
    await handleSoftDeleteTicketBookingIds(groupKey, ids, confirmMsg);
  };

  const renderDateViewGroupSummary = (dv: TicketDateViewGroup, variant: 'mobile' | 'desktop') => {
    const tourLine = formatCanyonCountsInline(dv.tourChoiceTotals);
    const ticketLine = formatCanyonCountsInline(dv.ticketChoiceTotals);
    const mismatch = dv.hasMismatch;
    const reconBundle = dateViewReconByDate.get(dv.dateYmd);
    const reconLoading =
      dateViewReconLoading && ticketTableLayout === 'byDate' && !dateViewReconByDate.has(dv.dateYmd);
    const wrap =
      variant === 'desktop'
        ? 'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]'
        : 'mt-1.5 space-y-1 text-[11px]';

    return (
      <div className={wrap}>
        <span className={mismatch ? 'text-red-800 font-semibold' : 'text-neutral-700'}>
          {locale === 'ko' ? '투어' : 'Tour'}: {tourLine}
        </span>
        <span className={mismatch ? 'text-red-800 font-semibold' : 'text-neutral-700'}>
          {locale === 'ko' ? '티켓' : 'Ticket'}: {ticketLine}
        </span>
        {mismatch ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 ring-1 ring-red-300">
            {locale === 'ko' ? 'L/X 불일치' : 'L/X mismatch'}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
            {locale === 'ko' ? 'L/X 일치' : 'L/X match'}
          </span>
        )}
        {dv.unlinkedTicketCount > 0 ? (
          <span className="text-amber-800 font-medium">
            {locale === 'ko'
              ? `미연결 티켓 ${dv.unlinkedTicketCount}건`
              : `${dv.unlinkedTicketCount} unlinked ticket(s)`}
          </span>
        ) : null}
        {dv.tours.length > 0 ? (
          <div
            className={`w-full ${variant === 'desktop' ? 'basis-full' : ''} rounded-md border border-slate-200/90 bg-white/70 px-2 py-1.5 text-[10px] text-slate-800`}
          >
            <div className="font-semibold text-slate-600 mb-0.5">
              {locale === 'ko' ? '이 날짜 투어' : 'Tours this day'}
            </div>
            <ul className="space-y-0.5">
              {dv.tours.map((tr) => (
                <li key={tr.tourId} className="leading-snug">
                  <span className="font-medium">{tr.label}</span>
                  <span className="text-slate-600 tabular-nums">
                    {' '}
                    — {formatCanyonCountsInline(tr.choiceCounts)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={variant === 'desktop' ? 'basis-full w-full' : 'w-full'}>
          <TicketBookingDateViewReconPanel
            bundle={reconBundle}
            loading={reconLoading}
            locale={locale}
            dayWindow={TICKET_BOOKING_STATEMENT_DAY_WINDOW}
            canDelete={canBookingMgmtSoftDeleteUi}
            onDataChanged={refreshDateViewReconForDate}
            onOpenLedgerRow={(row) => void openDateViewLedgerRow(row)}
          />
        </div>
      </div>
    );
  };

  const renderRnGroupBulkDeleteButtons = (
    groupKey: string,
    groupRows: TicketBooking[],
    variant: 'mobile' | 'desktop',
    groupLabel: string
  ) => {
    if (!canBookingMgmtSoftDeleteUi || groupRows.length < 2) return null;

    const busy = rnGroupBulkDeletingKey === groupKey;
    const nonConfirmedIds = ticketBookingRnGroupSoftDeleteCandidateIds(groupRows, {
      excludeConfirmed: true,
    });
    const selectedInGroupIds = ticketBookingRnGroupSoftDeleteCandidateIds(groupRows, {
      onlyIds: rnGroupSelectedIds,
    });
    const wrapClass =
      variant === 'desktop'
        ? 'ml-2 inline-flex flex-wrap items-center gap-1.5'
        : 'mt-2 flex flex-wrap items-center gap-1.5';

    const btnBase =
      variant === 'desktop'
        ? 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50'
        : 'inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold disabled:opacity-50';

    if (nonConfirmedIds.length === 0 && selectedInGroupIds.length === 0) return null;

    return (
      <span className={wrapClass}>
        {showRnRowSelection && selectedInGroupIds.length > 0 ? (
          <button
            type="button"
            className={`${btnBase} border-amber-700 bg-amber-50 text-amber-950 hover:bg-amber-100`}
            disabled={busy}
            title={
              locale === 'ko'
                ? '선택한 행 삭제 요청(목록에서 숨김). 확정 행은 선택할 수 없습니다.'
                : 'Soft-delete selected rows (confirmed rows cannot be selected).'
            }
            onClick={(e) => {
              e.stopPropagation();
              void handleSoftDeleteSelectedInRnGroup(groupKey, groupRows, groupLabel);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {busy
              ? locale === 'ko'
                ? '처리 중…'
                : 'Working…'
              : locale === 'ko'
                ? `선택 삭제 (${selectedInGroupIds.length})`
                : `Delete selected (${selectedInGroupIds.length})`}
          </button>
        ) : null}
        {nonConfirmedIds.length > 0 ? (
          <button
            type="button"
            className={`${btnBase} border-red-700 bg-red-50 text-red-900 hover:bg-red-100`}
            disabled={busy}
            title={
              locale === 'ko'
                ? '확정(예약)이 아닌 행만 삭제 요청(목록에서 숨김)합니다.'
                : 'Soft-delete all non-confirmed rows in this RN# group.'
            }
            onClick={(e) => {
              e.stopPropagation();
              void handleSoftDeleteNonConfirmedInRnGroup(groupKey, groupRows, groupLabel);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {busy
              ? locale === 'ko'
                ? '처리 중…'
                : 'Working…'
              : locale === 'ko'
                ? `확정 제외 삭제 (${nonConfirmedIds.length})`
                : `Delete non-confirmed (${nonConfirmedIds.length})`}
          </button>
        ) : null}
      </span>
    );
  };

  const renderRnGroupRowSelectCheckbox = (booking: TicketBooking) => {
    if (!showRnRowSelection) return null;
    const confirmed = isTicketBookingRowBookingConfirmed(booking);
    const checked = rnGroupSelectedIds.has(booking.id);
    return (
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
        checked={checked}
        disabled={confirmed || Boolean(booking.deletion_requested_at)}
        title={
          confirmed
            ? locale === 'ko'
              ? '확정된 행은 일괄 선택 삭제 대상이 아닙니다'
              : 'Confirmed rows cannot be bulk-deleted'
            : locale === 'ko'
              ? '선택 삭제 대상'
              : 'Select for bulk delete'
        }
        onChange={(e) => {
          e.stopPropagation();
          toggleRnGroupRowSelected(booking.id, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderTicketBookingActionButtons = useCallback(
    (
      booking: TicketBooking,
      opts?: { fromDetailModal?: boolean; size?: 'compact' | 'touch' }
    ) => {
      const touch = opts?.size === 'touch';
      const btn =
        touch
          ? 'flex-1 min-w-0 py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors'
          : 'px-1.5 py-0.5 text-xs rounded hover:opacity-90 transition-colors relative z-20';
      const wrap = touch ? 'flex flex-wrap gap-2 w-full' : 'flex flex-wrap items-center gap-0.5';

      return (
        <div className={wrap}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEdit(booking);
            }}
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
            title={locale === 'ko' ? '편집' : 'Edit'}
          >
            {locale === 'ko' ? '편집' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleViewHistory(booking.id);
            }}
            className={`${btn} bg-green-600 text-white hover:bg-green-700`}
            title={locale === 'ko' ? '히스토리' : 'History'}
          >
            {locale === 'ko' ? '히스토리' : 'History'}
          </button>
          {canBookingMgmtSoftDeleteUi && !booking.deletion_requested_at ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleRequestSoftDelete(booking.id, { fromDetailModal: opts?.fromDetailModal });
              }}
              className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}
              title={locale === 'ko' ? '삭제 요청 (목록에서 숨김)' : 'Request deletion'}
            >
              {locale === 'ko' ? '삭제' : 'Delete'}
            </button>
          ) : null}
          {canSuperDeleteTicketBooking && booking.deletion_requested_at ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDelete(booking.id, { fromDetailModal: opts?.fromDetailModal });
              }}
              className={`${btn} bg-red-700 text-white hover:bg-red-800`}
              title={locale === 'ko' ? '영구 삭제' : 'Permanent delete'}
            >
              {locale === 'ko' ? '영구 삭제' : 'Purge'}
            </button>
          ) : null}
          {canSuperDeleteTicketBooking &&
          isTicketBookingOffsetOrCancelRow(booking) &&
          !booking.deletion_requested_at ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (
                  confirm(
                    locale === 'ko'
                      ? '이 조정/취소 행을 바로 영구 삭제하시겠습니까? (되돌릴 수 없습니다)'
                      : 'Permanently delete this adjustment/cancel row now? This cannot be undone.'
                  )
                ) {
                  void handleDelete(booking.id, { fromDetailModal: opts?.fromDetailModal });
                }
              }}
              className={`${btn} bg-red-700 text-white hover:bg-red-800`}
              title={locale === 'ko' ? '조정 행 영구 삭제' : 'Purge adjustment row'}
            >
              {locale === 'ko' ? '영구 삭제' : 'Purge'}
            </button>
          ) : null}
          {booking.deletion_requested_at && !canSuperDeleteTicketBooking ? (
            <span
              className={
                touch
                  ? 'flex-1 text-center text-xs text-amber-700 bg-amber-50 py-2 rounded-lg'
                  : 'text-[10px] text-amber-700 px-1'
              }
            >
              {locale === 'ko' ? '삭제 요청됨' : 'Pending delete'}
            </span>
          ) : null}
        </div>
      );
    },
    [
      locale,
      canBookingMgmtSoftDeleteUi,
      canSuperDeleteTicketBooking,
      handleEdit,
      handleViewHistory,
      handleRequestSoftDelete,
      handleDelete,
    ]
  );

  const openInvoiceQuickModal = (booking: TicketBooking) => {
    invoicePhotoLoadGenRef.current += 1;
    setInvoiceQuickBooking(booking);
    invoiceQuickDraftRef.current = booking.invoice_number?.trim() || '';
    setInvoiceQuickPhotoUrls([]);
    setZelleQuickPhotoUrls([]);
    setInvoiceModalPasteTarget(null);
  };

  const handleDebouncedInvoiceAttachmentLoad = useCallback(
    (company: string, draft: string) => {
      void loadInvoicePhotosForDraft(company, draft);
    },
    [loadInvoicePhotosForDraft]
  );

  const saveInvoiceInline = useCallback(
    async (bookingId: string, invoiceNumber: string) => {
      const v = invoiceNumber.trim();
      const booking = bookingsRef.current.find((b) => b.id === bookingId);
      if (!booking) return;
      const prev = booking.invoice_number?.trim() || '';
      if (v === prev) return;

      setInvoiceInlineSavingId(bookingId);
      try {
        const { error } = await supabase
          .from('ticket_bookings')
          .update({ invoice_number: v || null })
          .eq('id', bookingId);
        if (error) throw error;
        setBookings((prevBookings) => {
          const next = prevBookings.map((b) =>
            b.id === bookingId ? { ...b, invoice_number: v } : b
          );
          void refreshInvoiceAttachmentMapForBookings(next);
          return next;
        });
        setEditingBooking((prev) =>
          prev?.id === bookingId ? { ...prev, invoice_number: v } : prev
        );
      } catch (err) {
        console.error(err);
        alert(
          locale === 'ko'
            ? 'Invoice 번호 저장에 실패했습니다.'
            : 'Failed to save invoice number.'
        );
      } finally {
        setInvoiceInlineSavingId(null);
      }
    },
    [locale, refreshInvoiceAttachmentMapForBookings]
  );

  const saveInvoiceQuick = async () => {
    if (!invoiceQuickBooking) return;
    const v = invoiceQuickDraftRef.current.trim();
    const co = invoiceCompanyNorm(invoiceQuickBooking.company);
    const urlsSnapshot = [...invoiceQuickPhotoUrls];
    const zelleSnapshot = [...zelleQuickPhotoUrls];
    const id = invoiceQuickBooking.id;
    setInvoiceQuickSaving(true);
    try {
      const { error } = await supabase
        .from('ticket_bookings')
        .update({ invoice_number: v || null })
        .eq('id', id);
      if (error) throw error;

      /** 붙여넣기 직후 DB 반영·맵 새로고침 타이밍 문제를 줄이기 위해, 저장 시점에 첨부 URL도 한 번 더 맞춤 */
      if (co && v && (urlsSnapshot.length > 0 || zelleSnapshot.length > 0)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: attachErr } = await (supabase as any)
          .from('ticket_invoice_attachments')
          .upsert(
            {
              company: co,
              invoice_number: v,
              file_urls: urlsSnapshot,
              zelle_file_urls: zelleSnapshot,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'company,invoice_number' }
          );
        if (attachErr) throw attachErr;
      }

      setBookings((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, invoice_number: v } : b));
        void refreshInvoiceAttachmentMapForBookings(next);
        return next;
      });
      setEditingBooking((prev) => (prev?.id === id ? { ...prev, invoice_number: v } : prev));
      invoicePhotoLoadGenRef.current += 1;
      setInvoiceQuickBooking(null);
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다. Invoice 번호 또는 인보이스 첨부 동기화를 확인해 주세요.');
    } finally {
      setInvoiceQuickSaving(false);
    }
  };

  const uploadInvoicePhotos = useCallback(
    async (files: File[]) => {
      if (!invoiceQuickBooking || !files.length) return;
      if (invoicePhotoUploading || zellePhotoUploading || invoicePhotoRemoving) return;
      const inv = invoiceQuickDraftRef.current.trim();
      if (!inv) {
        alert('먼저 Invoice 번호를 입력해 주세요.');
        return;
      }
      const company = invoiceCompanyNorm(invoiceQuickBooking.company);
      if (!company) {
        alert('회사(company) 정보가 없어 인보이스 첨부를 저장할 수 없습니다.');
        return;
      }
      setInvoicePhotoUploading(true);
      try {
        const fd = new FormData();
        fd.append('bucketType', 'ticket_bookings');
        files.forEach((f) => fd.append('files', f));
        const res = await fetchUploadApi(fd);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(typeof data?.error === 'string' ? data.error : '파일 업로드에 실패했습니다.');
          return;
        }
        const newUrls = Array.isArray(data.urls) ? data.urls : [];
        let merged: string[] = [];
        setInvoiceQuickPhotoUrls((prev) => {
          merged = [...prev, ...newUrls];
          return merged;
        });
        const payload = {
          company,
          invoice_number: inv,
          file_urls: merged,
          zelle_file_urls: zelleQuickPhotoUrlsRef.current,
          updated_at: new Date().toISOString(),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: upsertRow, error } = await (supabase as any)
          .from('ticket_invoice_attachments')
          .upsert(payload, { onConflict: 'company,invoice_number' })
          .select('file_urls, zelle_file_urls')
          .maybeSingle();
        if (error) throw error;
        const urlsFromDb = normalizeDbFileUrls(upsertRow?.file_urls);
        const finalUrls = urlsFromDb.length > 0 ? urlsFromDb : merged;
        const zelleFromDb = normalizeDbFileUrls(upsertRow?.zelle_file_urls);
        const finalZelle =
          zelleFromDb.length > 0 ? zelleFromDb : zelleQuickPhotoUrlsRef.current;
        invoicePhotoLoadGenRef.current += 1;
        setInvoiceQuickPhotoUrls(finalUrls);
        setZelleQuickPhotoUrls(finalZelle);
        setInvoiceAttachmentMap((prev) => {
          const next = new Map(prev);
          next.set(makeInvoiceKey(company, inv), finalUrls);
          return next;
        });
        setZelleAttachmentMap((prev) => {
          const next = new Map(prev);
          if (finalZelle.length === 0) next.delete(makeInvoiceKey(company, inv));
          else next.set(makeInvoiceKey(company, inv), finalZelle);
          return next;
        });
      } catch (e) {
        console.error(e);
        alert('인보이스 첨부 저장에 실패했습니다.');
      } finally {
        setInvoicePhotoUploading(false);
        if (invoicePhotoInputRef.current) invoicePhotoInputRef.current.value = '';
      }
    },
    [invoiceQuickBooking, invoicePhotoUploading, zellePhotoUploading, invoicePhotoRemoving]
  );

  const uploadZellePhotos = useCallback(
    async (files: File[]) => {
      if (!invoiceQuickBooking || !files.length) return;
      if (invoicePhotoUploading || zellePhotoUploading || invoicePhotoRemoving) return;
      const inv = invoiceQuickDraftRef.current.trim();
      if (!inv) {
        alert('먼저 Invoice 번호를 입력해 주세요.');
        return;
      }
      const company = invoiceCompanyNorm(invoiceQuickBooking.company);
      if (!company) {
        alert('회사(company) 정보가 없어 Zelle 첨부를 저장할 수 없습니다.');
        return;
      }
      setZellePhotoUploading(true);
      try {
        const fd = new FormData();
        fd.append('bucketType', 'ticket_bookings');
        files.forEach((f) => fd.append('files', f));
        const res = await fetchUploadApi(fd);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(typeof data?.error === 'string' ? data.error : '파일 업로드에 실패했습니다.');
          return;
        }
        const newUrls = Array.isArray(data.urls) ? data.urls : [];
        let merged: string[] = [];
        setZelleQuickPhotoUrls((prev) => {
          merged = [...prev, ...newUrls];
          return merged;
        });
        const payload = {
          company,
          invoice_number: inv,
          file_urls: invoiceQuickPhotoUrlsRef.current,
          zelle_file_urls: merged,
          updated_at: new Date().toISOString(),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: upsertRow, error } = await (supabase as any)
          .from('ticket_invoice_attachments')
          .upsert(payload, { onConflict: 'company,invoice_number' })
          .select('file_urls, zelle_file_urls')
          .maybeSingle();
        if (error) throw error;
        const invFromDb = normalizeDbFileUrls(upsertRow?.file_urls);
        const finalInv =
          invFromDb.length > 0 ? invFromDb : invoiceQuickPhotoUrlsRef.current;
        const zelleFromDb = normalizeDbFileUrls(upsertRow?.zelle_file_urls);
        const finalZelle = zelleFromDb.length > 0 ? zelleFromDb : merged;
        invoicePhotoLoadGenRef.current += 1;
        setInvoiceQuickPhotoUrls(finalInv);
        setZelleQuickPhotoUrls(finalZelle);
        const key = makeInvoiceKey(company, inv);
        setInvoiceAttachmentMap((prev) => {
          const next = new Map(prev);
          if (finalInv.length === 0) next.delete(key);
          else next.set(key, finalInv);
          return next;
        });
        setZelleAttachmentMap((prev) => {
          const next = new Map(prev);
          next.set(key, finalZelle);
          return next;
        });
      } catch (e) {
        console.error(e);
        alert('Zelle 첨부 저장에 실패했습니다.');
      } finally {
        setZellePhotoUploading(false);
        if (zellePhotoInputRef.current) zellePhotoInputRef.current.value = '';
      }
    },
    [invoiceQuickBooking, invoicePhotoUploading, zellePhotoUploading, invoicePhotoRemoving]
  );

  const handleInvoicePhotoPick = (files: FileList | null) => {
    if (!files?.length) return;
    void uploadInvoicePhotos(Array.from(files));
  };

  const handleZellePhotoPick = (files: FileList | null) => {
    if (!files?.length) return;
    void uploadZellePhotos(Array.from(files));
  };

  const removeInvoicePhotoUrl = async (urlToRemove: string) => {
    if (!invoiceQuickBooking || invoicePhotoRemoving || invoicePhotoUploading || zellePhotoUploading) return;
    const inv = invoiceQuickDraftRef.current.trim();
    if (!inv) return;
    if (!confirm('이 첨부를 삭제할까요?')) return;
    const company = invoiceCompanyNorm(invoiceQuickBooking.company);
    if (!company) return;
    setInvoicePhotoRemoving(true);
    try {
      const newUrls = invoiceQuickPhotoUrls.filter((u) => u !== urlToRemove);
      const zelleKeep = zelleQuickPhotoUrls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      if (newUrls.length === 0 && zelleKeep.length === 0) {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .delete()
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      } else if (newUrls.length === 0) {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .update({
            file_urls: [],
            updated_at: new Date().toISOString(),
          })
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .update({
            file_urls: newUrls,
            updated_at: new Date().toISOString(),
          })
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      }
      invoicePhotoLoadGenRef.current += 1;
      setInvoiceQuickPhotoUrls(newUrls);
      setInvoiceAttachmentMap((prev) => {
        const next = new Map(prev);
        if (newUrls.length === 0) next.delete(makeInvoiceKey(company, inv));
        else next.set(makeInvoiceKey(company, inv), newUrls);
        return next;
      });
    } catch (e) {
      console.error(e);
      alert('첨부 삭제에 실패했습니다.');
    } finally {
      setInvoicePhotoRemoving(false);
    }
  };

  const removeZellePhotoUrl = async (urlToRemove: string) => {
    if (!invoiceQuickBooking || invoicePhotoRemoving || invoicePhotoUploading || zellePhotoUploading) return;
    const inv = invoiceQuickDraftRef.current.trim();
    if (!inv) return;
    if (!confirm('이 첨부를 삭제할까요?')) return;
    const company = invoiceCompanyNorm(invoiceQuickBooking.company);
    if (!company) return;
    setInvoicePhotoRemoving(true);
    try {
      const newZelle = zelleQuickPhotoUrls.filter((u) => u !== urlToRemove);
      const invKeep = invoiceQuickPhotoUrls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      if (newZelle.length === 0 && invKeep.length === 0) {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .delete()
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      } else if (newZelle.length === 0) {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .update({
            zelle_file_urls: [],
            updated_at: new Date().toISOString(),
          })
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .update({
            zelle_file_urls: newZelle,
            updated_at: new Date().toISOString(),
          })
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
      }
      invoicePhotoLoadGenRef.current += 1;
      setZelleQuickPhotoUrls(newZelle);
      setZelleAttachmentMap((prev) => {
        const next = new Map(prev);
        if (newZelle.length === 0) next.delete(makeInvoiceKey(company, inv));
        else next.set(makeInvoiceKey(company, inv), newZelle);
        return next;
      });
    } catch (e) {
      console.error(e);
      alert('첨부 삭제에 실패했습니다.');
    } finally {
      setInvoicePhotoRemoving(false);
    }
  };

  const openInvoiceAttachmentView = (booking: TicketBooking) => {
    const inv = booking.invoice_number?.trim();
    if (!inv) {
      openInvoiceQuickModal(booking);
      return;
    }
    const urls = invoiceAttachmentMap.get(makeInvoiceKey(booking.company, inv)) || [];
    if (urls.length === 0) {
      openInvoiceQuickModal(booking);
      return;
    }
    setInvoiceLightbox({
      company: booking.company,
      invoiceNumber: inv,
      urls,
      kind: 'invoice',
    });
    setInvoiceLightboxIndex(0);
  };

  const openZelleAttachmentView = (booking: TicketBooking) => {
    const inv = booking.invoice_number?.trim();
    if (!inv) {
      openInvoiceQuickModal(booking);
      return;
    }
    const urls = zelleAttachmentMap.get(makeInvoiceKey(booking.company, inv)) || [];
    if (urls.length === 0) {
      openInvoiceQuickModal(booking);
      return;
    }
    setInvoiceLightbox({
      company: booking.company,
      invoiceNumber: inv,
      urls,
      kind: 'zelle',
    });
    setInvoiceLightboxIndex(0);
  };

  const removeAttachmentFromLightbox = async (urlToRemove: string) => {
    if (!invoiceLightbox || invoicePhotoRemoving) return;
    if (!confirm('이 첨부를 삭제할까요?')) return;
    const { company: companyRaw, invoiceNumber: inv } = invoiceLightbox;
    const kind = invoiceLightbox.kind ?? 'invoice';
    const company = invoiceCompanyNorm(companyRaw);
    if (!company) return;
    setInvoicePhotoRemoving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: row, error: fetchErr } = await sb
        .from('ticket_invoice_attachments')
        .select('file_urls, zelle_file_urls')
        .eq('company', company)
        .eq('invoice_number', inv)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      let nextInv = normalizeDbFileUrls(row?.file_urls);
      let nextZelle = normalizeDbFileUrls(row?.zelle_file_urls);
      if (kind === 'invoice') {
        nextInv = nextInv.filter((u) => u !== urlToRemove);
      } else {
        nextZelle = nextZelle.filter((u) => u !== urlToRemove);
      }
      const key = makeInvoiceKey(company, inv);
      if (nextInv.length === 0 && nextZelle.length === 0) {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .delete()
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
        setInvoiceLightbox(null);
      } else {
        const { error } = await sb
          .from('ticket_invoice_attachments')
          .update({
            file_urls: nextInv,
            zelle_file_urls: nextZelle,
            updated_at: new Date().toISOString(),
          })
          .eq('company', company)
          .eq('invoice_number', inv);
        if (error) throw error;
        const urlsForBox = kind === 'zelle' ? nextZelle : nextInv;
        setInvoiceLightbox((prev) =>
          prev ? { ...prev, urls: urlsForBox } : null
        );
        const imgLeft = urlsForBox.filter(isImageAttachmentUrl);
        setInvoiceLightboxIndex((i) =>
          Math.min(i, Math.max(0, imgLeft.length - 1))
        );
      }
      setInvoiceAttachmentMap((prev) => {
        const next = new Map(prev);
        if (nextInv.length === 0) next.delete(key);
        else next.set(key, nextInv);
        return next;
      });
      setZelleAttachmentMap((prev) => {
        const next = new Map(prev);
        if (nextZelle.length === 0) next.delete(key);
        else next.set(key, nextZelle);
        return next;
      });
    } catch (e) {
      console.error(e);
      alert('첨부 삭제에 실패했습니다.');
    } finally {
      setInvoicePhotoRemoving(false);
    }
  };

  useEffect(() => {
    if (!invoiceQuickBooking) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = clipboardFilesFromPasteEvent(e);
      if (!files.length) return;
      if (!invoiceModalPasteTarget) {
        e.preventDefault();
        alert('인보이스 또는 Zelle 추가 박스를 먼저 클릭한 뒤 붙여넣기(Ctrl+V) 해 주세요.');
        return;
      }
      e.preventDefault();
      if (invoiceModalPasteTarget === 'invoice') {
        void uploadInvoicePhotos(Array.from(files));
      } else {
        void uploadZellePhotos(Array.from(files));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [
    invoiceQuickBooking,
    invoiceModalPasteTarget,
    uploadInvoicePhotos,
    uploadZellePhotos,
  ]);

  useEffect(() => {
    if (!invoiceQuickBooking && !invoiceLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInvoiceQuickBooking(null);
        setInvoiceLightbox(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invoiceQuickBooking, invoiceLightbox]);

  const invoiceLightboxImageUrls = useMemo(() => {
    if (!invoiceLightbox) return [];
    return invoiceLightbox.urls.filter(isImageAttachmentUrl);
  }, [invoiceLightbox]);

  const invoiceLightboxOtherUrls = useMemo(() => {
    if (!invoiceLightbox) return [];
    return invoiceLightbox.urls.filter((u) => !isImageAttachmentUrl(u));
  }, [invoiceLightbox]);

  useEffect(() => {
    if (!invoiceLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (invoiceLightboxImageUrls.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setInvoiceLightboxIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setInvoiceLightboxIndex((i) =>
          Math.min(invoiceLightboxImageUrls.length - 1, i + 1)
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invoiceLightbox, invoiceLightboxImageUrls.length]);

  const invoiceLightboxSafeIndex =
    invoiceLightboxImageUrls.length > 0
      ? Math.min(
          Math.max(0, invoiceLightboxIndex),
          invoiceLightboxImageUrls.length - 1
        )
      : 0;

  const handleSave = (booking: TicketBooking) => {
    if (editingBooking) {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== booking.id) return b;
          if (b.tours !== undefined) {
            return { ...booking, tours: b.tours };
          }
          return { ...booking };
        })
      );
    } else {
      setBookings(prev => [booking, ...prev]);
    }
    setShowForm(false);
    setEditingBooking(null);
  };

  const handleInvoiceUploadApplied = useCallback(
    (updates: { id: string; invoice_number: string }[]) => {
      if (updates.length === 0) return;
      setBookings((prev) => {
        const next = prev.map((b) => {
          const u = updates.find((x) => x.id === b.id);
          return u ? { ...b, invoice_number: u.invoice_number } : b;
        });
        void refreshInvoiceAttachmentMapForBookings(next);
        return next;
      });
      setEditingBooking((prev) => {
        if (!prev) return prev;
        const u = updates.find((x) => x.id === prev.id);
        return u ? { ...prev, invoice_number: u.invoice_number } : prev;
      });
    },
    [refreshInvoiceAttachmentMapForBookings]
  );

  const handleInvoiceModalRnUpdated = useCallback((u: { id: string; rn_number: string }) => {
    setBookings((prev) => prev.map((b) => (b.id === u.id ? { ...b, rn_number: u.rn_number } : b)));
  }, []);

  const handleInvoiceModalNoteUpdated = useCallback((u: { id: string; note: string | null }) => {
    setBookings((prev) => prev.map((b) => (b.id === u.id ? { ...b, note: u.note ?? null } : b)));
  }, []);

  const getCancelDueDate = useCallback(
    (booking: TicketBooking): string | null =>
      getCancelDueDateForTicketBooking(
        { check_in_date: booking.check_in_date, company: booking.company },
        supplierProductsMap.get(booking.id)
      ),
    [supplierProductsMap]
  );

  const buildCancelDueColorMapFor = useCallback((bookings: TicketBooking[]) => {
    const cancelDueColorMap = new Map<string, string>();
    let colorIndex = 0;
    const usedDates = new Set<string>();
    bookings.forEach((booking) => {
      const cancelDueDate = getCancelDueDate(booking);
      if (cancelDueDate && !usedDates.has(cancelDueDate)) {
        cancelDueColorMap.set(
          cancelDueDate,
          TICKET_TABLE_CANCEL_DUE_BG[colorIndex % TICKET_TABLE_CANCEL_DUE_BG.length]
        );
        usedDates.add(cancelDueDate);
        colorIndex++;
      }
    });
    return cancelDueColorMap;
  }, [getCancelDueDate]);

  const pendingRequestCount = useMemo(
    () => bookings.filter((b) => isTicketBookingPendingRequestState(b)).length,
    [bookings]
  );

  const auditedCount = useMemo(
    () => bookings.filter((b) => Boolean(b.audited)).length,
    [bookings]
  );

  const ticketNeedCheckUnionCount = useMemo(() => {
    const ids = new Set<string>();
    for (const b of bookings) {
      if (String(b.status || '').toLowerCase() === 'cancelled') continue;
      const noTour = b.tour_id == null || String(b.tour_id).trim() === '';
      if (noTour) ids.add(b.id);
    }
    for (const b of bookings) {
      if (String(b.status || '').toLowerCase() === 'cancelled') continue;
      const sp = supplierProductsMap.get(b.id);
      if (isTicketBookingCancelDueStaleBeforeCheckIn(b, sp)) ids.add(b.id);
    }
    return ids.size;
  }, [bookings, supplierProductsMap]);

  // Future Event 필터: 체크인 날짜가 오늘 이후인 예약만 표시
  const matchesFutureEvent = (booking: TicketBooking): boolean => {
    if (!futureEventFilter) return true;
    
    const checkInDate = booking.check_in_date ? new Date(booking.check_in_date) : null;
    if (!checkInDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    checkInDate.setHours(0, 0, 0, 0);
    
    return checkInDate >= today;
  };

  // 취소 기한 필터: 취소 기한 날짜가 오늘이거나 과거이고, 체크인 날짜가 오늘이거나 미래인 예약만 표시
  const matchesCancelDeadline = (booking: TicketBooking): boolean => {
    if (!cancelDeadlineFilter) return true;
    
    if (!booking.check_in_date || !booking.company) return false;
    
    const supplierProduct = supplierProductsMap.get(booking.id);
    const cancelDeadlineDays = getCancelDeadlineDays(booking.company, booking.check_in_date, supplierProduct);
    if (cancelDeadlineDays === 0) return false;
    
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    
    const cancelDeadline = new Date(checkInDate);
    cancelDeadline.setDate(cancelDeadline.getDate() - cancelDeadlineDays);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 취소 기한 날짜가 오늘이거나 과거이고, 체크인 날짜가 오늘이거나 미래인 예약만 표시
    // 조건: 취소 기한 날짜 <= 오늘 && 체크인 날짜 >= 오늘
    return cancelDeadline <= today && checkInDate >= today;
  };

  // 검색어를 매 행마다 lowercase 변환하지 않도록 한 번만 정규화
  const searchTermLower = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  // 검색 필터
  const matchesSearch = (booking: TicketBooking): boolean => {
    if (!searchTermLower) return true;
    return (
      (booking.category || '').toLowerCase().includes(searchTermLower) ||
      (booking.reservation_name || '').toLowerCase().includes(searchTermLower) ||
      (booking.rn_number || '').toLowerCase().includes(searchTermLower) ||
      (booking.invoice_number || '').toLowerCase().includes(searchTermLower) ||
      (booking.zelle_confirmation_number || '').toLowerCase().includes(searchTermLower) ||
      (booking.note || '').toLowerCase().includes(searchTermLower) ||
      (booking.company || '').toLowerCase().includes(searchTermLower)
    );
  };

  const hasStatusFilter = selectedStatusFilters.size > 0;

  /** 확정 + 투어 연결 + 티켓 수량과 투어 예약 총원 불일치 */
  const isConfirmedEaHeadcountMismatch = (booking: TicketBooking): boolean => {
    if (booking.status?.toLowerCase() !== 'confirmed') return false;
    if (!booking.tour_id || !booking.tours) return false;
    const tourTotal = booking.tours.total_people;
    if (tourTotal == null || Number.isNaN(Number(tourTotal))) return false;
    return Number(booking.ea) !== Number(tourTotal);
  };

  const hasCheckInDateRangeFilter = Boolean(checkInDateFrom || checkInDateTo);

  // 기간(시작–종료) 필터 — 투어일(체크인) 또는 제출일
  const matchesDate = (booking: TicketBooking): boolean => {
    if (!hasCheckInDateRangeFilter) return true;
    const ymd = bookingPeriodYmd(booking, dateRangeBasis);
    if (!ymd) return false;
    if (checkInDateFrom && ymd < checkInDateFrom) return false;
    if (checkInDateTo && ymd > checkInDateTo) return false;
    return true;
  };

  // 투어 연결 필터
  const matchesTour = (booking: TicketBooking): boolean => {
    if (tourFilter === 'all') return true;
    if (tourFilter === 'connected') return !!booking.tour_id;
    if (tourFilter === 'unconnected') return !booking.tour_id;
    return true;
  };

  const vendorCompanyOptions = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) {
      const co = invoiceCompanyNorm(b.company);
      if (co) names.add(co);
    }
    return [...names].sort((a, b) => a.localeCompare(b, locale === 'ko' ? 'ko' : 'en'));
  }, [bookings, locale]);

  const matchesCompany = (booking: TicketBooking): boolean => {
    if (companyFilter === 'all') return true;
    return invoiceCompanyNorm(booking.company) === companyFilter;
  };

  const showVendorPeriodStats = Boolean(
    checkInDateFrom && checkInDateTo && companyFilter !== 'all'
  );

  const vendorPeriodStatsBookings = useMemo(() => {
    if (!showVendorPeriodStats) return [];
    return bookings.filter((booking) => {
      if (invoiceCompanyNorm(booking.company) !== companyFilter) return false;
      const ymd = bookingPeriodYmd(booking, dateRangeBasis);
      if (!ymd) return false;
      if (ymd < checkInDateFrom || ymd > checkInDateTo) return false;
      return true;
    });
  }, [
    bookings,
    checkInDateFrom,
    checkInDateTo,
    companyFilter,
    dateRangeBasis,
    showVendorPeriodStats,
  ]);

  const vendorPeriodStats = useMemo(
    () => computeTicketBookingVendorPeriodStats(vendorPeriodStatsBookings),
    [vendorPeriodStatsBookings]
  );

  const bookingsPassingBaseFilters = useMemo(() => {
    return bookings.filter(
      (booking) =>
        matchesSearch(booking) &&
        matchesDate(booking) &&
        matchesTour(booking) &&
        matchesCompany(booking) &&
        matchesFutureEvent(booking) &&
        matchesCancelDeadline(booking)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bookings,
    searchTermLower,
    checkInDateFrom,
    checkInDateTo,
    dateRangeBasis,
    tourFilter,
    companyFilter,
    futureEventFilter,
    cancelDeadlineFilter,
    supplierProductsMap,
  ]);

  const multiRnBookingIdSet = useMemo(
    () => ticketBookingIdsInMultiRnGroups(bookingsPassingBaseFilters),
    [bookingsPassingBaseFilters]
  );

  const multiRnGroupCount = useMemo(
    () => countTicketBookingMultiRnGroups(bookingsPassingBaseFilters),
    [bookingsPassingBaseFilters]
  );

  // 모든 필터를 적용한 부킹 목록 (입력/필터/뷰 변경 시에만 재계산)
  const filteredBookings = useMemo(() => {
    return bookingsPassingBaseFilters.filter((booking) => {
      if (hideAuditedFilter && Boolean(booking.audited)) return false;
      if (multiRnOnlyFilter && !multiRnBookingIdSet.has(booking.id)) return false;
      if (viewMode === 'table' && needsReviewEaMismatch) {
        return isConfirmedEaHeadcountMismatch(booking);
      }
      if (pendingRequestOnlyFilter) {
        return isTicketBookingPendingRequestState(booking);
      }
      return ticketBookingMatchesStatusFilters(booking, selectedStatusFilters);
    });
  }, [
    bookingsPassingBaseFilters,
    hideAuditedFilter,
    multiRnOnlyFilter,
    multiRnBookingIdSet,
    selectedStatusFilters,
    pendingRequestOnlyFilter,
    needsReviewEaMismatch,
    viewMode,
  ]);

  // 정렬된 부킹 목록 (정렬 필드/방향 변경 시에만 재계산)
  const sortedBookings = useMemo(() => {
    if (!sortField) return filteredBookings;
    const arr = [...filteredBookings];
    if (sortField === 'date') {
      arr.sort((a, b) => {
        const dateA = a.check_in_date ? new Date(a.check_in_date).getTime() : 0;
        const dateB = b.check_in_date ? new Date(b.check_in_date).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (sortField === 'submit_on') {
      arr.sort((a, b) => {
        const dateA = a.submit_on ? new Date(a.submit_on).getTime() : 0;
        const dateB = b.submit_on ? new Date(b.submit_on).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }
    return arr;
  }, [filteredBookings, sortField, sortDirection]);

  const dateViewGroupsAll = useMemo(() => {
    if (ticketTableLayout !== 'byDate') return null;
    return buildTicketDateViewGroups(
      sortedBookings as TicketDateViewBookingRow[],
      tourEvents,
      locale,
      tourFallbackLabel,
      {
        bookingCheckInYmd: (b) => bookingCheckInYmd(b as TicketBooking),
        tourOverlapsDate: tourOverlapsCalendarYmd,
        getProductName: (products) =>
          getProductName(products as TourEvent['products']),
      }
    );
  }, [ticketTableLayout, sortedBookings, tourEvents, locale, tourFallbackLabel]);

  const dateViewGroups = useMemo(() => {
    if (!dateViewGroupsAll) return null;
    if (!lxMismatchOnlyFilter) return dateViewGroupsAll;
    return dateViewGroupsAll.filter((g) => g.hasMismatch);
  }, [dateViewGroupsAll, lxMismatchOnlyFilter]);

  const listTotalPages = useMemo(() => {
    if (ticketTableLayout === 'byDate' && dateViewGroups) {
      return Math.max(1, Math.ceil(dateViewGroups.length / listPageSize) || 1);
    }
    return Math.max(1, Math.ceil(sortedBookings.length / listPageSize) || 1);
  }, [ticketTableLayout, dateViewGroups, sortedBookings.length, listPageSize]);

  const listPageEffective = Math.min(listPage, listTotalPages);

  const pagedSortedBookings = useMemo(() => {
    const start = (listPageEffective - 1) * listPageSize;
    return sortedBookings.slice(start, start + listPageSize);
  }, [sortedBookings, listPageEffective, listPageSize]);

  const pagedDateViewGroups = useMemo(() => {
    if (!dateViewGroups) return null;
    const start = (listPageEffective - 1) * listPageSize;
    return dateViewGroups.slice(start, start + listPageSize);
  }, [dateViewGroups, listPageEffective, listPageSize]);

  /** 날짜별 앤텔롭 대조 — 안정 문자열 키(배열 참조 변경만으로 effect 재실행 방지) */
  const dateViewReconDatesKey = useMemo(() => {
    if (ticketTableLayout !== 'byDate' || !dateViewGroups?.length) return '';
    const start = (listPageEffective - 1) * listPageSize;
    return dateViewGroups
      .slice(start, start + listPageSize)
      .map((g) => g.dateYmd)
      .join('|');
  }, [ticketTableLayout, dateViewGroups, listPageEffective, listPageSize]);

  const dateViewReconFetchGenRef = useRef(0);

  useEffect(() => {
    if (!dateViewReconDatesKey) {
      setDateViewReconByDate(new Map());
      setDateViewReconLoading(false);
      return;
    }
    const dates = dateViewReconDatesKey.split('|').filter(Boolean);
    const bookingRows = bookingsRef.current;
    const tbByDate = new Map<string, Array<Record<string, unknown>>>();
    for (const dateYmd of dates) {
      tbByDate.set(
        dateYmd,
        bookingRows
          .filter((b) => bookingCheckInYmd(b) === dateYmd)
          .map((b) => ({
            id: b.id,
            company: b.company,
            category: b.category,
            expense: b.expense,
            time: b.time,
            ea: b.ea,
          }))
      );
    }
    const gen = ++dateViewReconFetchGenRef.current;
    let cancelled = false;
    setDateViewReconLoading(true);
    void (async () => {
      try {
        const map = await fetchTicketDateViewReconForDates(supabase, dates, tbByDate, locale, {
          dayWindow: TICKET_BOOKING_STATEMENT_DAY_WINDOW,
        });
        if (!cancelled && gen === dateViewReconFetchGenRef.current) setDateViewReconByDate(map);
      } catch (e) {
        if (!cancelled && gen === dateViewReconFetchGenRef.current && !isAbortLikeError(e)) {
          console.error('[TicketBookingList] date view recon:', e);
          setDateViewReconByDate(new Map());
        }
      } finally {
        if (!cancelled && gen === dateViewReconFetchGenRef.current) setDateViewReconLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateViewReconDatesKey, locale]);

  const refreshDateViewReconForDate = useCallback(
    async (dateYmd: string, opts?: { reloadBookings?: boolean }) => {
      const bookingRows = bookingsRef.current;
      const tbByDate = new Map<string, Array<Record<string, unknown>>>();
      tbByDate.set(
        dateYmd,
        bookingRows
          .filter((b) => bookingCheckInYmd(b) === dateYmd)
          .map((b) => ({
            id: b.id,
            company: b.company,
            category: b.category,
            expense: b.expense,
            time: b.time,
            ea: b.ea,
            check_in_date: b.check_in_date,
            submit_on: b.submit_on,
          }))
      );
      try {
        const map = await fetchTicketDateViewReconForDates(supabase, [dateYmd], tbByDate, locale, {
          dayWindow: TICKET_BOOKING_STATEMENT_DAY_WINDOW,
        });
        const bundle = map.get(dateYmd);
        if (bundle) {
          setDateViewReconByDate((prev) => {
            const next = new Map(prev);
            next.set(dateYmd, bundle);
            return next;
          });
        }
        if (opts?.reloadBookings !== false) {
          await fetchBookingsRef.current();
        }
      } catch (e) {
        if (!isAbortLikeError(e)) console.error('[TicketBookingList] refresh date view recon:', e);
      }
    },
    [locale]
  );

  const openDateViewLedgerRow = useCallback(
    async (row: DateViewLedgerRow) => {
      if (row.sourceTable === 'ticket_bookings') {
        const booking =
          bookings.find((b) => b.id === row.sourceId) ??
          bookingsRef.current.find((b) => b.id === row.sourceId) ??
          null;
        if (!booking) {
          alert(
            locale === 'ko'
              ? '목록에 없는 부킹입니다. 필터를 확인하거나 새로고침 후 다시 시도하세요.'
              : 'Booking not in the current list. Refresh or adjust filters and try again.'
          );
          return;
        }
        setSelectedBookings([booking]);
        setShowBookingModal(true);
        return;
      }
      if (!row.dateYmd) return;
      setStmtReconCtx({
        sourceTable: row.sourceTable,
        sourceId: row.sourceId,
        dateYmd: row.dateYmd,
        amount: row.amount,
        direction: 'outflow',
      });
      setStmtReconOpen(true);
    },
    [bookings, locale]
  );

  const ticketTableGroups = useMemo((): Array<{
    key: string;
    label: string;
    rows: TicketBooking[];
    dateView?: TicketDateViewGroup;
  }> | null => {
    if (ticketTableLayout === 'byRn') return buildTicketRnGroups(pagedSortedBookings);
    if (ticketTableLayout === 'byTour') {
      return buildTicketTourGroups(pagedSortedBookings, locale, tourFallbackLabel);
    }
    if (ticketTableLayout === 'byDate' && pagedDateViewGroups) {
      return pagedDateViewGroups.map((g) => ({
        key: g.key,
        label: g.label,
        rows: sortedBookings.filter((b) => bookingCheckInYmd(b) === g.dateYmd),
        dateView: g,
      }));
    }
    return null;
  }, [ticketTableLayout, pagedSortedBookings, sortedBookings, locale, tourFallbackLabel, pagedDateViewGroups]);

  /** 테이블 뷰 현재 페이지 부킹 id (정렬·조인 문자열 — effect 의존용) */
  const tableVisibleBookingIdsKey = useMemo(() => {
    if (viewMode !== 'table') return '';
    const ids: string[] = [];
    if (ticketTableLayout === 'byDate' && dateViewReconDatesKey) {
      for (const dateYmd of dateViewReconDatesKey.split('|').filter(Boolean)) {
        for (const b of sortedBookings) {
          if (bookingCheckInYmd(b) === dateYmd && b.id) ids.push(b.id);
        }
      }
    } else if (ticketTableGroups) {
      for (const g of ticketTableGroups) {
        for (const row of g.rows) {
          if (row.id) ids.push(row.id);
        }
      }
    } else {
      for (const b of pagedSortedBookings) {
        if (b.id) ids.push(b.id);
      }
    }
    return [...new Set(ids)].sort().join('|');
  }, [
    viewMode,
    ticketTableLayout,
    ticketTableGroups,
    pagedSortedBookings,
    dateViewReconDatesKey,
    sortedBookings,
  ]);

  const selectedBookingIdsKey = showBookingModal
    ? selectedBookings
        .map((b) => b.id)
        .filter(Boolean)
        .sort()
        .join('|')
    : '';

  const statementReconLoadKey = useMemo(() => {
    const ids = new Set<string>();
    for (const id of selectedBookingIdsKey.split('|').filter(Boolean)) ids.add(id);
    for (const id of tableVisibleBookingIdsKey.split('|').filter(Boolean)) ids.add(id);
    return [...ids].sort().join('|');
  }, [selectedBookingIdsKey, tableVisibleBookingIdsKey]);

  const statementReconFetchGenRef = useRef(0);

  useEffect(() => {
    if (!statementReconLoadKey) {
      setStatementReconciledIds(new Set());
      setStatementReconDisplay(new Map());
      return;
    }
    const ids = statementReconLoadKey.split('|').filter(Boolean);
    const gen = ++statementReconFetchGenRef.current;
    let cancelled = false;
    void Promise.all([
      fetchReconciledSourceIdsBatched(supabase, 'ticket_bookings', ids),
      fetchTicketBookingStatementReconDisplayByBookingId(supabase, ids),
    ]).then(([reconciled, displayMap]) => {
      if (!cancelled && gen === statementReconFetchGenRef.current) {
        setStatementReconciledIds(reconciled);
        setStatementReconDisplay(displayMap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [statementReconLoadKey]);

  const refreshAfterStatementReconApply = useCallback(async () => {
    const ctx = stmtReconCtx
    const ids = new Set<string>()
    if (ctx?.sourceTable === 'ticket_bookings' && ctx.sourceId) ids.add(ctx.sourceId)
    if (showBookingModal) {
      for (const b of selectedBookings) {
        if (b.id) ids.add(b.id)
      }
    }
    for (const id of statementReconLoadKey.split('|').filter(Boolean)) ids.add(id)

    await refreshStatementReconDisplay([...ids])

    if (ctx?.sourceTable === 'ticket_bookings' && ctx.sourceId) {
      await patchTicketBookingAfterStatementRecon(ctx.sourceId)
      const booking = bookingsRef.current.find((b) => b.id === ctx.sourceId) ?? null
      const checkInYmd = booking ? bookingCheckInYmd(booking) : ''
      if (checkInYmd && ticketTableLayout === 'byDate') {
        await refreshDateViewReconForDate(checkInYmd, { reloadBookings: false })
      }
    }

    restoreStatementReconScroll()
  }, [
    stmtReconCtx,
    showBookingModal,
    selectedBookings,
    statementReconLoadKey,
    refreshStatementReconDisplay,
    patchTicketBookingAfterStatementRecon,
    ticketTableLayout,
    refreshDateViewReconForDate,
    restoreStatementReconScroll,
  ])

  useEffect(() => {
    setListPage(1);
  }, [
    searchTerm,
    selectedStatusFilters,
    checkInDateFrom,
    checkInDateTo,
    dateRangeBasis,
    tourFilter,
    companyFilter,
    futureEventFilter,
    cancelDeadlineFilter,
    pendingRequestOnlyFilter,
    multiRnOnlyFilter,
    hideAuditedFilter,
    needsReviewEaMismatch,
    lxMismatchOnlyFilter,
    ticketTableLayout,
    viewMode,
  ]);

  useEffect(() => {
    if (viewMode !== 'table') setNeedsReviewEaMismatch(false);
  }, [viewMode]);

  useEffect(() => {
    if (ticketTableLayout !== 'byDate') setLxMismatchOnlyFilter(false);
  }, [ticketTableLayout]);

  useEffect(() => {
    setListPage((p) => Math.min(Math.max(1, p), listTotalPages));
  }, [listTotalPages]);

  const handleSort = (field: 'date' | 'submit_on') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /** 예약 축만 수정 — 드롭다운 옵션은 `TICKET_BOOKING_AXIS_SELECT_ORDER.booking` 과 동일 (6축 편집·DB와 통일) */
  const handleBookingAxisBookingStatusChange = async (
    booking: TicketBooking,
    newBookingStatus: string
  ) => {
    try {
      const beforeAxes = normalizeTicketBookingAxisPatchFromSnapshot(booking);
      const patch = { ...beforeAxes };
      const next = newBookingStatus.trim().toLowerCase();
      if (patch.booking_status === next) {
        setOpenAxisDropdown(null);
        setDropdownPosition(null);
        return;
      }
      patch.booking_status = next;
      const res = await applyTicketBookingSetAxes(booking.id, patch, user?.email ?? null);
      if (!res.ok) {
        alert(res.error ?? tTbActUi('unknownError'));
        return;
      }
      const payload = res.data as { booking?: Record<string, unknown> } | undefined;
      const row = payload?.booking;
      if (row && typeof row === 'object') {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? mergeTicketBookingAxesFromRpcRow(b, row) : b))
        );
      } else {
        await fetchBookings();
      }
      const ustack = tableAxesUndoStackRef.current;
      ustack.push({ bookingId: booking.id, patch: beforeAxes });
      while (ustack.length > TICKET_TABLE_AXES_UNDO_STACK_MAX) ustack.shift();
      setOpenAxisDropdown(null);
      setDropdownPosition(null);
    } catch (error) {
      console.error('예약 상태 변경 오류:', error);
      alert(locale === 'ko' ? '예약 상태 변경 중 오류가 발생했습니다.' : 'Failed to update booking status.');
    }
  };

  const handleBookingAxisVendorStatusChange = async (
    booking: TicketBooking,
    newVendorStatus: string
  ) => {
    try {
      const beforeAxes = normalizeTicketBookingAxisPatchFromSnapshot(booking);
      const patch = { ...beforeAxes };
      const next = newVendorStatus.trim().toLowerCase();
      if (patch.vendor_status === next) {
        setOpenAxisDropdown(null);
        setDropdownPosition(null);
        return;
      }
      patch.vendor_status = next;
      const res = await applyTicketBookingSetAxes(booking.id, patch, user?.email ?? null);
      if (!res.ok) {
        alert(res.error ?? tTbActUi('unknownError'));
        return;
      }
      const payload = res.data as { booking?: Record<string, unknown> } | undefined;
      const row = payload?.booking;
      if (row && typeof row === 'object') {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? mergeTicketBookingAxesFromRpcRow(b, row) : b))
        );
      } else {
        await fetchBookings();
      }
      const ustack = tableAxesUndoStackRef.current;
      ustack.push({ bookingId: booking.id, patch: beforeAxes });
      while (ustack.length > TICKET_TABLE_AXES_UNDO_STACK_MAX) ustack.shift();
      setOpenAxisDropdown(null);
      setDropdownPosition(null);
    } catch (error) {
      console.error('벤더 상태 변경 오류:', error);
      alert(locale === 'ko' ? '벤더 상태 변경 중 오류가 발생했습니다.' : 'Failed to update vendor status.');
    }
  };

  const vendorStatusAxisOptions = useMemo(
    () =>
      TICKET_BOOKING_AXIS_SELECT_ORDER.vendor.map((value) => ({
        value,
        label: formatTicketBookingAxisLabel(tTbAxis, 'vendor', value),
        badgeClass: getVendorAxisStatusBadgeClass(value),
      })),
    [tTbAxis]
  );

  const toggleAxisDropdown = useCallback((bookingId: string, axis: 'booking' | 'vendor') => {
    const key = `${bookingId}:${axis}`;
    const el = axisBadgeRefs.current.get(key);
    if (el) {
      const rect = el.getBoundingClientRect();
      const vw = typeof window !== 'undefined' ? window.innerWidth : rect.left + 280;
      const left = Math.min(rect.left, Math.max(8, vw - 260));
      setDropdownPosition({ top: rect.bottom + 4, left });
    }
    setOpenAxisDropdown((prev) =>
      prev?.bookingId === bookingId && prev?.axis === axis ? null : { bookingId, axis }
    );
  }, []);

  const BOOKING_AXIS_DROPDOWN_CHANGE_REQUEST = '__booking_axis_dropdown_change_request__';

  const renderTicketBookingAxisDropdownPortal = (booking: TicketBooking) => {
    const axisDropdownOpen =
      openAxisDropdown?.bookingId === booking.id ? openAxisDropdown.axis : null;
    if (!axisDropdownOpen || !dropdownPosition || typeof window === 'undefined') return null;
    const bsCurrent = (booking.booking_status ?? 'requested').trim().toLowerCase();
    const vsCurrent = (booking.vendor_status ?? 'pending').trim().toLowerCase();
    const csLower = String(booking.change_status ?? 'none').toLowerCase();

    if (axisDropdownOpen === 'vendor') {
      return createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              setOpenAxisDropdown(null);
              setDropdownPosition(null);
            }}
          />
          <div
            className="fixed bg-black border-2 border-gray-600 rounded-lg shadow-2xl z-[9999] w-[min(16rem,calc(100vw-1rem))] max-h-72 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {vendorStatusAxisOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleBookingAxisVendorStatusChange(booking, option.value);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors flex items-center gap-2 border-b border-gray-700 last:border-b-0 ${
                  vsCurrent === option.value ? 'bg-gray-900 font-semibold' : 'bg-black'
                }`}
              >
                <TicketBookingVendorStatusIcon
                  status={option.value}
                  className="h-3.5 w-3.5 shrink-0 text-white"
                  title={option.label}
                />
                <span
                  className={`inline-flex max-w-full truncate px-2 py-0.5 text-[11px] font-medium rounded-full ${option.badgeClass}`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </>,
        document.body
      );
    }

    type BookingDdRow = {
      value: string;
      label: string;
      badgeClass: string;
      isChangeRequestRow?: boolean;
      disabled?: boolean;
    };

    const bookingDdRows: BookingDdRow[] = TICKET_BOOKING_AXIS_SELECT_ORDER.booking.map((value) => ({
      value,
      label: formatTicketBookingAxisLabel(tTbAxis, 'booking', value),
      badgeClass: getBookingAxisStatusBadgeClass(value),
    }));

    if (
      !isWorkflowInitialPhase(booking) &&
      (csLower === 'requested' || showChangeRequestButton(booking))
    ) {
      bookingDdRows.push({
        value: BOOKING_AXIS_DROPDOWN_CHANGE_REQUEST,
        label: formatTicketBookingAxisLabel(tTbAxis, 'change', 'requested'),
        badgeClass: getChangeAxisStatusBadgeClass('requested'),
        isChangeRequestRow: true,
        disabled: csLower === 'requested' || !showChangeRequestButton(booking),
      });
    }

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[9998]"
          onClick={(e) => {
            e.stopPropagation();
            setOpenAxisDropdown(null);
            setDropdownPosition(null);
          }}
        />
        <div
          className="fixed bg-black border-2 border-gray-600 rounded-lg shadow-2xl z-[9999] w-[min(16rem,calc(100vw-1rem))] max-h-72 overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {bookingDdRows.map((option) => {
            const isChangeRow = Boolean(option.isChangeRequestRow);
            const isSelected = isChangeRow
              ? csLower === 'requested'
              : bsCurrent === option.value.trim().toLowerCase();

            return (
              <button
                key={isChangeRow ? `${booking.id}-change-req` : option.value}
                type="button"
                disabled={Boolean(option.disabled)}
                title={
                  isChangeRow && option.disabled
                    ? locale === 'ko'
                      ? '이미 변경 요청 진행 중'
                      : 'Change request already in progress'
                    : isChangeRow && !option.disabled
                      ? locale === 'ko'
                        ? '수량·시간 변경 요청 모달 열기'
                        : 'Open quantity/time change request'
                      : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (isChangeRow) {
                    if (option.disabled) return;
                    setChangeModalBooking(booking);
                    setOpenAxisDropdown(null);
                    setDropdownPosition(null);
                    return;
                  }
                  void handleBookingAxisBookingStatusChange(booking, option.value);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 border-b border-gray-700 last:border-b-0 ${
                  isChangeRow ? 'border-t border-gray-600' : ''
                } ${
                  option.disabled
                    ? 'cursor-not-allowed bg-black opacity-50'
                    : 'hover:bg-gray-800'
                } ${isSelected ? 'bg-gray-900 font-semibold' : option.disabled ? '' : 'bg-black'}`}
              >
                {isChangeRow ? (
                  <PencilLine className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
                ) : (
                  <TicketBookingBookingStatusIcon
                    status={option.value}
                    className="h-3.5 w-3.5 shrink-0 text-white"
                    title={option.label}
                  />
                )}
                <span
                  className={`inline-flex max-w-full truncate px-2 py-0.5 text-[11px] font-medium rounded-full ${option.badgeClass}`}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </>,
      document.body
    );
  };

  const handleTourClick = (tourId: string) => {
    setTourDetailModalTourId(tourId);
  };

  const getCCStatusText = (cc: string) => {
    switch (cc) {
      case 'sent': return 'CC 발송 완료';
      case 'not_sent': return '미발송';
      case 'not_needed': return '필요없음';
      default: return cc || '-';
    }
  };

  const getCCStatusColor = (cc: string) => {
    switch (cc) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'not_sent': return 'bg-yellow-100 text-yellow-800';
      case 'not_needed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '신용카드';
      case 'bank_transfer': return '계좌이체';
      case 'cash': return '현금';
      case 'other': return '기타';
      default: return method;
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleBookingClick = (bookings: TicketBooking[]) => {
    setSelectedBookings(bookings);
    setShowBookingModal(true);
  };

  const buildVendorConfirmChangePayload = (booking: TicketBooking) => {
    const apply_qty = ticketBookingPendingQtyDiffers(booking);
    const apply_time = ticketBookingPendingTimeDiffers(booking);
    if (booking.pending_ea === 0) {
      return { apply_qty: true, apply_time: apply_time };
    }
    return { apply_qty, apply_time };
  };

  const renderVendorChangeActionButtons = (
    booking: TicketBooking,
    size: 'card' | 'row'
  ) => {
    if (!showVendorChangeActions(booking)) return null;
    const btnClass =
      size === 'card'
        ? 'inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full disabled:opacity-50'
        : 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full disabled:opacity-50';
    const iconClass = size === 'card' ? 'h-4 w-4' : 'h-4 w-4';
    const showPartial = ticketBookingHasMultiplePendingChanges(booking);
    return (
      <div className={`flex flex-wrap items-center gap-1 ${size === 'row' ? 'mt-1' : ''}`}>
        <button
          type="button"
          className={`${btnClass} bg-slate-800 text-white hover:bg-slate-900`}
          disabled={workflowActionSavingId === booking.id}
          title={locale === 'ko' ? '벤더 확정 (변경 전체)' : 'Confirm all vendor changes'}
          aria-label={locale === 'ko' ? '벤더 확정 (변경 전체)' : 'Confirm all vendor changes'}
          onClick={(e) => {
            e.stopPropagation();
            void runWorkflowRpc(
              booking,
              'workflow_vendor_confirm_change',
              buildVendorConfirmChangePayload(booking)
            );
          }}
        >
          <Check className={iconClass} strokeWidth={2.5} aria-hidden />
        </button>
        {showPartial ? (
          <button
            type="button"
            className={`${btnClass} border border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100`}
            disabled={workflowActionSavingId === booking.id}
            title={locale === 'ko' ? '부분 확정' : 'Partial confirm'}
            aria-label={locale === 'ko' ? '부분 확정' : 'Partial confirm'}
            onClick={(e) => {
              e.stopPropagation();
              setVendorPartialChangeModalBooking(booking);
            }}
          >
            <ListChecks className={iconClass} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className={`${btnClass} border border-red-300 bg-red-50 text-red-900 hover:bg-red-100`}
          disabled={workflowActionSavingId === booking.id}
          title={locale === 'ko' ? '벤더 거절 (변경)' : 'Reject vendor (change)'}
          aria-label={locale === 'ko' ? '벤더 거절 (변경)' : 'Reject vendor (change)'}
          onClick={(e) => {
            e.stopPropagation();
            void runWorkflowRpc(booking, 'workflow_vendor_reject_change');
          }}
        >
          <X className={iconClass} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    );
  };

  const renderTicketMobileCard = (
    booking: TicketBooking,
    opts?: { variant?: 'default' | 'modalForm' }
  ) => {
    const isModalForm = opts?.variant === 'modalForm';
    const changePending = isTicketBookingChangeRequestPending(booking);
    const cancelDueDate = getCancelDueDate(booking);
    const isOverdue = cancelDueDate ? new Date(cancelDueDate) < new Date() : false;
    const supplierStyle = ticketBookingSupplierColors(booking.company);
    const formLabel = (ko: string, en: string) => (locale.startsWith('en') ? en : ko);
    const FormField = ({
      label,
      children,
      title: fieldTitle,
    }: {
      label: string;
      children: React.ReactNode;
      title?: string;
    }) => (
      <div className="min-w-0 space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
        <div
          className="min-h-[2.25rem] rounded-md border border-gray-200 bg-gray-50/80 px-2 py-1.5 text-xs text-gray-900 flex flex-wrap items-center gap-0.5"
          title={fieldTitle}
        >
          {children}
        </div>
      </div>
    );
    const axisChipClassModal = isModalForm
      ? 'inline-flex w-full min-w-0 min-h-[2.35rem] max-w-full items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-90 transition-opacity'
      : 'inline-flex max-w-full items-center gap-1 truncate px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 cursor-pointer hover:opacity-90';
    const axisIconClassModal = isModalForm ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0';
    return (
      <div
        key={booking.id}
        className={
          isModalForm
            ? `max-w-full rounded-xl border bg-white p-3 shadow-sm space-y-3 touch-manipulation ${
                changePending ? 'border-red-600 ring-2 ring-red-500' : 'border-gray-200'
              }`
            : `rounded-xl p-3 bg-white shadow-sm space-y-2 ${
                changePending ? 'border-2 border-red-600 ring-2 ring-red-500/80' : 'border border-gray-200'
              }`
        }
        style={{ borderLeftWidth: 4, borderLeftColor: supplierStyle.backgroundColor }}
      >
        {showRnRowSelection && !isModalForm ? (
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            {renderRnGroupRowSelectCheckbox(booking)}
            <span className="text-[10px] text-gray-500">
              {locale === 'ko' ? '선택 삭제 대상' : 'Bulk delete selection'}
            </span>
          </div>
        ) : null}
        {isModalForm ? (
          <div className="space-y-2">
            {showChangeAxisInsteadOfBookingStatus(booking) ? (
              <span
                className={`${axisChipClassModal} w-full ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
              >
                {formatTicketBookingAxisLabel(tTbAxis, 'change', booking.change_status)}
              </span>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <span
                  ref={(el) => {
                    const key = `${booking.id}:booking`;
                    if (el) axisBadgeRefs.current.set(key, el);
                    else axisBadgeRefs.current.delete(key);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`${axisChipClassModal} ${getBookingAxisStatusBadgeClass(booking.booking_status)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAxisDropdown(booking.id, 'booking');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAxisDropdown(booking.id, 'booking');
                    }
                  }}
                  title={
                    locale === 'ko' ? '클릭하여 예약 상태 변경 (다축과 동일 목록)' : 'Change booking status'
                  }
                >
                  <TicketBookingBookingStatusIcon
                    status={booking.booking_status}
                    className={axisIconClassModal}
                    title={formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
                  />
                  <span className="min-w-0 truncate text-center">
                    {formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
                  </span>
                </span>
                <span
                  ref={(el) => {
                    const key = `${booking.id}:vendor`;
                    if (el) axisBadgeRefs.current.set(key, el);
                    else axisBadgeRefs.current.delete(key);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`${axisChipClassModal} ${getVendorAxisStatusBadgeClass(booking.vendor_status)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAxisDropdown(booking.id, 'vendor');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAxisDropdown(booking.id, 'vendor');
                    }
                  }}
                  title={
                    locale === 'ko'
                      ? '클릭하여 벤더 상태 변경 (다축과 동일 목록)'
                      : 'Change vendor status'
                  }
                >
                  <TicketBookingVendorStatusIcon
                    status={booking.vendor_status}
                    className={axisIconClassModal}
                    title={formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
                  />
                  <span className="min-w-0 truncate text-center">
                    {formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
                  </span>
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {showChangeRequestButton(booking) && !showChangeAxisInsteadOfBookingStatus(booking) ? (
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                  disabled={workflowActionSavingId === booking.id}
                  title={locale === 'ko' ? '수량·시간 변경 요청' : 'Request quantity/time change'}
                  aria-label={locale === 'ko' ? '수량·시간 변경 요청' : 'Request quantity/time change'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChangeModalBooking(booking);
                  }}
                >
                  <PencilLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
            </div>
            {showVendorInitialActions(booking) ? (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                  disabled={workflowActionSavingId === booking.id}
                  title={locale === 'ko' ? '벤더 확정' : 'Confirm vendor'}
                  aria-label={locale === 'ko' ? '벤더 확정' : 'Confirm vendor'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVendorConfirmModalBooking(booking);
                  }}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 disabled:opacity-50"
                  disabled={workflowActionSavingId === booking.id}
                  title={locale === 'ko' ? '벤더 거절' : 'Reject vendor'}
                  aria-label={locale === 'ko' ? '벤더 거절' : 'Reject vendor'}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runWorkflowRpc(booking, 'workflow_vendor_reject_initial');
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            ) : null}
            {renderVendorChangeActionButtons(booking, 'card')}
            {hasSecondaryChangeAxisBadge(booking) ? (
              <span
                className={`inline-flex w-full max-w-full items-center justify-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
              >
                {formatTicketBookingAxisLabel(tTbAxis, 'change', booking.change_status)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {showChangeAxisInsteadOfBookingStatus(booking) ? (
                  <span
                    className={`inline-flex max-w-full truncate px-2 py-0.5 text-[10px] font-semibold rounded-full ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
                  >
                    {formatTicketBookingAxisLabel(tTbAxis, 'change', booking.change_status)}
                  </span>
                ) : (
                  <>
                <span
                  ref={(el) => {
                    const key = `${booking.id}:booking`;
                    if (el) axisBadgeRefs.current.set(key, el);
                    else axisBadgeRefs.current.delete(key);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`${axisChipClassModal} ${getBookingAxisStatusBadgeClass(booking.booking_status)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAxisDropdown(booking.id, 'booking');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAxisDropdown(booking.id, 'booking');
                    }
                  }}
                  title={
                    locale === 'ko' ? '클릭하여 예약 상태 변경 (다축과 동일 목록)' : 'Change booking status'
                  }
                >
                  <TicketBookingBookingStatusIcon
                    status={booking.booking_status}
                    className={axisIconClassModal}
                    title={formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
                  />
                  <span className="truncate">
                    {formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
                  </span>
                </span>
                <span
                  ref={(el) => {
                    const key = `${booking.id}:vendor`;
                    if (el) axisBadgeRefs.current.set(key, el);
                    else axisBadgeRefs.current.delete(key);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`${axisChipClassModal} ${getVendorAxisStatusBadgeClass(booking.vendor_status)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAxisDropdown(booking.id, 'vendor');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAxisDropdown(booking.id, 'vendor');
                    }
                  }}
                  title={
                    locale === 'ko'
                      ? '클릭하여 벤더 상태 변경 (다축과 동일 목록)'
                      : 'Change vendor status'
                  }
                >
                  <TicketBookingVendorStatusIcon
                    status={booking.vendor_status}
                    className={axisIconClassModal}
                    title={formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
                  />
                  <span className="truncate">
                    {formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
                  </span>
                </span>
                {hasSecondaryChangeAxisBadge(booking) ? (
                  <span
                    className={`inline-flex max-w-full truncate px-2 py-0.5 text-[10px] font-semibold rounded-full ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
                  >
                    {formatTicketBookingAxisLabel(tTbAxis, 'change', booking.change_status)}
                  </span>
                ) : null}
                  </>
                )}
              </div>
              <button
                type="button"
                className="text-left text-xs font-medium text-blue-600 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setAxesDialogBooking(booking);
                }}
              >
                {tTbActUi('axesEditorOpenButton')}
              </button>
            </div>
            <span
              className="shrink-0 max-w-[55%] truncate rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-black/10"
              style={{ backgroundColor: supplierStyle.backgroundColor, color: supplierStyle.color }}
            >
              {booking.company}
            </span>
          </div>
        )}
        {isModalForm ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <FormField label={formLabel('카테고리', 'Category')}>
              <span className="font-medium text-gray-900">{booking.category}</span>
            </FormField>
            <FormField label={formLabel('공급업체', 'Supplier')}>
              <span
                className="inline-block max-w-full truncate rounded px-2 py-1 text-xs font-semibold ring-1 ring-black/10"
                style={{ backgroundColor: supplierStyle.backgroundColor, color: supplierStyle.color }}
              >
                {booking.company}
              </span>
            </FormField>
            <FormField label={formLabel('날짜', 'Check-in date')}>
              <span className="font-medium tabular-nums">
                {booking.check_in_date ? new Date(booking.check_in_date).toISOString().split('T')[0] : '-'}
              </span>
            </FormField>
            <FormField label={formLabel('시간', 'Time')}>
              <span
                className={`font-medium ${ticketBookingPendingTimeDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
              >
                {formatTimeArrow(booking)}
              </span>
            </FormField>
            <FormField label={formLabel('수량', 'Quantity')}>
              <span
                className={`font-medium ${ticketBookingPendingQtyDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
              >
                {formatQtyArrow(booking)}
              </span>
            </FormField>
            {cancelDueDate ? (
              <FormField label="Cancel Due">
                <span className={isOverdue ? 'text-red-600 font-semibold' : 'font-medium'}>{cancelDueDate}</span>
              </FormField>
            ) : null}
            <FormField label="RN#">
              <span className="font-medium truncate">{booking.rn_number?.trim() || '—'}</span>
            </FormField>
            <FormField label={formLabel('Invoice#', 'Invoice #')}>
              <span className="font-medium truncate">{booking.invoice_number?.trim() || '—'}</span>
            </FormField>
            <FormField label={formLabel('Zelle 확인#', 'Zelle confirmation #')}>
              <span className="font-medium truncate">{booking.zelle_confirmation_number?.trim() || '—'}</span>
            </FormField>
            <FormField label={formLabel('EA 금액', 'EA amount')} title={formLabel('(비용 − 수입) ÷ 수량', '(Expense − income) ÷ qty')}>
              <span
                className={`font-medium tabular-nums ${ticketBookingPendingExpenseDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
              >
                {formatEaMarginUsdArrow(booking)}
              </span>
            </FormField>
            <FormField label={formLabel('비용 (USD)', 'Expense (USD)')}>
              <span
                className={`font-medium ${ticketBookingPendingExpenseDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
              >
                {formatExpenseArrow(booking)}
              </span>
            </FormField>
            <FormField label={formLabel('제출일', 'Submitted')}>
              <span className="font-medium tabular-nums">
                {booking.submit_on ? new Date(booking.submit_on).toISOString().split('T')[0] : '-'}
              </span>
            </FormField>
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-3">
              <FormField label={formLabel('투어', 'Tour')}>
                {booking.tours && booking.tour_id ? (
                  <TicketBookingTourDisplay
                    locale={locale}
                    tours={booking.tours}
                    tourFallback={t('tour')}
                  />
                ) : (
                  <button
                    type="button"
                    className="text-left text-xs font-medium text-red-600 underline decoration-red-400/80 underline-offset-2 hover:text-red-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinkTourModalBooking(booking);
                    }}
                  >
                    {locale.startsWith('en') ? 'Not linked · link' : '미연결 · 연결'}
                  </button>
                )}
              </FormField>
              <FormField label={formLabel('예약자', 'Reservation name')}>
                <span className="font-medium break-words text-gray-900">{booking.reservation_name || '—'}</span>
              </FormField>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-500">날짜</span>
          <span className="font-medium">{booking.check_in_date ? new Date(booking.check_in_date).toISOString().split('T')[0] : '-'}</span>
          <span className="text-gray-500">시간</span>
          <span
            className={`font-medium ${ticketBookingPendingTimeDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
          >
            {formatTimeArrow(booking)}
          </span>
          <span className="text-gray-500">수량</span>
          <span
            className={`font-medium ${ticketBookingPendingQtyDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
          >
            {formatQtyArrow(booking)}
          </span>
          {cancelDueDate && (
            <>
              <span className="text-gray-500">Cancel Due</span>
              <span className={isOverdue ? 'text-red-600 font-semibold' : 'font-medium'}>{cancelDueDate}</span>
            </>
          )}
          <span className="text-gray-500">RN#</span>
          <span className="font-medium truncate">{booking.rn_number?.trim() || '—'}</span>
          <span className="text-gray-500">Invoice#</span>
          <span className="font-medium truncate">{booking.invoice_number?.trim() || '—'}</span>
          <span className="text-gray-500">Zelle 확인#</span>
          <span className="font-medium truncate">{booking.zelle_confirmation_number?.trim() || '—'}</span>
          <span className="text-gray-500" title="(비용 − 수입) ÷ 수량">
            EA 금액
          </span>
          <span
            className={`font-medium tabular-nums ${ticketBookingPendingExpenseDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
          >
            {formatEaMarginUsdArrow(booking)}
          </span>
          <span className="text-gray-500">비용</span>
          <span
            className={`font-medium ${ticketBookingPendingExpenseDiffers(booking) ? 'font-semibold text-red-600' : ''}`}
          >
            {formatExpenseArrow(booking)}
          </span>
          <span className="text-gray-500">제출일</span>
          <span className="font-medium">{booking.submit_on ? new Date(booking.submit_on).toISOString().split('T')[0] : '-'}</span>
          <span className="text-gray-500">투어</span>
          {booking.tours && booking.tour_id ? (
            <TicketBookingTourDisplay
              locale={locale}
              tours={booking.tours}
              tourFallback={t('tour')}
            />
          ) : (
            <button
              type="button"
              className="text-left text-xs font-medium text-red-600 underline decoration-red-400/80 underline-offset-2 hover:text-red-800"
              onClick={(e) => {
                e.stopPropagation();
                setLinkTourModalBooking(booking);
              }}
            >
              미연결 · 연결
            </button>
          )}
        </div>
        )}
        <div className="pt-2 border-t border-gray-100">
          <BookingAuditCell
            audit={booking}
            disabled={!user?.email}
            saving={bookingAuditSavingId === booking.id}
            onToggle={(next) => void handleToggleTicketBookingAudit(booking, next)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInvoiceQuickModal(booking);
            }}
            className="px-2 py-1 border border-gray-200 bg-white text-gray-800 text-xs rounded-lg hover:bg-gray-50"
          >
            Invoice·첨부
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openZelleAttachmentView(booking);
            }}
            className="px-2 py-1 border border-emerald-200 bg-emerald-50/60 text-emerald-900 text-xs rounded-lg hover:bg-emerald-100/80"
          >
            Zelle 첨부
          </button>
        </div>
        {renderTicketBookingAxisDropdownPortal(booking)}
        {isModalForm ? (
          <>
            <div className="pt-2 border-t border-gray-100">
              <BookingAuditCell
                audit={booking}
                disabled={!user?.email}
                saving={bookingAuditSavingId === booking.id}
                onToggle={(next) => void handleToggleTicketBookingAudit(booking, next)}
              />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {tStmtRecon('columnHeaderShort')}
              </span>
              {renderStatementReconCell(booking)}
            </div>
          </>
        ) : viewMode === 'table' ? (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 shrink-0">
              {tStmtRecon('columnHeaderShort')}
            </span>
            <div className="min-w-0 flex-1">{renderStatementReconCell(booking)}</div>
          </div>
        ) : null}
        <div className="pt-2 border-t border-gray-100">
          {renderTicketBookingActionButtons(booking, {
            fromDetailModal: isModalForm,
            size: 'touch',
          })}
        </div>
      </div>
    );
  };

  const renderTicketDesktopTableThead = useCallback(
    (opts?: { interactiveSort?: boolean; showStatementRecon?: boolean }) => {
      const interactive = opts?.interactiveSort !== false;
      const showStmt = opts?.showStatementRecon === true;
      const sortable = () =>
        `${TICKET_TABLE_TH}${interactive ? ' cursor-pointer hover:bg-gray-100 select-none' : ''}`;
      return (
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {showRnRowSelection ? (
              <th className={`${TICKET_TABLE_TH} w-9 px-1 text-center`}>
                <span className="sr-only">{locale === 'ko' ? '선택' : 'Select'}</span>
              </th>
            ) : null}
            <th
              className={`${TICKET_TABLE_TH} sticky left-0 z-10 min-w-[8.5rem] bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]${showRnRowSelection ? ' left-9' : ''}`}
              title={t('ticketTableStatusThHintSummary')}
            >
              상태
            </th>
            <th className={TICKET_TABLE_TH}>벤더</th>
            <th className={TICKET_TABLE_TH}>결제</th>
            <th className={`${TICKET_TABLE_TH} hidden xl:table-cell max-w-[6rem]`}>환불</th>
            <th className={TICKET_TABLE_TH}>공급</th>
            <th
              className={sortable()}
              onClick={interactive ? () => handleSort('date') : undefined}
            >
              <span className="inline-flex items-center gap-1">
                체크인
                {interactive && sortField === 'date' ? (
                  <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                ) : null}
              </span>
            </th>
            <th className={TICKET_TABLE_TH}>시간</th>
            <th className={TICKET_TABLE_TH}>수량</th>
            <th className={`${TICKET_TABLE_TH} hidden md:table-cell`}>Cancel</th>
            <th className={`${TICKET_TABLE_TH} hidden lg:table-cell`}>비용</th>
            <th className={`${TICKET_TABLE_TH} hidden md:table-cell`}>RN#</th>
            <th className={`${TICKET_TABLE_TH} hidden lg:table-cell min-w-[9rem]`}>투어</th>
            <th className={`${TICKET_TABLE_TH} hidden md:table-cell`}>Inv#</th>
            <th className={`${TICKET_TABLE_TH} hidden md:table-cell text-center`}>첨부</th>
            {showStmt ? (
              <th className={`${TICKET_TABLE_TH} text-center min-w-[8rem]`}>
                {tStmtRecon('columnHeaderShort')}
              </th>
            ) : null}
            <th
              className={sortable()}
              onClick={interactive ? () => handleSort('submit_on') : undefined}
            >
              <span className="inline-flex items-center gap-1">
                제출일
                {interactive && sortField === 'submit_on' ? (
                  <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                ) : null}
              </span>
            </th>
            <th className={`${TICKET_TABLE_TH} min-w-[7.5rem]`}>{tAudit('columnHeader')}</th>
          </tr>
        </thead>
      );
    },
    [t, tAudit, sortField, sortDirection, handleSort, tStmtRecon, showRnRowSelection, locale]
  );

  const renderDesktopRow = (
    booking: TicketBooking,
    rnRowStripe = '',
    cancelDueColorMap: Map<string, string>,
    opts?: { inDetailModal?: boolean }
  ) => {
    const changePending = isTicketBookingChangeRequestPending(booking);
    const cancelDueDateRow = getCancelDueDate(booking);
    const bgColor = cancelDueDateRow 
      ? (cancelDueColorMap.get(cancelDueDateRow) || 'bg-white')
      : 'bg-white';
    const dueBgIdx = TICKET_TABLE_CANCEL_DUE_BG.indexOf(bgColor as (typeof TICKET_TABLE_CANCEL_DUE_BG)[number]);
    const hoverColor = cancelDueDateRow
      ? (dueBgIdx >= 0 ? TICKET_TABLE_CANCEL_DUE_HOVER[dueBgIdx] : 'hover:bg-gray-50')
      : 'hover:bg-gray-50';
    const supplierStyle = ticketBookingSupplierColors(booking.company);

    const bookingStatusBadge = (
      <span
        ref={(el) => {
          const key = `${booking.id}:booking`;
          if (el) {
            axisBadgeRefs.current.set(key, el);
          } else {
            axisBadgeRefs.current.delete(key);
          }
        }}
        className={`inline-flex max-w-full min-h-[1.625rem] items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-90 transition-opacity ${getBookingAxisStatusBadgeClass(booking.booking_status)}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleAxisDropdown(booking.id, 'booking');
        }}
        title={
          locale === 'ko' ? '클릭하여 예약 상태 변경 (다축과 동일 목록)' : 'Change booking status'
        }
      >
        <TicketBookingBookingStatusIcon
          status={booking.booking_status}
          className="h-3.5 w-3.5 shrink-0"
          title={formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
        />
        <span className="truncate">
          {formatTicketBookingAxisLabel(tTbAxis, 'booking', booking.booking_status)}
        </span>
      </span>
    );

    const vendorStatusBadge = (
      <span
        ref={(el) => {
          const key = `${booking.id}:vendor`;
          if (el) {
            axisBadgeRefs.current.set(key, el);
          } else {
            axisBadgeRefs.current.delete(key);
          }
        }}
        className={`inline-flex max-w-full min-h-[1.625rem] items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-90 transition-opacity ${getVendorAxisStatusBadgeClass(booking.vendor_status)}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleAxisDropdown(booking.id, 'vendor');
        }}
        title={
          locale === 'ko'
            ? '클릭하여 벤더 상태 변경 (다축과 동일 목록)'
            : 'Change vendor status'
        }
      >
        <TicketBookingVendorStatusIcon
          status={booking.vendor_status}
          className="h-3.5 w-3.5 shrink-0"
          title={formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
        />
        <span className="truncate">
          {formatTicketBookingAxisLabel(tTbAxis, 'vendor', booking.vendor_status)}
        </span>
      </span>
    );

    const axisDropdownPortal = renderTicketBookingAxisDropdownPortal(booking);

    const openEditFromRow = !opts?.inDetailModal;

    return (
      <tr
        key={booking.id}
        className={`align-middle ${bgColor} ${hoverColor} transition-colors ${rnRowStripe ? 'border-b border-neutral-200/90' : ''} ${changePending ? 'outline outline-2 outline-red-600 -outline-offset-2' : ''} ${openEditFromRow ? 'cursor-pointer' : ''}`}
        style={{ borderLeftWidth: 4, borderLeftColor: supplierStyle.backgroundColor }}
        onClick={
          openEditFromRow
            ? () => {
                handleEdit(booking);
              }
            : undefined
        }
        title={openEditFromRow ? (locale === 'ko' ? '클릭하여 편집' : 'Click to edit') : undefined}
      >
        {showRnRowSelection ? (
          <td
            className={`${TICKET_TABLE_CELL} w-9 px-1 text-center align-middle ${bgColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            {renderRnGroupRowSelectCheckbox(booking)}
          </td>
        ) : null}
    <td
      className={`${TICKET_TABLE_CELL} sticky z-10 min-w-[9rem] w-[9rem] ${bgColor} ${rnRowStripe} ${showRnRowSelection ? 'left-9' : 'left-0'}`}
    >
      <div className="relative z-50 space-y-1.5 px-0.5 py-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {showChangeAxisInsteadOfBookingStatus(booking) ? (
            <span
              className={`inline-flex max-w-full min-h-[1.625rem] items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
            >
              {formatTicketBookingAxisLabel(tTbAxis, 'change', booking.change_status)}
            </span>
          ) : (
            bookingStatusBadge
          )}
          {showChangeRequestButton(booking) && !showChangeAxisInsteadOfBookingStatus(booking) ? (
            <button
              type="button"
              className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              disabled={workflowActionSavingId === booking.id}
              title={
                locale === 'ko' ? '수량·시간 변경 요청' : 'Request quantity/time change'
              }
              aria-label={
                locale === 'ko' ? '수량·시간 변경 요청' : 'Request quantity/time change'
              }
              onClick={(e) => {
                e.stopPropagation();
                setChangeModalBooking(booking);
              }}
            >
              <PencilLine className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>
        {hasSecondaryChangeAxisBadge(booking) ? (
          <div className="px-0.5">
            <span
              className={`inline-flex max-w-full truncate px-2 py-0.5 text-[10px] font-semibold rounded-full ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
            >
              {formatTicketBookingAxisLabel(
                tTbAxis,
                'change',
                booking.change_status
              )}
            </span>
          </div>
        ) : null}
        {axisDropdownPortal}
      </div>
    </td>
    <td className="align-middle px-2 py-1.5 text-[10px] leading-snug max-w-[9rem]">
      <div className="relative z-40">{vendorStatusBadge}</div>
      {showVendorInitialActions(booking) ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            disabled={workflowActionSavingId === booking.id}
            title={locale === 'ko' ? '벤더 확정' : 'Confirm vendor'}
            aria-label={locale === 'ko' ? '벤더 확정' : 'Confirm vendor'}
            onClick={(e) => {
              e.stopPropagation();
              setVendorConfirmModalBooking(booking);
            }}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 disabled:opacity-50"
            disabled={workflowActionSavingId === booking.id}
            title={locale === 'ko' ? '벤더 거절' : 'Reject vendor'}
            aria-label={locale === 'ko' ? '벤더 거절' : 'Reject vendor'}
            onClick={(e) => {
              e.stopPropagation();
              void runWorkflowRpc(booking, 'workflow_vendor_reject_initial');
            }}
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      ) : null}
      {renderVendorChangeActionButtons(booking, 'row')}
    </td>
    <td className="align-middle px-2 py-1.5 text-[10px] leading-snug max-w-[7rem]">
      {isWorkflowInitialPhase(booking) ? (
        <span className="text-gray-400">—</span>
      ) : String(booking.payment_status ?? '').toLowerCase() === 'paid' ? (
        <div>
          <div className="font-bold text-emerald-800">결제 완료</div>
          <div className="text-gray-600 tabular-nums">
            ${booking.paid_amount ?? booking.expense ?? '—'}
          </div>
        </div>
      ) : showPaymentCompleteButton(booking) ? (
        <button
          type="button"
          className="inline-flex h-[1.625rem] min-w-[2.25rem] items-center justify-center rounded-full border border-emerald-600 bg-emerald-50 px-2 text-[11px] font-bold tabular-nums tracking-tight text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          disabled={workflowActionSavingId === booking.id}
          title={locale === 'ko' ? '결제 입력' : 'Enter payment'}
          aria-label={locale === 'ko' ? '결제 입력' : 'Enter payment'}
          onClick={(e) => {
            e.stopPropagation();
            setPaymentModalBooking(booking);
          }}
        >
          +$
        </button>
      ) : (
        <span
          className="inline-flex h-[1.625rem] min-w-[2.25rem] items-center justify-center text-[11px] font-semibold tabular-nums tracking-tight text-gray-400"
          title={locale === 'ko' ? '결제 전' : 'Unpaid'}
        >
          +$
        </span>
      )}
    </td>
    <td className={`${TICKET_TABLE_CELL} hidden xl:table-cell max-w-[6rem]`} onClick={(e) => e.stopPropagation()}>
      {isWorkflowInitialPhase(booking) ? (
        <span className="text-gray-400">—</span>
      ) : (
        <div className="space-y-1">
          {(refundLinesByBookingId[booking.id] ?? []).map((line) => (
            <div
              key={line.id}
              className="rounded border border-gray-200 bg-gray-50/90 px-1 py-0.5"
            >
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-gray-800">
                  {refundLineStatusLabel(line.status)}
                </span>
                <select
                  className="max-w-[6rem] rounded border border-gray-300 bg-white px-0.5 py-px text-[9px]"
                  value={line.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    void updateRefundLineStatus(line.id, e.target.value);
                  }}
                >
                  <option value="requested">환불 요청</option>
                  <option value="rejected">환불 거절</option>
                  <option value="refunded">환불 완료</option>
                  <option value="credit_received">크레딧 받음</option>
                </select>
              </div>
              <div className="text-[9px] text-gray-600 tabular-nums">
                금액 ${line.amount ?? '—'} · 수량 {line.ea ?? '—'}
              </div>
            </div>
          ))}
          {showRefundLineManagement(booking) ? (
            <button
              type="button"
              className="rounded border border-dashed border-gray-400 px-1.5 py-0.5 text-[9px] text-gray-700 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                void addRefundLineForBooking(booking);
              }}
            >
              + 환불 건 추가
            </button>
          ) : null}
        </div>
      )}
    </td>
    <td className={`${TICKET_TABLE_CELL} whitespace-nowrap`}>
      <span
        className={`${TICKET_TABLE_CLIP} inline-block max-w-[7rem] rounded px-1.5 py-0.5 font-medium ring-1 ring-black/10`}
        style={{ backgroundColor: supplierStyle.backgroundColor, color: supplierStyle.color }}
        title={booking.company}
      >
        {booking.company}
      </span>
    </td>
    <td className={`${TICKET_TABLE_CELL} min-w-[5.5rem] whitespace-nowrap`}>
      <span className={`${TICKET_TABLE_CLIP} text-gray-900`} title={booking.check_in_date ?? ''}>
        {booking.check_in_date
          ? new Date(booking.check_in_date).toISOString().split('T')[0]
          : '-'}
      </span>
    </td>
    <td className={`${TICKET_TABLE_CELL} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
      <TicketBookingChangeStack model={getTicketBookingTimeStack(booking)} />
    </td>
    <td className={`${TICKET_TABLE_CELL} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
      <TicketBookingChangeStack model={getTicketBookingQtyStack(booking)} />
    </td>
    <td className={`${TICKET_TABLE_CELL} hidden md:table-cell min-w-[5rem] whitespace-nowrap`}>
      <span className={`${TICKET_TABLE_CLIP} text-gray-900`}>
        {(() => {
          const cancelDueDate = getCancelDueDate(booking);
          if (!cancelDueDate) return '-';
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(cancelDueDate);
          dueDate.setHours(0, 0, 0, 0);
          
          // 취소 기한이 지났으면 빨간색으로 표시
          const isOverdue = dueDate < today;
          
          return (
            <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
              {cancelDueDate}
            </span>
          );
        })()}
      </span>
    </td>
    <td className={`${TICKET_TABLE_CELL} hidden lg:table-cell whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
      <TicketBookingChangeStack model={getTicketBookingExpenseStack(booking)} />
    </td>
    <td className={`${TICKET_TABLE_CELL} hidden md:table-cell min-w-[5.5rem] whitespace-nowrap`}>
      <span className={`${TICKET_TABLE_CLIP} text-gray-900`} title={booking.rn_number ?? ''}>
        {booking.rn_number || '-'}
      </span>
    </td>
    <td
      className={`${TICKET_TABLE_CELL} hidden lg:table-cell min-w-[9rem] max-w-[12rem]`}
      onClick={(e) => e.stopPropagation()}
    >
      {booking.tours && booking.tour_id ? (
        <TicketBookingTourDisplay
          locale={locale}
          tours={booking.tours}
          tourFallback={t('tour')}
          layout={opts?.inDetailModal ? 'default' : 'table'}
          showDetails={opts?.inDetailModal === true}
          headlineClassName="font-medium text-gray-900 leading-snug"
          onTourClick={() => handleTourClick(booking.tour_id!)}
        />
      ) : (
        <button
          type="button"
          className="text-left text-xs font-medium text-red-600 underline decoration-red-400/80 underline-offset-2 hover:text-red-800"
          onClick={(e) => {
            e.stopPropagation();
            setLinkTourModalBooking(booking);
          }}
          title={locale === 'ko' ? '투어 선택·연결' : 'Select and link a tour'}
        >
          미연결
        </button>
      )}
    </td>
    <td
      className={`${TICKET_TABLE_CELL} hidden md:table-cell whitespace-nowrap`}
      onClick={(e) => e.stopPropagation()}
    >
      <TicketInvoiceInlineCell
        bookingId={booking.id}
        initialInvoice={booking.invoice_number?.trim() || ''}
        saving={invoiceInlineSavingId === booking.id}
        onSave={saveInvoiceInline}
      />
    </td>
    <td className={`${TICKET_TABLE_CELL} hidden md:table-cell whitespace-nowrap`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openInvoiceAttachmentView(booking);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-blue-700"
        title="Invoice 인보이스 사진"
      >
        {(() => {
          const inv = booking.invoice_number?.trim();
          const has =
            inv &&
            (invoiceAttachmentMap.get(makeInvoiceKey(booking.company, inv))?.length ?? 0) > 0;
          return has ? (
            <Paperclip className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
          ) : (
            <ImageOff className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          );
        })()}
      </button>
    </td>
    <td
      className={`${TICKET_TABLE_CELL} min-w-[7rem] max-w-[11rem]`}
      onClick={(e) => e.stopPropagation()}
    >
      {renderStatementReconCell(booking, { compact: !opts?.inDetailModal })}
    </td>
    <td className={`${TICKET_TABLE_CELL} whitespace-nowrap tabular-nums text-gray-600`}>
      {booking.submit_on ? new Date(booking.submit_on).toISOString().split('T')[0] : '-'}
    </td>
    <td className={`${TICKET_TABLE_CELL} min-w-[7.5rem] max-w-[11rem]`}>
      <BookingAuditCell
        audit={booking}
        compact
        disabled={!user?.email}
        saving={bookingAuditSavingId === booking.id}
        onToggle={(next) => void handleToggleTicketBookingAudit(booking, next)}
      />
    </td>
      </tr>
    );
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4 sm:space-y-6">
      {enriching && (
        <div
          className="fixed top-2 right-2 z-[1200] flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-1.5 text-xs text-gray-600"
          role="status"
          aria-live="polite"
        >
          <span className="inline-block h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" aria-hidden />
          <span>추가 정보 불러오는 중…</span>
        </div>
      )}
      {/* 헤더 - 모바일: 세로 배치, 데스크톱: 가로 */}
      <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4 sm:py-4">
        <h2 className="min-w-0 truncate text-lg font-bold text-gray-900 sm:text-2xl">{t('ticketBookingManagement')}</h2>
        <div className="flex min-w-0 w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 sm:p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 sm:p-1.5 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="카드 뷰"
            >
              <Grid size={16} className="sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 sm:p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="달력 뷰"
            >
              <CalendarIcon size={16} className="sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 sm:p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="테이블 뷰"
            >
              <Table size={16} className="sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNeedCheckModal(true)}
            className="relative inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg hover:bg-amber-100 text-sm font-medium transition-colors flex-shrink-0"
            title={t('ticketNeedCheckButtonTitle')}
          >
            <AlertTriangle size={16} className="text-amber-700 shrink-0" />
            <span className="hidden sm:inline">{t('ticketNeedCheckButton')}</span>
            <span className="sm:hidden">{t('ticketNeedCheckButtonShort')}</span>
            {ticketNeedCheckUnionCount > 0 ? (
              <span className="min-w-[1.25rem] rounded-full bg-amber-600 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white tabular-nums sm:text-xs">
                {ticketNeedCheckUnionCount > 99 ? '99+' : ticketNeedCheckUnionCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setShowInvoiceUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors flex-shrink-0"
            title="인보이스 이미지에서 RN# 등을 읽어 Invoice #을 채웁니다"
          >
            <FileUp size={16} />
            <span className="hidden sm:inline">인보이스 업로드</span>
            <span className="sm:hidden">인보이스</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBulkAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors flex-shrink-0"
          >
            <ListPlus size={16} />
            <span>{t('bulkAddBookings')}</span>
          </button>
          <button
            type="button"
            onClick={() => setDeletionReviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors flex-shrink-0"
            title={t('ticketDeletedBookingsViewTitle')}
          >
            <Archive size={16} />
            <span className="hidden sm:inline">{t('ticketDeletedBookingsView')}</span>
            <span className="sm:hidden">{locale === 'ko' ? '삭제됨' : 'Hidden'}</span>
          </button>
          <button
            onClick={() => {
              setEditingBooking(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex-shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t('addNewBooking')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일: 2열/스택, 데스크톱: 그리드 */}
      <div className="min-w-0 border-t border-gray-100 px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <TicketBookingStatusMultiFilter
              locale={locale}
              t={t}
              selected={selectedStatusFilters}
              onChange={setSelectedStatusFilters}
              disabled={
                pendingRequestOnlyFilter || (viewMode === 'table' && needsReviewEaMismatch)
              }
              disabledTitle={
                pendingRequestOnlyFilter
                  ? locale === 'ko'
                    ? '요청 중 필터에서는 상태 선택이 적용되지 않습니다.'
                    : 'Status filter is disabled while “Pending” filter is on.'
                  : viewMode === 'table' && needsReviewEaMismatch
                    ? locale === 'ko'
                      ? '확인 필요 모드에서는 확정·인원 불일치 부킹만 표시됩니다.'
                      : 'Needs review mode shows only confirmed bookings with headcount mismatch.'
                    : undefined
              }
            />
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('tourConnection')}
            </label>
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allBookings')}</option>
              <option value="connected">{t('tourConnected')}</option>
              <option value="unconnected">{t('tourNotConnected')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('vendorFilter')}
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allVendors')}</option>
              {companyFilter !== 'all' &&
                !vendorCompanyOptions.includes(companyFilter) && (
                  <option value={companyFilter}>{companyFilter}</option>
                )}
              {vendorCompanyOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">
                {dateRangeBasis === 'submit_on' ? t('submitDateRange') : t('checkInDateRange')}
              </label>
              <div
                className="inline-flex rounded-md border border-gray-200 p-0.5 bg-white"
                role="group"
                aria-label={t('dateRangeBasisAria')}
              >
                <button
                  type="button"
                  onClick={() => setDateRangeBasis('check_in')}
                  aria-pressed={dateRangeBasis === 'check_in'}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${
                    dateRangeBasis === 'check_in'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t('dateRangeBasisTourDate')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateRangeBasis('submit_on')}
                  aria-pressed={dateRangeBasis === 'submit_on'}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${
                    dateRangeBasis === 'submit_on'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t('dateRangeBasisSubmitOn')}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                <input
                  type="date"
                  value={checkInDateFrom}
                  onChange={(e) => setCheckInDateFrom(e.target.value)}
                  aria-label={t('dateRangeStart')}
                  className="w-full pl-6 pr-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                />
              </div>
              <span className="text-gray-400 text-xs shrink-0">–</span>
              <div className="relative min-w-0 flex-1">
                <input
                  type="date"
                  value={checkInDateTo}
                  onChange={(e) => setCheckInDateTo(e.target.value)}
                  aria-label={t('dateRangeEnd')}
                  min={checkInDateFrom || undefined}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {TICKET_CHECK_IN_YEAR_PRESETS.map((year) => {
                const active = isTicketCheckInYearPresetActive(checkInDateFrom, checkInDateTo, year);
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setCheckInDateFrom('');
                        setCheckInDateTo('');
                      } else {
                        const { from, to } = ticketCheckInYearRange(year);
                        setCheckInDateFrom(from);
                        setCheckInDateTo(to);
                      }
                    }}
                    aria-pressed={active}
                    aria-label={t('checkInYearPresetAria', { year })}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              필터
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const newValue = !futureEventFilter;
                  setFutureEventFilter(newValue);
                  // 필터 활성화 시 자동으로 날짜순 정렬
                  if (newValue) {
                    setSortField('date');
                    setSortDirection('asc');
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  futureEventFilter
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Future Event
              </button>
              <button
                type="button"
                onClick={() => {
                  const newValue = !cancelDeadlineFilter;
                  setCancelDeadlineFilter(newValue);
                  if (newValue) {
                    setSortField('date');
                    setSortDirection('asc');
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  cancelDeadlineFilter
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                취소 기한
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingRequestOnlyFilter((v) => !v);
                  if (viewMode === 'table' && needsReviewEaMismatch) {
                    setNeedsReviewEaMismatch(false);
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  pendingRequestOnlyFilter
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={
                  locale === 'ko'
                    ? '예매 요청·변경 요청 중(벤더 응답 대기) 부킹만 표시합니다.'
                    : 'Show only bookings awaiting vendor response (initial or change request).'
                }
              >
                {locale === 'ko' ? '요청 중' : 'Pending'}
                {pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !multiRnOnlyFilter;
                  setMultiRnOnlyFilter(next);
                  if (next && viewMode === 'table') {
                    setTicketTableLayout('byRn');
                  }
                }}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  multiRnOnlyFilter
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={
                  locale === 'ko'
                    ? '같은 RN#에 부킹이 2건 이상인 그룹만 표시합니다. (RN# 없음 단일 행은 제외)'
                    : 'Show only RN# groups with two or more booking rows (excludes rows without RN#).'
                }
              >
                {locale === 'ko' ? 'RN# 다중' : 'Multi RN#'}
                {multiRnGroupCount > 0 ? ` (${multiRnGroupCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setHideAuditedFilter((v) => !v)}
                className={`flex-1 px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  hideAuditedFilter
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={tAudit('hideAuditedTitle')}
              >
                {tAudit('hideAudited')}
                {auditedCount > 0 ? ` (${auditedCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showVendorPeriodStats ? (
        <TicketBookingVendorPeriodStatsPanel
          vendor={companyFilter}
          from={checkInDateFrom}
          to={checkInDateTo}
          dateBasis={dateRangeBasis}
          stats={vendorPeriodStats}
          locale={locale}
        />
      ) : null}

      {/* 데이터 표시 영역 */}
      <div className="min-w-0 max-w-full px-3 pb-4 sm:px-4">
        {viewMode === 'table' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium text-gray-600">테이블 표시</span>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setTicketTableLayout('flat')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ticketTableLayout === 'flat'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setTicketTableLayout('byRn')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ticketTableLayout === 'byRn'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  RN#별
                </button>
                <button
                  type="button"
                  onClick={() => setTicketTableLayout('byTour')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ticketTableLayout === 'byTour'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {locale === 'ko' ? '투어별' : 'By tour'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTicketTableLayout('byDate');
                    setLxMismatchOnlyFilter(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ticketTableLayout === 'byDate'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {locale === 'ko' ? '날짜별' : 'By date'}
                </button>
              </div>
              {ticketTableLayout === 'byDate' ? (
                <button
                  type="button"
                  onClick={() => setLxMismatchOnlyFilter((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    lxMismatchOnlyFilter
                      ? 'border-red-500 bg-red-100 text-red-950 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title={
                    locale === 'ko'
                      ? '투어 초이스 L/X 합과 티켓 EA L/X 합이 다른 날짜만 표시합니다. 미연결 티켓 배정·수정용.'
                      : 'Show only dates where tour choice L/X totals differ from ticket L/X EA totals.'
                  }
                >
                  {locale === 'ko' ? 'L/X 불일치만' : 'L/X mismatch only'}
                  {dateViewGroupsAll
                    ? ` (${dateViewGroupsAll.filter((g) => g.hasMismatch).length})`
                    : ''}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setNeedsReviewEaMismatch((v) => {
                    const next = !v;
                    if (next) setPendingRequestOnlyFilter(false);
                    return next;
                  });
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  needsReviewEaMismatch
                    ? 'border-amber-500 bg-amber-100 text-amber-950 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={
                  locale === 'ko'
                    ? '확정 부킹 중 티켓 수량(EA)과 투어 총 인원이 다른 행만 표시합니다.'
                    : 'Show only confirmed bookings where ticket quantity (EA) differs from tour total guests.'
                }
              >
                {locale === 'ko' ? '확인 필요' : 'Needs review'}
              </button>
            </div>
            {/* 상태 설명: 6축 다이어그램 */}
            <div className="min-w-0 max-w-full overflow-hidden">
              <TicketBookingAxisDiagram className="min-w-0" />
            </div>
            {/* 테이블 뷰 - 모바일: 카드형 리스트, 데스크톱: 테이블 */}
            <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
              {/* 모바일 카드형 리스트 */}
              <div className="block space-y-3 sm:hidden">
                {sortedBookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {searchTerm ||
                    hasStatusFilter ||
                    hasCheckInDateRangeFilter ||
                    needsReviewEaMismatch ||
                    lxMismatchOnlyFilter ||
                    pendingRequestOnlyFilter ||
                    multiRnOnlyFilter ||
                    hideAuditedFilter
                      ? '검색 조건에 맞는 부킹이 없습니다.'
                      : '등록된 입장권 부킹이 없습니다.'}
                  </div>
                ) : ticketTableGroups ? (
                  <div className="space-y-5">
                    {ticketTableGroups.map((g, gi) => {
                      const totalEa = g.rows.reduce((s, b) => s + (isTicketBookingCountingStatus(b) ? b.ea : 0), 0);
                      const totalPrice = g.rows.reduce(
                        (s, b) => s + (isTicketBookingCountingStatus(b) ? ticketBookingLineTotalUsd(b) : 0),
                        0
                      );
                      const palette = RN_TABLE_GROUP_STYLES[gi % RN_TABLE_GROUP_STYLES.length];
                      const anyChangePending = g.rows.some(isTicketBookingChangeRequestPending);
                      const groupHeaderTitle =
                        ticketTableLayout === 'byRn' ? `RN# ${g.label}` : g.label;
                      const dateMismatchRing =
                        g.dateView?.hasMismatch ? 'ring-2 ring-red-500 ring-offset-1' : '';
                      return (
                        <div
                          key={g.key}
                          className={`${palette.mobileSection} ${anyChangePending ? 'ring-2 ring-red-600 ring-offset-2' : dateMismatchRing}`}
                        >
                          <div className={`${palette.mobileHeader} text-xs`}>
                            <div className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
                              {ticketTableLayout === 'byDate'
                                ? locale === 'ko'
                                  ? `체크인 ${groupHeaderTitle}`
                                  : `Check-in ${groupHeaderTitle}`
                                : groupHeaderTitle}
                            </div>
                            {g.dateView ? renderDateViewGroupSummary(g.dateView, 'mobile') : null}
                            <div className="mt-1 text-neutral-700 font-medium">
                              {locale === 'ko' ? '티켓' : 'Tickets'}: {g.rows.length}건 · 수량 합 {totalEa}
                              {locale === 'ko' ? '개' : ''} · ${totalPrice}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {ticketTableLayout === 'byRn'
                                ? renderLegacyOffsetConsolidateButton(g.key, g.rows, 'mobile')
                                : null}
                              {renderRnGroupBulkDeleteButtons(
                                g.key,
                                g.rows,
                                'mobile',
                                groupHeaderTitle
                              )}
                            </div>
                          </div>
                          <div className="space-y-2.5 p-2.5 bg-white/80">
                            {g.rows.map((booking) => renderTicketMobileCard(booking))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  pagedSortedBookings.map((booking) => renderTicketMobileCard(booking))
                )}
              </div>
              {/* 데스크톱 테이블 — 페이지는 넘치지 않고, 카드 안에서만 가로 스크롤 */}
              <div className="hidden min-w-0 w-full max-w-full overflow-x-auto sm:block">
                <table className="w-full min-w-[960px] border-collapse text-[11px]">
                {renderTicketDesktopTableThead({ showStatementRecon: true })}
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Cancel Due 날짜별로 그룹화하여 배경색 매핑 생성
                    const cancelDueColorMap = buildCancelDueColorMapFor(sortedBookings);

                    if (ticketTableGroups) {
                      return ticketTableGroups.flatMap((g, gi) => {
                        const totalEa = g.rows.reduce(
                          (s, b) => s + (isTicketBookingCountingStatus(b) ? b.ea : 0),
                          0
                        );
                        const totalPrice = g.rows.reduce(
                          (s, b) =>
                            s + (isTicketBookingCountingStatus(b) ? ticketBookingLineTotalUsd(b) : 0),
                          0
                        );
                        const palette = RN_TABLE_GROUP_STYLES[gi % RN_TABLE_GROUP_STYLES.length];
                        const groupHeaderTitle =
                          ticketTableLayout === 'byRn' ? `RN# ${g.label}` : g.label;
                        const nodes: React.ReactNode[] = [];
                        if (gi > 0) {
                          nodes.push(
                            <tr key={`tbl-gap-${g.key}`} className="pointer-events-none" aria-hidden>
                              <td
                                colSpan={ticketDesktopColCount}
                                className="h-3 bg-neutral-300 p-0 border-y-2 border-neutral-400"
                              />
                            </tr>
                          );
                        }
                        const dateHeaderClass = g.dateView?.hasMismatch
                          ? 'bg-red-100 border-y border-red-300 shadow-sm'
                          : palette.headerRow;
                        nodes.push(
                          <Fragment key={g.key}>
                            <tr className={`align-middle ${dateHeaderClass}`}>
                              <td colSpan={ticketDesktopColCount} className="align-middle px-3 py-2.5 text-xs border-0">
                                <span className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
                                  {ticketTableLayout === 'byDate'
                                    ? locale === 'ko'
                                      ? `체크인 ${groupHeaderTitle}`
                                      : `Check-in ${groupHeaderTitle}`
                                    : groupHeaderTitle}
                                </span>
                                {g.dateView ? renderDateViewGroupSummary(g.dateView, 'desktop') : null}
                                <span className="text-neutral-800 font-medium ml-3 block sm:inline mt-1 sm:mt-0">
                                  {locale === 'ko' ? '티켓' : 'Tickets'}: {g.rows.length}건 · 수량 합{' '}
                                  {totalEa}개 · 총액 ${totalPrice}
                                </span>
                                {ticketTableLayout === 'byRn'
                                  ? renderLegacyOffsetConsolidateButton(g.key, g.rows, 'desktop')
                                  : null}
                                {renderRnGroupBulkDeleteButtons(
                                  g.key,
                                  g.rows,
                                  'desktop',
                                  groupHeaderTitle
                                )}
                              </td>
                            </tr>
                            {g.rows.map((b) => renderDesktopRow(b, palette.rowStripe, cancelDueColorMap))}
                          </Fragment>
                        );
                        return nodes;
                      });
                    }
                    return pagedSortedBookings.map((b) => renderDesktopRow(b, '', cancelDueColorMap));
                  })()}
                </tbody>
              </table>
            </div>
            {sortedBookings.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-lg font-medium mb-2">
                  {searchTerm ||
                  hasStatusFilter ||
                  hasCheckInDateRangeFilter ||
                  needsReviewEaMismatch ||
                  lxMismatchOnlyFilter ||
                  pendingRequestOnlyFilter ||
                  multiRnOnlyFilter ||
                  hideAuditedFilter
                    ? '검색 조건에 맞는 부킹이 없습니다.'
                    : '등록된 입장권 부킹이 없습니다.'}
                </div>
                <p className="text-sm text-gray-400">
                  {!searchTerm &&
                    !hasStatusFilter &&
                    !hasCheckInDateRangeFilter &&
                    !needsReviewEaMismatch &&
                    !lxMismatchOnlyFilter &&
                    !pendingRequestOnlyFilter &&
                    !multiRnOnlyFilter &&
                    !hideAuditedFilter &&
                    '새 부킹을 추가해보세요.'}
                </p>
              </div>
            )}
          </div>
          </>
        ) : viewMode === 'calendar' ? (
          /* 달력 뷰 - 실제 달력 UI에 라벨로 표시 */
          <div className="min-w-0 max-w-full">
            <div className="min-w-0">
              {(() => {
                // 체크인 날짜별로 그룹화 (달력 칸의 로컬 YMD와 일치)
                const groupedByDate = filteredBookings.reduce((groups, booking) => {
                  const date = bookingCheckInYmd(booking);
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(booking);
                  return groups;
                }, {} as Record<string, TicketBooking[]>);

                // 선택된 월 기준으로 달력 생성
                const now = new Date();

                const calendarDays: Date[] = [];

                // 월별 달력 뷰 (전체 월)
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();

                // 이번 달의 첫 번째 날
                const firstDay = new Date(currentYear, currentMonth, 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작

                // 6주 표시를 위해 42일 생성
                for (let i = 0; i < 42; i++) {
                  const date = new Date(startDate);
                  date.setDate(startDate.getDate() + i);
                  calendarDays.push(date);
                }

                const gridStartYmd = localYmdFromDate(calendarDays[0]!);
                const gridEndYmd = localYmdFromDate(calendarDays[41]!);
                const productLegendMap = new Map<
                  string,
                  { key: string; displayName: string; productId: string | null }
                >();
                for (const tour of tourEvents) {
                  if (!tourSpanIntersectsGrid(tour, gridStartYmd, gridEndYmd)) continue;
                  const pk = ticketCalendarProductKey(tour);
                  if (productLegendMap.has(pk)) continue;
                  productLegendMap.set(pk, {
                    key: pk,
                    displayName: getProductName(tour.products),
                    productId: (tour.product_id || '').trim() || null,
                  });
                }
                const collatorLocale = locale.startsWith('en') ? 'en' : 'ko';
                const productLegendItems = [...productLegendMap.values()].sort((a, b) =>
                  a.displayName.localeCompare(b.displayName, collatorLocale)
                );

                const tourSegmentsByWeek = buildTicketCalendarTourSegmentsByWeek(
                  tourEvents,
                  calendarDays,
                  gridStartYmd,
                  gridEndYmd
                );

                const monthNames = t.raw('monthNames');
                const dayNames = t.raw('dayNames');

                return (
                  <div className="space-y-3 sm:space-y-4">
                    {/* 달력 헤더 - 모바일 터치 영역 확대 */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                        title={t('previousMonth')}
                      >
                        <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="text-center min-w-0 flex-1">
                        <h4 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                          {currentYear} {monthNames[currentMonth]}
                        </h4>
                        <button
                          onClick={goToToday}
                          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 mt-0.5 sm:mt-1"
                        >
                          {t('goToToday')}
                        </button>
                      </div>
                      
                      <button
                        onClick={goToNextMonth}
                        className="p-2.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                        title={t('nextMonth')}
                      >
                        <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {productLegendItems.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-white px-2 py-2 sm:px-3 sm:py-2.5">
                        <div className="text-[11px] sm:text-xs font-semibold text-gray-700 mb-1.5">
                          {t('ticketCalendarProductLegendTitle')}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {productLegendItems.map((item) => {
                            const lp = ticketCalendarLegendChipDisplayProps(
                              item.productId,
                              item.key,
                              scheduleProductColors
                            );
                            return (
                              <span
                                key={item.key}
                                title={item.displayName}
                                className={`inline-flex max-w-[min(100%,14rem)] items-center rounded-full border border-black/10 px-2 py-0.5 text-[10px] sm:text-xs font-medium ${lp.className ?? ''}`}
                                style={lp.style}
                              >
                                <span className="truncate">{item.displayName}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 요일 헤더 - 모바일 컴팩트 */}
                    <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                      {dayNames.map((day: string) => (
                        <div key={day} className="py-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500 bg-gray-50">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* 달력 그리드 — 주(행) 단위 + 멀티데이 투어는 한 박스 오버레이 */}
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      {[0, 1, 2, 3, 4, 5].map((weekRow) => {
                        const rawWeekSegs = tourSegmentsByWeek.get(weekRow) ?? [];
                        const segsWithLane = assignTicketCalendarTourLanes(rawWeekSegs);
                        const maxLane = segsWithLane.reduce((m, s) => Math.max(m, s.lane), -1);
                        const stripRows = maxLane >= 0 ? maxLane + 1 : 0;
                        const cellPadTop = ticketCalendarCellPadTopForTourStrip(stripRows);

                        return (
                          <div
                            key={`cal-week-${weekRow}`}
                            className="relative grid grid-cols-7 gap-0.5 sm:gap-1"
                          >
                            {Array.from({ length: 7 }, (_, col) => {
                              const index = weekRow * 7 + col;
                              const date = calendarDays[index]!;
                              const dateString = localYmdFromDate(date);
                              const isCurrentMonth = date.getMonth() === currentMonth;
                              const isToday = date.toDateString() === now.toDateString();
                              const dayBookings = groupedByDate[dateString] || [];

                              const dayBookingsEaNonCancelled = dayBookings
                                .filter(isTicketBookingCountingStatus)
                                .reduce((sum, booking) => sum + (Number(booking.ea) || 0), 0);

                              const dayTours = tourEvents
                                .filter((tr) => tourOverlapsCalendarYmd(tr, dateString))
                                .sort(
                                  (a, b) =>
                                    String(a.tour_date).localeCompare(String(b.tour_date)) ||
                                    String(a.id).localeCompare(String(b.id))
                                );

                              const toursStartingThisDay = dayTours.filter(
                                (tr) => ymdFromDbDate(tr.tour_date) === dateString
                              );
                              const spanningContinuationOnly =
                                dayTours.length > 0 && toursStartingThisDay.length === 0;

                              const sumTourPeopleStartsToday = toursStartingThisDay.reduce(
                                (sum, tr) => sum + (Number(tr.total_people) || 0),
                                0
                              );

                              let tourBookingHeadcountMismatch = false;
                              if (!spanningContinuationOnly) {
                                if (
                                  toursStartingThisDay.length > 0 &&
                                  sumTourPeopleStartsToday !== dayBookingsEaNonCancelled
                                ) {
                                  tourBookingHeadcountMismatch = true;
                                } else if (
                                  toursStartingThisDay.length === 0 &&
                                  dayTours.length === 0 &&
                                  dayBookingsEaNonCancelled > 0
                                ) {
                                  tourBookingHeadcountMismatch = true;
                                }
                              }

                              const cellOutlineClass =
                                tourBookingHeadcountMismatch ?
                                  'border-2 border-red-500 shadow-sm shadow-red-200/70'
                                : 'border border-gray-200';

                              const cellBgClass = tourBookingHeadcountMismatch
                                ? 'bg-yellow-50'
                                : isCurrentMonth
                                  ? 'bg-white'
                                  : 'bg-gray-50';

                              return (
                                <div
                                  key={`cal-${dateString}-${index}`}
                                  style={{ paddingTop: cellPadTop }}
                                  className={`relative min-h-[72px] sm:min-h-[100px] lg:min-h-[160px] px-1 pb-1 sm:px-2 sm:pb-2 rounded-sm ${cellOutlineClass} ${cellBgClass} ${
                                    isToday ? 'ring-2 ring-blue-500 ring-offset-0' : ''}`}
                                >
                                  <div
                                    className={`absolute left-1 top-1 z-[15] text-xs sm:text-sm font-medium leading-none ${
                                      isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                    } ${isToday ? 'text-blue-600' : ''}`}
                                  >
                                    {date.getDate()}
                                  </div>

                                  {/* 부킹 정보 라벨 */}
                                  {dayBookings.length > 0 && (
                                    <div className="relative z-[25] space-y-0.5">
                                      <div
                                        className={`text-[11px] sm:text-sm font-semibold leading-tight ${
                                          sumTourPeopleStartsToday !== dayBookingsEaNonCancelled
                                            ? 'text-red-600'
                                            : 'text-blue-700'
                                        }`}
                                      >
                                        {t('tourPeopleReservationsSummary', {
                                          tourPeople: sumTourPeopleStartsToday,
                                          reservations: dayBookingsEaNonCancelled,
                                        })}
                                      </div>
                                      {buildTicketRnGroups(dayBookings).map((g) => {
                                        const groupChangePending = g.rows.some(isTicketBookingChangeRequestPending);
                                        const totalEa = g.rows.reduce((sum, booking) => sum + booking.ea, 0);
                                        const firstBooking = g.rows[0]!;
                                        const withTour = g.rows.filter((b) => Boolean(b.tour_id));
                                        const clipState: 'linked' | 'none' | 'partial' =
                                          withTour.length === g.rows.length
                                            ? 'linked'
                                            : withTour.length === 0
                                              ? 'none'
                                              : 'partial';
                                        const clipTitle =
                                          clipState === 'linked'
                                            ? t('tourLinkedBadge')
                                            : clipState === 'none'
                                              ? t('tourUnlinkedBadge')
                                              : t('tourPartiallyLinkedBadge');
                                        const clipClass =
                                          clipState === 'linked'
                                            ? 'text-emerald-600'
                                            : clipState === 'partial'
                                              ? 'text-amber-600'
                                              : '';
                                        const subtitleParts = g.rows.map((b) => {
                                          const tm = (b.time || '').replace(/:\d{2}$/, '');
                                          const co = (b.company || '').trim();
                                          return co ? `${tm} ${co}` : tm;
                                        });
                                        const detailTail =
                                          g.rows.length > 1 ? ` · +${g.rows.length - 1}` : '';
                                        const titleLine = `${clipTitle} · ${subtitleParts.join(' · ')}${detailTail}`;

                                        const timeShort = (firstBooking.time || '').replace(/:\d{2}$/, '');
                                        const companyShort = (firstBooking.company || '').trim();
                                        const supplierStyle = ticketBookingSupplierColors(firstBooking.company);

                                        return (
                                          <TicketCalendarRnBookingChipTooltip
                                            key={`${dateString}-rn-${g.key}`}
                                            rows={g.rows}
                                            locale={locale}
                                            tAxis={tTbAxis}
                                            tAct={tTbActUi}
                                            titleLine={titleLine}
                                            supplierStyle={supplierStyle}
                                            chipClassName={`min-w-0 w-full px-0.5 py-0.5 rounded text-left text-[8px] sm:text-[11px] lg:text-[12px] cursor-pointer hover:opacity-90 overflow-hidden transition-opacity ${
                                              groupChangePending
                                                ? 'ring-2 ring-red-600 ring-offset-0'
                                                : 'ring-1 ring-black/15'
                                            }`}
                                            onClick={() => handleBookingClick(g.rows)}
                                          >
                                            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                                              {groupChangePending ? (
                                                <span
                                                  className="shrink-0 rounded-sm bg-red-600 px-0.5 text-[7px] font-extrabold uppercase tracking-tight text-white sm:text-[9px]"
                                                  title={
                                                    locale.startsWith('en')
                                                      ? 'Change request in progress'
                                                      : '변경 요청 진행 중'
                                                  }
                                                >
                                                  {locale.startsWith('en') ? 'CHG' : '변경'}
                                                </span>
                                              ) : null}
                                              <span
                                                className="inline-flex shrink-0 items-center"
                                                title={clipTitle}
                                                aria-label={clipTitle}
                                              >
                                                {clipState === 'none' ? (
                                                  <span className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center sm:h-3 sm:w-3">
                                                    <Paperclip
                                                      className="absolute inset-0 h-full w-full text-orange-500"
                                                      strokeWidth={2.25}
                                                      aria-hidden
                                                    />
                                                    <svg
                                                      viewBox="0 0 24 24"
                                                      className="relative z-[1] h-full w-full text-orange-600"
                                                      fill="none"
                                                      aria-hidden
                                                    >
                                                      <path
                                                        d="M5 5 L19 19"
                                                        stroke="currentColor"
                                                        strokeWidth="2.85"
                                                        strokeLinecap="round"
                                                      />
                                                    </svg>
                                                  </span>
                                                ) : (
                                                  <Paperclip
                                                    className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${clipClass}`}
                                                    strokeWidth={2.25}
                                                    aria-hidden
                                                  />
                                                )}
                                              </span>
                                              <span
                                                className="inline-flex shrink-0 items-center gap-px sm:gap-0.5"
                                                title={[
                                                  formatTicketBookingAxisLabel(tTbAxis, 'booking', firstBooking.booking_status),
                                                  formatTicketBookingAxisLabel(tTbAxis, 'vendor', firstBooking.vendor_status),
                                                ].join(' · ')}
                                                aria-label={[
                                                  formatTicketBookingAxisLabel(tTbAxis, 'booking', firstBooking.booking_status),
                                                  formatTicketBookingAxisLabel(tTbAxis, 'vendor', firstBooking.vendor_status),
                                                ].join(' · ')}
                                              >
                                                <TicketBookingBookingStatusIcon
                                                  status={firstBooking.booking_status}
                                                  variant="tile"
                                                  className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                                                  title={formatTicketBookingAxisLabel(tTbAxis, 'booking', firstBooking.booking_status)}
                                                />
                                                <TicketBookingVendorStatusIcon
                                                  status={firstBooking.vendor_status}
                                                  variant="tile"
                                                  className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                                                  title={formatTicketBookingAxisLabel(tTbAxis, 'vendor', firstBooking.vendor_status)}
                                                />
                                              </span>
                                              <span className="shrink-0 font-semibold tabular-nums opacity-95">
                                                {timeShort}
                                              </span>
                                              <span className="min-w-0 truncate font-medium opacity-95">
                                                {companyShort || '—'}
                                              </span>
                                              <span className="shrink-0 tabular-nums opacity-95">
                                                {totalEa}
                                                {t('items')}
                                              </span>
                                              <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-1 py-px text-[7px] sm:text-[10px] font-bold text-indigo-900 ring-1 ring-indigo-200/90">
                                                {g.label === 'RN# 없음' ? '—' : g.label}
                                              </span>
                                            </div>
                                          </TicketCalendarRnBookingChipTooltip>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {stripRows > 0 ? (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-[10] grid grid-cols-7 gap-0.5 sm:gap-1"
                                style={{
                                  top: TICKET_CAL_DATE_ROW_PX,
                                  rowGap: TICKET_CAL_TOUR_LANE_GAP_PX,
                                  gridTemplateRows: `repeat(${stripRows}, minmax(${TICKET_CAL_TOUR_LANE_MIN_PX}px, auto))`,
                                }}
                              >
                                {segsWithLane.map((seg) => {
                                  const tour = seg.tour;
                                  const guideName = tour.guide_display_name?.trim();
                                  const asstName = tour.assistant_display_name?.trim();
                                  const staffNamesOnly = [guideName, asstName].filter(
                                    (n): n is string => Boolean(n)
                                  );
                                  const tourStartYmd = ymdFromDbDate(tour.tour_date);
                                  const tourEndYmd = tourCalendarSpanEndYmd(tour);
                                  const multiDayHint =
                                    tourStartYmd &&
                                    tourEndYmd &&
                                    tourEndYmd !== tourStartYmd
                                      ? ` · ${tourStartYmd}→${tourEndYmd}`
                                      : '';
                                  const baseTitle = `${getProductName(tour.products)} - ${t('adults')}:${tour.adults}${t('people')}, ${t('children')}:${tour.child}${t('people')}, ${t('infants')}:${tour.infant}${t('people')} (${t('total')} ${tour.total_people}${t('people')})${multiDayHint}`;
                                  const staffTitle = [
                                    guideName &&
                                      `${t('ticketCalendarTourGuideLabel')}: ${guideName}`,
                                    asstName &&
                                      `${t('ticketCalendarTourAssistantLabel')}: ${asstName}`,
                                  ]
                                    .filter(Boolean)
                                    .join(', ');
                                  const chipTitle = staffTitle
                                    ? `${baseTitle} · ${staffTitle} (Click for details)`
                                    : `${baseTitle} (Click for details)`;

                                  const peopleText = (() => {
                                    const tourName = getProductName(tour.products);
                                    const totalPeople = tour.total_people;
                                    const child = tour.child || 0;
                                    const infant = tour.infant || 0;
                                    if (child > 0 || infant > 0) {
                                      const childText = child > 0 ? `${t('children')}${child}` : '';
                                      const infantText = infant > 0 ? `${t('infants')}${infant}` : '';
                                      const additionalText = [childText, infantText].filter(Boolean).join(' ');
                                      return `${tourName} ${totalPeople}${t('people')} (${additionalText})`;
                                    }
                                    return `${tourName} ${totalPeople}${t('people')}`;
                                  })();

                                  const tourChipProps = ticketCalendarTourChipDisplayProps(
                                    tour,
                                    scheduleProductColors
                                  );

                                  return (
                                    <div
                                      key={`ovl-${tour.id}-w${weekRow}-c${seg.startCol}-${seg.endCol}-l${seg.lane}`}
                                      style={{
                                        gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                                        gridRow: seg.lane + 1,
                                      }}
                                      className="pointer-events-auto box-border flex min-h-0 min-w-0 w-full max-w-full items-stretch px-1.5 sm:px-2"
                                    >
                                      {/* 배경은 안쪽에만: 바깥 px로 달력 칸(그리드 스팬) 가장자리와 간격 */}
                                      <div
                                        className={`box-border flex min-w-0 w-full max-w-full items-center overflow-hidden rounded-sm text-[9px] font-medium shadow-sm ring-1 ring-black/10 sm:text-[11px] cursor-pointer hover:opacity-90 transition-opacity ${tourChipProps.className ?? ''}`}
                                        style={{
                                          minHeight: TICKET_CAL_TOUR_LANE_MIN_PX,
                                          ...tourChipProps.style,
                                        }}
                                        title={chipTitle}
                                        onClick={() => handleTourClick(tour.id)}
                                      >
                                        <div
                                          className="box-border flex w-full min-w-0 max-w-full flex-wrap items-center gap-x-0.5 gap-y-0 leading-tight"
                                          style={{
                                            paddingTop: 2,
                                            paddingBottom: 2,
                                            paddingLeft: 8,
                                            paddingRight: 8,
                                          }}
                                        >
                                          <span className="min-w-0 flex-1 truncate">{peopleText}</span>
                                          {staffNamesOnly.map((name, si) => (
                                            <span
                                              key={`${tour.id}-ovl-staff-${si}-${name}`}
                                              className="inline-flex shrink-0 items-center gap-x-0.5"
                                            >
                                              {si > 0 ? (
                                                <span className="text-[8px] font-normal opacity-70">,</span>
                                              ) : null}
                                              <span className="rounded-full bg-white/85 px-1 py-px text-[8px] font-semibold text-neutral-900 shadow-sm ring-1 ring-black/10 sm:text-[10px]">
                                                {name}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* 범례 - 모바일 컴팩트 */}
                    <div className="mt-3 sm:mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{t('ticketCalendarHeadcountMismatchHint')}</p>
                      <div className="text-xs sm:text-sm font-medium text-gray-700 mb-2">{t('statusLegend')}</div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {TICKET_BOOKING_STATUS_VALUES.map((sv) => (
                          <span
                            key={sv}
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTicketBookingStatusBadgeClass(sv)}`}
                          >
                            {formatTicketBookingStatusLabel(sv, t, locale)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">{t('tourEvents')}</div>
                        <p className="text-xs text-gray-600 mb-2 leading-relaxed">{t('ticketCalendarTourColorsLegendHint')}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 ring-1 ring-gray-200">
                            {t('tourNameAndPeople')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {t('supplierCategory')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">{t('supplierCategory')}</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-200 text-blue-800">
                            {t('seeCanyonConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-600">
                            {t('seeCanyonNotConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                            {t('antelopeXConnected')}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600">
                            {t('antelopeXNotConnected')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* 카드뷰 - 모바일 컴팩트 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {pagedSortedBookings.map((booking) => {
              const supplierStyle = ticketBookingSupplierColors(booking.company);
              const changePending = isTicketBookingChangeRequestPending(booking);
              return (
              <div
                key={booking.id}
                className={`bg-white rounded-xl sm:rounded-lg shadow-sm sm:shadow-md hover:shadow-md sm:hover:shadow-lg transition-shadow ${
                  changePending ? 'border-2 border-red-600 ring-2 ring-red-500/40' : 'border border-gray-200'
                }`}
                style={{ borderLeftWidth: 4, borderLeftColor: supplierStyle.backgroundColor }}
              >
                <div className="p-3 sm:p-4 lg:p-6">
                  {/* 카드 헤더 - 모바일 컴팩트 */}
                  <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-0.5 sm:mb-1 truncate">
                        {booking.category}
                      </h3>
                      <p
                        className="text-xs sm:text-sm truncate inline-flex max-w-full rounded px-1.5 py-0.5 font-medium ring-1 ring-black/10"
                        style={{ backgroundColor: supplierStyle.backgroundColor, color: supplierStyle.color }}
                      >
                        {booking.company}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{booking.reservation_name}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className={`inline-flex px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${getTicketBookingStatusBadgeClass(booking.status)}`}>
                        {formatTicketBookingStatusLabel(booking.status, t, locale)}
                      </span>
                      <TicketBookingAxisSummary
                        booking={booking}
                        variant="inline"
                        className="max-w-[12rem] text-right"
                        omitAxes={['operation']}
                      />
                    </div>
                  </div>

                  {/* 카드 내용 - 모바일 2열 그리드 */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:contents text-xs sm:text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">제출일</span>
                        <span className="font-medium truncate">{booking.submit_on}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">시간</span>
                        <span className="font-medium">{booking.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">수량</span>
                        <span className="font-medium">{booking.ea}개</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-2 sm:pt-3">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:flex-col sm:gap-1 text-xs sm:text-sm">
                        <div className="flex justify-between sm:mb-0">
                          <span className="text-gray-500">단가</span>
                          <span className="font-medium">${booking.unit_price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">총액</span>
                          <span className="font-medium text-blue-600">${booking.total_price}</span>
                        </div>
                        <div className="col-span-2 flex justify-between sm:col-span-1">
                          <span className="text-gray-500">Invoice#</span>
                          <span className="font-medium truncate max-w-[55%] text-right">
                            {booking.invoice_number?.trim() || '—'}
                          </span>
                        </div>
                        <div className="col-span-2 flex justify-between sm:col-span-1">
                          <span className="text-gray-500">Zelle 확인#</span>
                          <span className="font-medium truncate max-w-[55%] text-right">
                            {booking.zelle_confirmation_number?.trim() || '—'}
                          </span>
                        </div>
                        <div className="col-span-2 flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openInvoiceQuickModal(booking)}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50"
                          >
                            Invoice·첨부
                          </button>
                          <button
                            type="button"
                            onClick={() => openZelleAttachmentView(booking)}
                            className="rounded border border-emerald-200 bg-emerald-50/70 px-2 py-1 text-xs text-emerald-900 hover:bg-emerald-100/80"
                          >
                            Zelle 첨부
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-2 sm:pt-3">
                      <div className="text-xs sm:text-sm">
                        <span className="text-gray-500">결제</span>
                        <div className="mt-0.5 sm:mt-1 font-medium truncate">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                      </div>
                      <div className="mt-1.5 sm:mt-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc ?? '')}`}>
                          {getCCStatusText(booking.cc ?? '')}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-2 sm:pt-3">
                      <div className="text-xs sm:text-sm">
                        <span className="text-gray-500">투어 연결</span>
                        <div className="mt-0.5 sm:mt-1">
                          {booking.tours && booking.tour_id ? (
                            <div>
                              <TicketBookingTourDisplay locale={locale} tours={booking.tours} tourFallback={t('tour')} showDetails={false} />
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 mt-1">
                                연결됨
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-400 text-xs">투어 미연결</span>
                              <button
                                type="button"
                                className="mt-1.5 inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                                onClick={() => setLinkTourModalBooking(booking)}
                              >
                                투어 선택
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼들 - 모바일 터치 친화 */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                    {renderTicketBookingActionButtons(booking, { size: 'touch' })}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {sortedBookings.length > 0 && viewMode !== 'calendar' && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-xs text-gray-600 sm:text-sm">
              {ticketTableLayout === 'byDate' && dateViewGroups ? (
                <>
                  전체 <span className="font-semibold text-gray-800">{dateViewGroups.length}</span>일 중{' '}
                  <span className="font-semibold text-gray-800">
                    {(listPageEffective - 1) * listPageSize + 1}
                  </span>
                  –
                  <span className="font-semibold text-gray-800">
                    {Math.min(listPageEffective * listPageSize, dateViewGroups.length)}
                  </span>
                  일째
                </>
              ) : (
                <>
                  전체 <span className="font-semibold text-gray-800">{sortedBookings.length}</span>건 중{' '}
                  <span className="font-semibold text-gray-800">
                    {(listPageEffective - 1) * listPageSize + 1}
                  </span>
                  –
                  <span className="font-semibold text-gray-800">
                    {Math.min(listPageEffective * listPageSize, sortedBookings.length)}
                  </span>
                  번째
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 sm:text-sm">
                <span className="whitespace-nowrap">
                  {ticketTableLayout === 'byDate' ? '페이지당(날짜)' : '페이지당'}
                </span>
                <select
                  value={listPageSize}
                  onChange={(e) => {
                    setListPageSize(Number(e.target.value));
                    setListPage(1);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                >
                  <option value={25}>{ticketTableLayout === 'byDate' ? '25일' : '25건'}</option>
                  <option value={50}>{ticketTableLayout === 'byDate' ? '50일' : '50건'}</option>
                  <option value={100}>{ticketTableLayout === 'byDate' ? '100일' : '100건'}</option>
                  <option value={200}>{ticketTableLayout === 'byDate' ? '200일' : '200건'}</option>
                </select>
              </label>
              <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setListPage(1)}
                  disabled={listPageEffective <= 1}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
                  title="첫 페이지"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setListPage((p) => {
                      const cur = Math.min(Math.max(1, p), listTotalPages);
                      return Math.max(1, cur - 1);
                    })
                  }
                  disabled={listPageEffective <= 1}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
                  title="이전"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[5.5rem] px-2 text-center text-xs font-medium tabular-nums text-gray-800 sm:text-sm">
                  {listPageEffective} / {listTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setListPage((p) => {
                      const cur = Math.min(Math.max(1, p), listTotalPages);
                      return Math.min(listTotalPages, cur + 1);
                    })
                  }
                  disabled={listPageEffective >= listTotalPages}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
                  title="다음"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setListPage(listTotalPages)}
                  disabled={listPageEffective >= listTotalPages}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
                  title="마지막 페이지"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredBookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg font-medium mb-2">
              {searchTerm ||
              hasStatusFilter ||
              hasCheckInDateRangeFilter ||
              needsReviewEaMismatch ||
              pendingRequestOnlyFilter ||
              multiRnOnlyFilter ||
              hideAuditedFilter
                ? '검색 조건에 맞는 부킹이 없습니다.'
                : '등록된 입장권 부킹이 없습니다.'}
            </div>
            <p className="text-sm text-gray-400">
              {!searchTerm &&
                !hasStatusFilter &&
                !hasCheckInDateRangeFilter &&
                !needsReviewEaMismatch &&
                !pendingRequestOnlyFilter &&
                !multiRnOnlyFilter &&
                !hideAuditedFilter &&
                '새 부킹을 추가해보세요.'}
            </p>
          </div>
        )}
      </div>

      <TicketBookingBulkAddModal
        open={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        tourId={null}
        defaultSubmittedBy={user?.email ?? ''}
        onSuccess={async () => {
          await fetchBookings();
        }}
      />

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-xl font-semibold">
                {editingBooking ? '입장권 부킹 편집' : '새 입장권 부킹 추가'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBooking(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <TicketBookingForm
                key={editingBooking?.id ?? 'new'}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                booking={editingBooking as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onSave={handleSave as any}
                onCancel={() => {
                  setShowForm(false);
                  setEditingBooking(null);
                }}
                isSuper={canSuperDeleteTicketBooking}
                canRequestSoftDelete={canBookingMgmtSoftDeleteUi}
                onRequestDelete={handleRequestSoftDelete}
                onDelete={(id) => {
                  handleDelete(id);
                  setShowForm(false);
                  setEditingBooking(null);
                }}
              />
              {editingBooking ? (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() => handleViewHistory(editingBooking.id)}
                    className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    {locale === 'ko' ? '히스토리' : 'History'}
                  </button>
                  {canBookingMgmtSoftDeleteUi && !editingBooking.deletion_requested_at ? (
                    <button
                      type="button"
                      onClick={() => void handleRequestSoftDelete(editingBooking.id)}
                      className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      {locale === 'ko' ? '삭제 요청' : 'Request delete'}
                    </button>
                  ) : null}
                  {canSuperDeleteTicketBooking && editingBooking.deletion_requested_at ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(editingBooking.id)}
                      className="inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                    >
                      {locale === 'ko' ? '영구 삭제' : 'Permanent delete'}
                    </button>
                  ) : null}
                  {canSuperDeleteTicketBooking &&
                  isTicketBookingOffsetOrCancelRow(editingBooking) &&
                  !editingBooking.deletion_requested_at ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            locale === 'ko'
                              ? '이 조정/취소 행을 바로 영구 삭제하시겠습니까?'
                              : 'Permanently delete this row now?'
                          )
                        ) {
                          void handleDelete(editingBooking.id);
                        }
                      }}
                      className="inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                    >
                      {locale === 'ko' ? '영구 삭제' : 'Permanent delete'}
                    </button>
                  ) : null}
                  {editingBooking.deletion_requested_at && !canSuperDeleteTicketBooking ? (
                    <span className="self-center text-sm text-amber-700">
                      {locale === 'ko' ? '삭제 요청됨' : 'Deletion requested'}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <BookingHistory
          bookingType="ticket"
          bookingId={selectedBookingId}
          onClose={() => {
            setShowHistory(false);
            setSelectedBookingId('');
          }}
        />
      )}

      <TicketBookingDeletionReviewModal
        open={deletionReviewOpen}
        onOpenChange={setDeletionReviewOpen}
        allowBulkPermanentDelete={canSuperDeleteTicketBooking}
        dialogTitle={t('ticketDeletedBookingsViewTitle')}
        dialogDescription={
          canSuperDeleteTicketBooking
            ? t('ticketDeletedBookingsViewDescSuper')
            : t('ticketDeletedBookingsViewDescReadOnly')
        }
        onAfterBulkDelete={() => {
          void fetchBookings();
        }}
      />

      <TicketBookingsNeedCheckModal
        open={showNeedCheckModal}
        onClose={() => setShowNeedCheckModal(false)}
        bookings={bookings}
        supplierProductsMap={supplierProductsMap}
        onEdit={(b) => handleEdit(b as TicketBooking)}
      />

      <TicketInvoiceUploadModal
        open={showInvoiceUploadModal}
        onClose={() => setShowInvoiceUploadModal(false)}
        bookings={bookings as TicketBookingLike[]}
        onApplied={handleInvoiceUploadApplied}
        onRnUpdated={handleInvoiceModalRnUpdated}
        onNoteUpdated={handleInvoiceModalNoteUpdated}
      />

      <TicketBookingReservationDetailModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        bookings={selectedBookings as TicketBookingReservationDetailRow[]}
        onEdit={(b) => handleEdit(b as TicketBooking)}
        onViewHistory={(id) => {
          setSelectedBookingId(id);
          setShowHistory(true);
        }}
        {...(canBookingMgmtSoftDeleteUi
          ? {
              onRequestSoftDelete: (id) => void handleRequestSoftDelete(id, { fromDetailModal: true }),
            }
          : {})}
        {...(canSuperDeleteTicketBooking
          ? { onHardDelete: (id) => void handleDelete(id, { fromDetailModal: true }) }
          : {})}
        onActionApplied={() => {
          void fetchBookings();
        }}
        renderGroupDesktopTable={(groupRows) => {
          const rb = groupRows as TicketBooking[];
          const dueMap = buildCancelDueColorMapFor(rb);
          return (
            <div className="mt-1 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[1280px] divide-y divide-gray-200">
                {renderTicketDesktopTableThead({ interactiveSort: false, showStatementRecon: true })}
                <tbody className="bg-white divide-y divide-gray-200">
                  {rb.map((b) => renderDesktopRow(b, '', dueMap, { inDetailModal: true }))}
                </tbody>
              </table>
            </div>
          );
        }}
        renderGroupCardBookings={(groupRows) => {
          const rb = groupRows as TicketBooking[];
          return (
            <div className="mt-1 w-full space-y-4">
              {rb.map((b) => renderTicketMobileCard(b, { variant: 'modalForm' }))}
            </div>
          );
        }}
        renderStatementReconCell={(b) => renderStatementReconCell(b as TicketBooking)}
      />

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(open) => {
          setStmtReconOpen(open)
          if (!open) restoreStatementReconScroll()
        }}
        context={stmtReconCtx}
        onApplied={() => void refreshAfterStatementReconApply()}
      />

      <TicketBookingVendorPartialChangeConfirmModal
        open={vendorPartialChangeModalBooking !== null}
        locale={locale}
        company={vendorPartialChangeModalBooking?.company}
        booking={
          vendorPartialChangeModalBooking ?? {
            ea: 0,
            time: null,
            change_status: 'none',
            pending_ea: null,
            pending_time: null,
          }
        }
        saving={
          vendorPartialChangeModalBooking
            ? workflowActionSavingId === vendorPartialChangeModalBooking.id
            : false
        }
        onClose={() => setVendorPartialChangeModalBooking(null)}
        onConfirm={async (payload) => {
          if (!vendorPartialChangeModalBooking) return;
          const ok = await runWorkflowRpc(
            vendorPartialChangeModalBooking,
            'workflow_vendor_confirm_change',
            payload
          );
          if (ok) setVendorPartialChangeModalBooking(null);
        }}
      />

      <TicketBookingVendorConfirmModal
        open={vendorConfirmModalBooking !== null}
        initialRnNumber={vendorConfirmModalBooking?.rn_number?.trim() ?? ''}
        company={vendorConfirmModalBooking?.company}
        locale={locale}
        saving={
          vendorConfirmModalBooking
            ? workflowActionSavingId === vendorConfirmModalBooking.id
            : false
        }
        onClose={() => setVendorConfirmModalBooking(null)}
        onConfirm={async ({ rn_number }) => {
          if (!vendorConfirmModalBooking) return;
          const ok = await runWorkflowRpc(vendorConfirmModalBooking, 'workflow_vendor_confirm_initial', {
            rn_number,
          });
          if (ok) setVendorConfirmModalBooking(null);
        }}
      />

      <TicketBookingLinkTourModal
        open={linkTourModalBooking !== null}
        booking={
          linkTourModalBooking
            ? {
                id: linkTourModalBooking.id,
                check_in_date: linkTourModalBooking.check_in_date,
                tour_id: linkTourModalBooking.tour_id,
              }
            : null
        }
        locale={locale}
        onClose={() => setLinkTourModalBooking(null)}
        onLinked={() => {
          void fetchBookings();
        }}
      />

      <TicketBookingQtyTimeChangeModal
        open={changeModalBooking !== null}
        title="수량·시간 변경 요청"
        initialEa={changeModalBooking?.ea ?? 1}
        initialTime={changeModalBooking?.time ?? ''}
        initialExpense={Number(changeModalBooking?.expense ?? 0)}
        initialUnitPrice={
          changeModalBooking?.unit_price != null && Number.isFinite(changeModalBooking.unit_price)
            ? changeModalBooking.unit_price
            : null
        }
        company={changeModalBooking?.company ?? ''}
        checkInDate={changeModalBooking?.check_in_date ?? ''}
        category={changeModalBooking?.category}
        rnNumber={changeModalBooking?.rn_number}
        note={changeModalBooking?.note}
        submittedBy={changeModalBooking?.submitted_by}
        saving={changeModalBooking ? workflowActionSavingId === changeModalBooking.id : false}
        onClose={() => setChangeModalBooking(null)}
        onSubmit={async (pendingEa, pendingTimeRaw) => {
          if (!changeModalBooking) return;
          const tt = pendingTimeRaw.trim();
          const pending_time = tt.includes(':') ? (tt.length === 5 ? `${tt}:00` : tt) : tt;
          const ok = await runWorkflowRpc(changeModalBooking, 'workflow_submit_change', {
            pending_ea: pendingEa,
            pending_time,
          });
          if (ok) setChangeModalBooking(null);
        }}
      />

      <TicketBookingPaymentCompleteModal
        open={paymentModalBooking !== null}
        initialEa={paymentModalBooking?.ea ?? 1}
        initialExpense={Number(paymentModalBooking?.expense ?? 0)}
        initialPaymentMethod={String(paymentModalBooking?.payment_method ?? '').trim()}
        saving={paymentModalBooking ? workflowActionSavingId === paymentModalBooking.id : false}
        onClose={() => setPaymentModalBooking(null)}
        onSubmit={async (payload) => {
          if (!paymentModalBooking) return;
          const ok = await runWorkflowRpc(
            paymentModalBooking,
            'workflow_complete_payment',
            payload as Record<string, unknown>
          );
          if (ok) setPaymentModalBooking(null);
        }}
      />

      {axesDialogBooking ?
        <TicketBookingAxesEditorDialog
          key={axesDialogBooking.id}
          open
          onOpenChange={(open) => {
            if (!open) setAxesDialogBooking(null);
          }}
          bookingId={axesDialogBooking.id}
          initial={axesDialogBooking}
          onSaved={() => {
            void fetchBookings();
            setAxesDialogBooking(null);
          }}
        />
      : null}

      {invoiceQuickBooking && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-invoice-quick-title"
          onClick={() => !attachmentModalBusy && setInvoiceQuickBooking(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ticket-invoice-quick-title" className="text-base font-semibold text-gray-900">
              Invoice # · 인보이스 · Zelle 확인
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              RN# {invoiceQuickBooking.rn_number?.trim() || '—'} · {invoiceQuickBooking.company}
            </p>
            <p className="mt-2 text-xs text-gray-600">
              같은 Invoice #를 쓰는 모든 행에 동일한 인보이스·Zelle 스크린샷이 표시됩니다. Invoice 번호 입력 후 아래에서
              파일을 추가·삭제할 수 있습니다. 인보이스·Zelle 영역 중{' '}
              <span className="text-gray-800 font-medium">붙여넣기 박스를 한 번 클릭</span>한 뒤{' '}
              <span className="text-gray-800 font-medium">Ctrl+V</span>로 넣거나, 각 영역 아래 링크로 PC에서 파일을 고를 수
              있습니다.{' '}
              <span className="text-gray-700">저장</span>을 누르면 Invoice 번호가 부킹에 반영되고, 보이는 첨부 URL도 서버에
              함께 맞춥니다. 기존 인보이스·Zelle 첨부는{' '}
              <span className="text-gray-800 font-medium">입력을 잠시 멈춘 뒤</span> 자동으로 불러옵니다.
            </p>
            <TicketInvoiceDraftInput
              key={invoiceQuickBooking.id}
              initialInvoice={invoiceQuickBooking.invoice_number?.trim() || ''}
              draftRef={invoiceQuickDraftRef}
              company={invoiceQuickBooking.company}
              disabled={invoiceQuickSaving}
              onDebouncedLoad={handleDebouncedInvoiceAttachmentLoad}
              onEnterSave={() => void saveInvoiceQuick()}
            />
            {invoicePhotoLoading ? (
              <p className="mt-2 text-xs text-gray-400">첨부 불러오는 중…</p>
            ) : null}

            <input
              ref={invoicePhotoInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,application/pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => void handleInvoicePhotoPick(e.target.files)}
            />
            <p className="mt-4 text-xs font-semibold text-gray-700">인보이스</p>
            <button
              type="button"
              disabled={attachmentModalBusy}
              onClick={() => setInvoiceModalPasteTarget('invoice')}
              className={`mt-2 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 ${
                invoiceModalPasteTarget === 'invoice'
                  ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-400/60 ring-offset-2'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              {invoicePhotoUploading ? (
                <span>업로드 중…</span>
              ) : (
                <>
                  <span className="font-medium text-gray-800">인보이스 붙여넣기 영역</span>
                  <span className="mt-1 text-xs text-gray-500">
                    클릭한 뒤 <span className="text-gray-700">Ctrl+V</span>로 붙여넣기
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={attachmentModalBusy}
              onClick={() => invoicePhotoInputRef.current?.click()}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
            >
              PC에서 인보이스 파일 선택…
            </button>

            {invoiceQuickPhotoUrls.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {invoiceQuickPhotoUrls.map((url) => {
                  const isImg = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
                  return (
                    <li key={url} className="flex gap-2 rounded-lg border border-gray-200 p-2">
                      <div className="min-w-0 flex-1">
                        {isImg ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="max-h-36 w-auto max-w-full rounded object-contain" />
                          </a>
                        ) : (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-sm text-blue-600 hover:underline"
                          >
                            {url.split('/').pop() || url}
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeInvoicePhotoUrl(url)}
                        disabled={attachmentModalBusy}
                        className="shrink-0 self-start rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-400">등록된 인보이스 파일이 없습니다.</p>
            )}

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-700">Zelle 확인 스크린샷</p>
              <input
                ref={zellePhotoInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => void handleZellePhotoPick(e.target.files)}
              />
              <button
                type="button"
                disabled={attachmentModalBusy}
                onClick={() => setInvoiceModalPasteTarget('zelle')}
                className={`mt-2 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm text-gray-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50/70 disabled:opacity-50 ${
                  invoiceModalPasteTarget === 'zelle'
                    ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-400/60 ring-offset-2'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}
              >
                {zellePhotoUploading ? (
                  <span>업로드 중…</span>
                ) : (
                  <>
                    <span className="font-medium text-gray-800">Zelle 캡처 붙여넣기 영역</span>
                    <span className="mt-1 text-xs text-gray-500">
                      클릭한 뒤 <span className="text-gray-700">Ctrl+V</span>로 붙여넣기
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={attachmentModalBusy}
                onClick={() => zellePhotoInputRef.current?.click()}
                className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline disabled:opacity-50"
              >
                PC에서 Zelle 캡처 이미지 선택…
              </button>
              {zelleQuickPhotoUrls.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {zelleQuickPhotoUrls.map((url) => {
                    const isImg = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
                    return (
                      <li key={url} className="flex gap-2 rounded-lg border border-emerald-100 bg-white p-2">
                        <div className="min-w-0 flex-1">
                          {isImg ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="max-h-36 w-auto max-w-full rounded object-contain" />
                            </a>
                          ) : (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-sm text-blue-600 hover:underline"
                            >
                              {url.split('/').pop() || url}
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeZellePhotoUrl(url)}
                          disabled={attachmentModalBusy}
                          className="shrink-0 self-start rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">등록된 Zelle 스크린샷이 없습니다.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                disabled={attachmentModalBusy}
                onClick={() => setInvoiceQuickBooking(null)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={attachmentModalBusy}
                onClick={() => void saveInvoiceQuick()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {invoiceQuickSaving ? '저장 중…' : '저장 (Invoice # · 첨부)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceLightbox && (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
          aria-label={
            invoiceLightbox.kind === 'zelle' ? 'Zelle 확인 미리보기' : 'Invoice 인보이스 미리보기'
          }
          onClick={() => !invoicePhotoRemoving && setInvoiceLightbox(null)}
        >
          <div
            className="relative flex max-h-[96vh] w-full max-w-5xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="absolute left-0 top-0 z-20 max-w-[70%] truncate text-left text-xs text-white/80">
              {invoiceLightbox.kind === 'zelle'
                ? `Zelle 확인 · Invoice ${invoiceLightbox.invoiceNumber}`
                : `Invoice ${invoiceLightbox.invoiceNumber}`}{' '}
              · {invoiceLightbox.company}
            </p>
            <button
              type="button"
              disabled={invoicePhotoRemoving}
              onClick={() => setInvoiceLightbox(null)}
              className="absolute right-0 top-0 z-20 rounded-full bg-white/15 p-2.5 text-2xl leading-none text-white hover:bg-white/25 disabled:opacity-50"
              aria-label="닫기"
            >
              ×
            </button>

            {invoiceLightboxImageUrls.length > 0 ? (
              <div className="mt-10 flex w-full max-w-5xl items-center justify-center gap-1 sm:mt-8 sm:gap-3">
                {invoiceLightboxImageUrls.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceLightboxIndex((i) => Math.max(0, i - 1))
                    }
                    className="shrink-0 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                    aria-label="이전 이미지"
                  >
                    <ChevronLeft className="h-7 w-7 sm:h-9 sm:w-9" />
                  </button>
                ) : (
                  <span className="w-9 shrink-0 sm:w-11" aria-hidden />
                )}
                <div className="flex min-h-0 min-w-0 flex-1 justify-center px-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={invoiceLightboxImageUrls[invoiceLightboxSafeIndex]}
                    alt=""
                    className="max-h-[min(85vh,900px)] max-w-full rounded object-contain shadow-2xl"
                  />
                </div>
                {invoiceLightboxImageUrls.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceLightboxIndex((i) =>
                        Math.min(invoiceLightboxImageUrls.length - 1, i + 1)
                      )
                    }
                    className="shrink-0 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                    aria-label="다음 이미지"
                  >
                    <ChevronRight className="h-7 w-7 sm:h-9 sm:w-9" />
                  </button>
                ) : (
                  <span className="w-9 shrink-0 sm:w-11" aria-hidden />
                )}
              </div>
            ) : null}

            {invoiceLightboxImageUrls.length > 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2">
                {invoiceLightboxImageUrls.length > 1 ? (
                  <p className="text-sm tabular-nums text-white/90">
                    {invoiceLightboxSafeIndex + 1} / {invoiceLightboxImageUrls.length}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={invoicePhotoRemoving}
                  onClick={() =>
                    void removeAttachmentFromLightbox(
                      invoiceLightboxImageUrls[invoiceLightboxSafeIndex]
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  현재 이미지 삭제
                </button>
              </div>
            ) : null}

            {invoiceLightboxOtherUrls.length > 0 ? (
              <div
                className={`w-full max-w-lg rounded-lg border border-white/20 bg-white/95 p-4 text-left shadow-lg ${
                  invoiceLightboxImageUrls.length > 0 ? 'mt-6' : 'mt-14'
                }`}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {invoiceLightboxImageUrls.length > 0 ? '기타 파일' : '첨부 파일'}
                </p>
                <ul className="space-y-2">
                  {invoiceLightboxOtherUrls.map((url) => (
                    <li
                      key={url}
                      className="flex items-start justify-between gap-2 rounded-md border border-gray-100 bg-white p-2"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 break-all text-sm text-blue-700 hover:underline"
                      >
                        {url.split('/').pop() || url}
                      </a>
                      <button
                        type="button"
                        disabled={invoicePhotoRemoving}
                        onClick={() => void removeAttachmentFromLightbox(url)}
                        className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {invoiceLightboxImageUrls.length === 0 && invoiceLightboxOtherUrls.length === 0 ? (
              <p className="mt-16 text-center text-white/80">표시할 첨부가 없습니다.</p>
            ) : null}
          </div>
        </div>
      )}

      {/* 투어 상세 (달력·테이블에서 투어 클릭 시) */}
      {tourDetailModalTourId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-tour-detail-modal-title"
          onClick={() => setTourDetailModalTourId(null)}
        >
          <div
            className="flex h-[90vh] w-[90vw] max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <h3 id="ticket-tour-detail-modal-title" className="text-lg font-semibold text-gray-900 truncate pr-2">
                투어 상세
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/${locale}/admin/tours/${tourDetailModalTourId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                >
                  새 탭에서 열기
                </a>
                <button
                  type="button"
                  onClick={() => setTourDetailModalTourId(null)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label="닫기"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-50">
              <TourDetailModalContent tourId={tourDetailModalTourId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}