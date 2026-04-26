-- Prevent duplicate reservation IDs in the same tour when auto_create_or_update_tour appends on reservation insert/update.
CREATE OR REPLACE FUNCTION auto_create_or_update_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_sub_category TEXT;
    existing_tour_id TEXT;
    new_tour_id TEXT;
BEGIN
    SELECT sub_category INTO product_sub_category
    FROM products
    WHERE id = NEW.product_id;

    IF product_sub_category IN ('Mania Tour', 'Mania Service') THEN
        SELECT id INTO existing_tour_id
        FROM tours
        WHERE product_id = NEW.product_id
          AND tour_date = NEW.tour_date
        LIMIT 1;

        IF existing_tour_id IS NOT NULL THEN
            UPDATE tours
            SET reservation_ids = CASE
                WHEN reservation_ids IS NOT NULL AND reservation_ids @> ARRAY[NEW.id::text] THEN reservation_ids
                WHEN reservation_ids IS NULL THEN ARRAY[NEW.id::text]
                ELSE array_append(reservation_ids, NEW.id::text)
            END
            WHERE id = existing_tour_id;

            UPDATE reservations
            SET tour_id = existing_tour_id
            WHERE id = NEW.id;
        ELSE
            INSERT INTO tours (
                product_id,
                tour_date,
                reservation_ids,
                tour_status
            ) VALUES (
                NEW.product_id,
                NEW.tour_date,
                ARRAY[NEW.id::text],
                'scheduled'
            ) RETURNING id INTO new_tour_id;

            UPDATE reservations
            SET tour_id = new_tour_id
            WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
