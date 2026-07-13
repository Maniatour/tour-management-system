-- Product detail page recommendation rails.
CREATE TABLE IF NOT EXISTS public.product_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL CHECK (
    section_key IN (
      'traveler_viewed',
      'recommended_for_you',
      'bought_together'
    )
  ),
  recommended_product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_recommendations_not_self CHECK (source_product_id <> recommended_product_id),
  CONSTRAINT product_recommendations_unique_item UNIQUE (
    source_product_id,
    section_key,
    recommended_product_id
  )
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_source_section
  ON public.product_recommendations (source_product_id, section_key, order_index);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_recommended_product
  ON public.product_recommendations (recommended_product_id);

ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active product recommendations"
  ON public.product_recommendations
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Authenticated users can manage product recommendations"
  ON public.product_recommendations
  FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
