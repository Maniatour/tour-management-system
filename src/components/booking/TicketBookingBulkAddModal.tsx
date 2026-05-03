'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { deriveLegacyTicketBookingStatusFromAxes } from '@/lib/ticketBookingLegacyAxisMap';
import { getTicketBookingTimeSelectOptions } from '@/lib/ticketBookingTimeSelect';
import { X } from 'lucide-react';

function isMissingZelleConfirmationColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === 'PGRST204' &&
    typeof e.message === 'string' &&
    e.message.includes('zelle_confirmation_number')
  );
}

let omitZelleConfirmationInTicketBookingsPayload = false;

const DEFAULT_BULK_ADD_CATEGORY = 'antelope_canyon';
const DEFAULT_BULK_ADD_COMPANY = 'SEE CANYON';

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [yRaw, moRaw, dRaw] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(yRaw || 1970, (moRaw || 1) - 1, dRaw || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function enumerateInclusive(startYmd: string, endYmd: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return [];
  if (startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = startYmd;
  let guard = 0;
  while (cur <= endYmd && guard < 400) {
    out.push(cur);
    cur = addCalendarDaysYmd(cur, 1);
    guard += 1;
  }
  return out;
}

export type TicketBookingBulkAddModalProps = {
  open: boolean;
  onClose: () => void;
  /** 저장 후 목록 새로고침 등 */
  onSuccess?: () => void | Promise<void>;
  /** 투어 상세에서 열 때 현재 투어 ID, 전역 목록에서는 null */
  tourId: string | null;
  /** 제출자 이메일(미전달 시 로그인 사용자 이메일 사용) */
  defaultSubmittedBy?: string;
};

export default function TicketBookingBulkAddModal({
  open,
  onClose,
  onSuccess,
  tourId,
  defaultSubmittedBy = '',
}: TicketBookingBulkAddModalProps) {
  const t = useTranslations('booking.ticketBooking');
  const { user } = useAuth();
  const submitterEmail = useMemo(
    () => (defaultSubmittedBy?.trim() || user?.email || '').trim(),
    [defaultSubmittedBy, user?.email]
  );
  const [category, setCategory] = useState(DEFAULT_BULK_ADD_CATEGORY);
  const [company, setCompany] = useState(DEFAULT_BULK_ADD_COMPANY);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [time, setTime] = useState('');
  const [ea, setEa] = useState(1);
  const [expense, setExpense] = useState(0);
  const [income, setIncome] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const timeOptions = useMemo(() => getTicketBookingTimeSelectOptions(), []);

  useEffect(() => {
    if (!open) return;
    setCategory(DEFAULT_BULK_ADD_CATEGORY);
    setCompany(DEFAULT_BULK_ADD_COMPANY);
    setDateFrom('');
    setDateTo('');
    setTime('');
    setEa(1);
    setExpense(0);
    setIncome(0);
    setNote('');
    setSaving(false);
  }, [open]);

  const dates = useMemo(() => enumerateInclusive(dateFrom, dateTo), [dateFrom, dateTo]);
  const previewCount = dates.length;

  if (!open) return null;

  const buildRows = () => {
    const axesForInsert = {
      booking_status: 'requested' as const,
      vendor_status: 'pending' as const,
      change_status: 'none' as const,
      payment_status: 'not_due' as const,
      refund_status: 'none' as const,
      operation_status: 'none' as const,
    };
    const legacyForInsert = deriveLegacyTicketBookingStatusFromAxes(
      axesForInsert.booking_status,
      axesForInsert.vendor_status,
      axesForInsert.change_status,
      axesForInsert.payment_status,
      axesForInsert.refund_status,
      axesForInsert.operation_status
    );
    const tid = tourId && tourId.trim() !== '' ? tourId.trim() : null;
    return dates.map((check_in_date) => ({
      category: category.trim(),
      submitted_by: submitterEmail,
      check_in_date,
      time,
      company: company.trim(),
      ea,
      expense,
      income,
      payment_method: null as string | null,
      rn_number: null as string | null,
      invoice_number: null as string | null,
      ...(omitZelleConfirmationInTicketBookingsPayload ? {} : { zelle_confirmation_number: null }),
      tour_id: tid,
      reservation_id: null as string | null,
      note: note.trim() ? note.trim() : null,
      season: 'no',
      uploaded_file_urls: null as string[] | null,
      ...axesForInsert,
      status: legacyForInsert,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim()) {
      alert(t('bulkAddCategoryRequired'));
      return;
    }
    if (!company.trim()) {
      alert(t('bulkAddCompanyRequired'));
      return;
    }
    if (!submitterEmail) {
      alert(t('bulkAddSubmitterRequired'));
      return;
    }
    if (!dateFrom || !dateTo) {
      alert(t('bulkAddDatesRequired'));
      return;
    }
    if (previewCount === 0) {
      alert(t('bulkAddInvalidRange'));
      return;
    }
    if (!time) {
      alert(t('bulkAddTimeRequired'));
      return;
    }
    if (!Number.isFinite(ea) || ea < 1) {
      alert(t('bulkAddEaInvalid'));
      return;
    }

    const rows = buildRows();
    setSaving(true);
    try {
      let insertRes = await (supabase as any).from('ticket_bookings').insert(rows).select('id');
      if (isMissingZelleConfirmationColumnError(insertRes.error)) {
        omitZelleConfirmationInTicketBookingsPayload = true;
        const rowsNoZelle = rows.map(({ zelle_confirmation_number: _z, ...r }) => r);
        insertRes = await (supabase as any).from('ticket_bookings').insert(rowsNoZelle).select('id');
      }
      if (insertRes.error) throw insertRes.error;
      await onSuccess?.();
      alert(t('bulkAddSuccess', { count: previewCount }));
      onClose();
    } catch (err) {
      console.error('[TicketBookingBulkAdd]', err);
      alert(t('bulkAddError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center z-10">
          <h3 className="text-lg font-semibold text-gray-900">{t('bulkAddTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-500 hover:text-gray-800 p-1 rounded disabled:opacity-50"
            aria-label={t('cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-xs text-gray-600">{t('bulkAddHint')}</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('category')}</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              placeholder={t('categoryPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('supplier')}</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              placeholder={t('supplierPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('bulkAddDateFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('bulkAddDateTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('time')}</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">{t('selectTime')}</option>
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('quantity')}</label>
              <input
                type="number"
                min={1}
                value={ea}
                onChange={(e) => setEa(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('costUsd')}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={expense}
                onChange={(e) => setExpense(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('revenueUsd')}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={income}
              onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('memo')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              placeholder={t('memoPlaceholder')}
            />
          </div>

          <div className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
            {t('bulkAddPreview', { count: previewCount })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || previewCount === 0}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('bulkAddSaving') : t('bulkAddSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
