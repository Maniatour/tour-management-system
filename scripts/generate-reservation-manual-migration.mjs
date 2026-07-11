import { readFileSync, writeFileSync } from 'fs'
import { buildKnowledgeArticleSeedPayload, defaultKnowledgeArticleSeeds } from '../src/lib/operationsHubTemplates.ts'

const seed = defaultKnowledgeArticleSeeds().find((s) => s.slug === 'system-admin-reservation')
if (!seed) throw new Error('seed not found')

const p = buildKnowledgeArticleSeedPayload(seed)
const bodyJson = JSON.stringify(p.body_structure)
const esc = (s) => String(s).replace(/'/g, "''")

const sql = `-- Upgrade system-admin-reservation manual to full 10-section guide
UPDATE public.company_knowledge_articles
SET
  title_ko = '${esc(p.title_ko)}',
  title_en = '${esc(p.title_en)}',
  summary_ko = '${esc(p.summary_ko)}',
  summary_en = '${esc(p.summary_en)}',
  hub_category = '${p.hub_category}',
  content_type = '${p.content_type}',
  target_roles = ARRAY[${p.target_roles.map((r) => `'${esc(r)}'`).join(', ')}]::text[],
  body_structure = $$${bodyJson}$$::jsonb,
  sort_order = ${p.sort_order},
  is_published = true,
  published_at = COALESCE(published_at, now()),
  updated_at = now()
WHERE slug = 'system-admin-reservation';

INSERT INTO public.company_knowledge_articles (
  slug, title_ko, title_en, summary_ko, summary_en,
  hub_category, content_type, target_roles, body_structure,
  sort_order, is_published, published_at
)
SELECT
  '${esc(p.slug)}',
  '${esc(p.title_ko)}',
  '${esc(p.title_en)}',
  '${esc(p.summary_ko)}',
  '${esc(p.summary_en)}',
  '${p.hub_category}',
  '${p.content_type}',
  ARRAY[${p.target_roles.map((r) => `'${esc(r)}'`).join(', ')}]::text[],
  $$${bodyJson}$$::jsonb,
  ${p.sort_order},
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_knowledge_articles WHERE slug = 'system-admin-reservation'
);
`

const out = 'supabase/migrations/20260710164100_upgrade_system_admin_reservation_manual.sql'
writeFileSync(out, sql)
console.log('Wrote', out, 'bytes', sql.length)
