-- Create product_faqs table for storing FAQ items
CREATE TABLE IF NOT EXISTS product_faqs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id ON product_faqs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_faqs_order_index ON product_faqs(product_id, order_index);

-- Enable RLS
ALTER TABLE product_faqs ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_faqs
CREATE POLICY "Anyone can view product FAQs" ON product_faqs
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert product FAQs" ON product_faqs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product FAQs" ON product_faqs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product FAQs" ON product_faqs
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_product_faqs_updated_at
    BEFORE UPDATE ON product_faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
