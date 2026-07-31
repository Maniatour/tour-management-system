'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { MessengerContactSettings } from '@/lib/preTourContactSms'
import {
  getCachedMessengerContactSettings,
  getInitialMessengerContactSettings,
  invalidateMessengerContactSettingsCache,
  loadMessengerContactSettings,
} from '@/lib/messengerContactSettingsClientCache'

type Props = {
  uiLocale: string
  isActive: boolean
}

export default function AdminSmsMessengerContactsSection({ uiLocale, isActive }: Props) {
  const isKo = uiLocale.startsWith('ko')
  const [contacts, setContacts] = useState<MessengerContactSettings>(() =>
    getInitialMessengerContactSettings()
  )
  const [syncing, setSyncing] = useState(() => !getCachedMessengerContactSettings())
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) return

    const cached = getCachedMessengerContactSettings()
    if (cached) {
      setContacts(cached)
      setSyncing(false)
    } else {
      setContacts(getInitialMessengerContactSettings())
      setSyncing(true)
    }
    setNotice(null)

    let cancelled = false
    void loadMessengerContactSettings()
      .then((settings) => {
        if (cancelled) return
        setContacts(settings)
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
  }, [isActive, isKo])

  const handleSave = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await fetchApiWithAuth('/api/messenger-contact-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contacts,
          updated_by: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setNotice(data.error || (isKo ? '저장 실패' : 'Save failed'))
        return
      }
      invalidateMessengerContactSettingsCache()
      const refreshed = await loadMessengerContactSettings({ force: true })
      setContacts(refreshed)
      setNotice(isKo ? '연락처가 저장되었습니다.' : 'Contacts saved.')
    } catch {
      setNotice(isKo ? '저장 실패' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {isKo
            ? '투어 사전 연락 SMS 등에 삽입되는 메신저 연락처입니다.'
            : 'Messenger contacts inserted into pre-tour SMS and similar templates.'}
        </p>
        {syncing ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {isKo ? '동기화 중…' : 'Syncing…'}
          </span>
        ) : null}
      </div>

      {notice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {notice}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['line_id', 'LINE ID'],
            ['whatsapp', 'WhatsApp'],
            ['kakao', 'Kakao'],
            ['contact_email', 'Email'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs font-medium text-gray-700">
            {label}
            <input
              value={contacts[key]}
              onChange={(e) => setContacts((c) => ({ ...c, [key]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || syncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {isKo ? '연락처 저장' : 'Save contacts'}
        </button>
      </div>
    </div>
  )
}
