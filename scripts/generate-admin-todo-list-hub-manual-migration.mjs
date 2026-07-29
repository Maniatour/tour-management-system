import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Register tsx loader path via dynamic import of compiled - use tsx programmatically
const { buildAdminTodoListHubManualDocument, ADMIN_TODO_LIST_HUB_ARTICLE_META } = await import(
  '../src/lib/adminTodoListHubManual.ts'
)

const meta = ADMIN_TODO_LIST_HUB_ARTICLE_META
const body = buildAdminTodoListHubManualDocument()
const bodyJson = JSON.stringify(body).replace(/'/g, "''")
const roles = meta.target_roles.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ')

const sql = `-- 업무 Todo List 개편 매뉴얼 (운영 허브)
INSERT INTO public.company_knowledge_articles (
  slug,
  title_ko,
  title_en,
  summary_ko,
  summary_en,
  hub_category,
  content_type,
  target_roles,
  body_structure,
  body_layout,
  sort_order,
  is_published,
  published_at
)
VALUES (
  '${meta.slug}',
  '${meta.title_ko.replace(/'/g, "''")}',
  '${meta.title_en.replace(/'/g, "''")}',
  '${meta.summary_ko.replace(/'/g, "''")}',
  '${meta.summary_en.replace(/'/g, "''")}',
  '${meta.hub_category}',
  '${meta.content_type}',
  ARRAY[${roles}]::text[],
  '${bodyJson}'::jsonb,
  'structured',
  ${meta.sort_order},
  true,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  title_ko = EXCLUDED.title_ko,
  title_en = EXCLUDED.title_en,
  summary_ko = EXCLUDED.summary_ko,
  summary_en = EXCLUDED.summary_en,
  hub_category = EXCLUDED.hub_category,
  content_type = EXCLUDED.content_type,
  target_roles = EXCLUDED.target_roles,
  body_structure = EXCLUDED.body_structure,
  body_layout = EXCLUDED.body_layout,
  sort_order = EXCLUDED.sort_order,
  is_published = EXCLUDED.is_published,
  published_at = COALESCE(public.company_knowledge_articles.published_at, EXCLUDED.published_at),
  updated_at = now();
`

const outPath = path.join(root, 'supabase/migrations/20260728210000_admin_todo_list_hub_manual.sql')
fs.writeFileSync(outPath, sql)
console.log('Wrote', outPath, `(${sql.length} bytes)`)
