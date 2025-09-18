-- Restore core tables: tour_expenses, product_details, product_schedules, product_details_common
begin;

-- Helper functions (idempotent)
-- 1) current_email(): JWT에서 이메일 추출
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  ));
$$;

-- 2) is_staff(email): team 테이블 또는 화이트리스트 기반 스태프 판별
create or replace function public.is_staff(p_email text)
returns boolean
language sql
stable
as $$
  select coalesce(
    exists(
      select 1 from public.team t
      where lower(t.email) = lower(p_email) and coalesce(t.is_active, true) = true
    )
    or lower(coalesce(p_email, '')) in ('info@maniatour.com','wooyong.shim09@gmail.com')
  , false);
$$;

-- 3) update_updated_at_column(): updated_at 자동 갱신 트리거 함수
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- tour_expenses
CREATE TABLE IF NOT EXISTS tour_expenses (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    tour_id TEXT REFERENCES tours(id) ON DELETE CASCADE,
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_to VARCHAR(255) NOT NULL,
    paid_for TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(100),
    note TEXT,
    tour_date DATE NOT NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    submitted_by VARCHAR(255) NOT NULL,
    image_url TEXT,
    file_path TEXT,
    audited_by VARCHAR(255),
    checked_by VARCHAR(255),
    checked_on TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_tour_id ON tour_expenses(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_tour_date ON tour_expenses(tour_date);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_submitted_by ON tour_expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_status ON tour_expenses(status);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_created_at ON tour_expenses(created_at);
ALTER TABLE tour_expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_select_all') THEN
    CREATE POLICY "tour_expenses_select_all" ON tour_expenses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_insert_staff') THEN
    CREATE POLICY "tour_expenses_insert_staff" ON tour_expenses FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_update_staff') THEN
    CREATE POLICY "tour_expenses_update_staff" ON tour_expenses FOR UPDATE USING (public.is_staff(public.current_email())) WITH CHECK (public.is_staff(public.current_email()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_delete_staff') THEN
    CREATE POLICY "tour_expenses_delete_staff" ON tour_expenses FOR DELETE USING (public.is_staff(public.current_email()));
  END IF;
  -- 추가 완화 정책: 동기화용 INSERT/UPDATE 모두 허용 (필요 시 나중에 제거 가능)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_insert_all') THEN
    CREATE POLICY "tour_expenses_insert_all" ON tour_expenses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_expenses' AND policyname = 'tour_expenses_update_all') THEN
    CREATE POLICY "tour_expenses_update_all" ON tour_expenses FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- product_details
CREATE TABLE IF NOT EXISTS product_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    slogan1 TEXT,
    slogan2 TEXT,
    slogan3 TEXT,
    description TEXT,
    included TEXT,
    not_included TEXT,
    pickup_drop_info TEXT,
    luggage_info TEXT,
    tour_operation_info TEXT,
    preparation_info TEXT,
    small_group_info TEXT,
    companion_info TEXT,
    exclusive_booking_info TEXT,
    cancellation_policy TEXT,
    chat_announcement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id)
);
CREATE INDEX IF NOT EXISTS idx_product_details_product_id ON product_details(product_id);
ALTER TABLE product_details ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_details' AND policyname = 'Allow all operations on product_details for authenticated users') THEN
    CREATE POLICY "Allow all operations on product_details for authenticated users" ON product_details FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_details' AND policyname = 'Allow public read access to product_details') THEN
    CREATE POLICY "Allow public read access to product_details" ON product_details FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_details_updated_at') THEN
    CREATE TRIGGER update_product_details_updated_at BEFORE UPDATE ON product_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- product_schedules
CREATE TABLE IF NOT EXISTS product_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    duration_minutes INTEGER,
    is_break BOOLEAN DEFAULT false,
    is_meal BOOLEAN DEFAULT false,
    is_transport BOOLEAN DEFAULT false,
    transport_type TEXT,
    transport_details TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_schedules_product_id ON product_schedules(product_id);
CREATE INDEX IF NOT EXISTS idx_product_schedules_day_number ON product_schedules(product_id, day_number);
ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Anyone can view product schedules') THEN
    CREATE POLICY "Anyone can view product schedules" ON product_schedules FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can insert product schedules') THEN
    CREATE POLICY "Authenticated users can insert product schedules" ON product_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can update product schedules') THEN
    CREATE POLICY "Authenticated users can update product schedules" ON product_schedules FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can delete product schedules') THEN
    CREATE POLICY "Authenticated users can delete product schedules" ON product_schedules FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_schedules_updated_at') THEN
    CREATE TRIGGER update_product_schedules_updated_at BEFORE UPDATE ON product_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- product_details_common
CREATE TABLE IF NOT EXISTS product_details_common (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sub_category TEXT NOT NULL UNIQUE,
    slogan1 TEXT,
    slogan2 TEXT,
    slogan3 TEXT,
    description TEXT,
    included TEXT,
    not_included TEXT,
    pickup_drop_info TEXT,
    luggage_info TEXT,
    tour_operation_info TEXT,
    preparation_info TEXT,
    small_group_info TEXT,
    companion_info TEXT,
    exclusive_booking_info TEXT,
    cancellation_policy TEXT,
    chat_announcement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_details_common_sub_category ON product_details_common(sub_category);
ALTER TABLE product_details_common ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_details_common' AND policyname = 'Allow all operations on product_details_common for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations on product_details_common for authenticated users" ON product_details_common FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_details_common_updated_at') THEN
    CREATE TRIGGER update_product_details_common_updated_at BEFORE UPDATE ON product_details_common FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- chat tables (rooms, messages, participants)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('guide', 'customer', 'system')),
  sender_name TEXT NOT NULL,
  sender_email VARCHAR(255),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('guide', 'customer')),
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_tour_id ON chat_rooms(tour_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_room_code ON chat_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_active ON chat_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_type ON chat_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room_id ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_participant_id ON chat_participants(participant_id);

-- RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_rooms' AND policyname = 'chat_rooms_select_all') THEN
    CREATE POLICY "chat_rooms_select_all" ON chat_rooms FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_rooms' AND policyname = 'chat_rooms_insert_staff') THEN
    CREATE POLICY "chat_rooms_insert_staff" ON chat_rooms FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_rooms' AND policyname = 'chat_rooms_update_staff') THEN
    CREATE POLICY "chat_rooms_update_staff" ON chat_rooms FOR UPDATE USING (public.is_staff(public.current_email())) WITH CHECK (public.is_staff(public.current_email()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_select_all') THEN
    CREATE POLICY "chat_messages_select_all" ON chat_messages FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_insert_staff') THEN
    CREATE POLICY "chat_messages_insert_staff" ON chat_messages FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_update_staff') THEN
    CREATE POLICY "chat_messages_update_staff" ON chat_messages FOR UPDATE USING (public.is_staff(public.current_email())) WITH CHECK (public.is_staff(public.current_email()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_participants' AND policyname = 'chat_participants_select_all') THEN
    CREATE POLICY "chat_participants_select_all" ON chat_participants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_participants' AND policyname = 'chat_participants_insert_staff') THEN
    CREATE POLICY "chat_participants_insert_staff" ON chat_participants FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
END $$;

-- chat announcements (templates, tour_announcements, chat_room_announcements)
CREATE TABLE IF NOT EXISTS chat_announcement_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_room_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_chat_announcement_templates_language ON chat_announcement_templates(language);
CREATE INDEX IF NOT EXISTS idx_chat_announcement_templates_active ON chat_announcement_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_announcements_tour_id ON tour_announcements(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_announcements_active ON tour_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_room_announcements_room_id ON chat_room_announcements(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_announcements_active ON chat_room_announcements(is_active);

-- RLS
ALTER TABLE chat_announcement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_announcements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_announcement_templates' AND policyname = 'chat_announcement_templates_all_authenticated') THEN
    CREATE POLICY "chat_announcement_templates_all_authenticated" ON chat_announcement_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_announcements' AND policyname = 'tour_announcements_all_authenticated') THEN
    CREATE POLICY "tour_announcements_all_authenticated" ON tour_announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_room_announcements' AND policyname = 'chat_room_announcements_all_authenticated') THEN
    CREATE POLICY "chat_room_announcements_all_authenticated" ON chat_room_announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- public read access for active announcements (customer side)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_announcement_templates' AND policyname = 'chat_announcement_templates_public_read_active') THEN
    CREATE POLICY "chat_announcement_templates_public_read_active" ON chat_announcement_templates FOR SELECT TO anon USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tour_announcements' AND policyname = 'tour_announcements_public_read_active') THEN
    CREATE POLICY "tour_announcements_public_read_active" ON tour_announcements FOR SELECT TO anon USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_room_announcements' AND policyname = 'chat_room_announcements_public_read_active') THEN
    CREATE POLICY "chat_room_announcements_public_read_active" ON chat_room_announcements FOR SELECT TO anon USING (is_active = true);
  END IF;
END $$;

-- triggers to update updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_announcement_templates_updated_at') THEN
    CREATE TRIGGER update_chat_announcement_templates_updated_at BEFORE UPDATE ON chat_announcement_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tour_announcements_updated_at') THEN
    CREATE TRIGGER update_tour_announcements_updated_at BEFORE UPDATE ON tour_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_room_announcements_updated_at') THEN
    CREATE TRIGGER update_chat_room_announcements_updated_at BEFORE UPDATE ON chat_room_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- expense categories & vendors
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_vendors (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- seed minimal values (idempotent)
INSERT INTO expense_categories (name) VALUES
  ('Meals'), ('Bento'), ('Gas'), ('Entrance Fee'), ('Antelope'), ('Hotel'), ('Maintenance'), ('Misc'), ('Rent'), ('Lotto'), ('Parking'), ('Rent (Personal Vehicle)'), ('Guide Bento')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_vendors (name) VALUES
  ('Shell Station'), ('McDonald''s'), ('Starbucks'), ('Walmart'), ('Target'), ('Antelope Canyon'), ('Grand Canyon'), ('Hotel Chain'), ('Local Restaurant'), ('Gas Station'), ('Parking Lot'), ('Maintenance Shop')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_vendors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_categories' AND policyname = 'expense_categories_select_all') THEN
    CREATE POLICY "expense_categories_select_all" ON expense_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_categories' AND policyname = 'expense_categories_insert_staff') THEN
    CREATE POLICY "expense_categories_insert_staff" ON expense_categories FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_vendors' AND policyname = 'expense_vendors_select_all') THEN
    CREATE POLICY "expense_vendors_select_all" ON expense_vendors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_vendors' AND policyname = 'expense_vendors_insert_staff') THEN
    CREATE POLICY "expense_vendors_insert_staff" ON expense_vendors FOR INSERT WITH CHECK (public.is_staff(public.current_email()));
  END IF;
END $$;

commit;
