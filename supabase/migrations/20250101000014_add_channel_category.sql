-- Add channel category field for better classification
-- This migration adds a category field to classify channels as Own, OTA, or Partner

-- First, add missing columns if they don't exist
ALTER TABLE channels ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'Direct';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS website VARCHAR(500);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS commission DECIMAL(5,2) DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS markup DECIMAL(5,2) DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS description TEXT;

-- Add category column to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'Own';

-- Add comment to explain the category field
COMMENT ON COLUMN channels.category IS 'Channel category: Own (자체), OTA (Online Travel Agency), Partner (제휴)';

-- Create an index on the category column for better performance
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category);

-- Add check constraint to ensure valid categories
ALTER TABLE channels ADD CONSTRAINT chk_channel_category 
  CHECK (category IN ('Own', 'OTA', 'Partner'));

-- Update the sample data to use meaningful channel IDs and categories
-- First, clear existing data
DELETE FROM channels;

-- Insert sample channels with proper categories
INSERT INTO channels (id, name, type, category, website, commission, base_price, markup, status, description) VALUES 
('OWN_DIRECT', '직접 방문', 'Direct', 'Own', '', 0.00, 0.00, 0.00, 'active', '고객이 직접 방문하여 예약하는 채널'),
('OTA_NAVER', '네이버 여행', 'OTA', 'OTA', 'https://travel.naver.com', 15.00, 0.00, 5.00, 'active', '네이버 여행 플랫폼을 통한 예약'),
('OTA_KAKAO', '카카오 여행', 'OTA', 'OTA', 'https://travel.kakao.com', 12.00, 0.00, 3.00, 'active', '카카오 여행 플랫폼을 통한 예약'),
('OTA_MYREALTRIP', '마이리얼트립', 'OTA', 'OTA', 'https://www.myrealtrip.com', 18.00, 0.00, 8.00, 'active', '마이리얼트립 플랫폼을 통한 예약'),
('PARTNER_HOTEL', '제휴 호텔', 'Partner', 'Partner', '', 10.00, 0.00, 2.00, 'active', '제휴 호텔을 통한 예약'),
('PARTNER_CAFE', '제휴 카페', 'Partner', 'Partner', '', 8.00, 0.00, 1.00, 'active', '제휴 카페를 통한 예약'),
('OWN_WEBSITE', '자체 웹사이트', 'Website', 'Own', 'https://company.com', 0.00, 0.00, 0.00, 'active', '회사 자체 웹사이트를 통한 예약'),
('OWN_PHONE', '전화 예약', 'Phone', 'Own', '', 0.00, 0.00, 0.00, 'active', '전화를 통한 직접 예약');
