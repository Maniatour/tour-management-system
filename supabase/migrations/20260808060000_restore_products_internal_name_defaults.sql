-- Safety net: restore defaults for NOT NULL internal product name columns.
-- App create/update paths also set these explicitly from the admin name fields.
ALTER TABLE products
  ALTER COLUMN internal_name_ko SET DEFAULT '상품',
  ALTER COLUMN internal_name_en SET DEFAULT 'Product';
