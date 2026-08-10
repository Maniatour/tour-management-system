'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import { supabase } from '@/lib/supabase'
import { SITE_LOCALES, type SiteLocale } from '@/lib/siteLocales'
import {
  buildContentLibraryUiLabelPayload,
  fetchContentLibraryUiLabels,
  getContentLibraryUiLabelMap,
  type ContentLibraryUiLabelRow,
} from '@/lib/contentLibraryUiLabels'

const INPUT_CLASS = 'w-full rounded-lg border border-border px-3 py-2 text-sm'

export default function ContentLibraryUiLabelsPanel() {
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [rows, setRows] = useState<ContentLibraryUiLabelRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<SiteLocale, string>>>>({})
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await fetchContentLibraryUiLabels(supabase as never)
      setRows(data)
      const next: Record<string, Partial<Record<SiteLocale, string>>> = {}
      for (const row of data) {
        next[row.key] = getContentLibraryUiLabelMap(row)
      }
      setDrafts(next)
    } catch (error) {
      console.error(error)
      setMessage('짧은 라벨을 불러오지 못했습니다. 마이그레이션 적용 여부를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveRow = async (row: ContentLibraryUiLabelRow) => {
    setSavingKey(row.key)
    setMessage(null)
    try {
      const payload = buildContentLibraryUiLabelPayload({
        key: row.key,
        name: row.name,
        labelByLocale: drafts[row.key] || {},
      })
      const { error } = await supabase
        .from('content_library_ui_labels' as never)
        .upsert(payload as never, { onConflict: 'key' })
      if (error) throw error
      setMessage(`저장됨: ${row.name || row.key}`)
      await load()
    } catch (error) {
      console.error(error)
      setMessage('저장에 실패했습니다.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">짧은 UI 라벨</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            추천/비추천 섹션 제목처럼 짧은 문구를 DB에서 언어별로 관리합니다.
          </p>
        </div>
        <AdminEditLocaleToggle
          value={editLocale}
          onChange={(next) => setEditLocale(normalizeAdminEditLocale(next))}
          groupLabel="편집 언어"
        />
      </div>

      {message ? (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const filled = SITE_LOCALES.filter((l) => drafts[row.key]?.[l.code]?.trim()).map(
            (l) => l.code
          )
          return (
            <div
              key={row.key}
              className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">{row.name || row.key}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.key}</div>
                </div>
                <ContentLibraryLocaleBadges locales={filled} />
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium">
                  표시 문구 ({getAdminEditLocaleLabel(editLocale)})
                </span>
                <input
                  {...BROWSER_AUTOFILL_OFF_PROPS}
                  value={drafts[row.key]?.[editLocale] ?? ''}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.key]: { ...(prev[row.key] || {}), [editLocale]: e.target.value },
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
              <button
                type="button"
                onClick={() => void saveRow(row)}
                disabled={savingKey === row.key}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {savingKey === row.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                저장
              </button>
            </div>
          )
        })}
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            라벨이 없습니다. 마이그레이션을 적용해 주세요.
          </p>
        ) : null}
      </div>
    </div>
  )
}
