-- Mania Tour customer-facing travel guide / blog articles

CREATE TABLE IF NOT EXISTS public.travel_guide_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title_en text NOT NULL,
  title_ko text NOT NULL,
  excerpt_en text NOT NULL DEFAULT '',
  excerpt_ko text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_ko text NOT NULL DEFAULT '',
  category_en text NOT NULL DEFAULT 'Travel Tips',
  category_ko text NOT NULL DEFAULT '여행 팁',
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT travel_guide_articles_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_travel_guide_articles_public_list
  ON public.travel_guide_articles (is_published, sort_order DESC, published_at DESC);

COMMENT ON TABLE public.travel_guide_articles IS
  'Customer-facing Travel Guide & Tips blog articles for Mania Tour / Kovegas.';

ALTER TABLE public.travel_guide_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "travel_guide_articles_select_published" ON public.travel_guide_articles;
CREATE POLICY "travel_guide_articles_select_published"
  ON public.travel_guide_articles FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "travel_guide_articles_staff_select" ON public.travel_guide_articles;
CREATE POLICY "travel_guide_articles_staff_select"
  ON public.travel_guide_articles FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "travel_guide_articles_staff_insert" ON public.travel_guide_articles;
CREATE POLICY "travel_guide_articles_staff_insert"
  ON public.travel_guide_articles FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "travel_guide_articles_staff_update" ON public.travel_guide_articles;
CREATE POLICY "travel_guide_articles_staff_update"
  ON public.travel_guide_articles FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "travel_guide_articles_staff_delete" ON public.travel_guide_articles;
CREATE POLICY "travel_guide_articles_staff_delete"
  ON public.travel_guide_articles FOR DELETE TO authenticated
  USING (public.is_staff());

DROP TRIGGER IF EXISTS update_travel_guide_articles_updated_at ON public.travel_guide_articles;
CREATE TRIGGER update_travel_guide_articles_updated_at
  BEFORE UPDATE ON public.travel_guide_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.travel_guide_articles (
  slug,
  title_en,
  title_ko,
  excerpt_en,
  excerpt_ko,
  body_en,
  body_ko,
  category_en,
  category_ko,
  cover_image_url,
  sort_order,
  is_published,
  published_at
) VALUES
  (
    'top-10-restaurants-las-vegas',
    'Top 10 Restaurants in Las Vegas',
    'Top 10 Restaurants in Las Vegas',
    'Where to eat before or after your Southwest tour — local favorites and must-try spots.',
    'Southwest 투어 전후에 꼭 가볼 만한 라스베가스 맛집을 소개합니다.',
    E'## Top 10 Restaurants in Las Vegas\n\nPlanning a tour with Mania Tour? Save room for these local favorites.\n\n1. **Off-Strip gems** — Skip the long Strip lines and try neighborhood spots locals love.\n2. **Late-night eats** — Perfect after a sunrise Grand Canyon return.\n3. **Family-friendly picks** — Great for groups before hotel pickup.\n\n*More details coming soon — check back for our full dining guide.*',
    E'## 라스베가스 맛집 Top 10\n\n매니아투어와 함께하는 여행 전후, 현지인이 추천하는 맛집을 만나보세요.\n\n*상세 가이드는 곧 업데이트됩니다.*',
    'Food & Drink',
    'Food & Drink',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
    50,
    true,
    now()
  ),
  (
    'best-time-visit-antelope-canyon',
    'Best Time to Visit Antelope Canyon',
    'Best Time to Visit Antelope Canyon',
    'Seasonal light, crowd levels, and booking tips for Upper and Lower Antelope Canyon.',
    '앤텔롭 캐년 방문 시기, 빛의 각도, 예약 팁을 정리했습니다.',
    E'## Best Time to Visit Antelope Canyon\n\nMidday beams are famous, but timing affects photos and comfort.\n\n- **Spring & Fall** — Mild weather and strong light beams.\n- **Summer** — Book early; midday slots fill fast.\n- **Winter** — Fewer crowds; softer light.\n\nTravel with a licensed operator for safe, timed entry.',
    E'## 앤텔롭 캐년 방문 최적 시기\n\n유명한 빛줄기를 보려면 시간대와 계절이 중요합니다.\n\n*상세 가이드는 곧 업데이트됩니다.*',
    'Travel Tips',
    'Travel Tips',
    'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=800&q=80',
    40,
    true,
    now()
  ),
  (
    'what-to-pack-desert-tour',
    'What to Pack for a Desert Tour',
    'What to Pack for a Desert Tour',
    'Essentials for Grand Canyon, Antelope Canyon, and long desert day trips from Las Vegas.',
    '그랜드캐년·앤텔롭·사막 당일 투어에 필요한 준비물을 정리했습니다.',
    E'## What to Pack for a Desert Tour\n\n- Layered clothing (desert mornings are cold)\n- Sunscreen and hat\n- Refillable water bottle\n- Comfortable walking shoes\n- Phone charger / power bank\n- Snacks for long drive days',
    E'## 사막 투어 준비물\n\n- 겹쳐 입을 수 있는 옷\n- 선크림·모자\n- 물병\n- 편한 신발\n\n*상세 체크리스트는 곧 업데이트됩니다.*',
    'Travel Tips',
    'Travel Tips',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    30,
    true,
    now()
  ),
  (
    'grand-canyon-south-rim-vs-west-rim',
    'Grand Canyon: South Rim vs West Rim',
    'Grand Canyon: South Rim vs West Rim',
    'Compare views, drive time from Las Vegas, and which rim fits your trip style.',
    '라스베가스에서 출발해 남림과 서림 중 어디가 더 맞는지 비교합니다.',
    E'## South Rim vs West Rim\n\n**South Rim** — Classic viewpoints, longer drive, best for sunrise tours.\n\n**West Rim** — Closer to Vegas, Skywalk option, shorter day trips.\n\nMania Tour offers small-group experiences to both regions.',
    E'## 남림 vs 서림\n\n**남림** — 클래식 전망, 일출 투어에 적합\n\n**서림** — 라스베가스에서 더 가깝고 당일 일정에 유리\n\n*상세 비교는 곧 업데이트됩니다.*',
    'Destinations',
    'Destinations',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
    20,
    true,
    now()
  ),
  (
    'las-vegas-to-grand-canyon-guide',
    'Las Vegas to Grand Canyon: Complete Guide',
    'Las Vegas to Grand Canyon: Complete Guide',
    'Drive times, tour types, what to expect, and how to choose the right Grand Canyon day trip.',
    '라스베가스에서 그랜드캐년까지 이동 시간, 투어 종류, 선택 가이드.',
    E'## Las Vegas to Grand Canyon\n\nMost day tours depart early for sunrise or midday viewpoints.\n\n- **Small group** — More flexibility and photo stops\n- **Hotel pickup** — Strip and downtown options\n- **Included** — Park fees vary by tour; check your listing\n\nBook early for peak season dates.',
    E'## 라스베가스 → 그랜드캐년 가이드\n\n일출 투어는 이른 출발, 소그룹 투어는 사진 스팟이 더 많습니다.\n\n*전체 가이드는 곧 업데이트됩니다.*',
    'Destinations',
    'Destinations',
    'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=800&q=80',
    10,
    true,
    now()
  )
ON CONFLICT (slug) DO NOTHING;
