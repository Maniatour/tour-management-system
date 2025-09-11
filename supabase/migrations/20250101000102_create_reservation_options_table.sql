-- Create reservation_options table for Google Sheets compatibility
-- Migration: 20250101000102_create_reservation_options_table

CREATE TABLE IF NOT EXISTS reservation_options (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  ea INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservation_options_reservation_id ON reservation_options(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_option_id ON reservation_options(option_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_status ON reservation_options(status);

-- Enable RLS
ALTER TABLE reservation_options ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Enable all access for reservation_options" ON reservation_options FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE reservation_options IS 'Stores individual option selections for reservations, compatible with Google Sheets structure';
COMMENT ON COLUMN reservation_options.id IS 'Primary key (text type for Google Sheets compatibility)';
COMMENT ON COLUMN reservation_options.reservation_id IS 'Reference to reservation';
COMMENT ON COLUMN reservation_options.option_id IS 'Option identifier';
COMMENT ON COLUMN reservation_options.ea IS 'Quantity/amount';
COMMENT ON COLUMN reservation_options.price IS 'Price for this option';
COMMENT ON COLUMN reservation_options.status IS 'Status of the option selection';
