'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { isAdminSmsDbTemplateKey } from '@/lib/adminSmsTemplateCatalog'
import { getBuiltinAdminSmsLocaleTemplate } from '@/lib/adminSmsBuiltinTemplates'
import {
  getCachedAdminSmsLocaleTemplate,
  invalidateAdminSmsLocaleTemplateCache,
  loadAdminSmsLocaleTemplate,
} from '@/lib/adminSmsLocaleTemplateClientCache'
import AdminSmsSamplePreviewPanel from '@/components/admin/sms/AdminSmsSamplePreviewPanel'

type Props = {
  categoryId: AdminSmsCategoryId
  locale: string
  uiLocale: string
  placeholderHint?: string | undefined
  isActive: boolean
}

function initialSnapshot(categoryId: AdminSmsCategoryId, locale: string) {
  return (
    getCachedAdminSmsLocaleTemplate(categoryId, locale) ?? {
      body_template: getBuiltinAdminSmsLocaleTemplate(categoryId, locale),
      saved_in_db: false,
    }
  )
}

export default function AdminSmsLocaleTemplateEditor({
  categoryId,
  locale,
  uiLocale,
  placeholderHint,
  isActive,
}: Props) {
  const isKo = uiLocale.startsWith('ko')
  const [bodyTpl, setBodyTpl] = useState(() => initialSnapshot(categoryId, locale).body_template)
  const [savedInDb, setSavedInDb] = useState(() => initialSnapshot(categoryId, locale).saved_in_db)
  const [syncing, setSyncing] = useState(() => !getCachedAdminSmsLocaleTemplate(categoryId, locale))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) return

    const cached = getCachedAdminSmsLocaleTemplate(categoryId, locale)
    if (cached) {
      setBodyTpl(cached.body_template)
      setSavedInDb(cached.saved_in_db)
      setSyncing(false)
    } else {
      setBodyTpl(getBuiltinAdminSmsLocaleTemplate(categoryId, locale))
      setSavedInDb(false)
      setSyncing(true)
    }
    setNotice(null)

    let cancelled = false
    void loadAdminSmsLocaleTemplate(categoryId, locale)
      .then((snapshot) => {
        if (cancelled) return
        setBodyTpl(snapshot.body_template)
        setSavedInDb(snapshot.saved_in_db)
      })
      .catch(() => {
        if (cancelled) return
        setNotice(isKo ? '불러오기 실패' : 'Load failed')
      })
      .finally(() => {
        if (!cancelled) setSyncing(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryId, locale, isActive, isKo])

  const handleSave = async () => {
    if (!bodyTpl.trim()) return
    setSaving(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const updated_by = user?.email ?? null

      if (categoryId === 'pre_tour_contact') {
        const res = await fetch('/api/pre-tour-contact-sms-template', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            body_template: bodyTpl,
            updated_by,
          }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setNotice(data.error || (isKo ? '저장 실패' : 'Save failed'))
          return
        }
      } else if (isAdminSmsDbTemplateKey(categoryId)) {
        const res = await fetchApiWithAuth('/api/admin-sms-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_key: categoryId,
            locale,
            body_template: bodyTpl,
            updated_by,
          }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setNotice(data.error || (isKo ? '저장 실패' : 'Save failed'))
          return
        }
      }

      invalidateAdminSmsLocaleTemplateCache(categoryId, locale)
      const snapshot = await loadAdminSmsLocaleTemplate(categoryId, locale, { force: true })
      setBodyTpl(snapshot.body_template)
      setSavedInDb(snapshot.saved_in_db)
      setNotice(isKo ? '저장되었습니다.' : 'Saved.')
    } catch {
      setNotice(isKo ? '저장 실패' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (
      !confirm(
        isKo
          ? 'DB에 저장된 템플릿을 삭제하고 기본값으로 복원할까요?'
          : 'Delete saved template and restore default?'
      )
    ) {
      return
    }
    setResetting(true)
    setNotice(null)
    try {
      if (categoryId === 'pre_tour_contact') {
        const res = await fetch(`/api/pre-tour-contact-sms-template?locale=${locale}`, {
          method: 'DELETE',
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setNotice(data.error || (isKo ? '복원 실패' : 'Reset failed'))
          return
        }
      } else if (isAdminSmsDbTemplateKey(categoryId)) {
        const res = await fetchApiWithAuth(
          `/api/admin-sms-templates?template_key=${categoryId}&locale=${locale}`,
          { method: 'DELETE' }
        )
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setNotice(data.error || (isKo ? '복원 실패' : 'Reset failed'))
          return
        }
      }

      invalidateAdminSmsLocaleTemplateCache(categoryId, locale)
      const snapshot = await loadAdminSmsLocaleTemplate(categoryId, locale, { force: true })
      setBodyTpl(snapshot.body_template)
      setSavedInDb(snapshot.saved_in_db)
      setNotice(isKo ? '기본 템플릿으로 복원했습니다.' : 'Restored to default.')
    } catch {
      setNotice(isKo ? '복원 실패' : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            savedInDb ? 'bg-violet-100 text-violet-800' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {savedInDb
            ? isKo
              ? '저장된 템플릿'
              : 'Saved template'
            : isKo
              ? '기본 템플릿'
              : 'Default template'}
        </span>
        {syncing ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {isKo ? '동기화 중…' : 'Syncing…'}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || syncing || !bodyTpl.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {isKo ? '저장' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={resetting || syncing || !savedInDb}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {isKo ? '기본값 복원' : 'Reset default'}
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {notice}
        </div>
      )}

      {placeholderHint && (
        <p className="text-xs text-muted-foreground">{placeholderHint}</p>
      )}

      <textarea
        value={bodyTpl}
        onChange={(e) => setBodyTpl(e.target.value)}
        rows={12}
        className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500"
      />
      <AdminSmsSamplePreviewPanel
        categoryId={categoryId}
        locale={locale}
        bodyTpl={bodyTpl}
        uiLocale={uiLocale}
      />
    </div>
  )
}
