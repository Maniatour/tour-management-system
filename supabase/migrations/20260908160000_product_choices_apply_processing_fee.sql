-- Per choice group: whether to add 5% card processing fee on customer card payments

ALTER TABLE public.product_choices
  ADD COLUMN IF NOT EXISTS apply_processing_fee boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_choices.apply_processing_fee IS
  'When true, add 5% card processing fee on this group''s choice amounts for customer card checkout';
