-- cash_transactions: 메모(notes)를 설명(description)에 합친 뒤 notes를 비움.
-- 이미 설명에 같은 내용이 있으면 중복 추가하지 않음.

UPDATE public.cash_transactions
SET
  description = CASE
    WHEN notes IS NULL OR btrim(notes) = '' THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN btrim(notes)
    WHEN position(btrim(notes) IN btrim(description)) > 0 THEN description
    ELSE btrim(description) || E'\n' || btrim(notes)
  END,
  notes = NULL,
  updated_at = now()
WHERE notes IS NOT NULL AND btrim(notes) <> '';

UPDATE public.cash_transactions
SET notes = NULL
WHERE notes IS NOT NULL AND btrim(notes) = '';
