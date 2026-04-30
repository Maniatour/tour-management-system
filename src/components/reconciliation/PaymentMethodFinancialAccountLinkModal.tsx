'use client'

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { supabase, isAbortLikeError } from '@/lib/supabase'

const PAYMENT_LINK_RENDER_LIMIT = 150

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = localStorage.getItem('sb-access-token')
  return t?.trim() ? t.trim() : null
}

type FinancialAccountLite = {
  id: string
  name: string
  account_type: string
}

export type PaymentMethodLinkRow = {
  id: string
  method: string
  display_name?: string | null
  card_number_last4: string | null
  financial_account_id: string | null
  user_email?: string | null
  notes?: string | null
  team?: { email?: string; name_ko?: string | null; name_en?: string | null } | null
}

export type PaymentMethodRowDraft = {
  method: string
  user_email: string | null
  notes: string | null
  financial_account_id: string | null
}

type TeamGuideOption = {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name: string | null
  is_active: boolean
}

function normalizeEmailForCompare(v: string | null | undefined): string | null {
  const t = String(v ?? '').trim().toLowerCase()
  return t ? t : null
}

function normalizeNotesForCompare(v: string | null | undefined): string {
  return String(v ?? '').trim()
}

function rowDraftDiffers(pm: PaymentMethodLinkRow, d: PaymentMethodRowDraft): boolean {
  if ((pm.method ?? '').trim() !== d.method.trim()) return true
  if (normalizeEmailForCompare(pm.user_email) !== normalizeEmailForCompare(d.user_email)) return true
  if (normalizeNotesForCompare(pm.notes) !== normalizeNotesForCompare(d.notes)) return true
  const baseFa = pm.financial_account_id ?? null
  const curFa = d.financial_account_id ?? null
  if (baseFa !== curFa) return true
  return false
}

function mergePmWithDraft(pm: PaymentMethodLinkRow, d: PaymentMethodRowDraft | undefined): PaymentMethodLinkRow {
  if (!d) return pm
  return {
    ...pm,
    method: d.method,
    user_email: d.user_email,
    notes: d.notes,
    financial_account_id: d.financial_account_id,
  }
}

export type PaymentMethodFinancialAccountLinkModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  /** 결제 방법 관리 탭 등에서 호출 시 상단 안내 문구 조정 */
  fromPaymentMethodsPage?: boolean
  onSaved?: () => void
}

export default function PaymentMethodFinancialAccountLinkModal({
  open,
  onOpenChange,
  locale,
  fromPaymentMethodsPage,
  onSaved,
}: PaymentMethodFinancialAccountLinkModalProps) {
  const [accounts, setAccounts] = useState<FinancialAccountLite[]>([])
  const [accountsListError, setAccountsListError] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodLinkRow[]>([])
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null)
  const [teamGuideOptions, setTeamGuideOptions] = useState<TeamGuideOption[]>([])
  const [teamGuideError, setTeamGuideError] = useState<string | null>(null)

  const [rowDrafts, setRowDrafts] = useState<Record<string, PaymentMethodRowDraft>>({})
  const [paymentLinkDirty, setPaymentLinkDirty] = useState(false)
  const [savingPaymentLinks, setSavingPaymentLinks] = useState(false)
  const [paymentLinkMethodSearch, setPaymentLinkMethodSearch] = useState('')

  const paymentMethodsLoadedRef = useRef(false)

  const loadAccounts = useCallback(async () => {
    setAccountsListError(null)
    try {
      const getSessionToken = async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          return session?.access_token ?? null
        } catch (e) {
          if (isAbortLikeError(e)) return getStoredAccessToken()
          throw e
        }
      }

      let token = getStoredAccessToken() || (await getSessionToken())
      const fetchAccounts = (accessToken: string | null) =>
        fetch('/api/financial/accounts', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: 'same-origin',
        })

      let res = await fetchAccounts(token)

      if (res.status === 401) {
        const refreshedToken = await getSessionToken()
        if (refreshedToken && refreshedToken !== token) {
          token = refreshedToken
          res = await fetchAccounts(refreshedToken)
        }
      }

      const json = (await res.json()) as {
        success?: boolean
        data?: FinancialAccountLite[]
        error?: string
      }
      if (!res.ok) {
        setAccounts([])
        setAccountsListError(json.error || `금융 계정 목록을 불러오지 못했습니다. (${res.status})`)
        return
      }
      setAccounts(json.data || [])
    } catch (e) {
      setAccounts([])
      setAccountsListError(e instanceof Error ? e.message : '금융 계정 목록을 불러오지 못했습니다.')
    }
  }, [])

  const loadTeamGuideOptions = useCallback(async () => {
    setTeamGuideError(null)
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko', { ascending: true })

      if (error) throw error
      setTeamGuideOptions(
        (data ?? []).map((r) => ({
          email: String(r.email ?? '').trim().toLowerCase(),
          name_ko: r.name_ko ?? null,
          name_en: r.name_en ?? null,
          nick_name: r.nick_name ?? null,
          is_active: r.is_active ?? true,
        }))
      )
    } catch (e) {
      console.error(e)
      setTeamGuideOptions([])
      setTeamGuideError(e instanceof Error ? e.message : '팀(가이드) 목록을 불러오지 못했습니다.')
    }
  }, [])

  const loadPaymentMethodsInner = useCallback(async (force: boolean) => {
    if (!force && paymentMethodsLoadedRef.current) return
    setPaymentMethodsError(null)
    try {
      const res = await fetch('/api/payment-methods?limit=5000')
      const json = (await res.json()) as {
        success?: boolean
        message?: string
        data?: Array<{
          id: string
          method?: string
          display_name?: string | null
          card_number_last4?: string | null
          financial_account_id?: string | null
          user_email?: string | null
          notes?: string | null
          team?: { email?: string; name_ko?: string | null; name_en?: string | null } | null
        }>
      }
      if (!res.ok || json.success === false) {
        setPaymentMethods([])
        paymentMethodsLoadedRef.current = false
        setPaymentMethodsError(
          json.message || `결제수단 목록을 불러오지 못했습니다. (${res.status})`
        )
        return
      }
      const list = json.data || []
      setPaymentMethods(
        list.map((pm) => ({
          id: pm.id,
          method: pm.method ?? '',
          display_name: pm.display_name ?? null,
          card_number_last4: pm.card_number_last4 ?? null,
          financial_account_id: pm.financial_account_id ?? null,
          user_email: pm.user_email ?? null,
          notes: pm.notes ?? null,
          team: pm.team ?? null,
        }))
      )
      paymentMethodsLoadedRef.current = true
    } catch (e) {
      console.error(e)
      setPaymentMethods([])
      paymentMethodsLoadedRef.current = false
      setPaymentMethodsError(e instanceof Error ? e.message : '결제수단을 불러오는 중 오류가 났습니다.')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    paymentMethodsLoadedRef.current = false
    void loadAccounts()
    void loadTeamGuideOptions()
    void loadPaymentMethodsInner(true)
    setPaymentLinkDirty(false)
    setPaymentLinkMethodSearch('')
  }, [open, loadAccounts, loadTeamGuideOptions, loadPaymentMethodsInner])

  /** 모달이 열려 있고 편집 중이 아니면 서버 목록과 draft 동기화 */
  useEffect(() => {
    if (!open) return
    if (paymentLinkDirty) return
    const next: Record<string, PaymentMethodRowDraft> = {}
    for (const pm of paymentMethods) {
      next[pm.id] = {
        method: pm.method ?? '',
        user_email: normalizeEmailForCompare(pm.user_email),
        notes: pm.notes ?? null,
        financial_account_id: pm.financial_account_id ?? null,
      }
    }
    setRowDrafts(next)
  }, [open, paymentMethods, paymentLinkDirty])

  const paymentLinkHasChanges = useMemo(() => {
    if (!open) return false
    return paymentMethods.some((pm) => {
      const d = rowDrafts[pm.id]
      if (!d) return false
      return rowDraftDiffers(pm, d)
    })
  }, [open, paymentMethods, rowDrafts])

  const deferredPaymentLinkMethodSearch = useDeferredValue(paymentLinkMethodSearch)

  const accountsById = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]))
  }, [accounts])

  const teamByEmail = useMemo(() => {
    return new Map(teamGuideOptions.map((t) => [t.email.toLowerCase(), t]))
  }, [teamGuideOptions])

  const paymentLinkModalFilteredMethods = useMemo(() => {
    if (!open) return []
    const q = deferredPaymentLinkMethodSearch.trim().toLowerCase()
    if (!q) return paymentMethods
    return paymentMethods.filter((pm) => {
      const merged = mergePmWithDraft(pm, rowDrafts[pm.id])
      const fa = merged.financial_account_id ? accountsById.get(merged.financial_account_id) : undefined
      const te = merged.user_email ? teamByEmail.get(merged.user_email.toLowerCase()) : undefined
      const chunks: (string | null | undefined)[] = [
        merged.id,
        merged.method,
        merged.display_name,
        merged.notes,
        merged.user_email,
        merged.card_number_last4,
        te?.name_ko ?? undefined,
        te?.name_en ?? undefined,
        te?.nick_name ?? undefined,
        merged.team?.name_ko ?? undefined,
        merged.team?.name_en ?? undefined,
        merged.financial_account_id ?? undefined,
        fa?.name,
        fa?.account_type,
      ]
      return chunks.some((c) => c && String(c).toLowerCase().includes(q))
    })
  }, [open, paymentMethods, rowDrafts, deferredPaymentLinkMethodSearch, accountsById, teamByEmail])

  const paymentLinkModalVisibleMethods = useMemo(
    () => paymentLinkModalFilteredMethods.slice(0, PAYMENT_LINK_RENDER_LIMIT),
    [paymentLinkModalFilteredMethods]
  )

  const paymentLinkHiddenCount = Math.max(
    0,
    paymentLinkModalFilteredMethods.length - paymentLinkModalVisibleMethods.length
  )

  const displayPaymentError = accountsListError || paymentMethodsError || teamGuideError

  const saveAllPaymentMethodRows = async () => {
    const token = getStoredAccessToken()
    if (!token) {
      const msg = '로그인이 필요합니다. 다시 로그인한 뒤 시도하세요.'
      setPaymentMethodsError(msg)
      return
    }
    const toSave = paymentMethods.filter((pm) => {
      const d = rowDrafts[pm.id]
      if (!d) return false
      return rowDraftDiffers(pm, d)
    })
    if (toSave.length === 0) {
      return
    }
    setSavingPaymentLinks(true)
    setPaymentMethodsError(null)
    try {
      const results = await Promise.allSettled(
        toSave.map((pm) => {
          const d = rowDrafts[pm.id]
          return fetch(`/api/payment-methods/${encodeURIComponent(pm.id)}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              method: d.method.trim(),
              user_email: d.user_email === null || d.user_email === '' ? null : String(d.user_email).trim(),
              notes: d.notes === null || normalizeNotesForCompare(d.notes) === '' ? null : String(d.notes),
              financial_account_id: d.financial_account_id,
            }),
            credentials: 'same-origin',
          }).then(async (res) => {
            const json = (await res.json()) as { error?: string; message?: string; success?: boolean }
            if (!res.ok || json.success === false) {
              throw new Error(json.error || json.message || `HTTP ${res.status}`)
            }
            return pm.id
          })
        })
      )
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      if (failed.length > 0) {
        const errText =
          failed.length === 1
            ? String(failed[0].reason instanceof Error ? failed[0].reason.message : failed[0].reason)
            : `${failed.length}건 저장에 실패했습니다. ${failed
                .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
                .slice(0, 3)
                .join(' / ')}`
        setPaymentMethodsError(errText)
        return
      }
      setPaymentLinkDirty(false)
      paymentMethodsLoadedRef.current = false
      await loadPaymentMethodsInner(true)
      onSaved?.()
    } catch (e) {
      setPaymentMethodsError(e instanceof Error ? e.message : '저장 중 오류가 났습니다.')
    } finally {
      setSavingPaymentLinks(false)
    }
  }

  const statementRecoHref = `/${locale}/admin/statement-reconciliation`

  const guideLabelForEmail = useCallback(
    (email: string | null) => {
      if (!email) return ''
      const t = teamByEmail.get(email.toLowerCase())
      if (!t) return ''
      return (t.name_ko?.trim() || t.name_en?.trim() || t.email).trim()
    },
    [teamByEmail]
  )

  const guideTeamOptionsSorted = useMemo(() => {
    return [...teamGuideOptions].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      const la = (a.name_ko || a.name_en || a.email).toLowerCase()
      const lb = (b.name_ko || b.name_en || b.email).toLowerCase()
      return la.localeCompare(lb, 'ko')
    })
  }, [teamGuideOptions])

  const updateDraft = useCallback((id: string, patch: Partial<PaymentMethodRowDraft>) => {
    setRowDrafts((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
    setPaymentLinkDirty(true)
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPaymentLinkDirty(false)
          setPaymentLinkMethodSearch('')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-6xl w-[calc(100vw-1.25rem)] p-0 gap-0 flex flex-col max-h-[min(92vh,920px)] sm:max-h-[90vh]">
        <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg pr-2">
              <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>
                <span className="font-normal text-gray-600">↔</span>
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                <span className="font-normal text-gray-600">연결</span>
              </span>
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setPaymentLinkDirty(false)
                void loadAccounts()
                void loadTeamGuideOptions()
                void loadPaymentMethodsInner(true)
              }}
              title="목록 새로고침 (서버 기준으로 다시 불러와 선택 초기화)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-gray-500 mb-3">
            {fromPaymentMethodsPage ? (
              <>
                카드·방법명, 가이드(팀 이메일), 메모, 금융 계정을 한 화면에서 고친 뒤{' '}
                <strong>아래 저장</strong>을 누르면 반영됩니다. 저장은 <strong>Super 권한</strong>이 필요합니다. 명세
                업로드·대조는{' '}
                <Link href={statementRecoHref} className="text-blue-600 underline hover:text-blue-800">
                  명세 대조
                </Link>
                에서 진행합니다.
              </>
            ) : (
              <>
                직원 카드·계좌는{' '}
                <Link
                  href={`/${locale}/admin/payment-methods`}
                  className="text-blue-600 underline hover:text-blue-800"
                  onClick={() => onOpenChange(false)}
                >
                  결제 방법 관리
                </Link>
                에서도 등록·편집할 수 있습니다. 여기서는 카드명·가이드·메모·금융 계정을 한꺼번에 고칠 수 있으며 저장은{' '}
                <strong>Super 권한</strong>이 필요합니다.
              </>
            )}
          </p>
          {displayPaymentError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-3">
              {displayPaymentError}
            </div>
          )}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              검색 (이름, ID, 가이드, 메모, 끝자리, 연결 계정명 · 편집 중 내용 포함)
            </label>
            <div className="relative max-w-md">
              <Search
                className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={paymentLinkMethodSearch}
                onChange={(e) => setPaymentLinkMethodSearch(e.target.value)}
                placeholder="검색어 입력…"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                aria-label="결제수단 검색"
              />
            </div>
            {paymentLinkMethodSearch.trim() ? (
              <p className="text-xs text-gray-500 mt-1.5">
                표시 {paymentLinkModalFilteredMethods.length}건 / 전체 {paymentMethods.length}건
              </p>
            ) : null}
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-2 min-w-[11rem]">카드/방법</th>
                  <th className="py-2 pr-2 min-w-[12rem]">가이드(선택)</th>
                  <th className="py-2 pr-2 min-w-[10rem]">메모</th>
                  <th className="py-2 pr-2 whitespace-nowrap w-[4.5rem]">끝 4자리</th>
                  <th className="py-2 min-w-[14rem]">
                    <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.length === 0 && !displayPaymentError && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-600 text-sm">
                      등록된 결제수단이 없습니다.{' '}
                      <Link
                        href={`/${locale}/admin/payment-methods`}
                        className="text-blue-600 font-medium underline hover:text-blue-800"
                        onClick={() => onOpenChange(false)}
                      >
                        결제 방법 관리
                      </Link>
                      에서 추가하세요.
                    </td>
                  </tr>
                )}
                {paymentMethods.length > 0 && paymentLinkModalFilteredMethods.length === 0 && !displayPaymentError && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-600 text-sm">
                      검색 조건에 맞는 결제수단이 없습니다.
                    </td>
                  </tr>
                )}
                {paymentLinkModalVisibleMethods.map((pm) => {
                  const d = rowDrafts[pm.id]
                  if (!d) return null
                  const linked = d.financial_account_id ?? null
                  return (
                    <tr key={pm.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          disabled={savingPaymentLinks}
                          value={d.method}
                          onChange={(e) => updateDraft(pm.id, { method: e.target.value })}
                          className="w-full min-w-[10rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50"
                          aria-label={`${pm.id} 카드·방법명`}
                        />
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={pm.id}>
                          {pm.id}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          disabled={savingPaymentLinks}
                          value={d.user_email ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            updateDraft(pm.id, { user_email: v ? v.toLowerCase() : null })
                          }}
                          className="w-full max-w-[16rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 disabled:opacity-50"
                          aria-label="가이드(팀)"
                        >
                          <option value="">(없음)</option>
                          {d.user_email &&
                          !guideTeamOptionsSorted.some(
                            (t) => t.email.toLowerCase() === d.user_email?.toLowerCase()
                          ) ? (
                            <option value={d.user_email}>
                              {d.user_email} · 팀 목록에 없음 (저장 전 팀 추가 또는 선택 변경)
                            </option>
                          ) : null}
                          {guideTeamOptionsSorted.map((t) => (
                            <option key={t.email} value={t.email}>
                              {(t.name_ko || t.name_en || t.email) +
                                (t.is_active ? '' : ' · 비활성')}{' '}
                              — {t.email}
                            </option>
                          ))}
                        </select>
                        {d.user_email && !teamByEmail.has(d.user_email.toLowerCase()) ? (
                          <p className="text-[10px] text-amber-800 mt-1">
                            팀 목록에 없는 이메일입니다. 저장 시 오류가 날 수 있습니다.
                          </p>
                        ) : null}
                        {d.user_email ? (
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={guideLabelForEmail(d.user_email)}>
                            {guideLabelForEmail(d.user_email) || '—'}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 max-w-[18rem]">
                        <textarea
                          disabled={savingPaymentLinks}
                          value={d.notes ?? ''}
                          onChange={(e) => updateDraft(pm.id, { notes: e.target.value })}
                          rows={2}
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 resize-y min-h-[2.5rem] disabled:opacity-50"
                          placeholder="메모"
                          aria-label="메모"
                        />
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-gray-700">{pm.card_number_last4 || '—'}</td>
                      <td className="py-2">
                        {accounts.length === 0 ? (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 max-w-[20rem]">
                            <Link
                              href={statementRecoHref}
                              className="underline font-medium"
                              onClick={() => onOpenChange(false)}
                            >
                              명세 대조
                            </Link>
                            의 <strong>금융 계정</strong>에서 먼저 추가한 뒤 연결할 수 있습니다.
                          </p>
                        ) : (
                          <div className="max-w-[22rem]">
                            <select
                              disabled={savingPaymentLinks}
                              value={linked ?? ''}
                              onChange={(e) => {
                                const next = e.target.value || null
                                if (next === linked) return
                                updateDraft(pm.id, { financial_account_id: next })
                              }}
                              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 disabled:opacity-50"
                            >
                              <option value="">없음</option>
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.account_type})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {paymentLinkHiddenCount > 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-xs text-gray-500">
                      렌더링 성능을 위해 상위 {PAYMENT_LINK_RENDER_LIMIT}건만 표시 중입니다. 나머지 {paymentLinkHiddenCount}
                      건은 검색어를 더 좁혀서 표시하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/90">
          <p className="text-xs text-gray-600">
            {paymentLinkHasChanges ? (
              <span className="text-amber-800 font-medium">저장하지 않은 변경이 있습니다.</span>
            ) : (
              '변경 사항이 없거나 서버와 동일합니다.'
            )}
          </p>
          <Button
            type="button"
            className="shrink-0 w-full sm:w-auto"
            disabled={!paymentLinkHasChanges || savingPaymentLinks}
            onClick={() => void saveAllPaymentMethodRows()}
          >
            {savingPaymentLinks ? '저장 중…' : '변경 사항 저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
