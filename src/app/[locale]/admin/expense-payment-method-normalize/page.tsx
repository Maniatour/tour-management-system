'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { RefreshCw, ArrowRight, CreditCard, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import type { NormalizePreviewRow, ExpenseTableName } from '@/lib/expensePaymentMethodNormalize'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

type ApiPreview = NormalizePreviewRow

type PaymentMethodOpt = {
  id: string
  method: string
  display_name: string | null
  card_holder_name?: string | null
  user_email?: string | null
}

const TABLE_LABEL: Record<ExpenseTableName, string> = {
  reservation_expenses: '예약 지출',
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
}

function rowKey(r: ApiPreview) {
  return `${r.sourceTable}::${r.raw}`
}

export default function ExpensePaymentMethodNormalizePage() {
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const t = useTranslations('expensePaymentMethodNormalize')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ApiPreview[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([])
  const [summary, setSummary] = useState<{
    totalDistinctValues: number
    registered: number
    aliasSuggested: number
    unregistered: number
  } | null>(null)

  const [tableFilter, setTableFilter] = useState<ExpenseTableName | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'alias_suggested' | 'unregistered'>(
    'all'
  )

  /** 행별 치환 대상 payment_methods.id (사용자 수정 가능) */
  const [targetByRow, setTargetByRow] = useState<Record<string, string>>({})
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [migrateLoading, setMigrateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/expense-payment-method-normalize')
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || t('loadError'))
        setPreview([])
        setPaymentMethods([])
        setSummary(null)
        return
      }
      const rows = (json.preview || []) as ApiPreview[]
      setPreview(rows)
      setPaymentMethods(json.paymentMethods || [])
      setSummary(json.summary || null)

      const next: Record<string, string> = {}
      for (const r of rows) {
        const k = rowKey(r)
        if (r.status === 'registered') {
          next[k] = r.suggestedTargetId || ''
        } else if (r.suggestedTargetId) {
          next[k] = r.suggestedTargetId
        } else {
          next[k] = ''
        }
      }
      setTargetByRow(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    return preview.filter((r) => {
      if (tableFilter !== 'all' && r.sourceTable !== tableFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      return true
    })
  }, [preview, tableFilter, statusFilter])

  const pmLabel = (id: string) => {
    const p = paymentMethods.find((x) => x.id === id)
    if (!p) return id
    return formatPaymentMethodDisplay({
      id: p.id,
      method: p.method,
      display_name: p.display_name,
      card_holder_name: p.card_holder_name ?? null,
      user_email: p.user_email ?? null,
    })
  }

  const applyMapping = async (r: ApiPreview) => {
    const k = rowKey(r)
    const to = (targetByRow[k] || '').trim()
    if (!to) {
      alert(t('selectTarget'))
      return
    }
    if (r.raw === to) {
      alert(t('sameValue'))
      return
    }
    setApplyingKey(k)
    try {
      const res = await fetch('/api/admin/expense-payment-method-normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: [{ table: r.sourceTable, from: r.raw, to }],
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        alert(json.message || t('applyError'))
        return
      }
      const u = json.results?.[0]
      alert(t('applySuccess', { count: u?.updated ?? 0 }))
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('applyError'))
    } finally {
      setApplyingKey(null)
    }
  }

  const runRegisterMissingInPaymentMethods = async () => {
    if (!confirm(t('migrateConfirm'))) return
    setMigrateLoading(true)
    try {
      const res = await fetch('/api/payment-methods/migrate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        alert(json.message || t('migrateError'))
        return
      }
      alert(
        t('migrateSuccess', {
          total: json.total ?? 0,
          created: json.created ?? 0,
          skipped: json.skipped ?? 0,
        })
      )
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('migrateError'))
    } finally {
      setMigrateLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Link
              href={`/${locale}/admin/expenses`}
              className="text-blue-600 hover:underline"
            >
              ← {t('backToExpenses')}
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href={`/${locale}/admin/payment-methods`}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <CreditCard className="h-4 w-4" />
              {t('paymentMethodAdmin')}
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <div className="text-xs text-gray-500">{t('statTotal')}</div>
            <div className="text-lg font-semibold">{summary.totalDistinctValues}</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <div className="text-xs text-green-800">{t('statRegistered')}</div>
            <div className="text-lg font-semibold text-green-900">{summary.registered}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <div className="text-xs text-amber-900">{t('statAlias')}</div>
            <div className="text-lg font-semibold text-amber-950">{summary.aliasSuggested}</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <div className="text-xs text-red-800">{t('statUnregistered')}</div>
            <div className="text-lg font-semibold text-red-900">{summary.unregistered}</div>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-950">
        <div className="flex gap-2 font-medium">
          <HelpCircle className="h-5 w-5 flex-shrink-0" />
          {t('hintTitle')}
        </div>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t('hintStep1')}</li>
          <li>{t('hintStep2')}</li>
          <li>{t('hintStep3')}</li>
        </ol>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void runRegisterMissingInPaymentMethods()}
          disabled={migrateLoading}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {migrateLoading ? '…' : t('migrateButton')}
        </button>
        <span className="text-xs text-gray-500">{t('migrateNote')}</span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">{t('errorTitle')}</div>
            <p className="mt-1 whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-gray-600">
          {t('filterTable')}
          <select
            className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value as ExpenseTableName | 'all')}
          >
            <option value="all">{t('filterAll')}</option>
            {(Object.keys(TABLE_LABEL) as ExpenseTableName[]).map((tb) => (
              <option key={tb} value={tb}>
                {TABLE_LABEL[tb]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          {t('filterStatus')}
          <select
            className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
          >
            <option value="all">{t('filterAll')}</option>
            <option value="registered">{t('statusRegistered')}</option>
            <option value="alias_suggested">{t('statusAlias')}</option>
            <option value="unregistered">{t('statusUnregistered')}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500">{t('loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colTable')}</th>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colRaw')}</th>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colCount')}</th>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colStatus')}</th>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colTarget')}</th>
                <th className="px-3 py-2 font-medium text-gray-700">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((r) => {
                const k = rowKey(r)
                const sel = targetByRow[k] ?? ''
                const needsApply = r.status !== 'registered' || r.raw !== sel
                return (
                  <tr key={k} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 text-gray-800">{TABLE_LABEL[r.sourceTable]}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-gray-900" title={r.raw}>
                      {r.raw}
                    </td>
                    <td className="px-3 py-2">{r.rowCount}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {r.status === 'registered' && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-800">{t('statusRegistered')}</span>
                          </>
                        )}
                        {r.status === 'alias_suggested' && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-900">{t('statusAlias')}</span>
                          </>
                        )}
                        {r.status === 'unregistered' && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-red-800">{t('statusUnregistered')}</span>
                          </>
                        )}
                      </span>
                      <div className="text-[10px] text-gray-400">{r.matchReason}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="max-w-[220px] rounded border border-gray-300 px-2 py-1 text-xs sm:max-w-xs"
                        value={sel}
                        onChange={(e) =>
                          setTargetByRow((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                      >
                        <option value="">{t('selectPlaceholder')}</option>
                        {paymentMethods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {pmLabel(p.id)} ({p.id})
                          </option>
                        ))}
                      </select>
                      {r.displayNameForTarget && (
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          {t('suggested')}: {r.displayNameForTarget}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!needsApply || !sel || applyingKey === k}
                        onClick={() => void applyMapping(r)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {r.raw}
                        <ArrowRight className="h-3 w-3" />
                        {pmLabel(sel) || '—'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && !loading && (
            <p className="py-8 text-center text-gray-500">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
