'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import {
  DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS,
  type AdminSmsCategorySettingsRow,
} from '@/lib/adminSmsCategorySettings'
import AdminSmsCategoryIconPicker from '@/components/admin/sms/AdminSmsCategoryIconPicker'
import { invalidateAdminSmsCategorySettingsCache } from '@/hooks/useAdminSmsCategorySettings'

type Props = {
  categoryId: AdminSmsCategoryId
  row: AdminSmsCategorySettingsRow
  uiLocale: string
  onSaved: (row: AdminSmsCategorySettingsRow) => void
}

export default function AdminSmsCategorySettingsPanel({
  categoryId,
  row,
  uiLocale,
  onSaved,
}: Props) {
  const isKo = uiLocale.startsWith('ko')
  const [labelKo, setLabelKo] = useState(row.label_ko)
  const [labelEn, setLabelEn] = useState(row.label_en)
  const [iconKey, setIconKey] = useState(row.icon_key)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setLabelKo(row.label_ko)
    setLabelEn(row.label_en)
    setIconKey(row.icon_key)
  }, [row])

  const handleSave = async () => {
    if (!labelKo.trim() || !labelEn.trim()) return
    setSaving(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await fetchApiWithAuth('/api/admin-sms-category-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_key: categoryId,
          label_ko: labelKo,
          label_en: labelEn,
          icon_key: iconKey,
          sort_order:
            row.sort_order ?? DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS[categoryId].sort_order,
          updated_by: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as { row?: AdminSmsCategorySettingsRow; error?: string }
      if (!res.ok) {
        setNotice(data.error || (isKo ? '저장 실패' : 'Save failed'))
        return
      }
      invalidateAdminSmsCategorySettingsCache()
      if (data.row) onSaved(data.row)
      setNotice(isKo ? '이름·아이콘이 저장되었습니다.' : 'Name and icon saved.')
    } catch {
      setNotice(isKo ? '저장 실패' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <p className="text-xs font-medium text-violet-900">
        {isKo ? '표시 이름 · 아이콘 (예약 카드 등 버튼에 반영)' : 'Display name & icon (used on action buttons)'}
      </p>

      {notice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-700">
          {isKo ? '이름 (한국어)' : 'Name (Korean)'}
          <input
            value={labelKo}
            onChange={(e) => setLabelKo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          {isKo ? '이름 (English)' : 'Name (English)'}
          <input
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">{isKo ? '아이콘' : 'Icon'}</p>
        <AdminSmsCategoryIconPicker value={iconKey} onChange={setIconKey} uiLocale={uiLocale} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !labelKo.trim() || !labelEn.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {isKo ? '이름·아이콘 저장' : 'Save name & icon'}
        </button>
      </div>
    </div>
  )
}
