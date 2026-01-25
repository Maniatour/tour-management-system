-- Create customer-documents storage bucket for storing customer documents (invoices, estimates)
-- Migration: 20250125000001_create_customer_documents_storage

-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for customer-documents bucket
-- Allow authenticated users to upload documents
CREATE POLICY "Allow authenticated users to upload customer documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'customer-documents' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to view documents
CREATE POLICY "Allow authenticated users to view customer documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'customer-documents' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete documents
CREATE POLICY "Allow authenticated users to delete customer documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'customer-documents' AND
    auth.role() = 'authenticated'
  );
