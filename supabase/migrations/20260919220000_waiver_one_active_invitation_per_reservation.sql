-- One active waiver invitation per reservation.
-- Duplicate invites were created by concurrent email/admin minting; guests then
-- opened the emailed token while participants stayed on the first invite, so submit 404'd.

WITH candidates AS (
  SELECT
    i.id,
    i.reservation_id,
    i.created_at,
    EXISTS (
      SELECT 1
      FROM public.waiver_participants p
      WHERE p.reservation_id = i.reservation_id
        AND p.invitation_id = i.id
    ) AS has_participants,
    (
      SELECT max(e.created_at)
      FROM public.waiver_audit_events e
      WHERE e.reservation_id = i.reservation_id
        AND e.invitation_id = i.id
        AND e.event_type IN ('WAIVER_OPENED', 'DOCUMENT_VIEWED')
    ) AS last_opened_at
  FROM public.waiver_invitations i
  WHERE i.status = 'active'
),
ranked AS (
  SELECT
    id,
    reservation_id,
    ROW_NUMBER() OVER (
      PARTITION BY reservation_id
      ORDER BY
        last_opened_at DESC NULLS LAST,
        has_participants DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM candidates
)
UPDATE public.waiver_invitations w
SET status = 'revoked'
FROM ranked
WHERE w.id = ranked.id
  AND ranked.rn > 1;

UPDATE public.waiver_participants p
SET invitation_id = i.id
FROM public.waiver_invitations i
WHERE i.reservation_id = p.reservation_id
  AND i.status = 'active'
  AND p.invitation_id IS DISTINCT FROM i.id;

CREATE UNIQUE INDEX IF NOT EXISTS waiver_invitations_one_active_per_reservation
  ON public.waiver_invitations (reservation_id)
  WHERE status = 'active';
