'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import TourHotelBookingForm from './TourHotelBookingForm';
import BookingHistory from './BookingHistory';
import TourHotelBookingDeletionReviewModal from './TourHotelBookingDeletionReviewModal';
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal';
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries';
import {
  unlinkExpenseReconciliationMatch,
  type ExpenseStatementReconContext,
} from '@/lib/expense-reconciliation-similar-lines';
import {
  buildTourHotelBookingStatementReconContextResolved,
  fetchTourHotelBookingStatementReconDisplayByBookingId,
  isTourHotelBookingStatementReconDisabled,
  type TourHotelBookingStatementReconDisplay,
} from '@/lib/tour-hotel-booking-statement-recon';
import { TicketBookingStatementReconCell } from '@/components/booking/TicketBookingStatementReconCell';
import {
  Grid,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Calendar,
  Table,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdminActor } from '@/lib/superAdmin';
import { canRequestTicketBookingSoftDelete } from '@/lib/ticketBookingSoftDelete';
import { BookingAuditCell } from '@/components/booking/BookingAuditCell';
import {
  buildBookingAuditPatch,
  fetchTeamAuditProfile,
  updateBookingAudit,
  type TeamAuditProfile,
} from '@/lib/bookingAudit';
import { normalizeReservationIds, isReservationCancelledStatus } from '@/utils/tourUtils';
import { getStatusColor as getTourStatusColor, getStatusText as getTourStatusText } from '@/utils/tourStatusUtils';
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent';

interface TourHotelBookingTourMeta {
  tour_date: string;
  tour_status?: string | null;
  total_people?: number;
  guide_display_name?: string;
  products?: {
    name: string;
    name_en?: string;
    name_ko?: string;
  };
}

interface TourHotelBooking {
  id: string;
  tour_id: string;
  submit_on: string;
  check_in_date: string;
  check_out_date: string;
  reservation_name: string;
  submitted_by: string;
  cc: string;
  rooms: number;
  city: string;
  hotel: string;
  room_type: string;
  unit_price: number;
  total_price: number;
  payment_method: string;
  website: string;
  rn_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  deletion_requested_at?: string | null;
  deletion_requested_by?: string | null;
  audited?: boolean | null;
  audited_at?: string | null;
  audited_by_email?: string | null;
  audited_by_name?: string | null;
  audited_by_nick_name?: string | null;
  tours?: TourHotelBookingTourMeta | undefined;
}

type HotelTableGroup = {
  key: string;
  label: string;
  rows: TourHotelBooking[];
  guideDisplayName?: string;
  totalPeople?: number;
  tourId?: string;
  tourStatus?: string | null;
};

const HOTEL_TABLE_TH =
  'px-2 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap';
const HOTEL_TABLE_CELL = 'px-2 py-1.5 text-[11px] text-gray-900 align-middle whitespace-nowrap';
const HOTEL_DESKTOP_TABLE_COL_COUNT = 17;

const HOTEL_TABLE_GROUP_STYLES: Array<{
  headerRow: string;
  mobileSection: string;
  mobileHeader: string;
}> = [
  {
    headerRow: 'bg-blue-100 border-y border-blue-200 shadow-sm',
    mobileSection: 'rounded-xl border-2 border-blue-200 bg-blue-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-blue-100 border-b-2 border-blue-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-emerald-100 border-y border-emerald-200 shadow-sm',
    mobileSection: 'rounded-xl border-2 border-emerald-200 bg-emerald-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-emerald-100 border-b-2 border-emerald-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-violet-100 border-y border-violet-200 shadow-sm',
    mobileSection: 'rounded-xl border-2 border-violet-200 bg-violet-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-violet-100 border-b-2 border-violet-300 px-3 py-2.5',
  },
  {
    headerRow: 'bg-amber-100 border-y border-amber-200 shadow-sm',
    mobileSection: 'rounded-xl border-2 border-amber-200 bg-amber-50/40 shadow-md overflow-hidden',
    mobileHeader: 'bg-amber-100 border-b-2 border-amber-300 px-3 py-2.5',
  },
];

function hotelBookingRnGroupKey(booking: TourHotelBooking): string {
  const rn = (booking.rn_number ?? '').trim();
  if (!rn) return `__empty_rn__:${booking.id}`;
  return rn;
}

function sortHotelBookingsByCheckIn(a: TourHotelBooking, b: TourHotelBooking): number {
  const dateA = (a.check_in_date || '').trim();
  const dateB = (b.check_in_date || '').trim();
  const c = dateA.localeCompare(dateB);
  if (c !== 0) return c;
  return a.id.localeCompare(b.id);
}

function buildHotelRnGroups(
  bookings: TourHotelBooking[]
): { key: string; label: string; rows: TourHotelBooking[] }[] {
  const dateSorted = [...bookings].sort(sortHotelBookingsByCheckIn);
  const map = new Map<string, TourHotelBooking[]>();
  for (const b of dateSorted) {
    const k = hotelBookingRnGroupKey(b);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  }
  const groups = [...map.entries()].map(([key, rows]) => {
    const rowsSorted = [...rows].sort(sortHotelBookingsByCheckIn);
    const label = key.startsWith('__empty_rn__:') ? 'RN# 없음' : key;
    const first = rowsSorted[0]!;
    const groupSortKey = `${first.check_in_date || ''}\0${first.id}\0${key}`;
    return { key, label, rows: rowsSorted, groupSortKey };
  });
  groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
  return groups.map(({ key, label, rows }) => ({ key, label, rows }));
}

function buildHotelTourGroups(
  bookings: TourHotelBooking[],
  locale: string,
  getProductName: (product: { name?: string; name_en?: string; name_ko?: string } | undefined) => string
): HotelTableGroup[] {
  const dateSorted = [...bookings].sort(sortHotelBookingsByCheckIn);
  const linked = new Map<string, TourHotelBooking[]>();
  const unlinked: TourHotelBooking[] = [];

  for (const b of dateSorted) {
    const tid = b.tour_id?.trim();
    if (!tid) {
      unlinked.push(b);
      continue;
    }
    if (!linked.has(tid)) linked.set(tid, []);
    linked.get(tid)!.push(b);
  }

  const groups: Array<HotelTableGroup & { groupSortKey: string }> = [];

  for (const [tid, rows] of linked.entries()) {
    const rowsSorted = [...rows].sort(sortHotelBookingsByCheckIn);
    const first = rowsSorted[0]!;
    const productName = getProductName(first.tours?.products);
    const tourDate = first.tours?.tour_date || first.check_in_date || '';
    const headline = productName
      ? `${tourDate} · ${productName}`
      : locale.startsWith('ko')
        ? `투어 (${tid.slice(0, 8)}…)`
        : `Tour (${tid.slice(0, 8)}…)`;
    const groupSortKey = `${tourDate}\0${headline}\0${tid}`;
    const guideDisplayName = first.tours?.guide_display_name?.trim() || undefined;
    const totalPeopleRaw = first.tours?.total_people;
    const totalPeople =
      totalPeopleRaw != null && Number.isFinite(Number(totalPeopleRaw))
        ? Number(totalPeopleRaw)
        : undefined;
    const tourStatus = first.tours?.tour_status?.trim() || undefined;
    const group: HotelTableGroup & { groupSortKey: string } = {
      key: `tour:${tid}`,
      label: headline,
      rows: rowsSorted,
      groupSortKey,
      tourId: tid,
    };
    if (guideDisplayName) group.guideDisplayName = guideDisplayName;
    if (totalPeople != null) group.totalPeople = totalPeople;
    if (tourStatus) group.tourStatus = tourStatus;
    groups.push(group);
  }

  if (unlinked.length > 0) {
    const rowsSorted = [...unlinked].sort(sortHotelBookingsByCheckIn);
    const label = locale.startsWith('ko') ? '투어 미연결' : 'Tour not linked';
    groups.push({
      key: '__unlinked__',
      label,
      rows: rowsSorted,
      groupSortKey: `\uffff${label}`,
    });
  }

  groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
  return groups.map(({ key, label, rows, guideDisplayName, totalPeople, tourId, tourStatus }) => {
    const out: HotelTableGroup = { key, label, rows };
    if (guideDisplayName) out.guideDisplayName = guideDisplayName;
    if (totalPeople != null) out.totalPeople = totalPeople;
    if (tourId) out.tourId = tourId;
    if (tourStatus) out.tourStatus = tourStatus;
    return out;
  });
}

function buildHotelDateGroups(
  bookings: TourHotelBooking[],
  locale: string
): { key: string; label: string; rows: TourHotelBooking[] }[] {
  const map = new Map<string, TourHotelBooking[]>();
  for (const b of bookings) {
    const ymd = (b.check_in_date || '').trim().slice(0, 10) || '__no_date__';
    if (!map.has(ymd)) map.set(ymd, []);
    map.get(ymd)!.push(b);
  }
  const groups = [...map.entries()].map(([key, rows]) => {
    const rowsSorted = [...rows].sort(sortHotelBookingsByCheckIn);
    const label =
      key === '__no_date__'
        ? locale.startsWith('ko')
          ? '날짜 없음'
          : 'No date'
        : key;
    return { key, label, rows: rowsSorted, groupSortKey: key === '__no_date__' ? '\uffff' : key };
  });
  groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
  return groups.map(({ key, label, rows }) => ({ key, label, rows }));
}

/** 체크인 기간 필터 — 연도 프리셋 (투어 호텔 부킹 관리) */
const HOTEL_CHECK_IN_YEAR_PRESETS = [2025, 2026] as const;

function hotelCheckInYearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function isHotelCheckInYearPresetActive(from: string, to: string, year: number): boolean {
  const { from: yFrom, to: yTo } = hotelCheckInYearRange(year);
  return from === yFrom && to === yTo;
}

export default function TourHotelBookingList() {
  const locale = useLocale();
  const t = useTranslations('booking.calendar');
  const tAudit = useTranslations('booking.audit');
  const tStmtRecon = useTranslations('expenses.statementRecon');
  const tRes = useTranslations('reservations');
  const { user, userPosition } = useAuth();
  const teamAuditProfileRef = useRef<TeamAuditProfile | null>(null);
  const [bookingAuditSavingId, setBookingAuditSavingId] = useState<string | null>(null);
  const canBookingMgmtSoftDelete = useMemo(
    () => canRequestTicketBookingSoftDelete(userPosition),
    [userPosition]
  );
  const canSuperPurgeHotelBookings = useMemo(
    () => isSuperAdminActor(user?.email, userPosition),
    [user?.email, userPosition]
  );
  const [bookings, setBookings] = useState<TourHotelBooking[]>([]);
  const bookingsRef = useRef<TourHotelBooking[]>([]);
  bookingsRef.current = bookings;
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TourHotelBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [checkInDateFrom, setCheckInDateFrom] = useState('');
  const [checkInDateTo, setCheckInDateTo] = useState('');
  const hasCheckInDateRangeFilter = Boolean(checkInDateFrom || checkInDateTo);
  /** 검수(확인) 완료된 부킹 숨김 */
  const [hideAuditedFilter, setHideAuditedFilter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useRoutePersistedState<'card' | 'calendar' | 'table'>(
    'tour-hotel-bookings-view',
    'calendar'
  );
  const [hotelTableLayout, setHotelTableLayout] = useRoutePersistedState<
    'flat' | 'byRn' | 'byTour' | 'byDate'
  >('tour-hotel-bookings-table-layout', 'flat');
  const [sortField, setSortField] = useState<'date' | 'submit_on' | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(50);
  const [statementReconciledIds, setStatementReconciledIds] = useState<Set<string>>(() => new Set());
  const [statementReconDisplay, setStatementReconDisplay] = useState<
    Map<string, TourHotelBookingStatementReconDisplay[]>
  >(() => new Map());
  const [stmtReconOpen, setStmtReconOpen] = useState(false);
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null);
  const [stmtReconUnlinkingId, setStmtReconUnlinkingId] = useState<string | null>(null);
  const statementReconScrollRef = useRef<{ x: number; y: number } | null>(null);
  const statementReconFetchGenRef = useRef(0);

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
      return product.name_ko || product.name || t('tour');
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<TourHotelBooking[]>([]);
  const [hotelDeletionReviewOpen, setHotelDeletionReviewOpen] = useState(false);
  const [tourDetailModal, setTourDetailModal] = useState<{ tourId: string; title: string } | null>(
    null
  );

  useEffect(() => {
    fetchBookings();
  }, []);

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

  const patchHotelBookingAuditInList = useCallback(
    (bookingId: string, patch: ReturnType<typeof buildBookingAuditPatch>) => {
      const merge = <T extends { id: string }>(b: T): T =>
        b.id === bookingId ? { ...b, ...patch } : b;
      setBookings((prev) => prev.map(merge));
      setEditingBooking((prev) => (prev ? merge(prev) : prev));
      setSelectedBookings((prev) => prev.map(merge));
    },
    []
  );

  const handleToggleHotelBookingAudit = useCallback(
    async (booking: TourHotelBooking, nextAudited: boolean) => {
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
        patchHotelBookingAuditInList(booking.id, patch);
        const { error } = await updateBookingAudit(
          supabase,
          'tour_hotel_bookings',
          booking.id,
          patch
        );
        if (error) {
          patchHotelBookingAuditInList(booking.id, {
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
    [patchHotelBookingAuditInList, tAudit, user?.email, user?.name]
  );

  const fetchBookings = async () => {
    try {
      setLoading(true);

      // 1) 호텔 부킹 본문을 즉시 표시(투어 메타 병합 전에 화면 노출)
      // select * 대신 화면에 사용되는 컬럼만 선택 → 페이로드/직렬화 비용 감소
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('tour_hotel_bookings')
        .select(
          [
            'id',
            'tour_id',
            'submit_on',
            'check_in_date',
            'check_out_date',
            'reservation_name',
            'submitted_by',
            'cc',
            'rooms',
            'city',
            'hotel',
            'room_type',
            'unit_price',
            'total_price',
            'payment_method',
            'website',
            'rn_number',
            'status',
            'created_at',
            'updated_at',
            'deletion_requested_at',
            'deletion_requested_by',
            'audited',
            'audited_at',
            'audited_by_email',
            'audited_by_name',
            'audited_by_nick_name',
          ].join(', ')
        )
        .is('deletion_requested_at', null)
        .order('check_in_date', { ascending: false }) as { data: TourHotelBooking[] | null; error: Error | null };

      if (bookingsError) throw bookingsError;

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      setBookings(bookingsData);
      // 첫 표시 후 스피너를 내려 사용자 체감 로딩을 단축
      setLoading(false);

      // 2) 투어/상품 메타는 백그라운드로 병합
      const bookingsWithTourId = bookingsData.filter(booking => booking.tour_id);
      if (bookingsWithTourId.length === 0) return;

      const tourIds = [...new Set(bookingsWithTourId.map(booking => booking.tour_id))];

      type TourRow = {
        id: string;
        tour_date: string;
        tour_status?: string | null;
        tour_guide_id?: string | null;
        reservation_ids?: unknown;
        products: { name: string; name_en?: string; name_ko?: string } | null;
      };

      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_status,
          tour_guide_id,
          reservation_ids,
          products (
            name,
            name_en,
            name_ko
          )
        `)
        .in('id', tourIds) as { data: TourRow[] | null; error: Error | null };

      if (toursError) {
        console.warn('투어 정보 조회 오류:', toursError);
        return;
      }

      const toursMap = new Map<string, TourRow>();
      (toursData || []).forEach((tour) => {
        toursMap.set(tour.id, tour);
      });

      const staffEmailSet = new Set<string>();
      for (const tour of toursData || []) {
        const g = tour.tour_guide_id?.trim();
        if (g) staffEmailSet.add(g);
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
          console.warn('호텔 부킹 투어 staff(team) 조회:', teamStaffErr);
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

      const allResIds = new Set<string>();
      for (const tour of toursData || []) {
        for (const rid of normalizeReservationIds(tour.reservation_ids)) {
          allResIds.add(rid);
        }
      }
      const resIdList = [...allResIds];
      type ResPeopleRow = { id: string; total_people: number | null; status: string | null };
      let reservationsRows: ResPeopleRow[] = [];
      const RES_BATCH = 100;
      for (let i = 0; i < resIdList.length; i += RES_BATCH) {
        const chunk = resIdList.slice(i, i + RES_BATCH);
        const { data: resPage, error: resErr } = await supabase
          .from('reservations')
          .select('id, total_people, status')
          .in('id', chunk);
        if (resErr) {
          console.warn('호텔 부킹 투어 예약 인원 조회:', resErr);
          break;
        }
        if (resPage?.length) reservationsRows = reservationsRows.concat(resPage as ResPeopleRow[]);
      }
      const resById = new Map<string, ResPeopleRow>();
      for (const r of reservationsRows) resById.set(r.id, r);
      const tourTotalPeopleByTourId = new Map<string, number>();
      for (const tour of toursData || []) {
        let sum = 0;
        for (const rid of normalizeReservationIds(tour.reservation_ids)) {
          const r = resById.get(rid);
          if (!r || isReservationCancelledStatus(r.status)) continue;
          sum += Number(r.total_people) || 0;
        }
        tourTotalPeopleByTourId.set(tour.id, sum);
      }

      const bookingsWithTours: TourHotelBooking[] = bookingsData.map((booking) => {
        if (booking.tour_id && toursMap.has(booking.tour_id)) {
          const tour = toursMap.get(booking.tour_id)!;
          const toursPart: TourHotelBookingTourMeta = {
            tour_date: tour.tour_date,
            total_people: tourTotalPeopleByTourId.get(booking.tour_id) ?? 0,
          };
          if (tour.tour_status?.trim()) toursPart.tour_status = tour.tour_status.trim();
          const guide = resolveStaffDisplay(tour.tour_guide_id);
          if (guide) toursPart.guide_display_name = guide;
          if (tour.products) {
            toursPart.products = {
              name: tour.products.name,
              ...(tour.products.name_en ? { name_en: tour.products.name_en } : {}),
              ...(tour.products.name_ko ? { name_ko: tour.products.name_ko } : {}),
            };
          }
          return {
            ...booking,
            tours: toursPart,
          } as TourHotelBooking;
        }
        return booking;
      });

      setBookings(bookingsWithTours);
    } catch (error) {
      console.error('투어 호텔 부킹 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (booking: TourHotelBooking) => {
    setEditingBooking(booking);
    setShowForm(true);
    setShowBookingModal(false);
  };

  const handleRequestSoftDelete = async (id: string, opts?: { keepModalOpen?: boolean }) => {
    if (!canBookingMgmtSoftDelete) {
      alert(
        locale === 'ko'
          ? '삭제 권한이 없습니다.'
          : 'You do not have permission to delete this booking.'
      );
      return;
    }
    const msg =
      locale === 'ko'
        ? '삭제를 요청하시겠습니까? (목록에서 숨겨지며 SUPER가 확인 후 영구 삭제합니다.)'
        : 'Request deletion? It will be hidden until a super admin permanently deletes it.';
    if (!confirm(msg)) return;

    const email = user?.email || '';
    try {
      const { error } = await supabase
        .from('tour_hotel_bookings')
        .update({
          deletion_requested_at: new Date().toISOString(),
          deletion_requested_by: email || null,
        })
        .eq('id', id);

      if (error) throw error;

      setBookings((prev) => prev.filter((booking) => booking.id !== id));
      if (!opts?.keepModalOpen) {
        setShowForm(false);
        setEditingBooking(null);
        setShowBookingModal(false);
      }
      alert(
        locale === 'ko'
          ? '삭제 요청되었습니다. 목록에서 숨겨지며 SUPER가 확인 후 영구 삭제합니다.'
          : 'Deletion requested. Hidden from the list until a super admin permanently deletes it.'
      );
    } catch (error) {
      console.error('투어 호텔 부킹 삭제 요청 오류:', error);
      alert(locale === 'ko' ? '삭제 요청 처리 중 오류가 발생했습니다.' : 'Failed to request deletion.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canSuperPurgeHotelBookings) {
      alert(
        locale === 'ko'
          ? '영구 삭제는 SUPER 관리자만 할 수 있습니다.'
          : 'Only super admins can permanently delete booking rows.'
      );
      return;
    }
    const msg =
      locale === 'ko'
        ? '정말로 이 부킹을 영구 삭제하시겠습니까? (되돌릴 수 없습니다)'
        : 'Permanently delete this booking? This cannot be undone.';
    if (!confirm(msg)) return;

    try {
      const { error } = await supabase.from('tour_hotel_bookings').delete().eq('id', id);
      if (error) throw error;

      setBookings((prev) => prev.filter((booking) => booking.id !== id));
      setShowForm(false);
      setEditingBooking(null);
      setShowBookingModal(false);
    } catch (error) {
      console.error('투어 호텔 부킹 영구 삭제 오류:', error);
      alert(locale === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'Delete failed.');
    }
  };

  const handleViewHistory = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowHistory(true);
    setShowBookingModal(false);
  };

  const handleSave = (booking: TourHotelBooking) => {
    if (editingBooking) {
      setBookings(prev => 
        prev.map(b => b.id === booking.id ? { ...booking, tours: b.tours } as TourHotelBooking : b)
      );
    } else {
      setBookings(prev => [booking, ...prev]);
    }
    setShowForm(false);
    setEditingBooking(null);
  };

  const auditedCount = useMemo(
    () => bookings.filter((b) => Boolean(b.audited)).length,
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (hideAuditedFilter && Boolean(booking.audited)) return false;

      const matchesSearch =
        !q ||
        (booking.hotel ?? '').toLowerCase().includes(q) ||
        (booking.city ?? '').toLowerCase().includes(q) ||
        (booking.reservation_name ?? '').toLowerCase().includes(q) ||
        (booking.rn_number ?? '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      let matchesDate = true;
      if (hasCheckInDateRangeFilter) {
        const ymd = (booking.check_in_date || '').trim().slice(0, 10);
        if (!ymd) matchesDate = false;
        else if (checkInDateFrom && ymd < checkInDateFrom) matchesDate = false;
        else if (checkInDateTo && ymd > checkInDateTo) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookings, hideAuditedFilter, searchTerm, statusFilter, checkInDateFrom, checkInDateTo, hasCheckInDateRangeFilter]);

  const handleSort = useCallback(
    (field: 'date' | 'submit_on') => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection(field === 'date' ? 'desc' : 'desc');
      }
    },
    [sortField]
  );

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

  const dateViewGroups = useMemo(() => {
    if (hotelTableLayout !== 'byDate') return null;
    return buildHotelDateGroups(sortedBookings, locale);
  }, [hotelTableLayout, sortedBookings, locale]);

  const listTotalPages = useMemo(() => {
    if (hotelTableLayout === 'byDate' && dateViewGroups) {
      return Math.max(1, Math.ceil(dateViewGroups.length / listPageSize) || 1);
    }
    return Math.max(1, Math.ceil(sortedBookings.length / listPageSize) || 1);
  }, [hotelTableLayout, dateViewGroups, sortedBookings.length, listPageSize]);

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

  const hotelTableGroups = useMemo((): HotelTableGroup[] | null => {
    if (hotelTableLayout === 'byRn') return buildHotelRnGroups(pagedSortedBookings);
    if (hotelTableLayout === 'byTour') {
      return buildHotelTourGroups(pagedSortedBookings, locale, getProductName);
    }
    if (hotelTableLayout === 'byDate' && pagedDateViewGroups) {
      return pagedDateViewGroups.map((g) => ({
        key: g.key,
        label: g.label,
        rows: g.rows,
      }));
    }
    return null;
  }, [hotelTableLayout, pagedSortedBookings, locale, pagedDateViewGroups]);

  const tableVisibleBookingIdsKey = useMemo(() => {
    if (viewMode !== 'table') return '';
    const ids: string[] = [];
    if (hotelTableGroups) {
      for (const g of hotelTableGroups) {
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
  }, [viewMode, hotelTableGroups, pagedSortedBookings]);

  useEffect(() => {
    if (!tableVisibleBookingIdsKey) {
      setStatementReconciledIds(new Set());
      setStatementReconDisplay(new Map());
      return;
    }
    const ids = tableVisibleBookingIdsKey.split('|').filter(Boolean);
    const gen = ++statementReconFetchGenRef.current;
    let cancelled = false;
    void Promise.all([
      fetchReconciledSourceIdsBatched(supabase, 'tour_hotel_bookings', ids),
      fetchTourHotelBookingStatementReconDisplayByBookingId(supabase, ids),
    ]).then(([reconciled, displayMap]) => {
      if (!cancelled && gen === statementReconFetchGenRef.current) {
        setStatementReconciledIds(reconciled);
        setStatementReconDisplay(displayMap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tableVisibleBookingIdsKey]);

  useEffect(() => {
    setListPage(1);
  }, [
    hotelTableLayout,
    viewMode,
    searchTerm,
    statusFilter,
    checkInDateFrom,
    checkInDateTo,
    hideAuditedFilter,
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('pending');
      case 'confirmed': return t('confirmed');
      case 'cancelled': return t('cancelled');
      case 'completed': return t('completed');
      default: return status;
    }
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
    const m = (method ?? '').trim();
    if (!m) return '';
    switch (m) {
      case 'credit_card': return locale === 'ko' ? '신용카드' : 'Credit card';
      case 'bank_transfer': return locale === 'ko' ? '계좌이체' : 'Bank transfer';
      case 'cash': return locale === 'ko' ? '현금' : 'Cash';
      case 'other': return locale === 'ko' ? '기타' : 'Other';
      default: return m;
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

  const handleBookingClick = (bookings: TourHotelBooking[]) => {
    const uniqueBookings = bookings.filter((booking, index, array) => {
      const bookingKey = booking.id || `${booking.hotel}-${booking.check_in_date}-${booking.check_out_date}-${booking.reservation_name}`;
      return (
        array.findIndex((item) => {
          const itemKey = item.id || `${item.hotel}-${item.check_in_date}-${item.check_out_date}-${item.reservation_name}`;
          return itemKey === bookingKey;
        }) === index
      );
    });
    setSelectedBookings(uniqueBookings);
    setShowBookingModal(true);
  };

  const restoreStatementReconScroll = useCallback(() => {
    const saved = statementReconScrollRef.current;
    statementReconScrollRef.current = null;
    if (!saved) return;
    requestAnimationFrame(() => window.scrollTo(saved.x, saved.y));
  }, []);

  const refreshStatementReconDisplay = useCallback(async (bookingIds: string[]) => {
    const ids = [...new Set(bookingIds.filter(Boolean))];
    if (ids.length === 0) return;
    const [reconciled, displayMap] = await Promise.all([
      fetchReconciledSourceIdsBatched(supabase, 'tour_hotel_bookings', ids),
      fetchTourHotelBookingStatementReconDisplayByBookingId(supabase, ids),
    ]);
    setStatementReconciledIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (reconciled.has(id)) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setStatementReconDisplay((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        const lines = displayMap.get(id);
        if (lines && lines.length > 0) next.set(id, lines);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const patchHotelBookingAfterStatementRecon = useCallback(async (bookingId: string) => {
    const { data, error } = await supabase
      .from('tour_hotel_bookings')
      .select('id, total_price')
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !data) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, total_price: Number(data.total_price ?? b.total_price) }
          : b
      )
    );
  }, []);

  const openStatementRecon = useCallback(async (booking: TourHotelBooking) => {
    if (isTourHotelBookingStatementReconDisabled(booking)) return;
    statementReconScrollRef.current = { x: window.scrollX, y: window.scrollY };
    const ctx = await buildTourHotelBookingStatementReconContextResolved(supabase, booking);
    if (!ctx) return;
    setStmtReconCtx(ctx);
    setStmtReconOpen(true);
  }, []);

  const unlinkStatementRecon = useCallback(
    async (booking: TourHotelBooking, line: TourHotelBookingStatementReconDisplay) => {
      const key = line.match_id || `${booking.id}:${line.statement_line_id}`;
      if (stmtReconUnlinkingId) return;
      const ok = window.confirm(tStmtRecon('unlinkStatementMatchConfirm'));
      if (!ok) return;
      setStmtReconUnlinkingId(key);
      try {
        await unlinkExpenseReconciliationMatch(supabase, {
          sourceTable: 'tour_hotel_bookings',
          sourceId: booking.id,
          matchId: line.match_id,
          statementLineId: line.statement_line_id,
        });
        await refreshStatementReconDisplay([booking.id]);
        await patchHotelBookingAfterStatementRecon(booking.id);
      } catch (e) {
        console.error('명세 연결 해제 오류:', e);
        alert(e instanceof Error ? e.message : tStmtRecon('unlinkStatementMatchError'));
      } finally {
        setStmtReconUnlinkingId(null);
      }
    },
    [
      stmtReconUnlinkingId,
      tStmtRecon,
      refreshStatementReconDisplay,
      patchHotelBookingAfterStatementRecon,
    ]
  );

  const refreshAfterStatementReconApply = useCallback(async () => {
    const ctx = stmtReconCtx;
    const ids = new Set<string>();
    if (ctx?.sourceTable === 'tour_hotel_bookings' && ctx.sourceId) ids.add(ctx.sourceId);
    for (const id of tableVisibleBookingIdsKey.split('|').filter(Boolean)) ids.add(id);
    await refreshStatementReconDisplay([...ids]);
    if (ctx?.sourceTable === 'tour_hotel_bookings' && ctx.sourceId) {
      await patchHotelBookingAfterStatementRecon(ctx.sourceId);
    }
    restoreStatementReconScroll();
  }, [
    stmtReconCtx,
    tableVisibleBookingIdsKey,
    refreshStatementReconDisplay,
    patchHotelBookingAfterStatementRecon,
    restoreStatementReconScroll,
  ]);

  const renderStatementReconCell = useCallback(
    (booking: TourHotelBooking) => (
      <TicketBookingStatementReconCell
        matched={statementReconciledIds.has(booking.id)}
        disabled={isTourHotelBookingStatementReconDisabled(booking)}
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
        compact
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
  );

  const renderHotelTourGroupMeta = (g: Pick<HotelTableGroup, 'guideDisplayName' | 'totalPeople'>) => {
    if (hotelTableLayout !== 'byTour') return null;
    const guide = g.guideDisplayName;
    const people = g.totalPeople;
    const ko = locale.startsWith('ko');
    if (!guide && people == null) return null;
    return (
      <span className="font-medium text-neutral-700">
        {guide ? (
          <>
            {' · '}
            {ko ? '가이드 ' : 'Guide '}
            <span className="text-neutral-900">{guide}</span>
          </>
        ) : null}
        {people != null && Number.isFinite(people) ? (
          <>
            {' · '}
            {ko ? `배정 ${people}명` : `${people} assigned`}
          </>
        ) : null}
      </span>
    );
  };

  const openTourDetailModal = useCallback((g: Pick<HotelTableGroup, 'tourId' | 'label'>) => {
    const tourId = g.tourId?.trim();
    if (!tourId) return;
    setTourDetailModal({ tourId, title: g.label });
  }, []);

  const renderHotelTourGroupTitleBlock = (g: HotelTableGroup, groupHeaderTitle: string) => {
    const titleText =
      hotelTableLayout === 'byDate'
        ? locale === 'ko'
          ? `체크인 ${groupHeaderTitle}`
          : `Check-in ${groupHeaderTitle}`
        : groupHeaderTitle;
    const statusLabel =
      g.tourStatus != null && String(g.tourStatus).trim()
        ? getTourStatusText(String(g.tourStatus), locale.startsWith('ko') ? 'ko' : 'en')
        : null;
    const inner = (
      <>
        {titleText}
        {renderHotelTourGroupMeta(g)}
        {hotelTableLayout === 'byTour' && statusLabel ? (
          <span
            className={`ml-1.5 inline-flex align-middle px-2 py-0.5 text-[10px] font-semibold rounded-full ${getTourStatusColor(g.tourStatus ?? null)}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </>
    );
    if (hotelTableLayout === 'byTour' && g.tourId) {
      return (
        <button
          type="button"
          onClick={() => openTourDetailModal(g)}
          className="text-left hover:text-blue-800 hover:underline decoration-blue-400 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          title={locale === 'ko' ? '클릭하여 투어 상세 보기' : 'Click to view tour details'}
        >
          {inner}
        </button>
      );
    }
    return <span>{inner}</span>;
  };

  useEffect(() => {
    if (!tourDetailModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourDetailModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tourDetailModal]);

  const renderHotelBookingActionButtons = (
    booking: TourHotelBooking,
    opts?: { size?: 'compact' | 'touch' }
  ) => {
    const touch = opts?.size === 'touch';
    const btn = touch
      ? 'flex-1 min-w-0 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors'
      : 'px-1.5 py-0.5 text-[10px] font-medium rounded hover:opacity-90 transition-colors';
    const wrap = touch ? 'flex flex-wrap gap-2 w-full' : 'flex flex-wrap gap-1';

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
          {t('edit')}
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
          {t('history')}
        </button>
        {canBookingMgmtSoftDelete && !booking.deletion_requested_at ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleRequestSoftDelete(booking.id);
            }}
            className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}
            title={locale === 'ko' ? '삭제 요청 (목록에서 숨김)' : 'Request deletion'}
          >
            {t('delete')}
          </button>
        ) : null}
        {canSuperPurgeHotelBookings && booking.deletion_requested_at ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleDelete(booking.id);
            }}
            className={`${btn} bg-red-700 text-white hover:bg-red-800`}
            title={locale === 'ko' ? '영구 삭제' : 'Permanent delete'}
          >
            {locale === 'ko' ? '영구 삭제' : 'Purge'}
          </button>
        ) : null}
      </div>
    );
  };

  const renderHotelTableThead = () => (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className={`${HOTEL_TABLE_TH} sticky left-0 z-10 min-w-[5rem] bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
          {t('status')}
        </th>
        <th className={HOTEL_TABLE_TH}>{locale === 'ko' ? '호텔' : 'Hotel'}</th>
        <th className={HOTEL_TABLE_TH}>{locale === 'ko' ? '도시' : 'City'}</th>
        <th
          className={`${HOTEL_TABLE_TH} cursor-pointer hover:bg-gray-100 select-none`}
          onClick={() => handleSort('date')}
        >
          <span className="inline-flex items-center gap-1">
            {t('checkInDate')}
            {sortField === 'date' ? (
              <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            ) : null}
          </span>
        </th>
        <th className={HOTEL_TABLE_TH}>{t('checkOutDate')}</th>
        <th className={HOTEL_TABLE_TH}>{t('rooms')}</th>
        <th className={HOTEL_TABLE_TH}>{t('roomType')}</th>
        <th className={`${HOTEL_TABLE_TH} hidden lg:table-cell`}>{t('unitPrice')}</th>
        <th className={`${HOTEL_TABLE_TH} hidden lg:table-cell`}>{t('totalPrice')}</th>
        <th className={`${HOTEL_TABLE_TH} hidden md:table-cell`}>{t('paymentMethod')}</th>
        <th className={`${HOTEL_TABLE_TH} hidden md:table-cell`}>CC</th>
        <th className={`${HOTEL_TABLE_TH} hidden md:table-cell`}>RN#</th>
        <th className={`${HOTEL_TABLE_TH} hidden lg:table-cell min-w-[9rem]`}>{t('tour')}</th>
        <th className={`${HOTEL_TABLE_TH} hidden xl:table-cell`}>{locale === 'ko' ? '예약자' : 'Guest'}</th>
        <th className={`${HOTEL_TABLE_TH} text-center min-w-[8rem]`}>{tStmtRecon('columnHeaderShort')}</th>
        <th
          className={`${HOTEL_TABLE_TH} cursor-pointer hover:bg-gray-100 select-none`}
          onClick={() => handleSort('submit_on')}
        >
          <span className="inline-flex items-center gap-1">
            {locale === 'ko' ? '제출일' : 'Submitted'}
            {sortField === 'submit_on' ? (
              <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            ) : null}
          </span>
        </th>
        <th className={`${HOTEL_TABLE_TH} min-w-[7.5rem]`}>{tAudit('columnHeader')}</th>
        <th className={`${HOTEL_TABLE_TH} sticky right-0 z-10 min-w-[8rem] bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
          {locale === 'ko' ? '작업' : 'Actions'}
        </th>
      </tr>
    </thead>
  );

  const renderHotelTableRow = (booking: TourHotelBooking) => (
    <tr
      key={booking.id}
      className="align-middle bg-white hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => handleEdit(booking)}
      title={locale === 'ko' ? '클릭하여 편집' : 'Click to edit'}
    >
      <td
        className={`${HOTEL_TABLE_CELL} sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
          {getStatusText(booking.status)}
        </span>
      </td>
      <td className={`${HOTEL_TABLE_CELL} max-w-[10rem] truncate font-medium`}>{booking.hotel || '-'}</td>
      <td className={HOTEL_TABLE_CELL}>{booking.city || '-'}</td>
      <td className={HOTEL_TABLE_CELL}>{booking.check_in_date || '-'}</td>
      <td className={HOTEL_TABLE_CELL}>{booking.check_out_date || '-'}</td>
      <td className={HOTEL_TABLE_CELL}>{booking.rooms ?? '-'}</td>
      <td className={`${HOTEL_TABLE_CELL} max-w-[8rem] truncate`}>{booking.room_type || '-'}</td>
      <td className={`${HOTEL_TABLE_CELL} hidden lg:table-cell tabular-nums`}>
        ${Number(booking.unit_price ?? 0).toLocaleString()}
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden lg:table-cell tabular-nums`}>
        ${Number(booking.total_price ?? 0).toLocaleString()}
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden md:table-cell`}>
        {getPaymentMethodText(booking.payment_method) || '-'}
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden md:table-cell`} onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
          {getCCStatusText(booking.cc)}
        </span>
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden md:table-cell font-mono text-[10px]`}>
        {booking.rn_number || '-'}
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden lg:table-cell max-w-[10rem]`}>
        {booking.tours ? (
          <div className="truncate">
            <div>{booking.tours.tour_date}</div>
            <div className="text-[10px] text-gray-500 truncate">
              {getProductName(booking.tours?.products)}
            </div>
          </div>
        ) : (
          '-'
        )}
      </td>
      <td className={`${HOTEL_TABLE_CELL} hidden xl:table-cell max-w-[8rem] truncate`}>
        {booking.reservation_name || '-'}
      </td>
      <td
        className={`${HOTEL_TABLE_CELL} min-w-[7rem] max-w-[11rem]`}
        onClick={(e) => e.stopPropagation()}
      >
        {renderStatementReconCell(booking)}
      </td>
      <td className={HOTEL_TABLE_CELL}>{booking.submit_on?.slice(0, 10) || '-'}</td>
      <td className={HOTEL_TABLE_CELL} onClick={(e) => e.stopPropagation()}>
        <BookingAuditCell
          audit={booking}
          disabled={!user?.email}
          saving={bookingAuditSavingId === booking.id}
          onToggle={(next) => void handleToggleHotelBookingAudit(booking, next)}
          compact
        />
      </td>
      <td
        className={`${HOTEL_TABLE_CELL} sticky right-0 z-10 min-w-[8rem] bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {renderHotelBookingActionButtons(booking)}
      </td>
    </tr>
  );

  const renderHotelMobileCard = (booking: TourHotelBooking) => (
    <div
      key={booking.id}
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      onClick={() => handleEdit(booking)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900 truncate">{booking.hotel}</div>
          <div className="text-xs text-gray-500">{booking.city}</div>
        </div>
        <span className={`inline-flex shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
          {getStatusText(booking.status)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700">
        <span className="text-gray-500">{t('checkInDate')}</span>
        <span>{booking.check_in_date}</span>
        <span className="text-gray-500">{t('checkOutDate')}</span>
        <span>{booking.check_out_date}</span>
        <span className="text-gray-500">{t('rooms')}</span>
        <span>
          {booking.rooms} · {booking.room_type || '-'}
        </span>
        <span className="text-gray-500">{t('totalPrice')}</span>
        <span>${Number(booking.total_price ?? 0).toLocaleString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        <BookingAuditCell
          audit={booking}
          disabled={!user?.email}
          saving={bookingAuditSavingId === booking.id}
          onToggle={(next) => void handleToggleHotelBookingAudit(booking, next)}
        />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        {renderHotelBookingActionButtons(booking, { size: 'touch' })}
      </div>
    </div>
  );

  const renderHotelTablePagination = () =>
    sortedBookings.length > 0 ? (
      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-xs text-gray-600 sm:text-sm">
          {hotelTableLayout === 'byDate' && dateViewGroups ? (
            <>
              {locale === 'ko' ? '전체' : 'Total'}{' '}
              <span className="font-semibold text-gray-800">{dateViewGroups.length}</span>
              {locale === 'ko' ? '일 중 ' : ' days, '}
              <span className="font-semibold text-gray-800">
                {(listPageEffective - 1) * listPageSize + 1}
              </span>
              –
              <span className="font-semibold text-gray-800">
                {Math.min(listPageEffective * listPageSize, dateViewGroups.length)}
              </span>
              {locale === 'ko' ? '일째' : ''}
            </>
          ) : (
            <>
              {locale === 'ko' ? '전체' : 'Total'}{' '}
              <span className="font-semibold text-gray-800">{sortedBookings.length}</span>
              {locale === 'ko' ? '건 중 ' : ' items, '}
              <span className="font-semibold text-gray-800">
                {(listPageEffective - 1) * listPageSize + 1}
              </span>
              –
              <span className="font-semibold text-gray-800">
                {Math.min(listPageEffective * listPageSize, sortedBookings.length)}
              </span>
              {locale === 'ko' ? '번째' : ''}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 sm:text-sm">
            <span className="whitespace-nowrap">
              {hotelTableLayout === 'byDate'
                ? locale === 'ko'
                  ? '페이지당(날짜)'
                  : 'Per page (dates)'
                : locale === 'ko'
                  ? '페이지당'
                  : 'Per page'}
            </span>
            <select
              value={listPageSize}
              onChange={(e) => {
                setListPageSize(Number(e.target.value));
                setListPage(1);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
            >
              <option value={25}>{hotelTableLayout === 'byDate' ? '25일' : '25건'}</option>
              <option value={50}>{hotelTableLayout === 'byDate' ? '50일' : '50건'}</option>
              <option value={100}>{hotelTableLayout === 'byDate' ? '100일' : '100건'}</option>
              <option value={200}>{hotelTableLayout === 'byDate' ? '200일' : '200건'}</option>
            </select>
          </label>
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setListPage(1)}
              disabled={listPageEffective <= 1}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
              title={locale === 'ko' ? '첫 페이지' : 'First page'}
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
              title={locale === 'ko' ? '이전' : 'Previous'}
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
              title={locale === 'ko' ? '다음' : 'Next'}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setListPage(listTotalPages)}
              disabled={listPageEffective >= listTotalPages}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
              title={locale === 'ko' ? '마지막 페이지' : 'Last page'}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-4 sm:px-6">
        <h2 className="min-w-0 truncate text-lg font-bold sm:text-2xl">{t('tourHotelBookingManagement')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canSuperPurgeHotelBookings ? (
            <button
              type="button"
              onClick={() => setHotelDeletionReviewOpen(true)}
              className="px-2 sm:px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs sm:text-sm font-medium hover:bg-amber-100"
            >
              {locale === 'ko' ? '삭제 요청 목록' : 'Pending deletions'}
            </button>
          ) : null}
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={locale === 'ko' ? '카드 뷰' : 'Card view'}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={locale === 'ko' ? '달력 뷰' : 'Calendar view'}
            >
              <CalendarIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={locale === 'ko' ? '테이블 뷰' : 'Table view'}
            >
              <Table size={14} />
            </button>
          </div>
          <button
            onClick={() => {
              setEditingBooking(null);
              setShowForm(true);
            }}
            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-base flex items-center space-x-1"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{t('addNewBooking')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일 최적화 */}
      <div className="px-1 sm:px-6 py-4">
        <div className="flex flex-row sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allStatus')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="cancelled">{t('cancelled')}</option>
              <option value="completed">{t('completed')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-0 sm:min-w-[14rem]">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('checkInDateRange')}
            </label>
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
              {HOTEL_CHECK_IN_YEAR_PRESETS.map((year) => {
                const active = isHotelCheckInYearPresetActive(checkInDateFrom, checkInDateTo, year);
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setCheckInDateFrom('');
                        setCheckInDateTo('');
                      } else {
                        const { from, to } = hotelCheckInYearRange(year);
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
              {locale === 'ko' ? '필터' : 'Filters'}
            </label>
            <div className="flex flex-wrap gap-2">
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

      {/* 데이터 표시 영역 */}
      <div className="px-1 sm:px-6">
        {viewMode === 'calendar' ? (
          /* 달력 뷰 - 실제 달력 UI에 라벨로 표시 */
          <div>
            <div>
              {(() => {
                console.log('필터된 호텔 부킹 데이터:', filteredBookings);
                console.log('호텔 부킹 개수:', filteredBookings.length);
                
                // 체크인-체크아웃 날짜 범위로 그룹화 (2박 예약의 경우 오버래핑)
                const groupedByDateRange = filteredBookings.reduce((groups, booking) => {
                  const checkInDate = new Date(booking.check_in_date);
                  const checkOutDate = new Date(booking.check_out_date);
                  
                  // 체크인부터 체크아웃 전날까지 모든 날짜에 추가
                  const currentDate = new Date(checkInDate);
                  while (currentDate < checkOutDate) {
                    const dateString = currentDate.toISOString().split('T')[0];
                    if (!groups[dateString]) {
                      groups[dateString] = [];
                    }
                    groups[dateString].push(booking);
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                  return groups;
                }, {} as Record<string, TourHotelBooking[]>);
                
                console.log('날짜별 그룹화된 호텔 데이터:', groupedByDateRange);
                
                console.log('최종 호텔 그룹화된 데이터:', groupedByDateRange);

                // 선택된 월 기준으로 달력 생성
                const now = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                // 이번 달의 첫 번째 날
                const firstDay = new Date(currentYear, currentMonth, 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작
                
                // 6주 표시를 위해 42일 생성
                const calendarDays = [];
                for (let i = 0; i < 42; i++) {
                  const date = new Date(startDate);
                  date.setDate(startDate.getDate() + i);
                  calendarDays.push(date);
                }

                const monthNames = t.raw('monthNames');
                const dayNames = t.raw('dayNames');

                return (
                  <div className="space-y-4">
                    {/* 달력 헤더 */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="이전 달"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="text-center">
                        <h4 className="text-xl font-semibold text-gray-900">
                          {currentYear} {monthNames[currentMonth]}
                        </h4>
                        <button
                          onClick={goToToday}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                        >
                          {t('goToToday')}
                        </button>
                      </div>
                      
                      <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="다음 달"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1">
                      {dayNames.map((day: string) => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                          {day}
                        </div>
                      ))}
                        </div>

                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((date, index) => {
                        const dateString = date.toISOString().split('T')[0];
                        const isCurrentMonth = date.getMonth() === currentMonth;
                        const isToday = date.toDateString() === now.toDateString();
                        const dayBookings = groupedByDateRange[dateString] || [];
                        const totalRooms = dayBookings.reduce((sum, booking) => sum + booking.rooms, 0);
                        
                        // 디버깅: 해당 날짜에 호텔 부킹이 있는지 확인
                        if (dayBookings.length > 0) {
                          console.log(`${dateString}에 호텔 부킹 ${dayBookings.length}개:`, dayBookings);
                        }

                        return (
                          <div
                            key={index}
                            className={`min-h-[120px] p-2 border border-gray-200 ${
                              isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                            } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <div className={`text-sm font-medium mb-1 ${
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            } ${isToday ? 'text-blue-600' : ''}`}>
                              {date.getDate()}
                        </div>
                            
                             {/* 호텔 부킹 정보 라벨 */}
                             {dayBookings.length > 0 && (
                               <div className="space-y-0.5">
                                 <div className="text-xs text-blue-600 font-semibold">
                                   {t('totalRooms')} {totalRooms}
                                 </div>
                                {(() => {
                                  // 호텔별로 그룹화하고 체크인 시간순으로 정렬
                                  const hotelGroups = dayBookings.reduce((groups, booking) => {
                                    const hotel = booking.hotel;
                                    if (!groups[hotel]) {
                                      groups[hotel] = [];
                                    }
                                    groups[hotel].push(booking);
                                    return groups;
                                  }, {} as Record<string, TourHotelBooking[]>);

                                  // 각 호텔별로 체크인 시간순 정렬
                                  Object.keys(hotelGroups).forEach(hotel => {
                                    hotelGroups[hotel].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
                                  });

                                  // 호텔별로 정렬 (체크인 시간순)
                                  const sortedHotels = Object.keys(hotelGroups).sort((a, b) => {
                                    const aTime = hotelGroups[a][0].check_in_date;
                                    const bTime = hotelGroups[b][0].check_in_date;
                                    return aTime.localeCompare(bTime);
                                  });

                                  return sortedHotels.map((hotel) => {
                                    const hotelBookings = hotelGroups[hotel];
                                    const firstBooking = hotelBookings[0];
                                    
                                     // 호텔명 단축 및 색상 구분
                                     let displayName = hotel;
                                     let hotelBgColor = '';
                                     if (hotel.length > 10) {
                                       displayName = hotel.substring(0, 10) + '...';
                                     }
                                     
                                     // 호텔별로 다른 색상 적용
                                     const hotelColors = ['bg-purple-200 text-purple-800', 'bg-orange-200 text-orange-800', 'bg-pink-200 text-pink-800', 'bg-indigo-200 text-indigo-800', 'bg-green-200 text-green-800', 'bg-red-200 text-red-800'];
                                     const colorIndex = hotel.length % hotelColors.length;
                                     hotelBgColor = hotelColors[colorIndex];

                                     // 룸타입별로 그룹화
                                     const roomTypeGroups = hotelBookings.reduce((groups, booking) => {
                                       const roomType = booking.room_type || '기본';
                                       if (!groups[roomType]) {
                                         groups[roomType] = 0;
                                       }
                                       groups[roomType] += booking.rooms;
                                       return groups;
                                     }, {} as Record<string, number>);

                                     const roomTypeText = Object.entries(roomTypeGroups)
                                       .map(([type, count]) => `${type}(${count})`)
                                       .join(', ');

                                     // 투어 상품 이름 가져오기
                                     const tourProductName = getProductName(firstBooking.tours?.products);
                                     const tourInfo = tourProductName ? ` [${tourProductName}]` : '';

                                     return (
                                      <div
                                        key={hotel}
                                        className={`px-1 py-0.5 rounded text-[8px] sm:text-[10px] cursor-pointer hover:opacity-80 ${hotelBgColor} truncate`}
                                        title={`${hotel} - ${roomTypeText} - 체크인: ${firstBooking.check_in_date} ~ 체크아웃: ${firstBooking.check_out_date}${tourInfo ? ` - 투어: ${tourProductName}` : ''}`}
                                        onClick={() => handleBookingClick(hotelBookings)}
                                      >
                                        <span className="font-bold">{displayName}</span> <span>{roomTypeText}</span>{tourInfo}
                                      </div>
                                     );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                     {/* 범례 */}
                     <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                       <div className="text-sm font-medium text-gray-700 mb-2">{t('statusLegend')}</div>
                       <div className="flex flex-wrap gap-2">
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                           {t('pending')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                           {t('confirmed')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                           {t('cancelled')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                           {t('completed')}
                         </span>
                       </div>
                       <div className="mt-3">
                         <div className="text-sm font-medium text-gray-700 mb-2">{t('hotelCategory')}</div>
                         <div className="flex flex-wrap gap-2">
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                             {t('hotelA')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-200 text-orange-800">
                             {t('hotelB')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-pink-200 text-pink-800">
                             {t('hotelC')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-200 text-indigo-800">
                             {t('hotelD')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                             {t('hotelE')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800">
                             {t('hotelF')}
                           </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: t('hotelLegendDescription') }} />
                        </div>
                     </div>
                        </div>
                );
              })()}
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium text-gray-600">
                {locale === 'ko' ? '테이블 표시' : 'Table layout'}
              </span>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white shadow-sm">
                {(
                  [
                    ['flat', locale === 'ko' ? '전체' : 'All'],
                    ['byRn', 'RN#별'],
                    ['byTour', locale === 'ko' ? '투어별' : 'By tour'],
                    ['byDate', locale === 'ko' ? '날짜별' : 'By date'],
                  ] as const
                ).map(([layout, label]) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setHotelTableLayout(layout)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      hotelTableLayout === layout
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
              <div className="block space-y-3 sm:hidden p-2">
                {sortedBookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {searchTerm || statusFilter !== 'all' || hasCheckInDateRangeFilter || hideAuditedFilter
                      ? locale === 'ko'
                        ? '검색 조건에 맞는 부킹이 없습니다.'
                        : 'No bookings match your filters.'
                      : locale === 'ko'
                        ? '등록된 투어 호텔 부킹이 없습니다.'
                        : 'No tour hotel bookings registered.'}
                  </div>
                ) : hotelTableGroups ? (
                  <div className="space-y-5">
                    {hotelTableGroups.map((g, gi) => {
                      const palette = HOTEL_TABLE_GROUP_STYLES[gi % HOTEL_TABLE_GROUP_STYLES.length]!;
                      const totalRooms = g.rows.reduce((s, b) => s + (b.rooms || 0), 0);
                      const groupHeaderTitle =
                        hotelTableLayout === 'byRn' ? `RN# ${g.label}` : g.label;
                      return (
                        <div key={g.key} className={palette.mobileSection}>
                          <div className={`${palette.mobileHeader} text-xs`}>
                            <div className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
                              {renderHotelTourGroupTitleBlock(g, groupHeaderTitle)}
                            </div>
                            <div className="mt-1 text-neutral-700 font-medium">
                              {locale === 'ko' ? '부킹' : 'Bookings'}: {g.rows.length}
                              {locale === 'ko' ? '건' : ''} · {locale === 'ko' ? '객실' : 'Rooms'} {totalRooms}
                            </div>
                          </div>
                          <div className="space-y-2.5 p-2.5 bg-white/80">
                            {g.rows.map((booking) => renderHotelMobileCard(booking))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  pagedSortedBookings.map((booking) => renderHotelMobileCard(booking))
                )}
              </div>
              <div className="hidden min-w-0 w-full max-w-full overflow-x-auto sm:block">
                <table className="w-full min-w-[1180px] border-collapse text-[11px]">
                  {renderHotelTableThead()}
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedBookings.length === 0 ? (
                      <tr>
                        <td colSpan={HOTEL_DESKTOP_TABLE_COL_COUNT} className="px-4 py-10 text-center text-sm text-gray-500">
                          {searchTerm || statusFilter !== 'all' || hasCheckInDateRangeFilter || hideAuditedFilter
                            ? locale === 'ko'
                              ? '검색 조건에 맞는 부킹이 없습니다.'
                              : 'No bookings match your filters.'
                            : locale === 'ko'
                              ? '등록된 투어 호텔 부킹이 없습니다.'
                              : 'No tour hotel bookings registered.'}
                        </td>
                      </tr>
                    ) : hotelTableGroups ? (
                      hotelTableGroups.flatMap((g, gi) => {
                        const palette = HOTEL_TABLE_GROUP_STYLES[gi % HOTEL_TABLE_GROUP_STYLES.length]!;
                        const totalRooms = g.rows.reduce((s, b) => s + (b.rooms || 0), 0);
                        const groupHeaderTitle =
                          hotelTableLayout === 'byRn' ? `RN# ${g.label}` : g.label;
                        return [
                          <tr key={`${g.key}-header`} className={palette.headerRow}>
                            <td colSpan={HOTEL_DESKTOP_TABLE_COL_COUNT} className="px-3 py-2 text-xs font-bold text-neutral-900">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  {renderHotelTourGroupTitleBlock(g, groupHeaderTitle)}
                                </span>
                                <span className="font-medium text-neutral-700">
                                  {g.rows.length}
                                  {locale === 'ko' ? '건' : ' bookings'} · {locale === 'ko' ? '객실' : 'Rooms'}{' '}
                                  {totalRooms}
                                </span>
                              </div>
                            </td>
                          </tr>,
                          ...g.rows.map((booking) => renderHotelTableRow(booking)),
                        ];
                      })
                    ) : (
                      pagedSortedBookings.map((booking) => renderHotelTableRow(booking))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {renderHotelTablePagination()}
          </>
        ) : (
          /* 카드뷰 - 모바일 최적화 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="p-4 sm:p-6">
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {booking.hotel}
                      </h3>
                      <p className="text-sm text-gray-600">{booking.city}</p>
                      <p className="text-xs text-gray-500 mt-1">{booking.reservation_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('checkInDate')}</span>
                      <span className="font-medium">{booking.check_in_date}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('checkOutDate')}</span>
                      <span className="font-medium">{booking.check_out_date}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('rooms')}</span>
                      <span className="font-medium">{booking.rooms}개</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('roomType')}</span>
                      <span className="font-medium truncate ml-2">{booking.room_type || '타입 미지정'}</span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">{t('unitPrice')}</span>
                        <span className="font-medium">${booking.unit_price}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('totalPrice')}</span>
                        <span className="font-medium text-blue-600">${booking.total_price}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-sm">
                        <span className="text-gray-500">{t('paymentMethod')}</span>
                        <div className="mt-1 font-medium">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                          {getCCStatusText(booking.cc)}
                        </span>
                      </div>
                    </div>

                    {booking.tours && (
                      <div className="border-t pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">투어</span>
                          <div className="mt-1">
                            <div className="font-medium">{booking.tours.tour_date}</div>
                            <div className="text-xs text-gray-500">
                              {getProductName(booking.tours?.products)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3">
                      <BookingAuditCell
                        audit={booking}
                        disabled={!user?.email}
                        saving={bookingAuditSavingId === booking.id}
                        onToggle={(next) => void handleToggleHotelBookingAudit(booking, next)}
                      />
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="mt-4 pt-4 border-t">
                    {renderHotelBookingActionButtons(booking, { size: 'touch' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredBookings.length === 0 && viewMode !== 'table' && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg font-medium mb-2">
              {searchTerm || statusFilter !== 'all' || hasCheckInDateRangeFilter || hideAuditedFilter
                ? '검색 조건에 맞는 부킹이 없습니다.' 
                : '등록된 투어 호텔 부킹이 없습니다.'
              }
            </div>
            <p className="text-sm text-gray-400">
              {!searchTerm && statusFilter === 'all' && !hasCheckInDateRangeFilter && !hideAuditedFilter && '새 부킹을 추가해보세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 폼 모달 — 상세 모달과 동일하게 화면 중앙 오버레이로 표시 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 sm:p-6">
              <TourHotelBookingForm
                key={editingBooking?.id ?? 'new-hotel-booking'}
                {...(editingBooking ? { booking: editingBooking } : {})}
                onSave={(booking: unknown) => handleSave(booking as TourHotelBooking)}
                onCancel={() => {
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
                    {t('history')}
                  </button>
                  {canBookingMgmtSoftDelete && !editingBooking.deletion_requested_at ? (
                    <button
                      type="button"
                      onClick={() => void handleRequestSoftDelete(editingBooking.id)}
                      className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      {locale === 'ko' ? '삭제 요청' : 'Request delete'}
                    </button>
                  ) : null}
                  {canSuperPurgeHotelBookings && editingBooking.deletion_requested_at ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(editingBooking.id)}
                      className="inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                    >
                      {locale === 'ko' ? '영구 삭제' : 'Permanent delete'}
                    </button>
                  ) : null}
                  {editingBooking.deletion_requested_at && !canSuperPurgeHotelBookings ? (
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
          bookingType="hotel"
          bookingId={selectedBookingId}
          onClose={() => {
            setShowHistory(false);
            setSelectedBookingId('');
          }}
        />
      )}

      <TourHotelBookingDeletionReviewModal
        open={hotelDeletionReviewOpen}
        onOpenChange={setHotelDeletionReviewOpen}
        allowBulkPermanentDelete={canSuperPurgeHotelBookings}
        onAfterBulkDelete={() => {
          void fetchBookings();
        }}
      />

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(open) => {
          setStmtReconOpen(open);
          if (!open) restoreStatementReconScroll();
        }}
        context={stmtReconCtx}
        onApplied={() => void refreshAfterStatementReconApply()}
      />

      {tourDetailModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-2 sm:p-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hotel-booking-tour-detail-modal-title"
            onClick={() => setTourDetailModal(null)}
          >
            <div
              className="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                <h3
                  id="hotel-booking-tour-detail-modal-title"
                  className="text-lg font-semibold text-gray-900 truncate pr-2"
                  title={tourDetailModal.title}
                >
                  {tourDetailModal.title}
                </h3>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/${locale}/admin/tours/${tourDetailModal.tourId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                  >
                    {tRes('card.openTourInNewTab')}
                  </a>
                  <button
                    type="button"
                    onClick={() => setTourDetailModal(null)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                    aria-label={tRes('card.close')}
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 bg-gray-50">
                <TourDetailModalContent tourId={tourDetailModal.tourId} />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 부킹 상세 모달 */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">호텔 예약 상세 정보</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedBookings.map((booking, index) => (
                  <div key={`${booking.id}-${index}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                          {booking.hotel}
                        </h4>
                        <p className="text-sm text-gray-600">{booking.city}</p>
                        <p className="text-xs text-gray-500 mt-1">{booking.reservation_name}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('checkInDate')}</span>
                        <span className="font-medium">{booking.check_in_date}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('checkOutDate')}</span>
                        <span className="font-medium">{booking.check_out_date}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('rooms')}</span>
                        <span className="font-medium">{booking.rooms}개</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('roomType')}</span>
                        <span className="font-medium truncate ml-2">{booking.room_type || '타입 미지정'}</span>
                      </div>
                      
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500">{t('unitPrice')}</span>
                          <span className="font-medium">${booking.unit_price}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{t('totalPrice')}</span>
                          <span className="font-medium text-blue-600">${booking.total_price}</span>
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <div className="text-sm">
                          <span className="text-gray-500">{t('paymentMethod')}</span>
                          <div className="mt-1 font-medium">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                            {getCCStatusText(booking.cc)}
                          </span>
                        </div>
                      </div>

                      {booking.tours && (
                        <div className="border-t pt-2">
                          <div className="text-sm">
                            <span className="text-gray-500">투어</span>
                            <div className="mt-1">
                              <div className="font-medium">{booking.tours.tour_date}</div>
                              <div className="text-xs text-gray-500">
                                {getProductName(booking.tours?.products)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-2 mt-2">
                        <BookingAuditCell
                          audit={booking}
                          disabled={!user?.email}
                          saving={bookingAuditSavingId === booking.id}
                          onToggle={(next) => void handleToggleHotelBookingAudit(booking, next)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      {renderHotelBookingActionButtons(booking, { size: 'touch' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


