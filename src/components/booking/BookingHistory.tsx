'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Paperclip, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  formatTicketBookingStatusLabel,
  getTicketBookingStatusBadgeClass,
} from '@/lib/ticketBookingStatus';
import {
  formatTicketBookingAxisLabel,
  getBookingAxisStatusBadgeClass,
  getVendorAxisStatusBadgeClass,
} from '@/lib/ticketBookingAxisLabels';
import { SCHEDULE_COLOR_PRESETS } from '@/lib/scheduleProductColorPresets';
import { getCancelDueDateForTicketBooking } from '@/lib/ticketBookingCancelDue';
import {
  formatQtyArrow,
  formatTimeArrow,
  isWorkflowInitialPhase,
} from '@/lib/ticketBookingWorkflow';

interface BookingHistoryItem {
  id: string;
  booking_type: 'ticket' | 'hotel';
  booking_id: string;
  action: 'created' | 'updated' | 'cancelled' | 'confirmed';
  old_values: any;
  new_values: any;
  changed_by: string;
  changed_at: string;
  reason: string;
}

interface BookingHistoryProps {
  bookingType: 'ticket' | 'hotel';
  bookingId: string;
  onClose: () => void;
}

function changeAxisBadgeClass(changeStatus: string | null | undefined): string {
  const s = (changeStatus ?? 'none').trim().toLowerCase();
  switch (s) {
    case 'requested':
      return 'bg-purple-100 text-purple-900 ring-1 ring-purple-200/80';
    case 'confirmed':
      return 'bg-green-100 text-green-800 ring-1 ring-green-200/80';
    case 'rejected':
      return 'bg-red-100 text-red-800 ring-1 ring-red-200/80';
    case 'cancelled':
      return 'bg-gray-200 text-gray-800 ring-1 ring-gray-300/80';
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/80';
  }
}

/** 목록 「상태」열과 동일: 예약 축 + 변경 축·레거시 요약 */
function ticketHistoryBookingColFingerprint(data: any | null | undefined): string {
  if (!data) return '';
  return [
    data.booking_status ?? '',
    data.change_status ?? '',
    data.status ?? '',
  ].join('|');
}

function historySupplierChipColors(company: string | null | undefined): {
  backgroundColor: string;
  color: string;
} {
  const key = (company || '').trim().toLowerCase() || '__none__';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const preset = SCHEDULE_COLOR_PRESETS[h % SCHEDULE_COLOR_PRESETS.length]!;
  return { backgroundColor: preset.bgHex, color: preset.textHex };
}

function formatTicketHistoryPaymentCell(data: any, tAxis: (k: string) => string): string {
  if (isWorkflowInitialPhase(data)) return '—';
  const ps = String(data.payment_status ?? '').toLowerCase();
  if (ps === 'paid') {
    const amt = data.paid_amount ?? data.expense ?? '—';
    return `결제 완료 $${amt}`;
  }
  return formatTicketBookingAxisLabel(tAxis, 'payment', String(data.payment_status ?? ''));
}

function formatTicketHistoryRefundCell(data: any, tAxis: (k: string) => string): string {
  if (isWorkflowInitialPhase(data)) return '—';
  return formatTicketBookingAxisLabel(tAxis, 'refund', String(data.refund_status ?? ''));
}

type HistoryColumnDef = {
  key: string;
  label: string;
  thClass: string;
  tdClass: string;
  statusTitle?: string;
};

function getTicketHistoryColumns(statusHintTitle: string): HistoryColumnDef[] {
  const thBase =
    'px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
  const thCompact =
    'px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500';
  const tdBase = 'px-2 py-1.5 whitespace-nowrap text-xs';
  const tdCompact = 'px-2 py-1.5 text-[10px] leading-snug';

  return [
    {
      key: 'status',
      label: '상태',
      thClass: `${thBase} sticky left-0 bg-gray-50 z-10`,
      tdClass: `${tdBase} align-top sticky left-0 z-10 max-w-[12rem]`,
      statusTitle: statusHintTitle,
    },
    {
      key: 'vendor_axis',
      label: '벤더',
      thClass: `${thCompact} max-w-[9rem] leading-tight`,
      tdClass: `${tdCompact} align-middle max-w-[9rem]`,
    },
    {
      key: 'payment_axis',
      label: '결제',
      thClass: `${thCompact} max-w-[11rem] min-w-[9rem] leading-tight`,
      tdClass: `${tdCompact} align-middle max-w-[11rem] min-w-[9rem]`,
    },
    {
      key: 'refund_axis',
      label: '환불·크레딧',
      thClass: `${thCompact} max-w-[20rem] min-w-[14rem] leading-tight`,
      tdClass: `${tdCompact} align-middle max-w-[20rem] min-w-[14rem]`,
    },
    { key: 'company', label: '공급업체', thClass: thBase, tdClass: `${tdBase} align-middle` },
    {
      key: 'check_in_date',
      label: '날짜',
      thClass: `${thBase} cursor-default`,
      tdClass: `${tdBase} align-middle`,
    },
    { key: 'time', label: '시간', thClass: thBase, tdClass: `${tdBase} align-middle` },
    { key: 'ea', label: '수량', thClass: thBase, tdClass: `${tdBase} align-middle` },
    {
      key: 'cancel_due',
      label: 'Cancel Due',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} align-middle hidden md:table-cell`,
    },
    {
      key: 'expense',
      label: '비용(USD)',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell`,
    },
    {
      key: 'income',
      label: '수입(USD)',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell`,
    },
    {
      key: 'rn_number',
      label: 'RN#',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} align-middle hidden md:table-cell`,
    },
    {
      key: 'payment_method',
      label: '결제방법',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell`,
    },
    {
      key: 'zelle_confirmation_number',
      label: 'Zelle 확인#',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell max-w-[10rem]`,
    },
    {
      key: 'zelle_attachment',
      label: 'Zelle 첨부',
      thClass: `${thBase} hidden lg:table-cell text-center`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell text-center`,
    },
    {
      key: 'cc',
      label: 'CC',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} align-middle hidden md:table-cell`,
    },
    {
      key: 'tour_id',
      label: '투어연결',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell`,
    },
    {
      key: 'tour_total_guests',
      label: '투어총인원',
      thClass: `${thBase} hidden lg:table-cell`,
      tdClass: `${tdBase} align-middle hidden lg:table-cell`,
    },
    {
      key: 'invoice_number',
      label: 'Invoice#',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} align-middle hidden md:table-cell`,
    },
    {
      key: 'invoice_attachment',
      label: '첨부',
      thClass: `${thBase} hidden md:table-cell text-center`,
      tdClass: `${tdBase} align-middle hidden md:table-cell text-center`,
    },
    {
      key: 'history_audit',
      label: '액션',
      thClass: thBase,
      tdClass: `${tdBase} align-middle`,
    },
    {
      key: 'submit_on',
      label: '제출일',
      thClass: `${thBase} cursor-default`,
      tdClass: `${tdBase} align-middle`,
    },
    {
      key: 'submitted_by',
      label: '예약자',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} align-middle hidden md:table-cell`,
    },
    {
      key: 'changed_at',
      label: '수정날짜',
      thClass: thBase,
      tdClass: tdBase,
    },
    {
      key: 'changed_time',
      label: '수정시간',
      thClass: thBase,
      tdClass: tdBase,
    },
    {
      key: 'changed_by',
      label: '변경자',
      thClass: `${thBase} hidden md:table-cell`,
      tdClass: `${tdBase} hidden md:table-cell`,
    },
  ];
}

function getHotelHistoryColumns(): HistoryColumnDef[] {
  const stickyTh =
    'px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
  return [
    {
      key: 'history_audit',
      label: '작업',
      thClass: `${stickyTh} sticky left-0 bg-gray-50 z-10`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs sticky left-0 z-10',
    },
    {
      key: 'status',
      label: '상태',
      thClass: `${stickyTh} sticky left-[80px] bg-gray-50 z-10`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs sticky left-[80px] z-10',
    },
    {
      key: 'company',
      label: '공급업체',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'check_in_date',
      label: '날짜',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'time',
      label: '시간',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'ea',
      label: '수량',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'expense',
      label: '비용(USD)',
      thClass: `${stickyTh} hidden lg:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden lg:table-cell',
    },
    {
      key: 'income',
      label: '수입(USD)',
      thClass: `${stickyTh} hidden lg:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden lg:table-cell',
    },
    {
      key: 'rn_number',
      label: 'RN#',
      thClass: `${stickyTh} hidden md:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden md:table-cell',
    },
    {
      key: 'payment_method',
      label: '결제방법',
      thClass: `${stickyTh} hidden lg:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden lg:table-cell',
    },
    {
      key: 'cc',
      label: 'CC',
      thClass: `${stickyTh} hidden md:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden md:table-cell',
    },
    {
      key: 'tour_id',
      label: '투어연결',
      thClass: `${stickyTh} hidden lg:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden lg:table-cell',
    },
    {
      key: 'submit_on',
      label: '제출일',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'submitted_by',
      label: '예약자',
      thClass: `${stickyTh} hidden md:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden md:table-cell',
    },
    {
      key: 'changed_at',
      label: '수정날짜',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'changed_time',
      label: '수정시간',
      thClass: stickyTh,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs',
    },
    {
      key: 'changed_by',
      label: '변경자',
      thClass: `${stickyTh} hidden md:table-cell`,
      tdClass: 'px-2 py-1.5 whitespace-nowrap text-xs hidden md:table-cell',
    },
  ];
}

export default function BookingHistory({ bookingType, bookingId, onClose }: BookingHistoryProps) {
  const tCal = useTranslations('booking.calendar');
  const tTbAxis = useTranslations('booking.calendar.ticketBookingAxis');
  const locale = useLocale();
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMemberMap, setTeamMemberMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchHistory();
  }, [bookingType, bookingId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_history')
        .select('*')
        .eq('booking_type', bookingType)
        .eq('booking_id', bookingId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      
      // 수정 날짜와 시간 순으로 정렬 (최신순)
      const sortedHistory = (data || []).sort((a, b) => {
        const dateA = new Date(a.changed_at).getTime();
        const dateB = new Date(b.changed_at).getTime();
        return dateB - dateA; // 내림차순 (최신순)
      });
      
      setHistory(sortedHistory);

      // changed_by 이메일로 team 테이블에서 name_ko 조회
      const changedByEmails = [...new Set(
        (sortedHistory || [])
          .map((item) => item.changed_by)
          .filter((email): email is string => !!email && typeof email === 'string' && email.includes('@'))
      )];

      if (changedByEmails.length > 0) {
        try {
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('email, name_ko')
            .in('email', changedByEmails);

          if (!teamError && teamData) {
            const emailToNameMap = new Map<string, string>();
            (teamData || []).forEach((member: { email: string; name_ko: string | null }) => {
              if (member.email && member.name_ko) {
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
      }
    } catch (error) {
      console.error('부킹 히스토리 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return '생성';
      case 'updated': return '수정';
      case 'cancelled': return '취소';
      case 'confirmed': return '확정';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800';
      case 'updated': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'confirmed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatChanges = (oldValues: any, newValues: any) => {
    if (!oldValues || !newValues) return [];

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    allKeys.forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changes.push({
          field: key,
          oldValue: oldValues[key],
          newValue: newValues[key]
        });
      }
    });

    return changes;
  };

  const getFieldDisplayName = (field: string) => {
    const fieldNames: { [key: string]: string } = {
      category: '카테고리',
      submitted_by: '제출자',
      check_in_date: '체크인 날짜',
      time: '시간',
      company: '공급업체',
      ea: '수량',
      expense: '비용',
      income: '수입',
      payment_method: '결제 방법',
      rn_number: 'RN#',
      tour_id: '투어 ID',
      note: '메모',
      status: '상태',
      season: '시즌',
      event_date: '이벤트 날짜',
      check_out_date: '체크아웃 날짜',
      reservation_name: '예약명',
      cc: 'CC',
      rooms: '객실 수',
      city: '도시',
      hotel: '호텔명',
      room_type: '객실 타입',
      unit_price: '단가',
      total_price: '총 가격',
      website: '웹사이트'
    };

    return fieldNames[field] || field;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  };

  const historyColumns: HistoryColumnDef[] =
    bookingType === 'ticket'
      ? getTicketHistoryColumns(tCal('ticketTableStatusThHintSummary'))
      : getHotelHistoryColumns();

  // 결제 방법 텍스트 변환
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '신용카드';
      case 'bank_transfer': return '계좌이체';
      case 'cash': return '현금';
      case 'other': return '기타';
      default: return method || '-';
    }
  };

  // CC 상태 텍스트
  const getCCStatusText = (cc: string) => {
    switch (cc) {
      case 'sent': return 'CC 발송 완료';
      case 'not_sent': return '미발송';
      case 'not_needed': return '필요없음';
      default: return cc || '-';
    }
  };

  // CC 상태 색상
  const getCCStatusColor = (cc: string) => {
    switch (cc) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'not_sent': return 'bg-yellow-100 text-yellow-800';
      case 'not_needed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 컬럼 값 가져오기
  const getColumnValue = (data: any, columnKey: string) => {
    switch (columnKey) {
      case 'status':
        return {
          display: formatTicketBookingStatusLabel(String(data[columnKey] ?? ''), tCal, locale),
          isBadge: true,
          color: getTicketBookingStatusBadgeClass(String(data[columnKey] ?? '')),
        };
      case 'check_in_date':
        return { 
          display: data[columnKey] ? new Date(data[columnKey]).toISOString().split('T')[0] : '-',
          isBadge: false
        };
      case 'time':
        return { 
          display: data[columnKey]?.replace(/:\d{2}$/, '') || '-',
          isBadge: false
        };
      case 'ea':
        return { 
          display: `${data[columnKey] || 0}개`,
          isBadge: false
        };
      case 'expense':
        return { 
          display: `$${data[columnKey] || '-'}`,
          isBadge: false
        };
      case 'income':
        return { 
          display: `$${data[columnKey] || '-'}`,
          isBadge: false
        };
      case 'payment_method':
        return { 
          display: getPaymentMethodText(data[columnKey]),
          isBadge: false
        };
      case 'cc':
        return { 
          display: getCCStatusText(data[columnKey]),
          isBadge: true,
          color: getCCStatusColor(data[columnKey])
        };
      case 'submit_on':
        return { 
          display: data[columnKey] ? new Date(data[columnKey]).toISOString().split('T')[0] : '-',
          isBadge: false
        };
      case 'tour_id':
        return { 
          display: data[columnKey] ? '연결됨' : '미연결',
          isBadge: false
        };
      case 'submitted_by':
        return { 
          display: data[columnKey] || '-',
          isBadge: false
        };
      case 'zelle_confirmation_number':
        return {
          display: String(data[columnKey] ?? '').trim() || '—',
          isBadge: false,
        };
      case 'invoice_number':
        return {
          display: String(data[columnKey] ?? '').trim() || '-',
          isBadge: false,
        };
      case 'history_audit':
        return {
          display: '',
          isBadge: false,
        };
      case 'changed_at':
        // changed_at은 별도로 처리
        return { 
          display: '',
          isBadge: false
        };
      case 'changed_time':
        // changed_time은 별도로 처리
        return { 
          display: '',
          isBadge: false
        };
      default:
        return { 
          display: formatValue(data[columnKey]),
          isBadge: false
        };
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130]">
        <div className="bg-white rounded-lg p-6 w-full max-w-[96vw] xl:max-w-[1700px] max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130]">
      <div className="bg-white rounded-lg p-6 w-full max-w-[96vw] xl:max-w-[1700px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {bookingType === 'ticket' ? '입장권' : '투어 호텔'} 부킹 히스토리
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            변경 이력이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr className="align-middle">
                    {historyColumns.map((column) => (
                      <th
                        key={column.key}
                        title={column.statusTitle}
                        className={column.thClass}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => {
                    // 각 히스토리 항목에 따라 표시할 데이터 결정
                    const displayData = item.action === 'cancelled' 
                      ? item.old_values 
                      : item.new_values || item.old_values;
                    
                    // 이전 데이터 (updated의 경우)
                    const oldData = item.action === 'updated' ? item.old_values : null;
                    
                    // 수정 날짜와 시간 포맷팅
                    const changedDate = new Date(item.changed_at);
                    const formattedDate = changedDate.toISOString().split('T')[0];
                    const formattedTime = changedDate.toTimeString().split(' ')[0].replace(/:\d{2}$/, '');
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {historyColumns.map((column) => {
                          const applyStickyRowBg = (baseTdClass: string, bgColor: string) => {
                            if (baseTdClass.includes('sticky')) {
                              return `${baseTdClass.replace('bg-gray-50', '').trim()} ${bgColor}`;
                            }
                            return `${baseTdClass} ${bgColor}`;
                          };

                          // 히스토리 작업 유형 (목록의 「액션」열 헤더와 동일 위치 — 입장권)
                          if (column.key === 'history_audit') {
                            let actionBgColor = 'bg-white';
                            if (item.action === 'created') {
                              actionBgColor = 'bg-green-50';
                            } else if (item.action === 'cancelled') {
                              actionBgColor = 'bg-red-50';
                            }

                            return (
                              <td
                                key={column.key}
                                className={applyStickyRowBg(column.tdClass, actionBgColor)}
                              >
                                <span
                                  className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getActionColor(item.action)}`}
                                >
                                  {getActionText(item.action)}
                                </span>
                              </td>
                            );
                          }
                          
                          // 수정날짜 컬럼
                          if (column.key === 'changed_at') {
                            let metaBg = 'bg-white';
                            if (item.action === 'created') metaBg = 'bg-green-50';
                            else if (item.action === 'cancelled') metaBg = 'bg-red-50';
                            return (
                              <td key={column.key} className={`${column.tdClass} ${metaBg}`}>
                                <div className="text-gray-900">{formattedDate}</div>
                              </td>
                            );
                          }

                          // 수정시간 컬럼
                          if (column.key === 'changed_time') {
                            let metaBg = 'bg-white';
                            if (item.action === 'created') metaBg = 'bg-green-50';
                            else if (item.action === 'cancelled') metaBg = 'bg-red-50';
                            return (
                              <td key={column.key} className={`${column.tdClass} ${metaBg}`}>
                                <div className="text-gray-900">{formattedTime}</div>
                              </td>
                            );
                          }

                          // 입장권 「상태」열 — 목록과 동일하게 예약 축 + 변경 요약만 (벤더는 다음 열)
                          if (bookingType === 'ticket' && column.key === 'status') {
                            const newFp = ticketHistoryBookingColFingerprint(displayData);
                            const oldFp = oldData ? ticketHistoryBookingColFingerprint(oldData) : null;
                            const isAxisChanged =
                              item.action === 'updated' && oldFp !== null && oldFp !== newFp;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') {
                              bgColor = 'bg-green-50';
                            } else if (item.action === 'cancelled') {
                              bgColor = 'bg-red-50';
                            } else if (isAxisChanged) {
                              bgColor = 'bg-yellow-50';
                            }

                            const cellClassName = applyStickyRowBg(column.tdClass, bgColor);

                            const renderBookingStatusChips = (data: any) => (
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {data?.booking_status != null &&
                                  String(data.booking_status).trim() !== '' && (
                                    <span
                                      className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${getBookingAxisStatusBadgeClass(data.booking_status)}`}
                                    >
                                      {formatTicketBookingAxisLabel(
                                        tTbAxis,
                                        'booking',
                                        String(data.booking_status)
                                      )}
                                    </span>
                                  )}
                                {data?.change_status != null &&
                                  String(data.change_status).trim() !== '' &&
                                  String(data.change_status).trim().toLowerCase() !== 'none' && (
                                    <span
                                      className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${changeAxisBadgeClass(data.change_status)}`}
                                    >
                                      {formatTicketBookingAxisLabel(
                                        tTbAxis,
                                        'change',
                                        String(data.change_status)
                                      )}
                                    </span>
                                  )}
                              </div>
                            );

                            const legacyNew = formatTicketBookingStatusLabel(
                              String(displayData?.status ?? ''),
                              tCal,
                              locale
                            );
                            const legacyOld = oldData
                              ? formatTicketBookingStatusLabel(
                                  String(oldData?.status ?? ''),
                                  tCal,
                                  locale
                                )
                              : null;
                            const legacyChanged =
                              item.action === 'updated' &&
                              legacyOld !== null &&
                              legacyOld !== legacyNew;

                            return (
                              <td key={column.key} className={cellClassName}>
                                <div className="space-y-1">
                                  {renderBookingStatusChips(displayData)}
                                  {legacyChanged && legacyOld !== legacyNew && (
                                    <div className="text-[10px] text-gray-600 space-y-0.5">
                                      {isAxisChanged ? (
                                        <div>{legacyNew}</div>
                                      ) : (
                                        <>
                                          <div className="line-through text-red-600/90">
                                            {legacyOld}
                                          </div>
                                          <div>{legacyNew}</div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'vendor_axis') {
                            const vNorm = (d: any) => String(d?.vendor_status ?? '').trim().toLowerCase();
                            const isChanged =
                              item.action === 'updated' &&
                              oldData != null &&
                              vNorm(displayData) !== vNorm(oldData);

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            const renderVendor = (data: any) =>
                              data?.vendor_status != null &&
                              String(data.vendor_status).trim() !== '' ? (
                                <span
                                  className={`inline-flex max-w-full min-h-[1.625rem] items-center px-2 py-1 text-xs font-semibold rounded-full ${getVendorAxisStatusBadgeClass(data.vendor_status)}`}
                                >
                                  <span className="truncate">
                                    {formatTicketBookingAxisLabel(
                                      tTbAxis,
                                      'vendor',
                                      String(data.vendor_status)
                                    )}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              );

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {renderVendor(displayData)}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'payment_axis') {
                            const nt = formatTicketHistoryPaymentCell(displayData, tTbAxis);
                            const ot = oldData ? formatTicketHistoryPaymentCell(oldData, tTbAxis) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'refund_axis') {
                            const nt = formatTicketHistoryRefundCell(displayData, tTbAxis);
                            const ot = oldData ? formatTicketHistoryRefundCell(oldData, tTbAxis) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'cancel_due') {
                            const fmtCd = (d: any) =>
                              getCancelDueDateForTicketBooking(
                                { check_in_date: d.check_in_date, company: d.company },
                                undefined
                              ) || '—';
                            const nt = fmtCd(displayData);
                            const ot = oldData ? fmtCd(oldData) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'company') {
                            const label = (d: any) => String(d?.company ?? '').trim() || '—';
                            const isChanged =
                              item.action === 'updated' &&
                              oldData != null &&
                              label(displayData) !== label(oldData);

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            const chip = (d: any) => {
                              const name = String(d?.company ?? '').trim() || '—';
                              const sty = historySupplierChipColors(d.company);
                              return (
                                <span
                                  className="inline-block max-w-[12rem] truncate rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-black/10"
                                  style={{ backgroundColor: sty.backgroundColor, color: sty.color }}
                                >
                                  {name}
                                </span>
                              );
                            };

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-red-600 line-through opacity-90">
                                      {chip(oldData!)}
                                    </div>
                                    <div className="font-medium text-green-800">{chip(displayData)}</div>
                                  </div>
                                ) : (
                                  chip(displayData)
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'time') {
                            const nt = formatTimeArrow(displayData);
                            const ot = oldData ? formatTimeArrow(oldData) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'ea') {
                            const nt = formatQtyArrow(displayData);
                            const ot = oldData ? formatQtyArrow(oldData) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'zelle_attachment') {
                            const urlsKey = (d: any) =>
                              JSON.stringify(Array.isArray(d?.uploaded_file_urls) ? d.uploaded_file_urls : []);
                            const isChanged =
                              item.action === 'updated' &&
                              oldData != null &&
                              urlsKey(displayData) !== urlsKey(oldData);

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            const icon = (d: any) => {
                              const has =
                                Array.isArray(d?.uploaded_file_urls) && d.uploaded_file_urls.length > 0;
                              return has ? (
                                <Paperclip
                                  className="mx-auto h-5 w-5 shrink-0 text-emerald-600"
                                  aria-hidden
                                />
                              ) : (
                                <ImageOff
                                  className="mx-auto h-5 w-5 shrink-0 text-gray-400"
                                  aria-hidden
                                />
                              );
                            };

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="opacity-60 line-through">{icon(oldData!)}</div>
                                    <div>{icon(displayData)}</div>
                                  </div>
                                ) : (
                                  icon(displayData)
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'invoice_attachment') {
                            const urlsKey = (d: any) =>
                              JSON.stringify(Array.isArray(d?.uploaded_file_urls) ? d.uploaded_file_urls : []);
                            const isChanged =
                              item.action === 'updated' &&
                              oldData != null &&
                              urlsKey(displayData) !== urlsKey(oldData);

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            const icon = (d: any) => {
                              const has =
                                Array.isArray(d?.uploaded_file_urls) && d.uploaded_file_urls.length > 0;
                              return has ? (
                                <Paperclip
                                  className="mx-auto h-5 w-5 shrink-0 text-blue-600"
                                  aria-hidden
                                />
                              ) : (
                                <ImageOff
                                  className="mx-auto h-5 w-5 shrink-0 text-gray-400"
                                  aria-hidden
                                />
                              );
                            };

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="opacity-60 line-through">{icon(oldData!)}</div>
                                    <div>{icon(displayData)}</div>
                                  </div>
                                ) : (
                                  icon(displayData)
                                )}
                              </td>
                            );
                          }

                          if (bookingType === 'ticket' && column.key === 'tour_total_guests') {
                            const fmt = (d: any) =>
                              d?.tours && d?.tour_id ? `${d.tours.total_people ?? 0}명` : '-';
                            const nt = fmt(displayData);
                            const ot = oldData ? fmt(oldData) : null;
                            const isChanged =
                              item.action === 'updated' && ot !== null && ot !== nt;

                            let bgColor = 'bg-white';
                            if (item.action === 'created') bgColor = 'bg-green-50';
                            else if (item.action === 'cancelled') bgColor = 'bg-red-50';
                            else if (isChanged) bgColor = 'bg-yellow-50';

                            return (
                              <td key={column.key} className={`${column.tdClass} ${bgColor}`}>
                                {isChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-red-600 line-through">{ot}</div>
                                    <div className="tabular-nums font-medium text-green-800">{nt}</div>
                                  </div>
                                ) : (
                                  <div className="tabular-nums text-gray-900">{nt}</div>
                                )}
                              </td>
                            );
                          }

                          // 변경자 컬럼
                          if (column.key === 'changed_by') {
                            const changedByEmail = item.changed_by?.toLowerCase() || '';
                            const nameKo = teamMemberMap.get(changedByEmail) || item.changed_by || '-';
                            
                            // 배경색 결정
                            let bgColor = 'bg-white';
                            if (item.action === 'created') {
                              bgColor = 'bg-green-50';
                            } else if (item.action === 'cancelled') {
                              bgColor = 'bg-red-50';
                            }
                            
                            return (
                              <td 
                                key={column.key}
                                className={`${column.tdClass} ${bgColor}`}
                              >
                                <div className={item.action === 'cancelled' ? 'text-red-800' : item.action === 'created' ? 'text-green-800' : 'text-gray-900'}>
                                  {nameKo}
                                </div>
                              </td>
                            );
                          }
                          
                          // 나머지 컬럼들
                          const newValueInfo = getColumnValue(displayData, column.key);
                          const oldValueInfo = oldData ? getColumnValue(oldData, column.key) : null;
                          const isChanged = oldValueInfo && oldValueInfo.display !== newValueInfo.display;
                          
                          // 배경색 결정
                          let bgColor = 'bg-white';
                          if (item.action === 'created') {
                            bgColor = 'bg-green-50';
                          } else if (item.action === 'cancelled') {
                            bgColor = 'bg-red-50';
                          } else if (isChanged) {
                            bgColor = 'bg-yellow-50';
                          }
                          
                          const cellClassName = applyStickyRowBg(column.tdClass, bgColor);

                          return (
                            <td key={column.key} className={cellClassName}>
                              {isChanged ? (
                                <div className="space-y-1">
                                  <div className={`text-red-600 line-through text-[10px] ${oldValueInfo?.isBadge ? 'inline-block' : ''}`}>
                                    {oldValueInfo?.isBadge ? (
                                      <span className={`inline-flex px-1 py-0.5 text-[10px] font-semibold rounded-full ${oldValueInfo.color}`}>
                                        {oldValueInfo.display}
                                      </span>
                                    ) : (
                                      oldValueInfo?.display
                                    )}
                                  </div>
                                  <div className={`${item.action === 'cancelled' ? 'text-red-800' : 'text-green-800'} font-medium ${newValueInfo.isBadge ? 'inline-block' : ''}`}>
                                    {newValueInfo.isBadge ? (
                                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${newValueInfo.color}`}>
                                        {newValueInfo.display}
                                      </span>
                                    ) : (
                                      newValueInfo.display
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={item.action === 'cancelled' ? 'text-red-800' : item.action === 'created' ? 'text-green-800' : 'text-gray-900'}>
                                  {newValueInfo.isBadge ? (
                                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${newValueInfo.color}`}>
                                      {newValueInfo.display}
                                    </span>
                                  ) : (
                                    newValueInfo.display
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
