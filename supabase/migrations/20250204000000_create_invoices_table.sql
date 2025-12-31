-- Create invoices table for storing customer invoices
-- Migration: 20250204000000_create_invoices_table

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  
  -- Invoice items (JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Pricing breakdown
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  apply_tax BOOLEAN DEFAULT false,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_reason TEXT,
  apply_discount BOOLEAN DEFAULT false,
  processing_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  apply_processing_fee BOOLEAN DEFAULT false,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Exchange rate
  exchange_rate DECIMAL(10,2),
  
  -- Notes
  notes TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, cancelled
  
  -- Email tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by TEXT,
  email_id TEXT, -- Resend email ID
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Create indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, can be restricted later)
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
CREATE POLICY "Allow all access to invoices" ON invoices
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

