'use client'

import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useReportAdminAlert } from '@/contexts/AdminAlertInboxContext'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { MARKET_ALERTS_TABLE } from '@/lib/market-research/tables'
import { mapMarketPriceAlertRow } from '@/lib/market-research/notify'
import type { MarketPriceAlert } from '@/lib/market-research/types'
import { makeAdminAlertDraft } from '@/lib/adminAlertInbox'

const SEEN_KEY = 'tms-competitor-price-alert-seen'
const POLL_MS = 30_000
const LOOKBACK_DAYS = 7

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeSeen(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-80)))
  } catch {
    /* quota */
  }
}

export default function CompetitorPriceNotificationListener({ locale }: { locale: string }) {
  const { authUser, userRole } = useAuth()
  const report = useReportAdminAlert()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const seenRef = useRef<Set<string>>(new Set())

  const reportRow = useCallback(
    (row: MarketPriceAlert) => {
      if (seenRef.current.has(row.id)) return
      seenRef.current.add(row.id)
      writeSeen(seenRef.current)
      report(
        makeAdminAlertDraft('competitor_price', row.id, {
          title: row.title,
          body: row.body,
          href: `/${locale}/admin/market-research`,
          createdAt: row.created_at,
          payload: row,
        })
      )
    },
    [locale, report]
  )

  useEffect(() => {
    if (!enabled) return
    seenRef.current = readSeen()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const pull = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      const { data } = await fromUntypedTable(supabase, MARKET_ALERTS_TABLE)
        .select(
          'id, operator_id, listing_id, kind, title, body, canyon_variant, offer_type, old_adult_total, new_adult_total, created_at'
        )
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(20)
      if (cancelled || !Array.isArray(data)) return
      for (const raw of data) {
        const row = mapMarketPriceAlertRow(raw as Record<string, unknown>)
        if (row) reportRow(row)
      }
    }

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      channel = supabase
        .channel('competitor-price-alerts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: MARKET_ALERTS_TABLE },
          (change) => {
            const row = mapMarketPriceAlertRow(change.new as Record<string, unknown>)
            if (row) reportRow(row)
          }
        )
        .subscribe()
      await pull()
    }

    void start()
    const timer = window.setInterval(() => {
      void pull()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, reportRow])

  return null
}
