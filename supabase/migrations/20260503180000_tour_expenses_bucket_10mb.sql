-- Raise tour-expenses storage limit so phone camera receipts (often >5MB) can upload.
-- Client still rejects absurdly large originals; optional compression handles edge cases.

UPDATE storage.buckets
SET file_size_limit = 10485760 -- 10 MiB
WHERE id = 'tour-expenses';
