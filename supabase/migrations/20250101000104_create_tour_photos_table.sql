-- Create tour_photos table for storing tour photos
-- Migration: 20250101000104_create_tour_photos_table

CREATE TABLE IF NOT EXISTS tour_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
  uploaded_by VARCHAR(255) NOT NULL, -- 가이드 이메일
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage 경로
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false, -- 공개 여부
  share_token TEXT UNIQUE, -- 공유 토큰 (고객이 사진에 접근할 때 사용)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tour_photos_tour_id ON tour_photos(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_photos_reservation_id ON tour_photos(reservation_id);
CREATE INDEX IF NOT EXISTS idx_tour_photos_uploaded_by ON tour_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_tour_photos_share_token ON tour_photos(share_token);
CREATE INDEX IF NOT EXISTS idx_tour_photos_created_at ON tour_photos(created_at);

-- Enable RLS
ALTER TABLE tour_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Guides can view photos they uploaded" ON tour_photos
  FOR SELECT USING (uploaded_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can view all photos" ON tour_photos
  FOR SELECT USING (true);

CREATE POLICY "Guides can insert photos" ON tour_photos
  FOR INSERT WITH CHECK (uploaded_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can insert photos" ON tour_photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Guides can update their own photos" ON tour_photos
  FOR UPDATE USING (uploaded_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can update all photos" ON tour_photos
  FOR UPDATE USING (true);

CREATE POLICY "Guides can delete their own photos" ON tour_photos
  FOR DELETE USING (uploaded_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can delete all photos" ON tour_photos
  FOR DELETE USING (true);

-- Public access for shared photos (using share_token)
CREATE POLICY "Public access for shared photos" ON tour_photos
  FOR SELECT USING (is_public = true AND share_token IS NOT NULL);

-- Add comments
COMMENT ON TABLE tour_photos IS 'Stores photos uploaded by guides during tours';
COMMENT ON COLUMN tour_photos.tour_id IS 'Reference to the tour';
COMMENT ON COLUMN tour_photos.reservation_id IS 'Reference to specific reservation (optional)';
COMMENT ON COLUMN tour_photos.uploaded_by IS 'Email of the guide who uploaded the photo';
COMMENT ON COLUMN tour_photos.file_path IS 'Path to the file in Supabase Storage';
COMMENT ON COLUMN tour_photos.share_token IS 'Unique token for sharing photos with customers';
COMMENT ON COLUMN tour_photos.is_public IS 'Whether the photo is publicly accessible via share token';
