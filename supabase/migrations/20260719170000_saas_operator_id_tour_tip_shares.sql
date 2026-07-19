-- Phase 6b.5: operator_id on tour_tip_shares + tour_tip_share_ops
-- Parent backfill from tours.operator_id; child from parent share.
-- UNIQUE(tour_id) stays (tour already belongs to one operator).

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- tour_tip_shares
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_tip_shares'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.tour_tip_shares ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.tour_tip_shares tts
  SET operator_id = t.operator_id
  FROM public.tours t
  WHERE tts.tour_id = t.id
    AND tts.operator_id IS NULL
    AND t.operator_id IS NOT NULL;

  UPDATE public.tour_tip_shares
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.tour_tip_shares
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.tour_tip_shares
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.tour_tip_shares
      ADD CONSTRAINT tour_tip_shares_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- tour_tip_share_ops
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_tip_share_ops'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.tour_tip_share_ops ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.tour_tip_share_ops ops
  SET operator_id = tts.operator_id
  FROM public.tour_tip_shares tts
  WHERE ops.tour_tip_share_id = tts.id
    AND ops.operator_id IS NULL
    AND tts.operator_id IS NOT NULL;

  UPDATE public.tour_tip_share_ops
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.tour_tip_share_ops
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.tour_tip_share_ops
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.tour_tip_share_ops
      ADD CONSTRAINT tour_tip_share_ops_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_tip_shares_operator_id
  ON public.tour_tip_shares (operator_id);

CREATE INDEX IF NOT EXISTS idx_tour_tip_share_ops_operator_id
  ON public.tour_tip_share_ops (operator_id);

COMMENT ON COLUMN public.tour_tip_shares.operator_id IS
  'SaaS tenant owning this tip share. Backfilled from tours.operator_id. Phase 6b.5.';

COMMENT ON COLUMN public.tour_tip_share_ops.operator_id IS
  'SaaS tenant owning this OP tip-share row. Backfilled from tour_tip_shares.operator_id.';
