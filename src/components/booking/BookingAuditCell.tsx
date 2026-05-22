'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { BookingAuditFields } from '@/lib/bookingAudit';
import { formatBookingAuditedByLabel } from '@/lib/bookingAudit';

type BookingAuditCellProps = {
  audit: BookingAuditFields;
  compact?: boolean;
  disabled?: boolean;
  saving?: boolean;
  onToggle: (nextAudited: boolean) => void;
};

export function BookingAuditCell({
  audit,
  compact = false,
  disabled = false,
  saving = false,
  onToggle,
}: BookingAuditCellProps) {
  const t = useTranslations('booking.audit');
  const checked = Boolean(audit.audited);
  const byLabel = formatBookingAuditedByLabel(audit);
  const atLabel = audit.audited_at
    ? new Date(audit.audited_at).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const boxClass = checked
    ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
    : 'border-amber-200 bg-amber-50/80 text-amber-950';

  return (
    <div
      className={`rounded-md border px-1.5 py-1 ${boxClass} ${compact ? 'text-[10px]' : 'text-[11px]'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <label className="inline-flex cursor-pointer items-start gap-1.5 font-medium leading-tight">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
          checked={checked}
          disabled={disabled || saving}
          onChange={(e) => onToggle(e.target.checked)}
          title={t('checkboxTitle')}
        />
        <span className="min-w-0">
          <span className="block">{t('label')}</span>
          {checked ? (
            <span className={`block font-normal opacity-90 ${compact ? 'mt-0.5' : 'mt-0.5'}`}>
              {t('auditedBy', { name: byLabel })}
              {atLabel ? ` · ${atLabel}` : ''}
            </span>
          ) : (
            <span className="block font-normal opacity-80">{t('notYet')}</span>
          )}
          {saving ? (
            <span className="block text-[10px] font-normal text-gray-600">{t('saving')}</span>
          ) : null}
        </span>
      </label>
    </div>
  );
}
