-- Restore audit_logs_view after record_id type change
-- This migration recreates the audit_logs_view to work with TEXT record_id

-- Create a simple audit_logs_view that works with TEXT record_id
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
    WHEN al.table_name = 'products' THEN 'Product ' || al.record_id
    WHEN al.table_name = 'customers' THEN 'Customer ' || al.record_id
    WHEN al.table_name = 'employees' THEN 'Employee ' || al.record_id
    WHEN al.table_name = 'options' THEN 'Option ' || al.record_id
    WHEN al.table_name = 'tours' THEN '투어 #' || al.record_id
    WHEN al.table_name = 'reservations' THEN '예약 #' || al.record_id
    WHEN al.table_name = 'channels' THEN 'Channel ' || al.record_id
    WHEN al.table_name = 'dynamic_pricing' THEN '동적가격 #' || al.record_id
    ELSE al.record_id
  END as record_name
FROM audit_logs al
ORDER BY al.created_at DESC;
