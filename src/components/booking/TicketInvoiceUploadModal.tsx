'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  matchInvoiceLinesToBookings,
  normalizeBookingDateToIso,
  normalizeTimeToHHmm,
  parseTicketInvoiceOcrText,
  parseUsSlashDateToIso,
  type MatchResult,
  type ParsedTicketInvoice,
  type TicketBookingLike,
} from '@/utils/ticketInvoiceParse';

function tourProductLabelKo(
  product: { name_ko?: string; name?: string; name_en?: string } | undefined
): string {
  if (!product) return '투어';
  return (product.name_ko || product.name || product.name_en || '투어').trim();
}

type Props = {
  open: boolean;
  onClose: () => void;
  bookings: TicketBookingLike[];
  onApplied: (updates: { id: string; invoice_number: string }[]) => void;
  /** 해당일 부킹 표에서 RN# 수정 후 DB 반영 시 목록 상태 동기화 */
  onRnUpdated?: (u: { id: string; rn_number: string }) => void;
  /** 해당일 부킹 표에서 메모(note) 수정 후 DB 반영 시 목록 상태 동기화 */
  onNoteUpdated?: (u: { id: string; note: string | null }) => void;
};

export default function TicketInvoiceUploadModal({
  open,
  onClose,
  onApplied,
  bookings,
  onRnUpdated,
  onNoteUpdated,
}: Props) {
  const [ocrPhase, setOcrPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState('');
  const [invoiceDateDraft, setInvoiceDateDraft] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  /** RN# / 메모 입력 중 로컬 값 (키: booking id) */
  const [rnDrafts, setRnDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  /** 해당 행에서 RN 또는 메모 저장 중 */
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);

  const companies = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings) {
      const c = (b.company ?? '').trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const parsedEffective: ParsedTicketInvoice = useMemo(() => {
    const base = parseTicketInvoiceOcrText(ocrText);
    const inv = invoiceNumberDraft.trim() || base.invoiceNumber;
    let dateIso = base.invoiceDateIso;
    const manual = invoiceDateDraft.trim();
    if (manual) {
      const iso = manual.includes('/') ? parseUsSlashDateToIso(manual) : manual;
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) dateIso = iso;
    }
    return {
      ...base,
      invoiceNumber: inv,
      invoiceDateIso: dateIso,
    };
  }, [ocrText, invoiceNumberDraft, invoiceDateDraft]);

  const matchResults: MatchResult[] = useMemo(
    () =>
      matchInvoiceLinesToBookings(parsedEffective, bookings, {
        company: companyFilter || undefined,
      }),
    [parsedEffective, bookings, companyFilter]
  );

  /** 인보이스 날짜(체크인일) + 회사 필터와 같은 당일 티켓 부킹 (매칭 참고용) */
  const sameDayBookings = useMemo(() => {
    const d = parsedEffective.invoiceDateIso;
    if (!d) return [];
    const cf = companyFilter.trim();
    const rows = bookings.filter((b) => {
      if (cf && (b.company ?? '').trim() !== cf) return false;
      return normalizeBookingDateToIso(b.check_in_date) === d;
    });
    return [...rows].sort((a, b) => {
      const ta = normalizeTimeToHHmm(a.time);
      const tb = normalizeTimeToHHmm(b.time);
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a.rn_number ?? '').localeCompare(String(b.rn_number ?? ''));
    });
  }, [bookings, parsedEffective.invoiceDateIso, companyFilter]);

  const okMatches = matchResults.filter((r) => r.kind === 'ok');
  const blockedByExisting = okMatches.filter(
    (r) =>
      r.kind === 'ok' &&
      !!r.booking.invoice_number?.trim() &&
      r.booking.invoice_number.trim() !== parsedEffective.invoiceNumber.trim()
  );

  const resetForm = useCallback(() => {
    setOcrPhase('idle');
    setOcrError(null);
    setOcrText('');
    setInvoiceNumberDraft('');
    setInvoiceDateDraft('');
    setCompanyFilter('');
    setOverwriteExisting(false);
    setRnDrafts({});
    setNoteDrafts({});
    setRowSavingId(null);
  }, []);

  useEffect(() => {
    if (open) {
      setRnDrafts({});
      setNoteDrafts({});
      setRowSavingId(null);
    }
  }, [open]);

  const saveRnIfChanged = useCallback(
    async (b: TicketBookingLike, inputValue: string) => {
      const next = inputValue.trim();
      const prev = (b.rn_number ?? '').trim();
      if (next === prev) {
        setRnDrafts((d) => {
          if (!(b.id in d)) return d;
          const x = { ...d };
          delete x[b.id];
          return x;
        });
        return;
      }
      setRowSavingId(b.id);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('ticket_bookings').update({ rn_number: next }).eq('id', b.id);
        if (error) throw error;
        onRnUpdated?.({ id: b.id, rn_number: next });
        setRnDrafts((d) => {
          const x = { ...d };
          delete x[b.id];
          return x;
        });
      } catch (e) {
        console.error('ticket_bookings rn_number update:', e);
        alert('RN# 저장 중 오류가 발생했습니다.');
      } finally {
        setRowSavingId(null);
      }
    },
    [onRnUpdated]
  );

  const saveNoteIfChanged = useCallback(
    async (b: TicketBookingLike, inputValue: string) => {
      const next = inputValue.trim();
      const prev = (b.note ?? '').trim();
      if (next === prev) {
        setNoteDrafts((d) => {
          if (!(b.id in d)) return d;
          const x = { ...d };
          delete x[b.id];
          return x;
        });
        return;
      }
      const dbNote = next || null;
      setRowSavingId(b.id);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('ticket_bookings').update({ note: dbNote }).eq('id', b.id);
        if (error) throw error;
        onNoteUpdated?.({ id: b.id, note: dbNote });
        setNoteDrafts((d) => {
          const x = { ...d };
          delete x[b.id];
          return x;
        });
      } catch (e) {
        console.error('ticket_bookings note update:', e);
        alert('메모 저장 중 오류가 발생했습니다.');
      } finally {
        setRowSavingId(null);
      }
    },
    [onNoteUpdated]
  );

  const handleClose = () => {
    if (applyBusy || ocrPhase === 'running' || rowSavingId) return;
    resetForm();
    onClose();
  };

  const runOcrOnFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setOcrError('이미지 파일(JPEG, PNG 등)만 지원합니다. PDF는 스크린샷으로 저장 후 올려 주세요.');
      setOcrPhase('error');
      return;
    }
    setOcrPhase('running');
    setOcrError(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();
      setOcrText(text);
      const parsed = parseTicketInvoiceOcrText(text);
      if (parsed.invoiceNumber) setInvoiceNumberDraft(parsed.invoiceNumber);
      if (parsed.invoiceDateIso) setInvoiceDateDraft(parsed.invoiceDateIso);
      setOcrPhase('done');
    } catch (e) {
      console.error('ticket invoice OCR:', e);
      setOcrError(e instanceof Error ? e.message : '텍스트 추출에 실패했습니다.');
      setOcrPhase('error');
    }
  }, []);

  /** 클립보드에서 이미지 파일 추출 (스크린샷 붙여넣기 등, files 비어 있을 때 items 사용) */
  const imageFileFromClipboard = useCallback((cd: DataTransfer | null): File | null => {
    if (!cd) return null;
    const fromFiles = Array.from(cd.files ?? []).find((f) => f.type.startsWith('image/'));
    if (fromFiles) return fromFiles;
    for (const item of Array.from(cd.items ?? [])) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPaste = (e: ClipboardEvent) => {
      if (applyBusy || ocrPhase === 'running') return;

      const imageFile = imageFileFromClipboard(e.clipboardData);
      // 텍스트만 붙여넣기는 여기서 return → 기본 동작 유지(추출 텍스트 영역 등)
      if (!imageFile) return;

      e.preventDefault();
      void runOcrOnFile(imageFile);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, applyBusy, ocrPhase, runOcrOnFile, imageFileFromClipboard]);

  const applyInvoiceNumbers = async () => {
    const inv = parsedEffective.invoiceNumber.trim();
    if (!inv) {
      alert('Invoice 번호를 입력하거나 OCR로 인식되게 해 주세요.');
      return;
    }
    if (!parsedEffective.invoiceDateIso) {
      alert('인보이스 날짜(체크인 날짜와 동일한 YYYY-MM-DD)를 확인해 주세요.');
      return;
    }

    const toUpdate = okMatches.filter((r) => {
      if (r.kind !== 'ok') return false;
      const existing = r.booking.invoice_number?.trim();
      if (existing && existing !== inv && !overwriteExisting) return false;
      return true;
    });

    if (toUpdate.length === 0) {
      if (blockedByExisting.length > 0 && !overwriteExisting) {
        alert('이미 다른 Invoice #가 있는 행이 있습니다. 덮어쓰기에 체크하거나 수동으로 정리해 주세요.');
      } else {
        alert('적용할 매칭된 행이 없습니다. 날짜·시간·RN#·수량·회사 필터를 확인해 주세요.');
      }
      return;
    }

    const ambiguous = matchResults.filter((r) => r.kind === 'ambiguous');
    if (ambiguous.length > 0) {
      const ok = window.confirm(
        `동일 조건으로 여러 행이 있는 줄이 ${ambiguous.length}개 있습니다. 이 상태로 매칭된 행만 저장할까요?`
      );
      if (!ok) return;
    }

    setApplyBusy(true);
    try {
      const updates: { id: string; invoice_number: string }[] = [];
      for (const r of toUpdate) {
        if (r.kind !== 'ok') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('ticket_bookings')
          .update({ invoice_number: inv })
          .eq('id', r.booking.id);
        if (error) throw error;
        updates.push({ id: r.booking.id, invoice_number: inv });
      }
      onApplied(updates);
      resetForm();
      onClose();
    } catch (e) {
      console.error('apply invoice from upload:', e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setApplyBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-invoice-upload-title"
      onClick={() => handleClose()}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="ticket-invoice-upload-title" className="text-lg font-semibold text-gray-900">
            인보이스 업로드 · Invoice # 자동 입력
          </h3>
          <button
            type="button"
            onClick={() => handleClose()}
            disabled={applyBusy || ocrPhase === 'running' || !!rowSavingId}
            className="text-2xl leading-none text-gray-500 hover:text-gray-800 disabled:opacity-40"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-600 leading-relaxed">
          인보이스 이미지에서 텍스트를 읽은 뒤, 설명란의{' '}
          <span className="font-medium text-gray-800">시간 · RN# · 수량</span> 한 줄씩과 동일한{' '}
          <span className="font-medium text-gray-800">체크인 날짜</span>의 부킹을 찾아 Invoice #을 넣습니다. (예:{' '}
          <code className="rounded bg-gray-100 px-1">13:45 325869700 12</code>)
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-gray-700">회사(선택)</label>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            disabled={applyBusy || ocrPhase === 'running'}
          >
            <option value="">전체 회사</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50/40">
            <FileUp className="mb-2 h-8 w-8 text-gray-400" />
            <span className="font-medium text-gray-800">인보이스 이미지 선택</span>
            <span className="mt-1 text-xs text-gray-500">
              JPEG, PNG, GIF, WebP (첫 인식에 시간이 걸릴 수 있습니다) · 모달이 열린 상태에서{' '}
              <kbd className="rounded border border-gray-300 bg-white px-1 font-mono text-[10px]">Ctrl</kbd>+
              <kbd className="rounded border border-gray-300 bg-white px-1 font-mono text-[10px]">V</kbd>로
              클립보드 이미지 붙여넣기 가능
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              disabled={applyBusy || ocrPhase === 'running'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void runOcrOnFile(f);
              }}
            />
          </label>
        </div>

        {ocrPhase === 'running' ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            이미지에서 텍스트 추출 중…
          </div>
        ) : null}
        {ocrError ? <p className="mt-3 text-sm text-red-600">{ocrError}</p> : null}

        <div className="mt-5 space-y-2">
          <label className="text-xs font-medium text-gray-700">추출·수정 텍스트 (필요 시 직접 붙여넣기)</label>
          <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            placeholder="OCR 결과가 부정확하면 여기에 인보이스 본문을 붙여넣고 수정할 수 있습니다."
            disabled={applyBusy}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-700">Invoice #</label>
            <input
              type="text"
              value={invoiceNumberDraft}
              onChange={(e) => setInvoiceNumberDraft(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={applyBusy}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">인보이스 날짜 (YYYY-MM-DD 또는 MM/DD/YYYY)</label>
            <input
              type="text"
              value={invoiceDateDraft}
              onChange={(e) => setInvoiceDateDraft(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="예: 2025-12-22"
              disabled={applyBusy}
            />
          </div>
        </div>

        {parsedEffective.rawNotes ? (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            {parsedEffective.rawNotes}
          </p>
        ) : null}

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800">파싱된 줄 (시간 · RN# · 수량)</h4>
          {parsedEffective.lines.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">아직 없습니다.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm font-mono text-gray-800">
              {parsedEffective.lines.map((l) => (
                <li key={`${l.timeNorm}-${l.rn}-${l.qty}`}>
                  {normalizeTimeToHHmm(l.time)} · RN {l.rn} · 수량 {l.qty}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800">부킹 매칭 결과</h4>
          <p className="text-xs text-gray-500 mt-1">
            체크인 날짜 = 인보이스 날짜, 시간·RN#·수량이 모두 일치할 때만 적용됩니다.
          </p>
          <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto text-sm">
            {matchResults.map((r, i) => {
              if (r.kind === 'ok') {
                const ex = r.booking.invoice_number?.trim();
                const conflict = ex && ex !== parsedEffective.invoiceNumber.trim();
                return (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 ${
                      conflict ? 'border-amber-200 bg-amber-50/80' : 'border-green-200 bg-green-50/60'
                    }`}
                  >
                    <span className="font-medium text-green-900">매칭</span> — {r.booking.company} · RN{' '}
                    {r.line.rn} · {r.line.timeNorm} · {r.line.qty}명
                    {conflict ? (
                      <span className="block text-xs text-amber-900 mt-1">
                        기존 Invoice # {ex} → {overwriteExisting ? '덮어쓰기 예정' : '건너뜀(덮어쓰기 체크 필요)'}
                      </span>
                    ) : null}
                  </li>
                );
              }
              if (r.kind === 'ambiguous') {
                return (
                  <li key={i} className="rounded-md border border-orange-200 bg-orange-50/60 px-3 py-2">
                    <span className="font-medium text-orange-900">중복 후보 {r.bookings.length}건</span> — RN{' '}
                    {r.line.rn} · {r.line.timeNorm} · {r.line.qty}명 (회사 필터로 좁히거나 부킹을 정리해 주세요)
                  </li>
                );
              }
              return (
                <li key={i} className="rounded-md border border-red-100 bg-red-50/50 px-3 py-2">
                  <span className="font-medium text-red-800">없음</span> — RN {r.line.rn} · {r.line.timeNorm} ·{' '}
                  {r.line.qty}명
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800">해당일 티켓 부킹</h4>
          <p className="text-xs text-gray-500 mt-1">
            {parsedEffective.invoiceDateIso ? (
              <>
                체크인일이{' '}
                <span className="font-medium text-gray-700">{parsedEffective.invoiceDateIso}</span>
                인 부킹
                {companyFilter.trim() ? (
                  <>
                    {' '}
                    · 회사 <span className="font-medium text-gray-700">{companyFilter.trim()}</span>
                  </>
                ) : (
                  ' (전체 회사)'
                )}
                {sameDayBookings.length > 0 ? ` · ${sameDayBookings.length}건` : ''}
                {sameDayBookings.length > 0 ? (
                  <span className="block mt-1 text-gray-500">
                    RN#·메모는 수정 후 포커스를 벗어나면 저장됩니다. (RN#는 Enter로도 저장)
                  </span>
                ) : null}
              </>
            ) : (
              <>인보이스 날짜가 정해지면 같은 날짜의 부킹이 여기에 표시됩니다.</>
            )}
          </p>
          {!parsedEffective.invoiceDateIso ? null : sameDayBookings.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">조건에 맞는 부킹이 없습니다.</p>
          ) : (
            <div className="mt-2 overflow-x-auto border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">회사</th>
                    <th className="px-2 py-1.5 text-left font-medium min-w-[7rem]">투어연결</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">투어총인원</th>
                    <th className="px-2 py-1.5 text-left font-medium">시간</th>
                    <th className="px-2 py-1.5 text-left font-medium">RN#</th>
                    <th className="px-2 py-1.5 text-right font-medium">수량</th>
                    <th className="px-2 py-1.5 text-left font-medium">Invoice #</th>
                    <th className="px-2 py-1.5 text-left font-medium min-w-[8rem]">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sameDayBookings.map((b) => {
                    const inv = b.invoice_number?.trim();
                    const rowBusy = rowSavingId === b.id;
                    const fieldDisabled = applyBusy || ocrPhase === 'running' || rowBusy;
                    return (
                      <tr key={b.id} className="bg-white hover:bg-gray-50/80">
                        <td className="px-2 py-1.5 text-gray-900">{b.company || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-800">
                          {b.tour_id && b.tours ? (
                            <span className="text-xs leading-snug" title={b.tour_id}>
                              {tourProductLabelKo(b.tours.products)}{' '}
                              <span className="text-gray-500">{b.tours.tour_date || ''}</span>
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs">미연결</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                          {b.tour_id && b.tours ? `${b.tours.total_people ?? 0}명` : '—'}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-800">{normalizeTimeToHHmm(b.time)}</td>
                        <td className="px-2 py-1.5 align-middle">
                          <input
                            type="text"
                            value={rnDrafts[b.id] ?? b.rn_number ?? ''}
                            onChange={(e) =>
                              setRnDrafts((d) => ({
                                ...d,
                                [b.id]: e.target.value,
                              }))
                            }
                            onBlur={(e) => void saveRnIfChanged(b, e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            disabled={fieldDisabled}
                            className="w-full min-w-[6rem] rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                            aria-label={`RN# ${b.company ?? b.id}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{b.ea}</td>
                        <td className="px-2 py-1.5 text-gray-600">{inv || '—'}</td>
                        <td className="px-2 py-1.5 align-top min-w-[10rem] max-w-[14rem]">
                          <textarea
                            rows={2}
                            value={noteDrafts[b.id] ?? b.note ?? ''}
                            onChange={(e) =>
                              setNoteDrafts((d) => ({
                                ...d,
                                [b.id]: e.target.value,
                              }))
                            }
                            onBlur={(e) => void saveNoteIfChanged(b, e.target.value)}
                            disabled={fieldDisabled}
                            className="w-full resize-y rounded border border-gray-200 bg-white px-1.5 py-1 text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                            aria-label={`메모 ${b.company ?? b.id}`}
                          />
                          {rowBusy ? (
                            <span className="mt-0.5 block text-[10px] text-gray-400">저장 중…</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            disabled={applyBusy}
          />
          이미 Invoice #가 있어도 위 번호로 덮어쓰기
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => handleClose()}
            disabled={applyBusy || ocrPhase === 'running' || !!rowSavingId}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void applyInvoiceNumbers()}
            disabled={
              applyBusy || ocrPhase === 'running' || !!rowSavingId || !parsedEffective.invoiceNumber.trim()
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {applyBusy ? '저장 중…' : 'Invoice # 적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
