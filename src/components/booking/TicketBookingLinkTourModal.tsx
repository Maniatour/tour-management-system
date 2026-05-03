'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchTicketToursForCheckIn,
  type TicketTourPickerRow,
} from '@/lib/ticketBookingToursForCheckIn';

export type TicketBookingLinkTourModalProps = {
  open: boolean;
  booking: { id: string; check_in_date: string; tour_id?: string | null } | null;
  locale: string;
  onClose: () => void;
  /** 저장 후 목록 새로고침 등 */
  onLinked: () => void | Promise<void>;
};

function tourOptionLabel(tour: TicketTourPickerRow, locale: string): string {
  const productName =
    tour.products?.name || (locale === 'ko' ? '상품명 없음' : 'No product');
  const g = tour.guide_display?.trim();
  const a = tour.assistant_display?.trim();
  const nameParts = [g, a].filter(Boolean) as string[];
  return nameParts.length > 0
    ? `${tour.tour_date} ${productName}, ${nameParts.join(', ')}`
    : `${tour.tour_date} ${productName}`;
}

export default function TicketBookingLinkTourModal({
  open,
  booking,
  locale,
  onClose,
  onLinked,
}: TicketBookingLinkTourModalProps) {
  const isKo = locale === 'ko';
  const [tours, setTours] = useState<TicketTourPickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTourId, setSelectedTourId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadTours = useCallback(async () => {
    if (!booking?.check_in_date?.trim()) {
      setTours([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mergeId =
        booking.tour_id != null && String(booking.tour_id).trim() !== ''
          ? String(booking.tour_id).trim()
          : null;
      const rows = await fetchTicketToursForCheckIn(
        supabase as any,
        booking.check_in_date.trim(),
        mergeId
      );
      setTours(rows);
    } catch {
      setError(isKo ? '투어 목록을 불러오지 못했습니다.' : 'Could not load tours.');
      setTours([]);
    } finally {
      setLoading(false);
    }
  }, [booking?.check_in_date, booking?.tour_id, isKo]);

  useEffect(() => {
    if (!open || !booking) {
      setTours([]);
      setSelectedTourId('');
      setError(null);
      return;
    }
    void loadTours();
  }, [open, booking?.id, booking?.check_in_date, booking?.tour_id, loadTours]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !selectedTourId) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await (supabase as any)
        .from('ticket_bookings')
        .update({ tour_id: selectedTourId })
        .eq('id', booking.id);
      if (upErr) throw upErr;
      await onLinked();
      onClose();
    } catch {
      setError(isKo ? '저장에 실패했습니다.' : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !booking) return null;

  const checkIn = String(booking.check_in_date ?? '').trim();

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-link-tour-title"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 id="ticket-link-tour-title" className="text-base font-semibold text-gray-900">
          {isKo ? '투어 연결' : 'Link tour'}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {isKo
            ? '체크인일이 투어 달력 구간에 들어가는 투어 중에서 선택합니다.'
            : 'Pick a tour whose calendar span includes the check-in date.'}
        </p>
        <p className="mt-2 text-xs font-medium text-gray-700">
          {isKo ? '체크인' : 'Check-in'}:{' '}
          <span className="font-mono tabular-nums">{checkIn || '—'}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="ticket-link-tour-select" className="block text-xs font-medium text-gray-600">
              {isKo ? '투어' : 'Tour'}
            </label>
            <select
              id="ticket-link-tour-select"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={selectedTourId}
              onChange={(ev) => setSelectedTourId(ev.target.value)}
              disabled={loading || saving}
              required
            >
              <option value="">{isKo ? '투어를 선택하세요' : 'Select a tour'}</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tourOptionLabel(tour, locale)}
                </option>
              ))}
            </select>
            {loading ? (
              <p className="mt-1 text-[11px] text-gray-500">{isKo ? '불러오는 중…' : 'Loading…'}</p>
            ) : !checkIn ? (
              <p className="mt-1 text-[11px] text-amber-700">
                {isKo ? '체크인 날짜가 없으면 투어를 고를 수 없습니다.' : 'Check-in date is required.'}
              </p>
            ) : tours.length === 0 ? (
              <p className="mt-1 text-[11px] text-amber-700">
                {isKo
                  ? '조건에 맞는 투어가 없습니다. 체크인일·투어 일정을 확인하세요.'
                  : 'No matching tours. Verify check-in date and tour schedule.'}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              {isKo ? '취소' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving || loading || !selectedTourId}
            >
              {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '연결' : 'Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
