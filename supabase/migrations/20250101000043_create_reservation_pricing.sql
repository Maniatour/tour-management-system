-- Create reservation_pricing table for storing pricing information
-- Migration: 20250101000043_create_reservation_pricing

-- Drop existing table if exists
DROP TABLE IF EXISTS reservation_pricing CASCADE;

-- Create reservation_pricing table
CREATE TABLE reservation_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  
  -- Product Price
  adult_product_price DECIMAL(10,2) DEFAULT 0.00,
  child_product_price DECIMAL(10,2) DEFAULT 0.00,
  infant_product_price DECIMAL(10,2) DEFAULT 0.00,
  product_price_total DECIMAL(10,2) DEFAULT 0.00,
  
  -- Required Options (선택된 옵션 ID와 가격을 함께 저장)
  required_options JSONB DEFAULT '{}',
  required_option_total DECIMAL(10,2) DEFAULT 0.00,
  
  -- Subtotal
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  
  -- Discount and Additional Costs
  coupon_code TEXT,
  coupon_discount DECIMAL(10,2) DEFAULT 0.00,
  additional_discount DECIMAL(10,2) DEFAULT 0.00,
  additional_cost DECIMAL(10,2) DEFAULT 0.00,
  card_fee DECIMAL(10,2) DEFAULT 0.00,
  tax DECIMAL(10,2) DEFAULT 0.00,
  prepayment_cost DECIMAL(10,2) DEFAULT 0.00,
  prepayment_tip DECIMAL(10,2) DEFAULT 0.00,
  
  -- Optional Options (여러 선택 옵션을 JSON으로 저장)
  selected_options JSONB DEFAULT '{}',
  option_total DECIMAL(10,2) DEFAULT 0.00,
  
  -- Private Tour
  is_private_tour BOOLEAN DEFAULT FALSE,
  private_tour_additional_cost DECIMAL(10,2) DEFAULT 0.00,
  
  -- Final Pricing
  total_price DECIMAL(10,2) DEFAULT 0.00,
  deposit_amount DECIMAL(10,2) DEFAULT 0.00,
  balance_amount DECIMAL(10,2) DEFAULT 0.00,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_reservation_pricing_reservation_id ON reservation_pricing(reservation_id);

-- Enable Row Level Security
ALTER TABLE reservation_pricing ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public access to reservation_pricing" ON reservation_pricing FOR ALL USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_reservation_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reservation_pricing_updated_at_trigger
  BEFORE UPDATE ON reservation_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_reservation_pricing_updated_at();

-- Add comment
COMMENT ON TABLE reservation_pricing IS 'Reservation pricing information including product prices, options, discounts, and final totals';
