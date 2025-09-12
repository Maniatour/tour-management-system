-- Create product_media table for storing media files
CREATE TABLE IF NOT EXISTS product_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'document'
    file_size INTEGER,
    mime_type VARCHAR(100),
    alt_text TEXT,
    caption TEXT,
    order_index INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_file_type ON product_media(product_id, file_type);
CREATE INDEX IF NOT EXISTS idx_product_media_order_index ON product_media(product_id, order_index);

-- Enable RLS
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_media
CREATE POLICY "Anyone can view product media" ON product_media
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert product media" ON product_media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product media" ON product_media
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product media" ON product_media
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
