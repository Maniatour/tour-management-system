/**
 * 인보이스 OCR/붙여넣기 텍스트에서 Invoice 번호·날짜·(시간, RN#, 수량) 줄을 파싱하고
 * ticket_bookings 행과 매칭합니다.
 */

export type ParsedInvoiceLine = {
  time: string;
  /** HH:mm */
  timeNorm: string;
  rn: string;
  qty: number;
};

export type ParsedTicketInvoice = {
  invoiceNumber: string;
  /** YYYY-MM-DD */
  invoiceDateIso: string | null;
  lines: ParsedInvoiceLine[];
  rawNotes?: string;
};

export type TicketBookingLike = {
  id: string;
  check_in_date: string;
  time: string;
  rn_number: string;
  ea: number;
  company: string;
  status?: string;
  invoice_number?: string | null;
  /** ticket_bookings.note */
  note?: string | null;
  tour_id?: string | null;
  tours?: {
    tour_date: string;
    total_people?: number;
    products?: {
      name?: string;
      name_ko?: string;
      name_en?: string;
    };
  };
};

export function normalizeBookingDateToIso(checkIn: string): string | null {
  if (!checkIn?.trim()) return null;
  const s = checkIn.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(checkIn);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeTimeToHHmm(time: string): string {
  const s = (time ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return s;
  const h = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${h}:${m[2]}`;
}

/** M/D/YYYY 또는 MM/DD/YYYY → YYYY-MM-DD */
export function parseUsSlashDateToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mo = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** OCR이 INVOICE # 를 VOICES / INVOICES 등으로 읽은 표 헤더인지 */
function isInvoiceSummaryTableHeader(line: string): boolean {
  const t = line.trim();
  if (!/\bDATE\b/i.test(t) || !/\bTOTAL\b/i.test(t)) return false;
  if (/\bVOICES\b/i.test(t) || /\bINVOICES\b/i.test(t)) return true;
  if (/\bINVOICE\s*#?\s*DATE\b/i.test(t)) return true;
  if (/\bINVOICE\s+DATE\b/i.test(t) && /\bTOTAL\b/i.test(t)) return true;
  return false;
}

/**
 * 헤더 다음 줄: `26983 12/21/2025 $1,020.00 ...` → Invoice #, 인보이스 날짜(첫 MM/DD/YYYY)
 */
function parseInvoiceSummaryDataRow(line: string): { invoiceNumber: string; dateSlash: string } | null {
  const t = line.trim();
  const m = t.match(/^(\d[\d,]{2,})\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (!m) return null;
  return { invoiceNumber: m[1].replace(/,/g, ''), dateSlash: m[2] };
}

/**
 * OCR 본문에서 Invoice #, 인보이스 날짜, "시간 RN 수량" 형태 줄을 뽑습니다.
 */
export function parseTicketInvoiceOcrText(raw: string): ParsedTicketInvoice {
  const text = raw.replace(/\u00a0/g, ' ');
  const lines = text.split(/\r?\n/);

  let invoiceNumber = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/INVOICE\s*#+\s*[:\s]*(\d[\d\s,]*)/i);
    if (m) {
      invoiceNumber = m[1].replace(/[\s,]/g, '');
      break;
    }
    const m2 = line.match(/INVOICE\s*#?\s*$/i);
    if (m2 && lines[i + 1]) {
      const next = lines[i + 1].match(/^(\d{3,})$/);
      if (next) {
        invoiceNumber = next[1];
        break;
      }
    }
  }

  let invoiceDateIso: string | null = null;
  const dateCandidates: string[] = [];
  for (const line of lines) {
    const dm = line.match(
      /\b(?:DATE|INVOICE\s*DATE)\b\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
    );
    if (dm) {
      const iso = parseUsSlashDateToIso(dm[1]);
      if (iso) {
        invoiceDateIso = iso;
        break;
      }
    }
    const loose = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
    if (loose) dateCandidates.push(...loose);
  }
  if (!invoiceDateIso && dateCandidates.length > 0) {
    invoiceDateIso = parseUsSlashDateToIso(dateCandidates[0]) ?? null;
  }

  // INVOICE # 행이 VOICES/INVOICES 로 깨진 표 형식: 헤더 다음 줄에서 번호·날짜
  if (!invoiceNumber || !invoiceDateIso) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (!isInvoiceSummaryTableHeader(lines[i])) continue;
      const parsedRow = parseInvoiceSummaryDataRow(lines[i + 1] ?? '');
      if (!parsedRow) continue;
      if (!invoiceNumber) invoiceNumber = parsedRow.invoiceNumber;
      if (!invoiceDateIso) {
        invoiceDateIso = parseUsSlashDateToIso(parsedRow.dateSlash) ?? null;
      }
      break;
    }
  }

  const lineItems: ParsedInvoiceLine[] = [];
  const seen = new Set<string>();
  const globalRe = /(\d{1,2}:\d{2})\s+(\d{6,})\s+(\d+)\b/g;
  let gm: RegExpExecArray | null;
  while ((gm = globalRe.exec(text)) !== null) {
    const timeNorm = normalizeTimeToHHmm(gm[1]);
    const rn = gm[2];
    const qty = parseInt(gm[3], 10);
    if (!Number.isFinite(qty) || qty < 1) continue;
    const key = `${timeNorm}\0${rn}\0${qty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lineItems.push({ time: gm[1], timeNorm, rn, qty });
  }

  const notes: string[] = [];
  if (!invoiceNumber) notes.push('Invoice 번호를 찾지 못했습니다. 아래에서 직접 입력해 주세요.');
  if (!invoiceDateIso) notes.push('인보이스 날짜(MM/DD/YYYY)를 찾지 못했습니다. 직접 입력해 주세요.');
  if (lineItems.length === 0)
    notes.push('설명란의 "시간 RN# 수량" 줄을 찾지 못했습니다. 텍스트를 확인하거나 수동으로 추가해 주세요.');

  return {
    invoiceNumber,
    invoiceDateIso,
    lines: lineItems,
    rawNotes: notes.length ? notes.join(' ') : undefined,
  };
}

export type MatchResult =
  | {
      kind: 'ok';
      line: ParsedInvoiceLine;
      booking: TicketBookingLike;
    }
  | {
      kind: 'ambiguous';
      line: ParsedInvoiceLine;
      bookings: TicketBookingLike[];
    }
  | {
      kind: 'none';
      line: ParsedInvoiceLine;
    };

export function matchInvoiceLinesToBookings(
  parsed: Pick<ParsedTicketInvoice, 'invoiceDateIso' | 'lines'>,
  bookings: TicketBookingLike[],
  options?: { company?: string }
): MatchResult[] {
  const dateIso = parsed.invoiceDateIso;
  const companyFilter = options?.company?.trim();
  const pool = companyFilter
    ? bookings.filter((b) => invoiceCompanyNorm(b.company) === companyFilter)
    : bookings;

  const results: MatchResult[] = [];
  for (const line of parsed.lines) {
    const candidates = pool.filter((b) => {
      const bDate = normalizeBookingDateToIso(b.check_in_date);
      if (dateIso && bDate !== dateIso) return false;
      if ((b.rn_number ?? '').trim() !== line.rn) return false;
      if (Number(b.ea) !== line.qty) return false;
      const bt = normalizeTimeToHHmm(b.time);
      if (bt !== line.timeNorm) return false;
      return true;
    });

    if (candidates.length === 1) {
      results.push({ kind: 'ok', line, booking: candidates[0] });
    } else if (candidates.length > 1) {
      results.push({ kind: 'ambiguous', line, bookings: candidates });
    } else {
      results.push({ kind: 'none', line });
    }
  }

  return results;
}

function invoiceCompanyNorm(s: string | null | undefined): string {
  return (s ?? '').trim();
}
