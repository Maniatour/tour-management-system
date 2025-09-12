-- Create product_schedules table for storing tour itineraries
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_schedules_product_id ON product_schedules(product_id);
CREATE INDEX IF NOT EXISTS idx_product_schedules_day_number ON product_schedules(product_id, day_number);

-- Enable RLS
ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_schedules
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Anyone can view product schedules') THEN
        CREATE POLICY "Anyone can view product schedules" ON product_schedules
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can insert product schedules') THEN
        CREATE POLICY "Authenticated users can insert product schedules" ON product_schedules
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can update product schedules') THEN
        CREATE POLICY "Authenticated users can update product schedules" ON product_schedules
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_schedules' AND policyname = 'Authenticated users can delete product schedules') THEN
        CREATE POLICY "Authenticated users can delete product schedules" ON product_schedules
            FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_schedules_updated_at') THEN
        CREATE TRIGGER update_product_schedules_updated_at
            BEFORE UPDATE ON product_schedules
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
