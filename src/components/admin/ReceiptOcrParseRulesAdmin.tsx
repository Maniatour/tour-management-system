'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Image as ImageIcon, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
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
  normalizeReceiptBodyForMatch,
  parseStoredReceiptOcrRules,
  serializeReceiptOcrRulesForSave,
  suggestBodyMatchPhraseFromOcrText,
  upsertReceiptOcrParseRulesStored,
  type ReceiptOcrBodyMatchRuleStored,
  type ReceiptOcrCategoryRuleStored,
  type ReceiptOcrParseRulesStored,
} from '@/lib/receiptOcrParseRules'
import type { ReceiptOcrCandidates } from '@/lib/receiptOcrParse'
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

function formatReceiptPickShortCaption(r: TourExpenseReceiptPick): string {
  const date = (r.tour_date ?? '').slice(0, 10) || '—'
  const pt = (r.paid_to ?? '').trim().slice(0, 18) || '—'
  const amt =
    r.amount != null && Number.isFinite(r.amount) && r.amount > 0
      ? `$${Number(r.amount).toFixed(2)}`
      : '—'
  return `${date} · ${pt} · ${amt}`
}

function resolveReceiptDisplayUrl(
  supabaseClient: typeof supabase,
  row: TourExpenseReceiptPick
): string | null {
  const u = String(row.image_url ?? '').trim()
  if (u) return u
  const fp = String(row.file_path ?? '').trim()
  if (!fp) return null
  const {
    data: { publicUrl },
  } = supabaseClient.storage.from('tour-expenses').getPublicUrl(fp)
  return publicUrl || null
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

type AdminTab = 'preview' | 'bodyMatch' | 'category' | 'skip' | 'amount'

function bodyMatchRuleMatchesPreview(row: ReceiptOcrBodyMatchRuleStored, previewText: string): boolean {
  if (!row.enabled || !previewText.trim()) return false
  const hay = normalizeReceiptBodyForMatch(previewText)
  const needle = normalizeReceiptBodyForMatch(row.contains_phrase)
  return needle.length > 0 && hay.includes(needle)
}

function categoryRuleMatchesPreview(row: ReceiptOcrCategoryRuleStored, previewText: string): boolean {
  if (!row.enabled || !previewText.trim()) return false
  const lower = previewText.toLowerCase()
  return row.keywords.some((kw) => kw.length > 0 && lower.includes(kw))
}

function lineRuleMatchesPreview(pattern: string, flags: string | undefined, previewText: string): boolean {
  if (!previewText.trim() || !pattern.trim()) return false
  const re = (() => {
    try {
      return new RegExp(pattern, flags && /^[gimsuy]*$/.test(flags) ? flags : 'i')
    } catch {
      return null
    }
  })()
  if (!re) return false
  return previewText.split(/\r?\n/).some((line) => re.test(line))
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
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('preview')
  const [expenseCategoryNames, setExpenseCategoryNames] = useState<string[]>([])
  const [quickAddPhrase, setQuickAddPhrase] = useState('')
  const [quickAddPaidTo, setQuickAddPaidTo] = useState('')
  const [quickAddPaidFor, setQuickAddPaidFor] = useState('')
  const [quickAddUseCc, setQuickAddUseCc] = useState(false)
  const [showPreviewJson, setShowPreviewJson] = useState(false)

  const [previewText, setPreviewText] = useState('')
  const [receiptRows, setReceiptRows] = useState<TourExpenseReceiptPick[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [receiptFilter, setReceiptFilter] = useState('')
  const [selectedReceiptId, setSelectedReceiptId] = useState('')
  const [ocrFromReceiptLoading, setOcrFromReceiptLoading] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const previewUrlIsBlobRef = useRef(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [receiptPreviewZoomOpen, setReceiptPreviewZoomOpen] = useState(false)
  const [receiptPreviewZoom, setReceiptPreviewZoom] = useState(1)

  const clearBlobPreviewUrl = useCallback(() => {
    if (previewUrlRef.current && previewUrlIsBlobRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = null
    previewUrlIsBlobRef.current = false
  }, [])

  const setPreviewFromPublicUrl = useCallback(
    (url: string) => {
      clearBlobPreviewUrl()
      setPreviewImageUrl(url)
    },
    [clearBlobPreviewUrl]
  )

  const replacePreviewImage = useCallback((buffer: ArrayBuffer, mime: string) => {
    clearBlobPreviewUrl()
    const u = URL.createObjectURL(new Blob([buffer], { type: mime }))
    previewUrlRef.current = u
    previewUrlIsBlobRef.current = true
    setPreviewImageUrl(u)
  }, [clearBlobPreviewUrl])

  useEffect(() => {
    return () => {
      clearBlobPreviewUrl()
    }
  }, [clearBlobPreviewUrl])

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

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('expense_categories').select('name').order('name')
      setExpenseCategoryNames((data ?? []).map((r) => String(r.name ?? '').trim()).filter(Boolean))
    })()
  }, [])

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

  const filteredReceiptRowsWithMedia = useMemo(
    () => filteredReceiptRows.filter((r) => pickHasReceiptMedia(r)),
    [filteredReceiptRows]
  )

  const selectedReceiptPick = useMemo(
    () => receiptRows.find((r) => r.id === selectedReceiptId),
    [receiptRows, selectedReceiptId]
  )

  const handleSelectReceipt = useCallback(
    (row: TourExpenseReceiptPick) => {
      setSelectedReceiptId(row.id)
      const url = resolveReceiptDisplayUrl(supabase, row)
      if (url) setPreviewFromPublicUrl(url)
    },
    [setPreviewFromPublicUrl]
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
      const payload = serializeReceiptOcrRulesForSave(parsed)
      setStored(payload)
      setSavedSnapshot(JSON.stringify(payload))
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

  const isDirty = useMemo(
    () => JSON.stringify(stored) !== savedSnapshot,
    [stored, savedSnapshot]
  )

  const matchingBodyRuleIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of stored.body_match_rules) {
      if (bodyMatchRuleMatchesPreview(row, previewText)) ids.add(row.id)
    }
    return ids
  }, [stored.body_match_rules, previewText])

  const matchingCategoryRuleIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of stored.category_rules) {
      if (categoryRuleMatchesPreview(row, previewText)) ids.add(row.id)
    }
    return ids
  }, [stored.category_rules, previewText])

  const sortedBodyMatchRules = useMemo(() => {
    if (!previewText.trim() || matchingBodyRuleIds.size === 0) return stored.body_match_rules
    return [...stored.body_match_rules].sort((a, b) => {
      const am = matchingBodyRuleIds.has(a.id) ? 0 : 1
      const bm = matchingBodyRuleIds.has(b.id) ? 0 : 1
      return am - bm
    })
  }, [stored.body_match_rules, matchingBodyRuleIds, previewText])

  useEffect(() => {
    if (!previewText.trim()) return
    setQuickAddPhrase((prev) => (prev.trim() ? prev : suggestBodyMatchPhraseFromOcrText(previewText)))
    setQuickAddPaidTo((prev) => (prev.trim() ? prev : (syncPreview.paid_to || '').trim()))
    setQuickAddPaidFor((prev) => (prev.trim() ? prev : (syncPreview.paid_for || '').trim()))
  }, [previewText, syncPreview.paid_for, syncPreview.paid_to])

  const fillBodyMatchFromPreview = (row: ReceiptOcrBodyMatchRuleStored): ReceiptOcrBodyMatchRuleStored => ({
    ...row,
    contains_phrase: row.contains_phrase.trim() || suggestBodyMatchPhraseFromOcrText(previewText),
    paid_to: row.paid_to.trim() || (syncPreview.paid_to || '').trim(),
    paid_for: row.paid_for.trim() || (syncPreview.paid_for || '').trim(),
    payment_use_cc_label: row.payment_use_cc_label || Boolean(syncPreview.card_last4.trim()),
  })

  const addBodyMatchFromQuickAdd = () => {
    const phrase = quickAddPhrase.trim()
    const paidTo = quickAddPaidTo.trim()
    const paidFor = quickAddPaidFor.trim()
    if (!phrase) {
      toast.error(t('quickAddPhraseRequired'))
      return
    }
    if (!paidTo && !paidFor && !quickAddUseCc) {
      toast.error(t('quickAddTargetsRequired'))
      return
    }
    setStored((prev) => ({
      ...prev,
      body_match_rules: [
        {
          id: newId(),
          contains_phrase: phrase.slice(0, 120),
          paid_to: paidTo,
          paid_for: paidFor,
          payment_method_id: '',
          payment_use_cc_label: quickAddUseCc,
          enabled: true,
        },
        ...prev.body_match_rules,
      ],
    }))
    setActiveTab('bodyMatch')
    toast.success(t('quickAddBodyMatchAdded'))
  }

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
      setSavedSnapshot(JSON.stringify(payload))
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
          contains_phrase: suggestBodyMatchPhraseFromOcrText(previewText),
          paid_to: (syncPreview.paid_to || '').trim(),
          paid_for: (syncPreview.paid_for || '').trim(),
          payment_method_id: '',
          payment_use_cc_label: Boolean(syncPreview.card_last4.trim()),
          enabled: true,
        },
      ],
    }))
  }

  const adminTabs: Array<{ id: AdminTab; label: string; count: number }> = [
    { id: 'preview', label: t('tabPreview'), count: 0 },
    { id: 'bodyMatch', label: t('tabBodyMatch'), count: stored.body_match_rules.length },
    { id: 'category', label: t('tabCategory'), count: stored.category_rules.length },
    { id: 'skip', label: t('tabSkip'), count: stored.paid_to_skip_patterns.length },
    { id: 'amount', label: t('tabAmount'), count: stored.amount_line_hints.length },
  ]

  const bodyMatchLabels = {
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
    fillFromPreview: t('fillFromPreview'),
    matchesPreview: t('ruleMatchesPreview'),
    categoryPickHint: t('categoryPickHint'),
  }

  const categoryLabels = {
    paidFor: t('fieldPaidFor'),
    keywords: t('fieldKeywords'),
    keywordsPlaceholder: t('fieldKeywordsPlaceholder'),
    keywordsHint: t('fieldKeywordsExplain'),
    enabled: t('fieldEnabled'),
    remove: t('remove'),
    matchesPreview: t('ruleMatchesPreview'),
    categoryPickHint: t('categoryPickHint'),
  }

  if (loading) {
    return <div className="px-4 py-8 text-sm text-gray-600">{t('loading')}</div>
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-2 pb-28 pt-4 sm:px-4 md:px-5 lg:px-6 lg:pt-6 xl:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">{t('description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => void load()}>
          {t('refresh')}
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || !canSave || !isDirty}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTemplateDialogOpen(true)}>
          {t('openTemplateDialog')}
        </Button>
        {isDirty ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-200">
            {t('unsavedChanges')}
          </Badge>
        ) : null}
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

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.id !== 'preview' && tab.count > 0 ? (
              <span className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                ({tab.count})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'preview' ? (
        <>
          <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 text-sm text-slate-800 shadow-sm">
            <h2 className="text-base font-semibold text-indigo-950">{t('guideTitle')}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
              <li>{t('guideWorkflowStep1')}</li>
              <li>{t('guideWorkflowStep2')}</li>
              <li>{t('guideWorkflowStep3')}</li>
            </ol>
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
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{t('receiptFilterLabel')}</Label>
                  <Input
                    className="mt-1"
                    value={receiptFilter}
                    onChange={(e) => setReceiptFilter(e.target.value)}
                    placeholder={t('receiptFilterPlaceholder')}
                  />
                </div>
                <ReceiptImagePickerGrid
                  rows={filteredReceiptRowsWithMedia}
                  selectedId={selectedReceiptId}
                  loading={receiptsLoading}
                  resolveDisplayUrl={(row) => resolveReceiptDisplayUrl(supabase, row)}
                  onSelect={handleSelectReceipt}
                  labels={{
                    title: t('receiptImagePickerLabel'),
                    empty: t('receiptImagePickerEmpty'),
                    count: t('receiptImagePickerCount', { count: filteredReceiptRowsWithMedia.length }),
                    loadFailed: t('receiptImageThumbFailed'),
                    selected: t('receiptImagePickerSelected'),
                    loading: t('receiptsLoading'),
                  }}
                />
              </div>
              {!receiptsLoading && receiptRows.length === 0 ? (
                <p className="text-xs text-amber-800">{t('receiptsEmpty')}</p>
              ) : null}
              {!receiptsLoading &&
              receiptRows.length > 0 &&
              filteredReceiptRowsWithMedia.length === 0 ? (
                <p className="text-xs text-amber-800">{t('receiptImagePickerEmpty')}</p>
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
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-gray-600">
                      {selectedReceiptPick
                        ? `${t('receiptPreviewThumb')} · ${formatReceiptPickShortCaption(selectedReceiptPick)}`
                        : t('receiptPreviewThumb')}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setReceiptPreviewZoom(1)
                        setReceiptPreviewZoomOpen(true)
                      }}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      {t('receiptPreviewExpand')}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptPreviewZoom(1)
                      setReceiptPreviewZoomOpen(true)
                    }}
                    className="group block w-full rounded-lg border border-gray-200 bg-slate-50 p-2 text-left transition-colors hover:border-indigo-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title={t('receiptPreviewClickToExpand')}
                  >
                    <img
                      src={previewImageUrl}
                      alt=""
                      className="mx-auto max-h-80 w-full object-contain"
                    />
                    <p className="mt-2 text-center text-[11px] text-gray-500 group-hover:text-indigo-700">
                      {t('receiptPreviewClickToExpand')}
                    </p>
                  </button>
                  <ReceiptPreviewZoomDialog
                    open={receiptPreviewZoomOpen}
                    onOpenChange={(open) => {
                      setReceiptPreviewZoomOpen(open)
                      if (!open) setReceiptPreviewZoom(1)
                    }}
                    imageUrl={previewImageUrl}
                    title={
                      selectedReceiptPick
                        ? `${t('receiptPreviewThumb')} · ${formatReceiptPickShortCaption(selectedReceiptPick)}`
                        : t('receiptPreviewThumb')
                    }
                    zoom={receiptPreviewZoom}
                    onZoomChange={setReceiptPreviewZoom}
                    labels={{
                      zoomIn: t('receiptPreviewZoomIn'),
                      zoomOut: t('receiptPreviewZoomOut'),
                      zoomReset: t('receiptPreviewZoomReset'),
                      openNew: t('receiptPreviewOpenNew'),
                    }}
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

            <ParsePreviewSummary candidates={syncPreview} labels={t} />

            {previewText.trim() ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">{t('quickAddTitle')}</h3>
                  <p className="mt-1 text-xs text-emerald-900/90">{t('quickAddHint')}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">{t('quickAddPhraseLabel')}</Label>
                    <Input
                      className="mt-1 text-sm"
                      value={quickAddPhrase}
                      onChange={(e) => setQuickAddPhrase(e.target.value)}
                      placeholder={t('fieldBodyContainsPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('fieldBodyPaidTo')}</Label>
                    <Input
                      className="mt-1 text-sm"
                      value={quickAddPaidTo}
                      onChange={(e) => setQuickAddPaidTo(e.target.value)}
                      placeholder={t('fieldBodyPaidToPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('fieldBodyPaidFor')}</Label>
                    <Input
                      className="mt-1 text-sm"
                      value={quickAddPaidFor}
                      onChange={(e) => setQuickAddPaidFor(e.target.value)}
                      placeholder={t('fieldBodyPaidForPlaceholder')}
                      list="receipt-ocr-expense-category-options"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">{t('categoryPickHint')}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={quickAddUseCc} onCheckedChange={(c) => setQuickAddUseCc(c === true)} />
                  {t('fieldBodyPaymentCc')}
                </label>
                <Button type="button" size="sm" onClick={addBodyMatchFromQuickAdd} disabled={!canSave}>
                  {t('quickAddBtn')}
                </Button>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 text-xs text-indigo-700 hover:underline"
              onClick={() => setShowPreviewJson((x) => !x)}
            >
              {showPreviewJson ? t('previewHideJson') : t('previewShowJson')}
            </button>
            {showPreviewJson ? (
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">
                {JSON.stringify(syncPreview, null, 2)}
              </pre>
            ) : null}

            {previewText.trim() && matchingBodyRuleIds.size > 0 ? (
              <p className="mt-4 text-xs text-indigo-800">
                {t('previewMatchingRulesSummary', {
                  body: matchingBodyRuleIds.size,
                  category: matchingCategoryRuleIds.size,
                })}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {activeTab === 'bodyMatch' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{t('sectionBodyMatch')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('sectionBodyMatchHint')}</p>
          <p className="mt-2 text-xs text-slate-700">{t('sectionBodyMatchPlain')}</p>
          {previewText.trim() && matchingBodyRuleIds.size > 0 ? (
            <p className="mt-2 text-xs text-emerald-800">{t('matchingRulesSortedHint')}</p>
          ) : null}
          <div className="mt-4 space-y-4">
            {sortedBodyMatchRules.map((row) => (
              <BodyMatchRuleRow
                key={row.id}
                row={row}
                paymentOptions={activePaymentMethodOptions}
                expenseCategoryNames={expenseCategoryNames}
                matchesPreview={matchingBodyRuleIds.has(row.id)}
                onFillFromPreview={() =>
                  setStored((p) => ({
                    ...p,
                    body_match_rules: p.body_match_rules.map((r) =>
                      r.id === row.id ? fillBodyMatchFromPreview(r) : r
                    ),
                  }))
                }
                canFillFromPreview={Boolean(previewText.trim())}
                onChange={(next) =>
                  setStored((p) => ({
                    ...p,
                    body_match_rules: p.body_match_rules.map((r) => (r.id === row.id ? next : r)),
                  }))
                }
                onRemove={() =>
                  setStored((p) => ({
                    ...p,
                    body_match_rules: p.body_match_rules.filter((r) => r.id !== row.id),
                  }))
                }
                labels={bodyMatchLabels}
              />
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addBodyMatch}>
              {t('addBodyMatch')}
            </Button>
          </div>
        </section>
      ) : null}

      {activeTab === 'category' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{t('sectionCategory')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('sectionCategoryHint')}</p>
          <p className="mt-2 text-xs text-indigo-900/90 bg-indigo-50/80 border border-indigo-100 rounded px-2 py-1.5">
            {t('sectionCategoryPlain')}
          </p>
          <div className="mt-4 space-y-4">
            {stored.category_rules.map((row) => (
              <CategoryRuleRow
                key={row.id}
                row={row}
                expenseCategoryNames={expenseCategoryNames}
                matchesPreview={matchingCategoryRuleIds.has(row.id)}
                onChange={(next) =>
                  setStored((p) => ({
                    ...p,
                    category_rules: p.category_rules.map((r) => (r.id === row.id ? next : r)),
                  }))
                }
                onRemove={() =>
                  setStored((p) => ({
                    ...p,
                    category_rules: p.category_rules.filter((r) => r.id !== row.id),
                  }))
                }
                labels={categoryLabels}
              />
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addCategory}>
              {t('addCategory')}
            </Button>
          </div>
        </section>
      ) : null}

      {activeTab === 'skip' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{t('sectionPaidToSkip')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('sectionPaidToSkipHint')}</p>
          <p className="mt-2 text-xs text-slate-700">{t('sectionPaidToSkipPlain')}</p>
          <div className="mt-4 space-y-4">
            {stored.paid_to_skip_patterns.map((row, idx) => (
              <FriendlyLineMatchRuleRow
                key={row.id}
                storedPattern={row.pattern}
                {...(row.plain_phrase !== undefined ? { plainPhrase: row.plain_phrase } : {})}
                flags={row.flags ?? 'i'}
                enabled={row.enabled}
                matchesPreview={lineRuleMatchesPreview(row.pattern, row.flags, previewText)}
                plainLabel={t('plainPhraseLabel')}
                plainPlaceholder={t('plainPhraseInputPlaceholder')}
                plainHint={t('plainPhraseHint')}
                advancedRegexLabel={t('advancedRegexToggle')}
                patternLabel={t('fieldRegex')}
                flagsLabel={t('fieldFlags')}
                enabledLabel={t('fieldEnabled')}
                legacyHint={t('legacyPatternHint')}
                matchesPreviewLabel={t('ruleMatchesPreview')}
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
                    } as typeof cur
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
      ) : null}

      {activeTab === 'amount' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{t('sectionAmountHint')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('sectionAmountHintDetail')}</p>
          <p className="mt-2 text-xs text-slate-700">{t('sectionAmountPlain')}</p>
          <div className="mt-4 space-y-4">
            {stored.amount_line_hints.map((row, idx) => (
              <FriendlyLineMatchRuleRow
                key={row.id}
                storedPattern={row.line_pattern}
                {...(row.plain_phrase !== undefined ? { plainPhrase: row.plain_phrase } : {})}
                flags={row.flags ?? 'i'}
                enabled={row.enabled}
                matchesPreview={lineRuleMatchesPreview(row.line_pattern, row.flags, previewText)}
                plainLabel={t('plainPhraseLabelAmount')}
                plainPlaceholder={t('plainPhraseInputPlaceholderAmount')}
                plainHint={t('plainPhraseHintAmount')}
                advancedRegexLabel={t('advancedRegexToggle')}
                patternLabel={t('fieldLineRegex')}
                flagsLabel={t('fieldFlags')}
                enabledLabel={t('fieldEnabled')}
                legacyHint={t('legacyPatternHint')}
                matchesPreviewLabel={t('ruleMatchesPreview')}
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
                    } as typeof cur
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
      ) : null}

      <datalist id="receipt-ocr-expense-category-options">
        {expenseCategoryNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {isDirty && canSave ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-200 bg-amber-50/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-amber-900">{t('unsavedChangesSticky')}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {t('discardReload')}
              </Button>
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ReceiptPreviewZoomDialog({
  open,
  onOpenChange,
  imageUrl,
  title,
  zoom,
  onZoomChange,
  labels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  title: string
  zoom: number
  onZoomChange: (zoom: number) => void
  labels: {
    zoomIn: string
    zoomOut: string
    zoomReset: string
    openNew: string
  }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-gray-200 px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-slate-50 px-3 py-2 shrink-0">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.25, Math.round((zoom - 0.25) * 100) / 100))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            title={labels.zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-gray-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(4, Math.round((zoom + 0.25) * 100) / 100))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            title={labels.zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {labels.zoomReset}
          </button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {labels.openNew}
          </a>
        </div>
        <div className="min-h-[50vh] flex-1 overflow-auto bg-slate-100/90 p-4">
          <img
            src={imageUrl}
            alt=""
            style={{
              width: `${100 * zoom}%`,
              maxWidth: 'none',
              height: 'auto',
            }}
            className="mx-auto block rounded-lg shadow-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptImagePickerGrid({
  rows,
  selectedId,
  loading,
  resolveDisplayUrl,
  onSelect,
  labels,
}: {
  rows: TourExpenseReceiptPick[]
  selectedId: string
  loading: boolean
  resolveDisplayUrl: (row: TourExpenseReceiptPick) => string | null
  onSelect: (row: TourExpenseReceiptPick) => void
  labels: {
    title: string
    empty: string
    count: string
    loadFailed: string
    selected: string
    loading: string
  }
}) {
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set())

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {labels.loading}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
        {labels.empty}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">{labels.title}</Label>
        <span className="text-[11px] text-gray-500">{labels.count}</span>
      </div>
      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((row) => {
            const url = resolveDisplayUrl(row)
            const isSelected = row.id === selectedId
            const broken = brokenIds.has(row.id) || !url
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect(row)}
                className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/40 shadow-md'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
                title={formatReceiptPickLabel(row, '')}
              >
                <div className="relative aspect-[3/4] w-full bg-gray-100">
                  {!broken && url ? (
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover object-center"
                      onError={() =>
                        setBrokenIds((prev) => {
                          const next = new Set(prev)
                          next.add(row.id)
                          return next
                        })
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-gray-500">
                      <ImageIcon className="h-6 w-6 text-gray-400" aria-hidden />
                      <span>{labels.loadFailed}</span>
                    </div>
                  )}
                  {isSelected ? (
                    <span className="absolute left-1 top-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {labels.selected}
                    </span>
                  ) : null}
                </div>
                <div className="border-t border-gray-100 bg-white px-1.5 py-1.5">
                  <p className="truncate text-[10px] font-medium text-gray-800">
                    {formatReceiptPickShortCaption(row)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ParsePreviewSummary({
  candidates,
  labels,
}: {
  candidates: ReceiptOcrCandidates
  labels: (key: string) => string
}) {
  const amount =
    candidates.amount != null && candidates.amount > 0
      ? `$${candidates.amount.toFixed(2)}`
      : '—'
  const fields = [
    { label: labels('previewFieldPaidTo'), value: candidates.paid_to || '—' },
    { label: labels('previewFieldPaidFor'), value: candidates.paid_for || '—' },
    { label: labels('previewFieldAmount'), value: amount },
    { label: labels('previewFieldDate'), value: candidates.date || '—' },
    {
      label: labels('previewFieldPayment'),
      value: candidates.payment_method_text || candidates.card_last4 || '—',
    },
  ]
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-800">{labels('previewParseResult')}</div>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label} className="rounded-md bg-white px-2 py-1.5 border border-slate-100">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{f.label}</dt>
            <dd className="text-sm font-medium text-slate-900 break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function BodyMatchRuleRow({
  row,
  paymentOptions,
  expenseCategoryNames,
  matchesPreview,
  canFillFromPreview,
  onFillFromPreview,
  onChange,
  onRemove,
  labels,
}: {
  row: ReceiptOcrBodyMatchRuleStored
  paymentOptions: Array<{ id: string; name: string }>
  expenseCategoryNames: string[]
  matchesPreview: boolean
  canFillFromPreview: boolean
  onFillFromPreview: () => void
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
    fillFromPreview: string
    matchesPreview: string
    categoryPickHint: string
  }
}) {
  const pmValue = row.payment_method_id?.trim() ? row.payment_method_id : '__none__'
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-3 md:flex-row md:flex-wrap md:items-end ${
        matchesPreview
          ? 'border-emerald-300 bg-emerald-50/50'
          : 'border-gray-100 bg-gray-50/80'
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2 md:w-auto md:flex-1 md:min-w-full">
        {matchesPreview ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border-emerald-200">
            {labels.matchesPreview}
          </Badge>
        ) : null}
        {canFillFromPreview ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={onFillFromPreview}>
            {labels.fillFromPreview}
          </Button>
        ) : null}
      </div>
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
          list="receipt-ocr-expense-category-options"
          onChange={(e) => onChange({ ...row, paid_for: e.target.value })}
        />
        {expenseCategoryNames.length > 0 ? (
          <p className="mt-1 text-[10px] text-gray-500">{labels.categoryPickHint}</p>
        ) : null}
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
  matchesPreview = false,
  plainLabel,
  plainPlaceholder,
  plainHint,
  advancedRegexLabel,
  patternLabel,
  flagsLabel,
  enabledLabel,
  legacyHint,
  matchesPreviewLabel,
  onPatch,
  onRemove,
  removeLabel,
}: {
  storedPattern: string
  plainPhrase?: string
  flags: string
  enabled: boolean
  matchesPreview?: boolean
  plainLabel: string
  plainPlaceholder: string
  plainHint: string
  advancedRegexLabel: string
  patternLabel: string
  flagsLabel: string
  enabledLabel: string
  legacyHint: string
  matchesPreviewLabel?: string
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
    <div
      className={`flex flex-col gap-3 rounded-md border p-3 ${
        matchesPreview ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/80'
      }`}
    >
      {matchesPreview && matchesPreviewLabel ? (
        <Badge variant="secondary" className="w-fit bg-emerald-100 text-emerald-900 border-emerald-200">
          {matchesPreviewLabel}
        </Badge>
      ) : null}
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
  expenseCategoryNames,
  matchesPreview,
  onChange,
  onRemove,
  labels,
}: {
  row: ReceiptOcrCategoryRuleStored
  expenseCategoryNames: string[]
  matchesPreview: boolean
  onChange: (next: ReceiptOcrCategoryRuleStored) => void
  onRemove: () => void
  labels: {
    paidFor: string
    keywords: string
    keywordsPlaceholder: string
    keywordsHint: string
    enabled: string
    remove: string
    matchesPreview: string
    categoryPickHint: string
  }
}) {
  const kwStr = row.keywords.join(', ')
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-3 md:flex-row md:flex-wrap md:items-end ${
        matchesPreview ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/80'
      }`}
    >
      {matchesPreview ? (
        <Badge
          variant="secondary"
          className="w-full md:w-auto bg-emerald-100 text-emerald-900 border-emerald-200 mb-1 md:mb-0"
        >
          {labels.matchesPreview}
        </Badge>
      ) : null}
      <div className="min-w-[8rem] flex-1">
        <Label className="text-xs">{labels.paidFor}</Label>
        <Input
          className="mt-1"
          value={row.paid_for}
          list="receipt-ocr-expense-category-options"
          onChange={(e) => onChange({ ...row, paid_for: e.target.value })}
        />
        {expenseCategoryNames.length > 0 ? (
          <p className="mt-1 text-[10px] text-gray-500">{labels.categoryPickHint}</p>
        ) : null}
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

