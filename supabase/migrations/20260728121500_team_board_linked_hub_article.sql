-- Todo / 업무 / 전달사항 → 운영 허브 메뉴얼 연결
alter table public.op_todos
  add column if not exists linked_hub_article_id uuid references public.company_knowledge_articles (id) on delete set null;

alter table public.tasks
  add column if not exists linked_hub_article_id uuid references public.company_knowledge_articles (id) on delete set null;

alter table public.team_announcements
  add column if not exists linked_hub_article_id uuid references public.company_knowledge_articles (id) on delete set null;

create index if not exists op_todos_linked_hub_article_id_idx
  on public.op_todos (linked_hub_article_id)
  where linked_hub_article_id is not null;

create index if not exists tasks_linked_hub_article_id_idx
  on public.tasks (linked_hub_article_id)
  where linked_hub_article_id is not null;

create index if not exists team_announcements_linked_hub_article_id_idx
  on public.team_announcements (linked_hub_article_id)
  where linked_hub_article_id is not null;

comment on column public.op_todos.linked_hub_article_id is '운영 허브(company_knowledge_articles) 메뉴얼 연결';
comment on column public.tasks.linked_hub_article_id is '운영 허브(company_knowledge_articles) 메뉴얼 연결';
comment on column public.team_announcements.linked_hub_article_id is '운영 허브(company_knowledge_articles) 메뉴얼 연결';
