'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { buildReceiptOcrCandidates } from '@/lib/receiptOcrParse'
import { runReceiptOcrFromImageBuffer } from '@/lib/receiptOcrBrowser'
import { loadTourExpenseReceiptImageBytes } from '@/lib/tourExpenseReceiptImageBytes'
import {
  RECEIPT_OCR_PARSE_RULES_KEY,
  buildReceiptOcrParseRuntime,
  parseStoredReceiptOcrRules,
  serializeReceiptOcrRulesForSave,
  upsertReceiptOcrParseRulesStored,
  type ReceiptOcrBodyMatchRuleStored,
  type ReceiptOcrCategoryRuleStored,
  type ReceiptOcrParseRulesStored,
} from '@/lib/receiptOcrParseRules'
import { canSaveReceiptOcrParseRules } from '@/lib/receiptOcrParseRulesPermissions'
import { plainPhraseToLineContainsPattern } from '@/lib/receiptOcrRuleTemplates'
import ReceiptOcrRuleTemplateDialog from '@/components/admin/ReceiptOcrRuleTemplateDialog'

type TourExpenseReceiptPick = {
  id: string
  image_url: string | null
  file_path: string | null
  paid_to: string | null
  paid_for: string
  tour_date: string
  amount: number | null
  submitted_by: string
  /** API가 내려주면 사용 — 없으면 URL/경로로 추정 */
  has_receipt_media?: boolean
}

function pickHasReceiptMedia(r: TourExpenseReceiptPick): boolean {
  if (typeof r.has_receipt_media === 'boolean') return r.has_receipt_media
  const u = String(r.image_url ?? '').trim()
  const fp = String(r.file_path ?? '').trim()
  return u.length > 0 || fp.length > 0
}

function formatReceiptPickLabel(r: TourExpenseReceiptPick, noMediaTag: string): string {
  const date = (r.tour_date ?? '').slice(0, 10) || '—'
  const pt = (r.paid_to ?? '').trim().slice(0, 28) || '—'
  const pf = (r.paid_for ?? '').trim().slice(0, 22) || '—'
  const amt =
    r.amount != null && Number.isFinite(r.amount) && r.amount > 0
      ? `$${Number(r.amount).toFixed(2)}`
      : '—'
  const tag = pickHasReceiptMedia(r) ? '' : `${noMediaTag} `
  return `${tag}${date} · ${pt} · ${pf} · ${amt}`
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const emptyStored = (): ReceiptOcrParseRulesStored =>
  serializeReceiptOcrRulesForSave({
    version: 1,
    category_rules: [],
    paid_to_skip_patterns: [],
    amount_line_hints: [],
    body_match_rules: [],
  })

export default function ReceiptOcrParseRulesAdmin() {
  const t = useTranslations('adminReceiptOcrParseRules')
  const { userPosition, authUser } = useAuth()
  const { paymentMethodOptions } = usePaymentMethodOptions()
  const activePaymentMethodOptions = useMemo(
    () => paymentMethodOptions.filter((o) => String(o.status || 'active').toLowerCase() === 'active'),
    [paymentMethodOptions]
  )
  const canSave = canSaveReceiptOcrParseRules({
    userPosition,
    email: authUser?.email,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stored, setStored] = useState<ReceiptOcrParseRulesStored>(emptyStored)

  const [previewText, setPreviewText] = useState('')
  const [receiptRows, setReceiptRows] = useState<TourExpenseReceiptPick[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [receiptFilter, setReceiptFilter] = useState('')
  const [selectedReceiptId, setSelectedReceiptId] = useState('')
  const [ocrFromReceiptLoading, setOcrFromReceiptLoading] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const previewUrlRef = React.useRef<string | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

  const replacePreviewImage = useCallback((buffer: ArrayBuffer, mime: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const u = URL.createObjectURL(new Blob([buffer], { type: mime }))
    previewUrlRef.current = u
    setPreviewImageUrl(u)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  const loadReceiptPickList = useCallback(async () => {
    setReceiptsLoading(true)
    try {
      const res = await fetch('/api/admin/receipt-ocr-parse-rules/receipt-picks', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          ...apiBearerAuthHeaders(),
        },
      })
      const json = (await res.json().catch(() => ({}))) as { data?: TourExpenseReceiptPick[]; error?: string }
      if (!res.ok) {
        toast.error(json.error || t('receiptListLoadError'))
        setReceiptRows([])
        return
      }
      setReceiptRows(Array.isArray(json.data) ? json.data : [])
    } finally {
      setReceiptsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadReceiptPickList()
  }, [loadReceiptPickList])

  const filteredReceiptRows = useMemo(() => {
    const q = receiptFilter.trim().toLowerCase()
    if (!q) return receiptRows
    return receiptRows.filter((r) => {
      const blob = [
        r.id,
        r.paid_to,
        r.paid_for,
        r.tour_date,
        r.submitted_by,
        r.amount != null ? String(r.amount) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [receiptRows, receiptFilter])

  const selectedReceiptPick = useMemo(
    () => receiptRows.find((r) => r.id === selectedReceiptId),
    [receiptRows, selectedReceiptId]
  )

  const runOcrOnSelectedReceipt = async () => {
    const row = receiptRows.find((r) => r.id === selectedReceiptId)
    if (!row) {
      toast.error(t('receiptPickRequired'))
      return
    }
    if (!pickHasReceiptMedia(row)) {
      toast.error(t('receiptOcrNoMediaOnRow'))
      return
    }
    setOcrFromReceiptLoading(true)
    try {
      const { buffer, mime } = await loadTourExpenseReceiptImageBytes(supabase, {
        imageUrl: row.image_url,
        filePath: row.file_path,
      })
      replacePreviewImage(buffer, mime)
      const { text } = await runReceiptOcrFromImageBuffer(buffer, mime)
      setPreviewText(text)
      toast.success(t('receiptOcrLoaded'))
    } catch (e) {
      if (e instanceof Error && e.message === 'RECEIPT_IMAGE_LOAD_FAILED') {
        toast.error(t('receiptImageLoadError'))
      } else {
        toast.error(e instanceof Error ? `${t('receiptOcrRunError')}: ${e.message}` : t('receiptOcrRunError'))
      }
    } finally {
      setOcrFromReceiptLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shared_settings')
        .select('setting_value')
        .eq('setting_key', RECEIPT_OCR_PARSE_RULES_KEY)
        .maybeSingle()

      if (error) {
        toast.error(t('loadError'))
        setStored(emptyStored())
        return
      }
      const parsed = parseStoredReceiptOcrRules(data?.setting_value)
      setStored(serializeReceiptOcrRulesForSave(parsed))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const syncPreview = useMemo(() => {
    const runtime = buildReceiptOcrParseRuntime(stored)
    return buildReceiptOcrCandidates(previewText, { runtime })
  }, [stored, previewText])

  const save = async () => {
    if (!canSave) {
      toast.error(t('noPermission'))
      return
    }
    setSaving(true)
    try {
      const payload = serializeReceiptOcrRulesForSave(stored)
      const { error } = await upsertReceiptOcrParseRulesStored(supabase, payload)
      if (error) {
        toast.error(error.message || t('saveError'))
        return
      }
      toast.success(t('saveSuccess'))
      setStored(payload)
    } finally {
      setSaving(false)
    }
  }

  const addCategory = () => {
    setStored((prev) => ({
      ...prev,
      category_rules: [
        ...prev.category_rules,
        { id: newId(), paid_for: '', keywords: [], enabled: true },
      ],
    }))
  }

  const addSkip = () => {
    setStored((prev) => ({
      ...prev,
      paid_to_skip_patterns: [
        ...prev.paid_to_skip_patterns,
        { id: newId(), pattern: '', flags: 'i', enabled: true },
      ],
    }))
  }

  const addAmountHint = () => {
    setStored((prev) => ({
      ...prev,
      amount_line_hints: [
        ...prev.amount_line_hints,
        { id: newId(), line_pattern: '', flags: 'i', enabled: true },
      ],
    }))
  }

  const addBodyMatch = () => {
    setStored((prev) => ({
      ...prev,
      body_match_rules: [
        ...prev.body_match_rules,
        {
          id: newId(),
          contains_phrase: '',
          paid_to: '',
          paid_for: '',
          payment_method_id: '',
          payment_use_cc_label: false,
          enabled: true,
        },
      ],
    }))
  }

  if (loading) {
    return <div className="px-4 py-8 text-sm text-gray-600">{t('loading')}</div>
  }

  return (
    <div className="w-full min-w-0 space-y-8 px-2 pb-24 pt-4 sm:px-4 md:px-5 lg:px-6 lg:pt-6 xl:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">{t('description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void load()}>
          {t('refresh')}
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || !canSave}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTemplateDialogOpen(true)}>
          {t('openTemplateDialog')}
        </Button>
        {!canSave ? <span className="self-center text-xs text-amber-700">{t('readOnlyHint')}</span> : null}
      </div>

      <ReceiptOcrRuleTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        newId={newId}
        onAddCategory={(row) =>
          setStored((p) => ({ ...p, category_rules: [...p.category_rules, row] }))
        }
        onAddSkip={(row) =>
          setStored((p) => ({ ...p, paid_to_skip_patterns: [...p.paid_to_skip_patterns, row] }))
        }
        onAddAmount={(row) =>
          setStored((p) => ({ ...p, amount_line_hints: [...p.amount_line_hints, row] }))
        }
        onAddBodyMatch={(row) =>
          setStored((p) => ({ ...p, body_match_rules: [...p.body_match_rules, row] }))
        }
      />

      <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 text-sm text-slate-800 shadow-sm">
        <h2 className="text-base font-semibold text-indigo-950">{t('guideTitle')}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
          <li>{t('guideStepBodyMatch')}</li>
          <li>{t('guideStepCategory')}</li>
          <li>{t('guideStepSkip')}</li>
          <li>{t('guideStepAmount')}</li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-600">{t('guideFooter')}</p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('sectionBodyMatch')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('sectionBodyMatchHint')}</p>
        <p className="mt-2 text-xs text-slate-700">{t('sectionBodyMatchPlain')}</p>
        <div className="mt-4 space-y-4">
          {stored.body_match_rules.map((row, idx) => (
            <BodyMatchRuleRow
              key={row.id}
              row={row}
              paymentOptions={activePaymentMethodOptions}
              onChange={(next) =>
                setStored((p) => {
                  const list = [...p.body_match_rules]
                  list[idx] = next
                  return { ...p, body_match_rules: list }
                })
              }
              onRemove={() =>
                setStored((p) => ({
                  ...p,
                  body_match_rules: p.body_match_rules.filter((r) => r.id !== row.id),
                }))
              }
              labels={{
                contains: t('fieldBodyContains'),
                containsPlaceholder: t('fieldBodyContainsPlaceholder'),
                paidTo: t('fieldBodyPaidTo'),
                paidToPlaceholder: t('fieldBodyPaidToPlaceholder'),
                paidFor: t('fieldBodyPaidFor'),
                paidForPlaceholder: t('fieldBodyPaidForPlaceholder'),
                paymentMethod: t('fieldBodyPaymentMethod'),
                paymentMethodNone: t('fieldBodyPaymentMethodNone'),
                paymentCc: t('fieldBodyPaymentCc'),
                enabled: t('fieldEnabled'),
                remove: t('remove'),
              }}
            />
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addBodyMatch}>
            {t('addBodyMatch')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('sectionCategory')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('sectionCategoryHint')}</p>
        <p className="mt-2 text-xs text-indigo-900/90 bg-indigo-50/80 border border-indigo-100 rounded px-2 py-1.5">
          {t('sectionCategoryPlain')}
        </p>
        <div className="mt-4 space-y-4">
          {stored.category_rules.map((row, idx) => (
            <CategoryRuleRow
              key={row.id}
              row={row}
              onChange={(next) =>
                setStored((p) => {
                  const nextRules = [...p.category_rules]
                  nextRules[idx] = next
                  return { ...p, category_rules: nextRules }
                })
              }
              onRemove={() =>
                setStored((p) => ({
                  ...p,
                  category_rules: p.category_rules.filter((r) => r.id !== row.id),
                }))
              }
              labels={{
                paidFor: t('fieldPaidFor'),
                keywords: t('fieldKeywords'),
                keywordsPlaceholder: t('fieldKeywordsPlaceholder'),
                keywordsHint: t('fieldKeywordsExplain'),
                enabled: t('fieldEnabled'),
                remove: t('remove'),
              }}
            />
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addCategory}>
            {t('addCategory')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('sectionPaidToSkip')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('sectionPaidToSkipHint')}</p>
        <p className="mt-2 text-xs text-slate-700">{t('sectionPaidToSkipPlain')}</p>
        <div className="mt-4 space-y-4">
          {stored.paid_to_skip_patterns.map((row, idx) => (
            <FriendlyLineMatchRuleRow
              key={row.id}
              storedPattern={row.pattern}
              plainPhrase={row.plain_phrase}
              flags={row.flags ?? 'i'}
              enabled={row.enabled}
              plainLabel={t('plainPhraseLabel')}
              plainPlaceholder={t('plainPhraseInputPlaceholder')}
              plainHint={t('plainPhraseHint')}
              advancedRegexLabel={t('advancedRegexToggle')}
              patternLabel={t('fieldRegex')}
              flagsLabel={t('fieldFlags')}
              enabledLabel={t('fieldEnabled')}
              legacyHint={t('legacyPatternHint')}
              onPatch={(patch) =>
                setStored((p) => {
                  const list = [...p.paid_to_skip_patterns]
                  const cur = list[idx]
                  list[idx] = {
                    ...cur,
                    ...(patch.storedPattern !== undefined ? { pattern: patch.storedPattern } : {}),
                    ...('plain_phrase' in patch ? { plain_phrase: patch.plain_phrase } : {}),
                    ...(patch.flags !== undefined ? { flags: patch.flags } : {}),
                    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
                  }
                  return { ...p, paid_to_skip_patterns: list }
                })
              }
              onRemove={() =>
                setStored((p) => ({
                  ...p,
                  paid_to_skip_patterns: p.paid_to_skip_patterns.filter((r) => r.id !== row.id),
                }))
              }
              removeLabel={t('remove')}
            />
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addSkip}>
            {t('addSkipPattern')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('sectionAmountHint')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('sectionAmountHintDetail')}</p>
        <p className="mt-2 text-xs text-slate-700">{t('sectionAmountPlain')}</p>
        <div className="mt-4 space-y-4">
          {stored.amount_line_hints.map((row, idx) => (
            <FriendlyLineMatchRuleRow
              key={row.id}
              storedPattern={row.line_pattern}
              plainPhrase={row.plain_phrase}
              flags={row.flags ?? 'i'}
              enabled={row.enabled}
              plainLabel={t('plainPhraseLabelAmount')}
              plainPlaceholder={t('plainPhraseInputPlaceholderAmount')}
              plainHint={t('plainPhraseHintAmount')}
              advancedRegexLabel={t('advancedRegexToggle')}
              patternLabel={t('fieldLineRegex')}
              flagsLabel={t('fieldFlags')}
              enabledLabel={t('fieldEnabled')}
              legacyHint={t('legacyPatternHint')}
              onPatch={(patch) =>
                setStored((p) => {
                  const list = [...p.amount_line_hints]
                  const cur = list[idx]
                  list[idx] = {
                    ...cur,
                    ...(patch.storedPattern !== undefined ? { line_pattern: patch.storedPattern } : {}),
                    ...('plain_phrase' in patch ? { plain_phrase: patch.plain_phrase } : {}),
                    ...(patch.flags !== undefined ? { flags: patch.flags } : {}),
                    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
                  }
                  return { ...p, amount_line_hints: list }
                })
              }
              onRemove={() =>
                setStored((p) => ({
                  ...p,
                  amount_line_hints: p.amount_line_hints.filter((r) => r.id !== row.id),
                }))
              }
              removeLabel={t('remove')}
            />
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addAmountHint}>
            {t('addAmountHint')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('sectionPreview')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('sectionPreviewHint')}</p>

        <div className="mt-4 rounded-md border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-3">
          <div className="text-sm font-medium text-gray-800">{t('previewFromDbReceipts')}</div>
          <p className="text-xs text-gray-500">{t('previewFromDbReceiptsHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadReceiptPickList()}
              disabled={receiptsLoading}
            >
              {receiptsLoading ? t('receiptsLoading') : t('receiptListRefresh')}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">{t('receiptFilterLabel')}</Label>
              <Input
                className="mt-1"
                value={receiptFilter}
                onChange={(e) => setReceiptFilter(e.target.value)}
                placeholder={t('receiptFilterPlaceholder')}
              />
            </div>
            <div>
              <Label className="text-xs">{t('receiptPickLabel')}</Label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={selectedReceiptId}
                onChange={(e) => setSelectedReceiptId(e.target.value)}
                disabled={receiptsLoading || filteredReceiptRows.length === 0}
              >
                <option value="">{t('receiptPickPlaceholder')}</option>
                {filteredReceiptRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatReceiptPickLabel(r, t('receiptPickNoMediaTag'))}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!receiptsLoading && receiptRows.length === 0 ? (
            <p className="text-xs text-amber-800">{t('receiptsEmpty')}</p>
          ) : null}
          {selectedReceiptPick && !pickHasReceiptMedia(selectedReceiptPick) ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              {t('receiptNoMediaHint')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void runOcrOnSelectedReceipt()}
              disabled={
                ocrFromReceiptLoading ||
                !selectedReceiptId ||
                !selectedReceiptPick ||
                !pickHasReceiptMedia(selectedReceiptPick)
              }
            >
              {ocrFromReceiptLoading ? t('receiptOcrRunning') : t('receiptOcrRun')}
            </Button>
          </div>
          {previewImageUrl ? (
            <div className="pt-1">
              <div className="text-xs font-medium text-gray-600 mb-1">{t('receiptPreviewThumb')}</div>
              <img
                src={previewImageUrl}
                alt=""
                className="max-h-48 max-w-full rounded border border-gray-200 bg-white object-contain"
              />
            </div>
          ) : null}
        </div>

        <Label className="mt-6 block text-sm">{t('previewSample')}</Label>
        <textarea
          className="mt-1 w-full min-h-[140px] rounded border border-gray-300 p-2 font-mono text-xs"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder={t('previewPlaceholder')}
        />
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">
          {JSON.stringify(syncPreview, null, 2)}
        </pre>
      </section>
    </div>
  )
}

function BodyMatchRuleRow({
  row,
  paymentOptions,
  onChange,
  onRemove,
  labels,
}: {
  row: ReceiptOcrBodyMatchRuleStored
  paymentOptions: Array<{ id: string; name: string }>
  onChange: (next: ReceiptOcrBodyMatchRuleStored) => void
  onRemove: () => void
  labels: {
    contains: string
    containsPlaceholder: string
    paidTo: string
    paidToPlaceholder: string
    paidFor: string
    paidForPlaceholder: string
    paymentMethod: string
    paymentMethodNone: string
    paymentCc: string
    enabled: string
    remove: string
  }
}) {
  const pmValue = row.payment_method_id?.trim() ? row.payment_method_id : '__none__'
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50/80 p-3 md:flex-row md:flex-wrap md:items-end">
      <div className="min-w-[10rem] flex-[2]">
        <Label className="text-xs">{labels.contains}</Label>
        <Input
          className="mt-1 text-sm"
          value={row.contains_phrase}
          placeholder={labels.containsPlaceholder}
          onChange={(e) => onChange({ ...row, contains_phrase: e.target.value })}
        />
      </div>
      <div className="min-w-[8rem] flex-1">
        <Label className="text-xs">{labels.paidTo}</Label>
        <Input
          className="mt-1 text-sm"
          value={row.paid_to}
          placeholder={labels.paidToPlaceholder}
          onChange={(e) => onChange({ ...row, paid_to: e.target.value })}
        />
      </div>
      <div className="min-w-[8rem] flex-1">
        <Label className="text-xs">{labels.paidFor}</Label>
        <Input
          className="mt-1 text-sm"
          value={row.paid_for}
          placeholder={labels.paidForPlaceholder}
          onChange={(e) => onChange({ ...row, paid_for: e.target.value })}
        />
      </div>
      <div className="min-w-[12rem] flex-[1.5]">
        <Label className="text-xs">{labels.paymentMethod}</Label>
        <Select
          value={pmValue}
          onValueChange={(v) => onChange({ ...row, payment_method_id: v === '__none__' ? '' : v })}
        >
          <SelectTrigger className="mt-1 h-9 text-sm">
            <SelectValue placeholder={labels.paymentMethodNone} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{labels.paymentMethodNone}</SelectItem>
            {paymentOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm max-w-[14rem]">
        <Checkbox
          checked={row.payment_use_cc_label}
          onCheckedChange={(c) => onChange({ ...row, payment_use_cc_label: c === true })}
        />
        <span className="text-xs leading-tight">{labels.paymentCc}</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={row.enabled} onCheckedChange={(c) => onChange({ ...row, enabled: c === true })} />
        {labels.enabled}
      </label>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {labels.remove}
      </Button>
    </div>
  )
}

function regexLooksAdvanced(pattern: string): boolean {
  if (!pattern.trim()) return false
  let esc = false
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (esc) {
      esc = false
      continue
    }
    if (c === '\\') {
      esc = true
      continue
    }
    if ('.*+?^${}()|[]'.includes(c)) return true
  }
  return false
}

function FriendlyLineMatchRuleRow({
  storedPattern,
  plainPhrase,
  flags,
  enabled,
  plainLabel,
  plainPlaceholder,
  plainHint,
  advancedRegexLabel,
  patternLabel,
  flagsLabel,
  enabledLabel,
  legacyHint,
  onPatch,
  onRemove,
  removeLabel,
}: {
  storedPattern: string
  plainPhrase?: string
  flags: string
  enabled: boolean
  plainLabel: string
  plainPlaceholder: string
  plainHint: string
  advancedRegexLabel: string
  patternLabel: string
  flagsLabel: string
  enabledLabel: string
  legacyHint: string
  onPatch: (patch: {
    storedPattern?: string
    plain_phrase?: string | undefined
    flags?: string
    enabled?: boolean
  }) => void
  onRemove: () => void
  removeLabel: string
}) {
  const [showAdvanced, setShowAdvanced] = useState(() => {
    const plain = plainPhrase?.trim() ?? ''
    if (plain.length > 0) return false
    return regexLooksAdvanced(storedPattern)
  })

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-100 bg-gray-50/80 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-[12rem] flex-[2]">
          <Label className="text-xs">{plainLabel}</Label>
          <Input
            className="mt-1 text-sm"
            value={plainPhrase ?? ''}
            placeholder={plainPlaceholder}
            onChange={(e) => {
              const v = e.target.value
              const pat = plainPhraseToLineContainsPattern(v)
              onPatch({
                plain_phrase: v.trim() || undefined,
                storedPattern: pat,
                flags: 'i',
              })
              if (v.trim()) setShowAdvanced(false)
            }}
          />
          <p className="mt-1 text-[10px] text-gray-500">{plainHint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(c) => onPatch({ enabled: c === true })} />
          {enabledLabel}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {removeLabel}
        </Button>
      </div>
      {!plainPhrase?.trim() && storedPattern.trim() && regexLooksAdvanced(storedPattern) ? (
        <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1">{legacyHint}</p>
      ) : null}
      <button
        type="button"
        className="text-left text-xs text-indigo-700 hover:underline w-fit"
        onClick={() => setShowAdvanced((x) => !x)}
      >
        {advancedRegexLabel}
      </button>
      {showAdvanced ? (
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end border-t border-gray-200 pt-2">
          <div className="min-w-[12rem] flex-[2]">
            <Label className="text-xs">{patternLabel}</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={storedPattern}
              onChange={(e) =>
                onPatch({
                  storedPattern: e.target.value,
                  plain_phrase: undefined,
                })
              }
            />
          </div>
          <div className="w-24">
            <Label className="text-xs">{flagsLabel}</Label>
            <Input className="mt-1 font-mono text-sm" value={flags} onChange={(e) => onPatch({ flags: e.target.value })} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CategoryRuleRow({
  row,
  onChange,
  onRemove,
  labels,
}: {
  row: ReceiptOcrCategoryRuleStored
  onChange: (next: ReceiptOcrCategoryRuleStored) => void
  onRemove: () => void
  labels: {
    paidFor: string
    keywords: string
    keywordsPlaceholder: string
    keywordsHint: string
    enabled: string
    remove: string
  }
}) {
  const kwStr = row.keywords.join(', ')
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50/80 p-3 md:flex-row md:flex-wrap md:items-end">
      <div className="min-w-[8rem] flex-1">
        <Label className="text-xs">{labels.paidFor}</Label>
        <Input
          className="mt-1"
          value={row.paid_for}
          onChange={(e) => onChange({ ...row, paid_for: e.target.value })}
        />
      </div>
      <div className="min-w-[12rem] flex-[2]">
        <Label className="text-xs">{labels.keywords}</Label>
        <Input
          className="mt-1"
          value={kwStr}
          placeholder={labels.keywordsPlaceholder}
          onChange={(e) =>
            onChange({
              ...row,
              keywords: e.target.value
                .split(/[,|\n]+/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
            })
          }
        />
        <p className="mt-1 text-[10px] text-gray-500">{labels.keywordsHint}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={row.enabled} onCheckedChange={(c) => onChange({ ...row, enabled: c === true })} />
        {labels.enabled}
      </label>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {labels.remove}
      </Button>
    </div>
  )
}

