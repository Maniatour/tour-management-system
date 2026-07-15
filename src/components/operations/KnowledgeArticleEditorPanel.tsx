'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CONTENT_TYPE_LABELS,
  HUB_CATEGORIES,
  HUB_TARGET_ROLE_OPTIONS,
  ensureHubArticleSlug,
} from '@/lib/operationsHub'
import type { KnowledgeArticleDraftForm } from '@/lib/knowledgeArticleForm'

type Props = {
  form: KnowledgeArticleDraftForm
  setForm: Dispatch<SetStateAction<KnowledgeArticleDraftForm>>
  isEn: boolean
  busy: boolean
  msg: string | null
  onSave: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  toggleRole: (role: string) => void
  /** 모달 안에 넣을 때 바깥 테두리 제거 */
  embedded?: boolean
}

export default function KnowledgeArticleEditorPanel({
  form,
  setForm,
  isEn,
  busy,
  msg,
  onSave,
  onDelete,
  toggleRole,
  embedded = false,
}: Props) {
  return (
    <div
      className={
        embedded
          ? 'min-w-0'
          : 'min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Title (KO)' : '제목 (한)'}</span>
            <Input
              value={form.title_ko}
              onChange={(e) => setForm((f) => ({ ...f, title_ko: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Title (EN)' : '제목 (영)'}</span>
            <Input
              value={form.title_en}
              onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
              className="mt-1"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">slug</span>
          <Input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder={
              ensureHubArticleSlug(form.slug || form.title_en || form.title_ko || 'my-article')
            }
            className="mt-1 font-mono text-xs"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Summary (KO)' : '요약 (한)'}</span>
            <Input
              value={form.summary_ko}
              onChange={(e) => setForm((f) => ({ ...f, summary_ko: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Summary (EN)' : '요약 (영)'}</span>
            <Input
              value={form.summary_en}
              onChange={(e) => setForm((f) => ({ ...f, summary_en: e.target.value }))}
              className="mt-1"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Category' : '카테고리'}</span>
            <select
              value={form.hub_category}
              onChange={(e) => setForm((f) => ({ ...f, hub_category: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              {HUB_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {isEn ? c.title_en : c.title_ko}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Type' : '유형'}</span>
            <select
              value={form.content_type}
              onChange={(e) => setForm((f) => ({ ...f, content_type: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              {(Object.keys(CONTENT_TYPE_LABELS) as Array<keyof typeof CONTENT_TYPE_LABELS>).map(
                (k) => (
                  <option key={k} value={k}>
                    {isEn ? CONTENT_TYPE_LABELS[k].en : CONTENT_TYPE_LABELS[k].ko}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Document format' : '문서 형식'}</span>
            <select
              value={form.body_layout}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  body_layout: e.target.value === 'plain' ? 'plain' : 'structured',
                }))
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="structured">
                {isEn ? 'Structured (sections)' : '구조화 문서'}
              </option>
              <option value="plain">{isEn ? 'Plain (original text)' : '일반 문서 (원문)'}</option>
            </select>
            <span className="mt-1 block text-[11px] text-gray-500">
              {isEn
                ? 'Structured opens in Structure view; Plain opens in Original view.'
                : '구조화는 「구조 보기」, 일반은 「원문 보기」로 열립니다.'}
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">{isEn ? 'Sort order' : '정렬'}</span>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))
              }
              className="mt-1"
            />
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm text-gray-700">
            {isEn ? 'Target roles (empty = all staff)' : '대상 직책 (비우면 전 직원)'}
          </p>
          <div className="flex flex-wrap gap-2">
            {HUB_TARGET_ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  form.target_roles.includes(role)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
          />
          {isEn ? 'Published (visible in hub)' : '게시 (허브에 표시)'}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <Button type="button" disabled={busy} onClick={() => void onSave()}>
          <Save className="mr-1 h-4 w-4" />
          {isEn ? 'Save' : '저장'}
        </Button>
        {form.id && onDelete ? (
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void onDelete()}>
            <Trash2 className="mr-1 h-4 w-4" />
            {isEn ? 'Delete' : '삭제'}
          </Button>
        ) : null}
        {msg ? <span className="text-sm text-gray-600">{msg}</span> : null}
      </div>
    </div>
  )
}
