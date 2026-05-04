'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type TicketBookingPendingDeletionRow = {
  id: string;
  tour_id: string | null;
  company: string | null;
  rn_number: string | null;
  check_in_date: string | null;
  time: string | null;
  ea: number | null;
  deletion_requested_at: string | null;
  deletion_requested_by: string | null;
  tours?: { tour_date: string | null } | null;
};

type TicketBookingDeletionReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterBulkDelete?: () => void;
  /** false면 목록만 표시 (SUPER 일괄 영구 삭제 UI 숨김) */
  allowBulkPermanentDelete?: boolean;
  /** 미지정 시 locale 기본 문구 */
  dialogTitle?: string;
  dialogDescription?: string;
};

export default function TicketBookingDeletionReviewModal({
  open,
  onOpenChange,
  onAfterBulkDelete,
  allowBulkPermanentDelete = true,
  dialogTitle,
  dialogDescription,
}: TicketBookingDeletionReviewModalProps) {
  const locale = useLocale();
  const [rows, setRows] = useState<TicketBookingPendingDeletionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_bookings')
        .select(
          'id, tour_id, company, rn_number, check_in_date, time, ea, deletion_requested_at, deletion_requested_by, tours(tour_date)'
        )
        .not('deletion_requested_at', 'is', null)
        .order('deletion_requested_at', { ascending: false });
      if (error) throw error;
      setRows((data as TicketBookingPendingDeletionRow[]) || []);
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (rows.length === 0) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const msg =
      locale === 'ko'
        ? `선택한 ${selected.size}건을 영구 삭제합니다. 계속할까요?`
        : `Permanently delete ${selected.size} selected booking(s)?`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      const { error } = await supabase.from('ticket_bookings').delete().in('id', ids);
      if (error) throw error;
      onAfterBulkDelete?.();
      await load();
    } catch (e) {
      console.error(e);
      alert(locale === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const defaultTitle =
    locale === 'ko' ? '삭제 요청된 입장권 부킹' : 'Ticket bookings pending deletion';
  const title = dialogTitle ?? defaultTitle;
  const defaultDesc = allowBulkPermanentDelete
    ? locale === 'ko'
      ? 'OP·매니저가 삭제 요청한 항목입니다. 확인 후 선택하여 영구 삭제할 수 있습니다.'
      : 'Requested by OP or office manager. Review and permanently delete selected rows.'
    : locale === 'ko'
      ? '목록에서 숨겨진 부킹입니다. 영구 삭제는 SUPER 관리자만 할 수 있습니다.'
      : 'These bookings are hidden from the main list. Only a super admin can permanently delete them.';
  const description = dialogDescription ?? defaultDesc;
  const empty = locale === 'ko' ? '삭제 요청된 부킹이 없습니다.' : 'No pending deletion requests.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 sm:rounded-lg overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-gray-200 shrink-0 text-left space-y-1">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <p className="text-xs text-gray-500 font-normal leading-snug">{description}</p>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {locale === 'ko' ? '새로고침' : 'Refresh'}
          </button>
          {allowBulkPermanentDelete ? (
            <>
              <button
                type="button"
                onClick={toggleAll}
                disabled={loading || rows.length === 0}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {locale === 'ko'
                  ? selected.size === rows.length
                    ? '전체 해제'
                    : '전체 선택'
                  : selected.size === rows.length
                    ? 'Deselect all'
                    : 'Select all'}
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={deleting || selected.size === 0}
                className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 ml-auto"
              >
                {deleting
                  ? locale === 'ko'
                    ? '삭제 중…'
                    : 'Deleting…'
                  : locale === 'ko'
                    ? `선택 영구 삭제 (${selected.size})`
                    : `Delete selected (${selected.size})`}
              </button>
            </>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 sm:px-3">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              {locale === 'ko' ? '불러오는 중…' : 'Loading…'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">{empty}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  {allowBulkPermanentDelete ? <th className="py-2 pl-2 w-10" /> : null}
                  <th className={`py-2 px-1 font-medium ${allowBulkPermanentDelete ? '' : 'pl-2'}`}>
                    {locale === 'ko' ? '투어일' : 'Tour date'}
                  </th>
                  <th className="py-2 px-1 font-medium">{locale === 'ko' ? '체크인' : 'Check-in'}</th>
                  <th className="py-2 px-1 font-medium">RN#</th>
                  <th className="py-2 px-1 font-medium">{locale === 'ko' ? '업체' : 'Company'}</th>
                  <th className="py-2 px-1 font-medium text-right">EA</th>
                  <th className="py-2 px-1 font-medium">{locale === 'ko' ? '요청자' : 'Requested by'}</th>
                  <th className="py-2 pr-2 font-medium">{locale === 'ko' ? '요청 시각' : 'Requested at'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    {allowBulkPermanentDelete ? (
                      <td className="py-2 pl-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          className="rounded border-gray-300"
                          aria-label={r.id}
                        />
                      </td>
                    ) : null}
                    <td className="py-2 px-1 align-middle tabular-nums text-gray-800">
                      {r.tours?.tour_date ?? '—'}
                    </td>
                    <td className="py-2 px-1 align-middle tabular-nums">{r.check_in_date ?? '—'}</td>
                    <td className="py-2 px-1 align-middle font-mono text-xs">{r.rn_number ?? '—'}</td>
                    <td className="py-2 px-1 align-middle max-w-[10rem] truncate" title={r.company ?? ''}>
                      {r.company ?? '—'}
                    </td>
                    <td className="py-2 px-1 align-middle text-right tabular-nums">{r.ea ?? '—'}</td>
                    <td className="py-2 px-1 align-middle text-xs max-w-[12rem] truncate" title={r.deletion_requested_by ?? ''}>
                      {r.deletion_requested_by ?? '—'}
                    </td>
                    <td className="py-2 pr-2 align-middle text-xs text-gray-600 whitespace-nowrap">
                      {r.deletion_requested_at
                        ? new Date(r.deletion_requested_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
