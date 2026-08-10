'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { History } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export type ChannelCommissionRateHistoryRow = {
  id: string
  channel_id: string
  old_percent: number | null
  new_percent: number
  note: string | null
  changed_by: string | null
  changed_at: string
}

type Props = {
  channelId: string
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}%`
}

export function ChannelCommissionRateHistory({ channelId }: Props) {
  const t = useTranslations('channels.commissionHistory')
  const locale = useLocale()
  const [rows, setRows] = useState<ChannelCommissionRateHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: fetchError } = await (supabase as any)
          .from('channel_commission_rate_history')
          .select('id, channel_id, old_percent, new_percent, note, changed_by, changed_at')
          .eq('channel_id', channelId)
          .order('changed_at', { ascending: false })
          .limit(50)

        if (fetchError) throw fetchError
        if (!cancelled) {
          setRows((data as ChannelCommissionRateHistoryRow[]) || [])
        }
      } catch (err) {
        console.error('Failed to load channel commission history:', err)
        if (!cancelled) {
          setError(t('loadError'))
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [channelId, t])

  const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US'

  return (
    <div className="border-t pt-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-lg font-medium text-gray-900">{t('title')}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t('hint')}</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3">
          {rows.map((row) => {
            const when = new Date(row.changed_at).toLocaleString(dateLocale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            const changeLabel =
              row.old_percent == null
                ? t('initial', { rate: formatPercent(row.new_percent) })
                : t('changed', {
                    from: formatPercent(row.old_percent),
                    to: formatPercent(row.new_percent),
                  })

            return (
              <li
                key={row.id}
                className="rounded-md border border-border/40 bg-white px-3 py-2 text-sm"
              >
                <div className="font-medium text-foreground">{changeLabel}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {when}
                  {row.changed_by ? ` · ${row.changed_by}` : ''}
                  {row.note ? ` · ${row.note}` : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
