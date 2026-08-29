-- Narration playback log for today's assigned tours (guide / assistant / driver).
-- Attached to tour reports by tour_id.

begin;

create table if not exists public.tour_narration_plays (
  id uuid primary key default gen_random_uuid(),
  tour_id text not null references public.tours(id) on delete cascade,
  material_id text not null,
  material_title text not null,
  file_path text not null,
  played_by_email text not null,
  played_as text not null check (played_as in ('guide', 'assistant', 'driver')),
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  play_count integer not null default 1,
  play_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tour_id, material_id, played_by_email)
);

comment on table public.tour_narration_plays is
  '가이드/어시/드라이버가 투어에서 나레이션을 재생한 기록. 투어 리포트에 tour_id로 첨부.';

create index if not exists tour_narration_plays_tour_id_idx
  on public.tour_narration_plays (tour_id);

create index if not exists tour_narration_plays_played_by_email_idx
  on public.tour_narration_plays (played_by_email);

alter table public.tour_narration_plays enable row level security;

grant select, insert, update on table public.tour_narration_plays to authenticated;

drop policy if exists tour_narration_plays_select on public.tour_narration_plays;
create policy tour_narration_plays_select
  on public.tour_narration_plays
  for select
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or lower(trim(played_by_email)) = public.current_email()
  );

drop policy if exists tour_narration_plays_insert on public.tour_narration_plays;
create policy tour_narration_plays_insert
  on public.tour_narration_plays
  for insert
  to authenticated
  with check (
    lower(trim(played_by_email)) = public.current_email()
    and exists (
      select 1
      from public.tours t
      where t.id = tour_id
        and (
          lower(trim(t.tour_guide_id)) = public.current_email()
          or lower(trim(coalesce(t.assistant_id, ''))) = public.current_email()
        )
    )
  );

drop policy if exists tour_narration_plays_update on public.tour_narration_plays;
create policy tour_narration_plays_update
  on public.tour_narration_plays
  for update
  to authenticated
  using (lower(trim(played_by_email)) = public.current_email())
  with check (lower(trim(played_by_email)) = public.current_email());

create or replace function public.record_tour_narration_play(
  p_tour_id text,
  p_material_id text,
  p_material_title text,
  p_file_path text,
  p_played_as text,
  p_play_seconds integer default 0,
  p_new_session boolean default true
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  em text := public.current_email();
  role_key text := lower(trim(coalesce(p_played_as, 'guide')));
begin
  if em is null or length(em) = 0 then
    raise exception 'not authenticated';
  end if;
  if role_key not in ('guide', 'assistant', 'driver') then
    role_key := 'guide';
  end if;

  insert into public.tour_narration_plays (
    tour_id,
    material_id,
    material_title,
    file_path,
    played_by_email,
    played_as,
    first_played_at,
    last_played_at,
    play_count,
    play_seconds
  ) values (
    p_tour_id,
    p_material_id,
    p_material_title,
    p_file_path,
    em,
    role_key,
    now(),
    now(),
    case when p_new_session then 1 else 0 end,
    greatest(coalesce(p_play_seconds, 0), 0)
  )
  on conflict (tour_id, material_id, played_by_email)
  do update set
    material_title = excluded.material_title,
    file_path = excluded.file_path,
    played_as = excluded.played_as,
    last_played_at = now(),
    play_count = public.tour_narration_plays.play_count + case when p_new_session then 1 else 0 end,
    play_seconds = public.tour_narration_plays.play_seconds + greatest(excluded.play_seconds, 0);
end;
$$;

comment on function public.record_tour_narration_play(text, text, text, text, text, integer, boolean) is
  '오늘 배정 투어의 나레이션 재생을 기록하거나 재생 시간을 더함.';

grant execute on function public.record_tour_narration_play(text, text, text, text, text, integer, boolean) to authenticated;

commit;
