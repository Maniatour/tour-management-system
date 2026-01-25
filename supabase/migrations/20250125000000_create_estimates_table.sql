-- Create estimates table for storing customer estimates
-- Migration: 20250125000000_create_estimates_table

CREATE TABLE IF NOT EXISTS estimates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  estimate_number VARCHAR(100) UNIQUE NOT NULL,
  estimate_date DATE NOT NULL,
  
  -- Estimate data (JSONB)
  estimate_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- PDF file
  pdf_url TEXT,
  pdf_file_path TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected
  
  -- Email tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by TEXT,
  email_id TEXT, -- Resend email ID
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_date ON estimates(estimate_date);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);

-- Enable RLS
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, can be restricted later)
DROP POLICY IF EXISTS "Allow all access to estimates" ON estimates;
CREATE POLICY "Allow all access to estimates" ON estimates
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();
