'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CreditCard, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = localStorage.getItem('sb-access-token')
  return t?.trim() ? t.trim() : null
}

export type ReconciliationAccountLite = {
  id: string
  name: string
  account_type: string
}

type FinancialAccountLite = {
  id: string
  name: string
  account_type: string
}

type PaymentMethodRow = {
  id: string
  method: string
  display_name?: string | null
  card_holder_name?: string | null
  card_number_last4: string | null
  financial_account_id: string | null
  user_email?: string | null
  team?: {
    email?: string
    name_ko?: string | null
    name_en?: string | null
    nick_name?: string | null
  } | null
}

type TeamPickRow = {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name: string | null
  is_active: boolean | null
}

/** 결제수단에 묶인 팀(가이드) 사용자 표시 — 카드명과 별도 줄 */
function paymentMethodUserLabel(pm: PaymentMethodRow): string | null {
  const t = pm.team
  const person =
    (t?.nick_name && String(t.nick_name).trim()) ||
    (t?.name_en && String(t.name_en).trim()) ||
    (t?.name_ko && String(t.name_ko).trim()) ||
    ''
  const email = (pm.user_email && String(pm.user_email).trim()) || ''
  if (person && email) return `${person} (${email})`
  if (person) return person
  if (email) return email
  return null
}

function teamMemberSelectLabel(m: TeamPickRow): string {
  const nick = m.nick_name?.trim()
  const ko = m.name_ko?.trim()
  const en = m.name_en?.trim()
  const primary = nick || ko || en || m.email
  if (ko && en && ko !== en) return `${primary} · ${en}`
  return primary
}

function normalizeFa(v: string | null | undefined): string | null {
  const t = String(v ?? '').trim()
  return t ? t : null
}

function paymentMethodShortLabel(pm: PaymentMethodRow): string {
  const formatted = formatPaymentMethodDisplay(
    {
      id: pm.id,
      method: pm.method,
      display_name: pm.display_name ?? null,
      user_email: pm.user_email ?? null,
      card_holder_name: pm.card_holder_name ?? null,
    },
    pm.team
      ? {
          nick_name: pm.team.nick_name ?? null,
          name_en: pm.team.name_en ?? null,
          name_ko: pm.team.name_ko ?? null,
        }
      : undefined
  )
  const last = pm.card_number_last4 ? ` ·${pm.card_number_last4}` : ''
  return `${formatted}${last}`.trim() || pm.id
}

export type FinancialAccountLinkedCardsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  reconciliationAccounts: ReconciliationAccountLite[]
  /** 현재 명세에서 고른 금융 계정 — 열릴 때 해당 블록으로 스크롤 */
  initialAccountId?: string | null
  /** 카드명·가이드·메모 등 풀 편집이 필요할 때 상위에서 «결제수단 ↔ 금융 계정 연결» 모달을 염 */
  onOpenFlatLinkModal?: () => void
  onSaved?: () => void
}

export default function FinancialAccountLinkedCardsModal({
  open,
  onOpenChange,
  locale,
  reconciliationAccounts,
  initialAccountId,
  onOpenFlatLinkModal,
  onSaved,
}: FinancialAccountLinkedCardsModalProps) {
  const [allAccounts, setAllAccounts] = useState<FinancialAccountLite[]>([])
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null)
  const [rowDraftFa, setRowDraftFa] = useState<Record<string, string | null>>({})
  const [draftDirty, setDraftDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  /** «다른 카드 선택» 드롭다운을 선택 후 맨 위로 되돌리기 위해 계정별 key 버전 */
  const [addPickerVersionByAccount, setAddPickerVersionByAccount] = useState<Record<string, number>>({})
  const [teamPickRows, setTeamPickRows] = useState<TeamPickRow[]>([])
  const [newCardOpenForAccountId, setNewCardOpenForAccountId] = useState<string | null>(null)
  const [newCardMethod, setNewCardMethod] = useState('')
  const [newCardLast4, setNewCardLast4] = useState('')
  const [newCardUserEmail, setNewCardUserEmail] = useState('')
  const [creatingNewCard, setCreatingNewCard] = useState(false)

  const paymentMethodsLoadedRef = useRef(false)

  const loadAccounts = useCallback(async () => {
    setAccountsError(null)
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
        setAllAccounts([])
        setAccountsError(json.error || `금융 계정 목록을 불러오지 못했습니다. (${res.status})`)
        return
      }
      setAllAccounts(json.data || [])
    } catch (e) {
      setAllAccounts([])
      setAccountsError(e instanceof Error ? e.message : '금융 계정 목록을 불러오지 못했습니다.')
    }
  }, [])

  const loadPaymentMethodsInner = useCallback(async (force: boolean) => {
    if (!force && paymentMethodsLoadedRef.current) return
    setPaymentMethodsError(null)
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
      const fetchPm = (accessToken: string | null) =>
        fetch('/api/payment-methods?limit=5000', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: 'same-origin',
        })
      let res = await fetchPm(token)
      if (res.status === 401) {
        const refreshed = await getSessionToken()
        if (refreshed && refreshed !== token) {
          token = refreshed
          res = await fetchPm(refreshed)
        }
      }
      const json = (await res.json()) as {
        success?: boolean
        message?: string
        data?: Array<{
          id: string
          method?: string
          display_name?: string | null
          card_holder_name?: string | null
          card_number_last4?: string | null
          financial_account_id?: string | null
          user_email?: string | null
          team?: {
            email?: string
            name_ko?: string | null
            name_en?: string | null
            nick_name?: string | null
          } | null
        }>
      }
      if (!res.ok || json.success === false) {
        setPaymentMethods([])
        paymentMethodsLoadedRef.current = false
        setPaymentMethodsError(json.message || `결제수단 목록을 불러오지 못했습니다. (${res.status})`)
        return
      }
      const list = json.data || []
      setPaymentMethods(
        list.map((pm) => ({
          id: pm.id,
          method: pm.method ?? '',
          display_name: pm.display_name ?? null,
          card_holder_name: pm.card_holder_name ?? null,
          card_number_last4: pm.card_number_last4 ?? null,
          financial_account_id: pm.financial_account_id ?? null,
          user_email: pm.user_email ?? null,
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

  const loadTeamPickRows = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko', { ascending: true })

      if (error) throw error
      const rows: TeamPickRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
        email: String(r.email ?? ''),
        name_ko: (r.name_ko as string | null) ?? null,
        name_en: (r.name_en as string | null) ?? null,
        nick_name: (r.nick_name as string | null) ?? null,
        is_active: (r.is_active as boolean | null) ?? true,
      }))
      setTeamPickRows(rows.filter((r) => r.email))
    } catch (e) {
      if (!isAbortLikeError(e)) {
        console.error(e)
      }
      setTeamPickRows([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    paymentMethodsLoadedRef.current = false
    setDraftDirty(false)
    setNewCardOpenForAccountId(null)
    setNewCardMethod('')
    setNewCardLast4('')
    setNewCardUserEmail('')
    void loadAccounts()
    void loadPaymentMethodsInner(true)
    void loadTeamPickRows()
  }, [open, loadAccounts, loadPaymentMethodsInner, loadTeamPickRows])

  useEffect(() => {
    if (!open) return
    if (draftDirty) return
    const next: Record<string, string | null> = {}
    for (const pm of paymentMethods) {
      next[pm.id] = normalizeFa(pm.financial_account_id)
    }
    setRowDraftFa(next)
  }, [open, paymentMethods, draftDirty])

  useEffect(() => {
    if (!open || !initialAccountId) return
    const elId = `fa-linked-section-${initialAccountId}`
    const raf = requestAnimationFrame(() => {
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, initialAccountId])

  const recoIdSet = useMemo(
    () => new Set(reconciliationAccounts.map((a) => a.id)),
    [reconciliationAccounts]
  )

  const effectiveFa = useCallback(
    (pm: PaymentMethodRow): string | null => {
      if (rowDraftFa[pm.id] !== undefined) return normalizeFa(rowDraftFa[pm.id])
      return normalizeFa(pm.financial_account_id)
    },
    [rowDraftFa]
  )

  const hasChanges = useMemo(() => {
    if (!open) return false
    return paymentMethods.some((pm) => {
      const orig = normalizeFa(pm.financial_account_id)
      const cur = effectiveFa(pm)
      return orig !== cur
    })
  }, [open, paymentMethods, effectiveFa])

  const setFaDraft = useCallback((pmId: string, fa: string | null) => {
    setRowDraftFa((prev) => ({ ...prev, [pmId]: fa }))
    setDraftDirty(true)
  }, [])

  const paymentMethodsSorted = useMemo(() => {
    return [...paymentMethods].sort((a, b) =>
      paymentMethodShortLabel(a).localeCompare(paymentMethodShortLabel(b), 'ko')
    )
  }, [paymentMethods])

  const accountOptionsSorted = useMemo(() => {
    return [...allAccounts].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [allAccounts])

  const saveFaChanges = async () => {
    const token = getStoredAccessToken()
    if (!token) {
      setPaymentMethodsError('로그인이 필요합니다. 다시 로그인한 뒤 시도하세요.')
      return
    }
    const toSave = paymentMethods.filter((pm) => {
      const orig = normalizeFa(pm.financial_account_id)
      const cur = effectiveFa(pm)
      return orig !== cur
    })
    if (toSave.length === 0) return

    setSaving(true)
    setPaymentMethodsError(null)
    try {
      const results = await Promise.allSettled(
        toSave.map((pm) => {
          const cur = effectiveFa(pm)
          return fetch(`/api/payment-methods/${encodeURIComponent(pm.id)}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ financial_account_id: cur }),
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
            : `${failed.length}건 저장에 실패했습니다.`
        setPaymentMethodsError(errText)
        return
      }
      setDraftDirty(false)
      paymentMethodsLoadedRef.current = false
      await loadPaymentMethodsInner(true)
      onSaved?.()
    } catch (e) {
      setPaymentMethodsError(e instanceof Error ? e.message : '저장 중 오류가 났습니다.')
    } finally {
      setSaving(false)
    }
  }

  const createAndLinkNewCard = async (financialAccountId: string) => {
    const method = newCardMethod.trim()
    if (!method) {
      setPaymentMethodsError('카드·방법 이름을 입력하세요.')
      return
    }
    const last4 = newCardLast4.replace(/\D/g, '').slice(0, 4)
    const userEmailRaw = newCardUserEmail.trim()
    const userEmail = userEmailRaw || null
    const methodSlug =
      method.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() || 'CARD'
    const emailPrefix = userEmail
      ? userEmail.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '') || 'user'
      : 'nouser'

    setCreatingNewCard(true)
    setPaymentMethodsError(null)
    let lastError: string | null = null
    let createdId: string | null = null
    let id = `PAYM${Date.now().toString().slice(-6)}-${methodSlug}-${emailPrefix}`

    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const postRes = await fetch('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            method,
            method_type: 'card',
            user_email: userEmail,
            card_number_last4: last4 || null,
            status: 'active',
            created_by: userEmail,
          }),
        })
        const postJson = (await postRes.json()) as {
          success?: boolean
          message?: string
          error?: string
          data?: { id: string }
        }

        if (postRes.ok && postJson.success && postJson.data?.id) {
          createdId = postJson.data.id
          break
        }
        const msg = postJson.error || postJson.message || `HTTP ${postRes.status}`
        if (String(msg).includes('already exists') && attempt < 5) {
          id = `PAYM${Date.now().toString().slice(-6)}${attempt}${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}-${methodSlug}-${emailPrefix}`
          continue
        }
        lastError = msg
        break
      }

      if (!createdId) {
        setPaymentMethodsError(lastError || '결제수단을 만들지 못했습니다.')
        return
      }

      const token = getStoredAccessToken()
      if (token) {
        const patchRes = await fetch(`/api/payment-methods/${encodeURIComponent(createdId)}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ financial_account_id: financialAccountId }),
          credentials: 'same-origin',
        })
        const patchJson = (await patchRes.json()) as { success?: boolean; error?: string; message?: string }
        if (!patchRes.ok || patchJson.success === false) {
          setPaymentMethodsError(
            patchJson.error ||
              patchJson.message ||
              `생성은 됐으나 이 금융 계정에 연결하지 못했습니다(Super 권한·HTTP ${patchRes.status}). 아래 «미연결»에서 연결할 수 있습니다.`
          )
        }
      } else {
        setPaymentMethodsError(
          '결제수단은 생성됐으나 로그인 토큰이 없어 금융 계정을 자동 연결하지 못했습니다. 로그인 후 «연결 저장» 또는 미연결 목록에서 연결하세요.'
        )
      }

      setDraftDirty(false)
      paymentMethodsLoadedRef.current = false
      await loadPaymentMethodsInner(true)
      onSaved?.()
      setNewCardMethod('')
      setNewCardLast4('')
      setNewCardUserEmail('')
      setNewCardOpenForAccountId(null)
    } catch (e) {
      setPaymentMethodsError(e instanceof Error ? e.message : '새 카드 등록 중 오류가 났습니다.')
    } finally {
      setCreatingNewCard(false)
    }
  }

  const displayError = accountsError || paymentMethodsError
  const paymentMethodsHref = `/${locale}/admin/payment-methods`
  const statementRecoHref = `/${locale}/admin/statement-reconciliation`

  const orphanOrUnlinked = useMemo(() => {
    return paymentMethodsSorted.filter((pm) => {
      const fa = effectiveFa(pm)
      return !fa || !recoIdSet.has(fa)
    })
  }, [paymentMethodsSorted, effectiveFa, recoIdSet])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDraftDirty(false)
          setAddPickerVersionByAccount({})
          setNewCardOpenForAccountId(null)
          setNewCardMethod('')
          setNewCardLast4('')
          setNewCardUserEmail('')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-3xl w-[calc(100vw-1.25rem)] p-0 gap-0 flex flex-col max-h-[min(92vh,880px)] sm:max-h-[90vh]">
        <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg pr-2 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-600 shrink-0" aria-hidden />
              <span>
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>별 연결 카드
              </span>
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setDraftDirty(false)
                void loadAccounts()
                void loadPaymentMethodsInner(true)
              }}
              title="목록 새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-4">
          <p className="text-xs text-gray-500">
            명세 대조 상단에 보이는 <strong>활성 금융 계정</strong>마다 어떤{' '}
            <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>이 묶였는지 확인하고, 아래에서 연결{' '}
            <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>을 바꿀 수 있습니다. 저장은{' '}
            <strong>Super 권한</strong>이 필요합니다. 카드명·가이드·메모까지 함께 고치려면{' '}
            <button
              type="button"
              className="text-blue-600 underline hover:text-blue-800"
              onClick={() => {
                onOpenChange(false)
                onOpenFlatLinkModal?.()
              }}
            >
              «결제수단 ↔ 금융 계정 연결»
            </button>
            을 여세요.
          </p>
          {displayError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {displayError}
            </div>
          ) : null}

          {reconciliationAccounts.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              활성 금융 계정이 없습니다.{' '}
              <Link href={statementRecoHref} className="underline font-medium" onClick={() => onOpenChange(false)}>
                명세 대조
              </Link>
              의 «금융 계정»에서 추가하세요.
            </p>
          ) : null}

          {allAccounts.length === 0 && !accountsError ? (
            <p className="text-xs text-amber-800">금융 계정 목록을 불러오는 중…</p>
          ) : null}

          {reconciliationAccounts.map((acc) => {
            const linked = paymentMethodsSorted.filter((pm) => effectiveFa(pm) === acc.id)
            const addPool = paymentMethodsSorted.filter((pm) => effectiveFa(pm) !== acc.id)
            return (
              <section
                key={acc.id}
                id={`fa-linked-section-${acc.id}`}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 scroll-mt-3"
              >
                <div className="flex flex-wrap items-baseline gap-2 justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {acc.name}
                    <span className="ml-2 text-[11px] font-normal uppercase text-slate-500">
                      {acc.account_type === 'bank'
                        ? '은행'
                        : acc.account_type === 'credit_card'
                          ? '카드'
                          : acc.account_type}
                    </span>
                    <span className="ml-2 text-[11px] font-normal text-slate-500 tabular-nums">
                      연결 {linked.length}건
                    </span>
                  </h3>
                </div>

                {linked.length === 0 ? (
                  <p className="text-xs text-amber-900/90 mb-2">이 계정에 연결된 결제수단이 없습니다.</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {linked.map((pm) => (
                      <li
                        key={pm.id}
                        className="flex flex-col sm:flex-row sm:items-start gap-2 rounded-md bg-white border border-slate-100 px-2 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {paymentMethodShortLabel(pm)}
                          </div>
                          {paymentMethodUserLabel(pm) ? (
                            <div
                              className="text-xs text-slate-600 mt-0.5 truncate"
                              title={paymentMethodUserLabel(pm) ?? undefined}
                            >
                              사용자 {paymentMethodUserLabel(pm)}
                            </div>
                          ) : null}
                          <div className="text-[10px] text-slate-400 font-mono truncate" title={pm.id}>
                            {pm.id}
                          </div>
                        </div>
                        <select
                          disabled={saving || creatingNewCard}
                          className="w-full sm:w-[min(14rem,100%)] shrink-0 text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 disabled:opacity-50"
                          value={effectiveFa(pm) ?? ''}
                          onChange={(e) =>
                            setFaDraft(pm.id, e.target.value ? e.target.value : null)
                          }
                          aria-label={`${paymentMethodShortLabel(pm)} 금융 계정`}
                        >
                          <option value="">연결 안 함</option>
                          {accountOptionsSorted.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.account_type})
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}

                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  카드를 이 계정에 연결
                </label>
                <select
                  key={`add-pm-${acc.id}-${addPickerVersionByAccount[acc.id] ?? 0}`}
                  disabled={
                    saving || creatingNewCard || paymentMethods.length === 0 || allAccounts.length === 0
                  }
                  className="w-full max-w-md text-xs rounded-md border border-slate-300 bg-white px-2 py-2 disabled:opacity-50"
                  defaultValue=""
                  onChange={(e) => {
                    const pmId = e.target.value
                    if (pmId) {
                      setFaDraft(pmId, acc.id)
                      setAddPickerVersionByAccount((prev) => ({
                        ...prev,
                        [acc.id]: (prev[acc.id] ?? 0) + 1,
                      }))
                    }
                  }}
                  aria-label={`${acc.name}에 결제수단 추가`}
                >
                  <option value="">다른 카드 선택…</option>
                  {addPool.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {paymentMethodShortLabel(pm)}
                    </option>
                  ))}
                </select>

                <div className="mt-3 pt-3 border-t border-slate-200/90">
                  <button
                    type="button"
                    disabled={saving || creatingNewCard}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 underline disabled:opacity-50 disabled:no-underline"
                    onClick={() => {
                      if (newCardOpenForAccountId === acc.id) {
                        setNewCardOpenForAccountId(null)
                      } else {
                        setNewCardOpenForAccountId(acc.id)
                        setNewCardMethod('')
                        setNewCardLast4('')
                        setNewCardUserEmail('')
                      }
                    }}
                  >
                    {newCardOpenForAccountId === acc.id ? '새 카드 등록 닫기' : '+ 새 카드 등록'}
                  </button>
                  {newCardOpenForAccountId === acc.id ? (
                    <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3 max-w-md">
                      <p className="text-[11px] text-slate-500">
                        결제수단을 만든 뒤 이 금융 계정에 연결합니다. 계정 연결은{' '}
                        <strong>Super</strong> 권한이 필요합니다.
                      </p>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          카드·방법 이름 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={newCardMethod}
                          onChange={(e) => setNewCardMethod(e.target.value)}
                          placeholder="예: CC 0602"
                          className="w-full text-xs rounded-md border border-slate-300 px-2 py-1.5"
                          disabled={creatingNewCard}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          카드번호 끝 4자리
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={newCardLast4}
                          onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="1234"
                          className="w-full text-xs rounded-md border border-slate-300 px-2 py-1.5 max-w-[8rem]"
                          disabled={creatingNewCard}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          담당 사용자(팀)
                        </label>
                        <select
                          value={newCardUserEmail}
                          onChange={(e) => setNewCardUserEmail(e.target.value)}
                          className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5"
                          disabled={creatingNewCard}
                        >
                          <option value="">없음</option>
                          {teamPickRows.map((m) => (
                            <option key={m.email} value={m.email}>
                              {teamMemberSelectLabel(m)}
                              {m.is_active === false ? ' (비활성)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={creatingNewCard || !newCardMethod.trim()}
                        onClick={() => void createAndLinkNewCard(acc.id)}
                      >
                        {creatingNewCard ? '처리 중…' : '등록 후 이 계정에 연결'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
            )
          })}

          {orphanOrUnlinked.length > 0 ? (
            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-800 mb-1">
                미연결 또는 탭에 없는 금융 계정에 연결됨
              </h3>
              <p className="text-[11px] text-slate-500 mb-2">
                활성 명세 계정으로 옮기면 위 블록에 나타납니다. ({orphanOrUnlinked.length}건)
              </p>
              <ul className="space-y-2 max-h-[12rem] overflow-y-auto">
                {orphanOrUnlinked.map((pm) => (
                  <li
                    key={pm.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 rounded-md border border-slate-100 px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {paymentMethodShortLabel(pm)}
                      </div>
                      {paymentMethodUserLabel(pm) ? (
                        <div
                          className="text-xs text-slate-600 mt-0.5 truncate"
                          title={paymentMethodUserLabel(pm) ?? undefined}
                        >
                          사용자 {paymentMethodUserLabel(pm)}
                        </div>
                      ) : null}
                      <div className="text-[10px] text-slate-400 font-mono truncate">{pm.id}</div>
                    </div>
                    <select
                      disabled={saving || creatingNewCard}
                      className="w-full sm:w-[min(14rem,100%)] text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5"
                      value={effectiveFa(pm) ?? ''}
                      onChange={(e) =>
                        setFaDraft(pm.id, e.target.value ? e.target.value : null)
                      }
                    >
                      <option value="">연결 안 함</option>
                      {accountOptionsSorted.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.account_type})
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {paymentMethods.length === 0 && !paymentMethodsError ? (
            <p className="text-sm text-gray-600 text-center py-6">
              등록된 결제수단이 없습니다.{' '}
              <Link
                href={paymentMethodsHref}
                className="text-blue-600 font-medium underline"
                onClick={() => onOpenChange(false)}
              >
                결제 방법 관리
              </Link>
              에서 추가하세요.
            </p>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/90">
          <p className="text-xs text-gray-600">
            {hasChanges ? (
              <span className="text-amber-800 font-medium">저장하지 않은 연결 변경이 있습니다.</span>
            ) : (
              '연결 변경 없음 또는 서버와 동일합니다.'
            )}
          </p>
          <Button
            type="button"
            className="shrink-0 w-full sm:w-auto"
            disabled={!hasChanges || saving || creatingNewCard}
            onClick={() => void saveFaChanges()}
          >
            {saving ? '저장 중…' : '연결 저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
