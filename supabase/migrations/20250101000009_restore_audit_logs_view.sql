-- Restore audit_logs_view after product id type change
-- This migration recreates the audit_logs_view to work with TEXT product IDs

-- First, let's check the table structure and create a simple view
-- We'll create a basic view first, then enhance it based on actual table structure

-- Drop the view if it exists
DROP VIEW IF EXISTS audit_logs_view;

-- Create a basic audit_logs_view that works with the current table structure
-- Using safe column references and fallback values
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT 
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.old_values,
  al.new_values,
  al.changed_fields,
  al.user_id,
  al.user_email,
  al.ip_address,
  al.user_agent,
  al.created_at,
  CASE 
    WHEN al.table_name = 'products' THEN COALESCE(p.name, 'Product ' || al.record_id::text)
    WHEN al.table_name = 'customers' THEN COALESCE(c.name_ko, c.name_en, 'Customer ' || al.record_id::text)
    WHEN al.table_name = 'employees' THEN COALESCE(e.name_ko, e.name_en, 'Employee ' || al.record_id::text)
    WHEN al.table_name = 'options' THEN COALESCE(opt.name, 'Option ' || al.record_id::text)
    WHEN al.table_name = 'tours' THEN CONCAT('투어 #', al.record_id::text)
    WHEN al.table_name = 'reservations' THEN CONCAT('예약 #', al.record_id::text)
    WHEN al.table_name = 'channels' THEN COALESCE(ch.name, 'Channel ' || al.record_id::text)
    WHEN al.table_name = 'dynamic_pricing' THEN CONCAT('동적가격 #', al.record_id::text)
    ELSE al.record_id::text
  END as record_name
FROM audit_logs al
LEFT JOIN products p ON al.table_name = 'products' AND al.record_id::text = p.id
LEFT JOIN customers c ON al.table_name = 'customers' AND al.record_id = c.id
LEFT JOIN employees e ON al.table_name = 'employees' AND al.record_id = e.id
LEFT JOIN options opt ON al.table_name = 'options' AND al.record_id = opt.id
LEFT JOIN tours t ON al.table_name = 'tours' AND al.record_id = t.id
LEFT JOIN reservations r ON al.table_name = 'reservations' AND al.record_id = r.id
LEFT JOIN channels ch ON al.table_name = 'channels' AND al.record_id = ch.id
LEFT JOIN dynamic_pricing dp ON al.table_name = 'dynamic_pricing' AND al.record_id = dp.id
ORDER BY al.created_at DESC;
