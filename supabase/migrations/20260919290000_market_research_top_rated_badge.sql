-- Add Top rated to the OTA badge catalog for existing operators.
begin;

insert into public.market_research_badges (operator_id, badge_id, label_ko, label_en, sort_order, is_preset)
select id, 'top_rated', 'Top rated', 'Top rated', 2, true
from public.operators
on conflict (operator_id, badge_id) do nothing;

commit;
