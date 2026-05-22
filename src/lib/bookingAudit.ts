import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingAuditTable = 'ticket_bookings' | 'tour_hotel_bookings';

export type BookingAuditFields = {
  audited?: boolean | null;
  audited_at?: string | null;
  audited_by_email?: string | null;
  audited_by_name?: string | null;
  audited_by_nick_name?: string | null;
};

export type TeamAuditProfile = {
  email: string;
  name: string;
  nickName: string;
};

export function formatBookingAuditedByLabel(row: BookingAuditFields): string {
  const nick = row.audited_by_nick_name?.trim();
  const name = row.audited_by_name?.trim();
  const email = row.audited_by_email?.trim();
  return nick || name || email || '—';
}

export function buildBookingAuditPatch(
  nextAudited: boolean,
  actor: TeamAuditProfile
): Required<
  Pick<
    BookingAuditFields,
    'audited' | 'audited_at' | 'audited_by_email' | 'audited_by_name' | 'audited_by_nick_name'
  >
> {
  const auditedAtIso = nextAudited ? new Date().toISOString() : null;
  return nextAudited
    ? {
        audited: true,
        audited_at: auditedAtIso,
        audited_by_email: actor.email,
        audited_by_name: actor.name,
        audited_by_nick_name: actor.nickName,
      }
    : {
        audited: false,
        audited_at: null,
        audited_by_email: null,
        audited_by_name: null,
        audited_by_nick_name: null,
      };
}

export async function fetchTeamAuditProfile(
  supabase: SupabaseClient,
  email: string,
  fallbackName?: string | null
): Promise<TeamAuditProfile> {
  const normalized = email.trim().toLowerCase();
  const { data } = await supabase
    .from('team')
    .select('email, name_ko, name_en, nick_name')
    .ilike('email', normalized)
    .maybeSingle();

  const name =
    data?.name_ko?.trim() || data?.name_en?.trim() || fallbackName?.trim() || normalized;
  const nickName = data?.nick_name?.trim() || name;

  return { email: normalized, name, nickName };
}

export async function updateBookingAudit(
  supabase: SupabaseClient,
  table: BookingAuditTable,
  bookingId: string,
  patch: ReturnType<typeof buildBookingAuditPatch>
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(table).update(patch).eq('id', bookingId);
  return { error: error ? new Error(error.message) : null };
}
