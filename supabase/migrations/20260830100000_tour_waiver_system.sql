-- Tour waiver & electronic signature system
-- Per-participant records. Does not replace reservations or customers.

CREATE TABLE IF NOT EXISTS public.waiver_documents (
  code text PRIMARY KEY,
  operator_name text NOT NULL DEFAULT '',
  display_name text NOT NULL,
  governing_language text NOT NULL DEFAULT 'en',
  source_type text NOT NULL CHECK (source_type IN ('COMPANY_FORM', 'OFFICIAL_OPERATOR_FORM')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'NOT_CONFIGURED')),
  signature_mode text NOT NULL CHECK (signature_mode IN ('SHARED_SESSION_SIGNATURE', 'SEPARATE_SIGNATURE_REQUIRED')),
  requires_printed_copy boolean NOT NULL DEFAULT true,
  original_form_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waiver_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code text NOT NULL REFERENCES public.waiver_documents(code),
  version text NOT NULL,
  effective_date date NOT NULL,
  governing_text text NOT NULL,
  governing_text_hash text NOT NULL,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS waiver_document_versions_one_current
  ON public.waiver_document_versions (document_code)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS public.product_required_waivers (
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  document_code text NOT NULL REFERENCES public.waiver_documents(code),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, document_code)
);

CREATE TABLE IF NOT EXISTS public.waiver_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  operator_id uuid,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  last_sent_at timestamptz,
  last_sent_via text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiver_invitations_reservation
  ON public.waiver_invitations (reservation_id);

CREATE TABLE IF NOT EXISTS public.waiver_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES public.waiver_invitations(id) ON DELETE SET NULL,
  slot_index integer NOT NULL,
  placeholder_label text NOT NULL,
  participant_type text CHECK (participant_type IN ('ADULT', 'MINOR')),
  full_legal_name text,
  date_of_birth date,
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  identity_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_waiver_participants_reservation
  ON public.waiver_participants (reservation_id);

CREATE TABLE IF NOT EXISTS public.waiver_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waiver_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.waiver_participants(id),
  invitation_id uuid REFERENCES public.waiver_invitations(id),
  selected_language text NOT NULL,
  signature_id uuid NOT NULL REFERENCES public.waiver_signatures(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiver_submissions_participant
  ON public.waiver_submissions (participant_id);

CREATE TABLE IF NOT EXISTS public.waiver_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_waiver_id text NOT NULL UNIQUE,
  submission_id uuid NOT NULL REFERENCES public.waiver_submissions(id),
  reservation_id text NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.waiver_participants(id),
  participant_full_legal_name text NOT NULL,
  participant_type text NOT NULL CHECK (participant_type IN ('ADULT', 'MINOR')),
  document_code text NOT NULL REFERENCES public.waiver_documents(code),
  operator_name text NOT NULL,
  waiver_version text NOT NULL,
  waiver_text_hash text NOT NULL,
  governing_text_snapshot text NOT NULL,
  displayed_translation_snapshot text,
  selected_language text NOT NULL,
  signature_id uuid NOT NULL REFERENCES public.waiver_signatures(id),
  acknowledgments jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  status text NOT NULL DEFAULT 'signed' CHECK (status IN ('signed', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by text,
  replacement_acceptance_id uuid REFERENCES public.waiver_acceptances(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waiver_acceptances_one_active
  ON public.waiver_acceptances (participant_id, document_code)
  WHERE status = 'signed';

CREATE INDEX IF NOT EXISTS idx_waiver_acceptances_reservation
  ON public.waiver_acceptances (reservation_id);
CREATE INDEX IF NOT EXISTS idx_waiver_acceptances_public_id
  ON public.waiver_acceptances (public_waiver_id);

CREATE TABLE IF NOT EXISTS public.waiver_guardian_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.waiver_submissions(id),
  guardian_full_legal_name text NOT NULL,
  relationship_to_minor text NOT NULL,
  signature_id uuid NOT NULL REFERENCES public.waiver_signatures(id),
  minor_participant_ids uuid[] NOT NULL,
  acknowledgment_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waiver_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text,
  participant_id uuid,
  invitation_id uuid,
  acceptance_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiver_audit_reservation
  ON public.waiver_audit_events (reservation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.waiver_pdf_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id uuid REFERENCES public.waiver_acceptances(id),
  reservation_id text REFERENCES public.reservations(id) ON DELETE CASCADE,
  packet_type text NOT NULL,
  pdf_storage_key text,
  pdf_hash text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waiver_guide_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  tour_id text,
  document_code text NOT NULL REFERENCES public.waiver_documents(code),
  guide_name text,
  guide_phone text,
  signature_id uuid REFERENCES public.waiver_signatures(id),
  signed_at timestamptz,
  signed_by_staff_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, document_code)
);

INSERT INTO public.waiver_documents (
  code, operator_name, display_name, governing_language, source_type, status, signature_mode, requires_printed_copy, original_form_template
) VALUES
  ('LAS_VEGAS_MANIA', 'LAS VEGAS MANIA TOUR', 'Las Vegas Mania Tour Waiver & Assumption of Risk', 'en', 'COMPANY_FORM', 'ACTIVE', 'SHARED_SESSION_SIGNATURE', true, 'las_vegas_mania_letter'),
  ('ANTELOPE_CANYON_X', 'Taadidiin Tours L.L.C.', 'Antelope Canyon X / Taadidiin Tours Waiver', 'en', 'OFFICIAL_OPERATOR_FORM', 'ACTIVE', 'SHARED_SESSION_SIGNATURE', true, 'taadidiin_two_page'),
  ('LOWER_ANTELOPE', '', 'Lower Antelope Canyon Waiver', 'en', 'OFFICIAL_OPERATOR_FORM', 'NOT_CONFIGURED', 'SEPARATE_SIGNATURE_REQUIRED', true, null)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.product_required_waivers (product_id, document_code)
SELECT p.id, 'LAS_VEGAS_MANIA'
FROM public.products p
ON CONFLICT DO NOTHING;

INSERT INTO public.product_required_waivers (product_id, document_code)
SELECT p.id, 'ANTELOPE_CANYON_X'
FROM public.products p
WHERE
  coalesce(array_to_string(p.tags, ' '), '') ~* 'antelope_x|canyon.?x'
  OR coalesce(p.name, '') ~* 'antelope\s*(canyon\s*)?x|canyon\s*x|앤텔롭.*엑스|엑스.*앤텔롭'
  OR coalesce(p.name_en, '') ~* 'antelope\s*(canyon\s*)?x|canyon\s*x'
  OR coalesce(p.name_ko, '') ~* '앤텔롭.*엑스|엑스.*앤텔롭|캐년\s*x'
ON CONFLICT DO NOTHING;

INSERT INTO public.product_required_waivers (product_id, document_code)
SELECT p.id, 'LOWER_ANTELOPE'
FROM public.products p
WHERE
  coalesce(array_to_string(p.tags, ' '), '') ~* 'lower_antelope'
  OR coalesce(p.name, '') ~* 'lower\s*antelope|로워\s*앤텔롭|로어\s*앤텔롭'
  OR coalesce(p.name_en, '') ~* 'lower\s*antelope'
  OR coalesce(p.name_ko, '') ~* '로워\s*앤텔롭|로어\s*앤텔롭'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.waiver_acceptances_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Signed waiver records cannot be deleted';
  END IF;

  IF OLD.status = 'voided' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Voided waivers cannot be restored';
  END IF;

  IF NEW.governing_text_snapshot IS DISTINCT FROM OLD.governing_text_snapshot
     OR NEW.displayed_translation_snapshot IS DISTINCT FROM OLD.displayed_translation_snapshot
     OR NEW.waiver_text_hash IS DISTINCT FROM OLD.waiver_text_hash
     OR NEW.waiver_version IS DISTINCT FROM OLD.waiver_version
     OR NEW.document_code IS DISTINCT FROM OLD.document_code
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.signature_id IS DISTINCT FROM OLD.signature_id
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
     OR NEW.acknowledgments IS DISTINCT FROM OLD.acknowledgments
     OR NEW.selected_language IS DISTINCT FROM OLD.selected_language
     OR NEW.participant_full_legal_name IS DISTINCT FROM OLD.participant_full_legal_name
     OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
     OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
  THEN
    RAISE EXCEPTION 'Signed waiver legal snapshot is immutable';
  END IF;

  IF OLD.status = 'signed' AND NEW.status = 'voided' THEN
    RETURN NEW;
  END IF;

  IF NEW.void_reason IS DISTINCT FROM OLD.void_reason
     OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
     OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
     OR NEW.replacement_acceptance_id IS DISTINCT FROM OLD.replacement_acceptance_id
     OR NEW.status IS DISTINCT FROM OLD.status
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Signed waiver records cannot be edited';
END;
$$;

DROP TRIGGER IF EXISTS trg_waiver_acceptances_immutable ON public.waiver_acceptances;
CREATE TRIGGER trg_waiver_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.waiver_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION public.waiver_acceptances_immutable();

CREATE OR REPLACE FUNCTION public.waiver_signatures_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Waiver signatures cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_waiver_signatures_immutable ON public.waiver_signatures;
CREATE TRIGGER trg_waiver_signatures_immutable
  BEFORE UPDATE OR DELETE ON public.waiver_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.waiver_signatures_immutable();

ALTER TABLE public.waiver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_required_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_guardian_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_pdf_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_guide_signatures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.waiver_documents FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_document_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.product_required_waivers FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_invitations FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_participants FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_signatures FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_submissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_acceptances FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_guardian_authorizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_audit_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_pdf_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.waiver_guide_signatures FROM anon, authenticated;

GRANT SELECT ON TABLE public.waiver_documents TO authenticated;
GRANT SELECT ON TABLE public.waiver_document_versions TO authenticated;
GRANT SELECT ON TABLE public.product_required_waivers TO authenticated;
GRANT SELECT ON TABLE public.waiver_invitations TO authenticated;
GRANT SELECT ON TABLE public.waiver_participants TO authenticated;
GRANT SELECT ON TABLE public.waiver_submissions TO authenticated;
GRANT SELECT ON TABLE public.waiver_acceptances TO authenticated;
GRANT SELECT ON TABLE public.waiver_guardian_authorizations TO authenticated;
GRANT SELECT ON TABLE public.waiver_audit_events TO authenticated;
GRANT SELECT ON TABLE public.waiver_pdf_records TO authenticated;
GRANT SELECT ON TABLE public.waiver_guide_signatures TO authenticated;

CREATE POLICY waiver_documents_staff_select ON public.waiver_documents
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_document_versions_staff_select ON public.waiver_document_versions
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY product_required_waivers_staff_select ON public.product_required_waivers
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_invitations_staff_select ON public.waiver_invitations
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_participants_staff_select ON public.waiver_participants
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_submissions_staff_select ON public.waiver_submissions
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_acceptances_staff_select ON public.waiver_acceptances
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_guardian_staff_select ON public.waiver_guardian_authorizations
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_audit_staff_select ON public.waiver_audit_events
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_pdf_staff_select ON public.waiver_pdf_records
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY waiver_guide_sig_staff_select ON public.waiver_guide_signatures
  FOR SELECT TO authenticated USING (public.is_staff());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('waiver-signatures', 'waiver-signatures', false, 2097152, ARRAY['image/png']::text[]),
  ('waiver-pdfs', 'waiver-pdfs', false, 20971520, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO NOTHING;
