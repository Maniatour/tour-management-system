-- Update tour_expenses schema to make paid_to nullable and add common values
-- Migration: 202509160014_update_tour_expenses_schema

begin;

-- Make paid_to nullable
ALTER TABLE tour_expenses ALTER COLUMN paid_to DROP NOT NULL;

-- Add common paid_for categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common paid_for categories
INSERT INTO expense_categories (name) VALUES
    ('Meals'),
    ('Bento'),
    ('Gas'),
    ('Entrance Fee'),
    ('Antelope'),
    ('Hotel'),
    ('Maintenance'),
    ('Misc'),
    ('Rent'),
    ('Lotto'),
    ('Parking'),
    ('Rent (Personal Vehicle)'),
    ('Guide Bento')
ON CONFLICT (name) DO NOTHING;

-- Add common paid_to vendors
CREATE TABLE IF NOT EXISTS expense_vendors (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some common vendors (you can add more based on your data)
INSERT INTO expense_vendors (name) VALUES
    ('Shell Station'),
    ('McDonald''s'),
    ('Starbucks'),
    ('Walmart'),
    ('Target'),
    ('Antelope Canyon'),
    ('Grand Canyon'),
    ('Hotel Chain'),
    ('Local Restaurant'),
    ('Gas Station'),
    ('Parking Lot'),
    ('Maintenance Shop')
ON CONFLICT (name) DO NOTHING;

-- RLS policies for new tables
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_vendors ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read categories and vendors
CREATE POLICY "expense_categories_select_all" ON expense_categories
    FOR SELECT
    USING (true);

CREATE POLICY "expense_vendors_select_all" ON expense_vendors
    FOR SELECT
    USING (true);

-- Allow staff to insert new categories and vendors
CREATE POLICY "expense_categories_insert_staff" ON expense_categories
    FOR INSERT
    WITH CHECK (
        public.is_staff(public.current_email())
    );

CREATE POLICY "expense_vendors_insert_staff" ON expense_vendors
    FOR INSERT
    WITH CHECK (
        public.is_staff(public.current_email())
    );

commit;
