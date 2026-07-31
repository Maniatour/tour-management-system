'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Plus, Upload, X, DollarSign, ChevronDown, ChevronRight, Trash2, Settings, Receipt, Image as ImageIcon, Folder, Ticket, Fuel, MoreHorizontal, UtensilsCrossed, Building2, Wrench, Car, Coins, MapPin, Package, Camera, ZoomIn, ZoomOut, ListOrdered, RotateCcw, RotateCw, Sparkles, type LucideIcon } from 'lucide-react'
import ExpenseVendorManagerModal from '@/components/expense/ExpenseVendorManagerModal'
import { supabase } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupTourOperatorId } from '@/lib/operators/lookupTourOperatorId'
import OptionManagementModal from './expense/OptionManagementModal'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import GoogleDriveReceiptImporter from './GoogleDriveReceiptImporter'
import {
  hotelAmountForSettlement,
  isHotelBookingIncludedInSettlement,
  isTicketBookingIncludedInSettlement,
  ticketExpenseForSettlement
} from '@/lib/bookingSettlement'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  reservationExcludedFromTourSettlementAggregates,
  resolveOperatingProfitForTourStats,
} from '@/lib/tourStatsCalculator'
import {
  expenseHasReimbursementTracking,
  parseReimbursedAmount,
  reimbursementOutstanding,
} from '@/lib/expenseReimbursement'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ensureFreshAuthSessionForUpload } from '@/lib/uploadClient'
import { ensureImageFitsMaxBytes, RECEIPT_COMPRESS_FAILED } from '@/lib/imageUtils'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'
import { runReceiptOcrFromImageBuffer } from '@/lib/receiptOcrBrowser'
import type { ReceiptOcrRotationDegrees } from '@/lib/receiptOcrPreprocess'
import { buildReceiptOcrCandidates, type ReceiptOcrCandidates as ReceiptOcrParseCandidates } from '@/lib/receiptOcrParse'
import {
  resolvePaidForFromOcrCandidate,
  resolvePaidToFromOcrCandidate,
  vendorEntriesForOcrMatch,
} from '@/lib/receiptOcrFieldResolve'
import {
  fetchReceiptOcrParseRuntime,
  MAX_BODY_MATCH_PHRASE,
  prependBodyMatchRuleToStoredSettings,
  suggestBodyMatchPhraseFromOcrText,
} from '@/lib/receiptOcrParseRules'
import { canSaveReceiptOcrParseRules } from '@/lib/receiptOcrParseRulesPermissions'
import { toast } from 'sonner'

const TOUR_RECEIPT_MAX_STORAGE_BYTES = 10 * 1024 * 1024
const TOUR_RECEIPT_MAX_ORIGINAL_BYTES = 35 * 1024 * 1024
/** Radix Dialog(투어 상세 모달 z-1100)·관리자 헤더(z-9999) 위에 그리기 — transform/overflow 조상 탈출 */
const TOUR_EXPENSE_MODAL_PORTAL_Z = 'z-[12000]'
/** Dialog가 body에 pointer-events:none을 둘 때 포털 루트가 클릭·스크롤을 받도록 함 */
const TOUR_EXPENSE_MODAL_PORTAL_INTERACTION = 'pointer-events-auto overscroll-contain'

/** `type="number"`는 IME·로캘에서 입력이 막히거나 `,` 소수가 거부되는 경우가 있어 텍스트 필드와 함께 사용 */
function normalizeDecimalTyping(raw: string): string {
  return raw.replace(/,/g, '.')
}

interface TourExpense {
  id: string
  tour_id: string
  submit_on: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  tour_date: string
  product_id: string | null
  submitted_by: string
  image_url: string | null
  file_path: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  reimbursed_amount?: number | null
  reimbursed_on?: string | null
  reimbursement_note?: string | null
}

interface ExpenseCategory {
  id: string
  name: string
}

interface ExpenseVendor {
  id: string
  name: string
  usage_type?: string | null
  match_aliases?: string[] | null
}

type ReceiptOcrResult = {
  text: string
  candidates: ReceiptOcrParseCandidates
}

interface ReservationPricing {
  id: string
  reservation_id: string
  total_price: number
  adult_product_price: number
  child_product_price: number
  infant_product_price: number
  commission_amount?: number
  commission_percent?: number
  coupon_discount?: number
  additional_discount?: number
  additional_cost?: number
  product_price_total?: number
  option_total?: number
  subtotal?: number
  card_fee?: number
  prepayment_tip?: number
  choices_total?: number
  operating_profit?: number | null
}

interface Reservation {
  id: string
  customer_name: string
  adults: number
  children: number
  infants: number
  /** 예약 상태 — 취소·환불 시 정산 Operating Profit 합계에서 제외 */
  status?: string | null
}

interface TourExpenseManagerProps {
  tourId: string
  tourDate: string
  productId?: string | null
  submittedBy: string
  reservationIds?: string[] // 투어에 배정된 예약 ID들
  userRole?: string // 사용자 역할 (admin, manager, team_member 등)
  allowReceiptOnlyUpload?: boolean
  onExpenseUpdated?: () => void
  /** 팀 구성 & 차량 배정에서 설정한 수수료 (전달 시 총 지출에 반영, 부모 tour 업데이트 시 즉시 반영) */
  tourGuideFee?: number | null
  tourAssistantFee?: number | null
  /** 부모의 최신 투어 상태 (취소 여부 정산 반영·DB 재로드용; 없으면 loadTourData 결과만 사용) */
  tourStatus?: string | null
  /** Todo 정산 등: 단일 지출만 수정 UI로 연다 */
  embedSingleExpenseId?: string | null
  onEmbedClose?: () => void
  onEmbedUpdated?: () => void
  /** 투어 상세 모달 등 좁은 영역 — 정산 통계·지출 목록 컴팩트 표시 */
  compact?: boolean
  /** 부모(TourFinance) 헤더에 제목·툴바가 있을 때 내부 제목·액션 행 숨김 */
  hideTitle?: boolean
}

export type TourExpenseManagerHandle = {
  openOptionManagement: () => void
  openAddExpense: () => void
  toggleDriveImporter: () => void
}

const TourExpenseManager = forwardRef<TourExpenseManagerHandle, TourExpenseManagerProps>(function TourExpenseManager({
  tourId, 
  tourDate, 
  productId, 
  submittedBy, 
  reservationIds,
  userRole = 'team_member',
  allowReceiptOnlyUpload = false,
  onExpenseUpdated,
  tourGuideFee,
  tourAssistantFee,
  tourStatus,
  embedSingleExpenseId,
  onEmbedClose,
  onEmbedUpdated,
  compact = false,
  hideTitle = false,
}, ref) {
  const t = useTranslations('tours.tourExpense')
  const locale = useLocale()
  const { userRole: authUserRole, userPosition, authUser } = useAuth()
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const canSeeReceiptOcrRulesLink =
    authUserRole === 'admin' ||
    authUserRole === 'manager' ||
    userPosition === 'super' ||
    userPosition === 'admin'
  const canSaveReceiptOcrQuickRule = canSaveReceiptOcrParseRules({
    userPosition,
    email: authUser?.email,
  })
  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()

  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [vendors, setVendors] = useState<ExpenseVendor[]>([])
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])
  const vendorMatchEntries = useMemo(() => vendorEntriesForOcrMatch(vendors), [vendors])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationPricing, setReservationPricing] = useState<ReservationPricing[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const showAddFormRef = useRef(false)
  showAddFormRef.current = showAddForm
  const [editingExpense, setEditingExpense] = useState<TourExpense | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const [showCustomPaidFor, setShowCustomPaidFor] = useState(false)
  const [showOptionManagement, setShowOptionManagement] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [paymentMethodTab, setPaymentMethodTab] = useState<'own' | 'other'>('own')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const receiptOnlyInputRef = useRef<HTMLInputElement>(null)
  const receiptOnlyCameraInputRef = useRef<HTMLInputElement>(null)
  const [webcamTarget, setWebcamTarget] = useState<null | 'toolbar' | 'addForm'>(null)
  const receiptWebcamVideoRef = useRef<HTMLVideoElement>(null)
  const receiptWebcamStreamRef = useRef<MediaStream | null>(null)
  /** 카메라·갤러리 확인 직후 합성 click이 배경으로 전달되며 모달이 닫히는 것을 막음 (특히 iOS). */
  const expenseModalBackdropSuppressedUntilRef = useRef(0)
  const [viewingReceipt, setViewingReceipt] = useState<{ imageUrl: string; expenseId: string; paidFor: string } | null>(null)
  const [receiptViewerZoom, setReceiptViewerZoom] = useState(1)
  const embedEditOpenedRef = useRef(false)
  const [formReceiptZoom, setFormReceiptZoom] = useState(1)
  const [formReceiptRotation, setFormReceiptRotation] = useState<ReceiptOcrRotationDegrees>(0)
  const [formInlineOcrOpen, setFormInlineOcrOpen] = useState(false)
  const [vendorManagerOpen, setVendorManagerOpen] = useState(false)
  const [ocrReview, setOcrReview] = useState<{
    /** 신규·수정 입력폼에서 업로드 직후 OCR이면 반영 시 편집 중 지출로 바꾸지 않음 */
    applyTarget?: 'edit_expense' | 'add_form'
    expense: TourExpense
    result: ReceiptOcrResult
    draft: {
      paid_to: string
      custom_paid_to: string
      paid_for: string
      custom_paid_for: string
      amount: string
      payment_method: string
      date: string
      note: string
    }
  } | null>(null)
  const [ocrLoadingExpenseId, setOcrLoadingExpenseId] = useState<string | null>(null)
  const [ocrShowCustomPaidTo, setOcrShowCustomPaidTo] = useState(false)
  const [ocrShowCustomPaidFor, setOcrShowCustomPaidFor] = useState(false)
  const [ocrShowMoreCategories, setOcrShowMoreCategories] = useState(false)
  const [ocrPaymentMethodTab, setOcrPaymentMethodTab] = useState<'own' | 'other'>('own')
  const [receiptQuickRulePhrase, setReceiptQuickRulePhrase] = useState('')
  const [receiptQuickRuleCcLabel, setReceiptQuickRuleCcLabel] = useState(false)
  const [receiptQuickRuleSaving, setReceiptQuickRuleSaving] = useState(false)
  const expenseForViewingReceipt = useMemo(
    () =>
      viewingReceipt && viewingReceipt.expenseId !== '__ocr_draft__'
        ? expenses.find((e) => e.id === viewingReceipt.expenseId)
        : undefined,
    [viewingReceipt, expenses]
  )

  useEffect(() => {
    setReceiptViewerZoom(1)
  }, [viewingReceipt?.expenseId, viewingReceipt?.imageUrl])

  useEffect(() => {
    if (!ocrReview?.result?.text) return
    setReceiptQuickRulePhrase(suggestBodyMatchPhraseFromOcrText(ocrReview.result.text))
    setReceiptQuickRuleCcLabel(false)
  }, [ocrReview?.expense?.id])

  const [expenseModalPortalReady, setExpenseModalPortalReady] = useState(false)
  useEffect(() => {
    setExpenseModalPortalReady(true)
  }, [])
  const [showDriveImporter, setShowDriveImporter] = useState(false)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  
  // 투어 데이터 및 수수료 관련 상태
  const [tourData, setTourData] = useState<any>(null)
  const [guideFee, setGuideFee] = useState<number>(0)
  const [assistantFee, setAssistantFee] = useState<number>(0)
  const [_isLoadingTourData, setIsLoadingTourData] = useState(false)
  
  // 부킹 데이터 관련 상태
  const [ticketBookings, setTicketBookings] = useState<any[]>([])
  const [hotelBookings, setHotelBookings] = useState<any[]>([])
  const [_isLoadingBookings, setIsLoadingBookings] = useState(false)
  
  // 예약별 지출 데이터 상태
  const [reservationExpenses, setReservationExpenses] = useState<Record<string, number>>({})
  const [reservationChannels, setReservationChannels] = useState<Record<string, any>>({})
  const receiptOnlyPaidFor = TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR

  function translateReceiptImageError(error: unknown): string {
    if (!(error instanceof Error)) return t('unknownError')
    if (error.message === 'ORIGINAL_RECEIPT_TOO_LARGE') return t('receiptOriginalTooLarge')
    if (error.message === RECEIPT_COMPRESS_FAILED) return t('receiptCompressFailed')
    return error.message
  }

  /** RLS: tour_expenses.submitted_by / checked_by는 JWT 이메일과 맞아야 할 때가 많음 — prop이 비면 세션에서 채움 */
  const resolveSubmitterEmail = useCallback(async (): Promise<string | null> => {
    const fromProp = typeof submittedBy === 'string' ? submittedBy.trim() : ''
    if (fromProp) return fromProp
    const { data: sessionData } = await supabase.auth.getSession()
    const fromSession = sessionData?.session?.user?.email?.trim()
    return fromSession || null
  }, [submittedBy])

  // 폼 데이터
  const [formData, setFormData] = useState({
    paid_to: '',
    paid_for: '',
    amount: '',
    payment_method: '',
    note: '',
    image_url: '',
    file_path: '',
    custom_paid_to: '',
    custom_paid_for: '',
    reimbursed_amount: '',
    reimbursed_on: '',
    reimbursement_note: ''
  })
  /** 지출 추가·수정 폼: 환급 입력란 표시 */
  const [reimbursementSectionOpen, setReimbursementSectionOpen] = useState(false)

  /** 투어에 배정된 가이드·어시스턴트(또는 2인 가이드) 이메일 — 본인 카드 탭에 모두 반영 */
  const tourGuideEmails = useMemo(() => {
    const set = new Set<string>()
    const primary = String(tourData?.tour_guide_id || '').trim().toLowerCase()
    const assistant = String(tourData?.assistant_id || '').trim().toLowerCase()
    if (primary) set.add(primary)
    if (assistant) set.add(assistant)
    return set
  }, [tourData?.tour_guide_id, tourData?.assistant_id])

  const activePaymentMethodOptions = useMemo(
    () => paymentMethodOptions.filter((option) => String(option.status || 'active').toLowerCase() === 'active'),
    [paymentMethodOptions]
  )
  const guideCardPaymentMethodOptions = useMemo(
    () =>
      activePaymentMethodOptions.filter((option) => {
        const optionOwner = String(option.user_email || '').trim().toLowerCase()
        const methodType = String(option.method_type || 'card').toLowerCase()
        return tourGuideEmails.size > 0 && tourGuideEmails.has(optionOwner) && methodType === 'card'
      }),
    [activePaymentMethodOptions, tourGuideEmails]
  )
  const guideCardPaymentMethodIds = useMemo(
    () => new Set(guideCardPaymentMethodOptions.map((option) => option.id)),
    [guideCardPaymentMethodOptions]
  )
  const otherPaymentMethodOptions = useMemo(
    () => activePaymentMethodOptions.filter((option) => !guideCardPaymentMethodIds.has(option.id)),
    [activePaymentMethodOptions, guideCardPaymentMethodIds]
  )
  const visiblePaymentMethodOptions =
    paymentMethodTab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions
  const visibleOcrPaymentMethodOptions =
    ocrPaymentMethodTab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions

  useEffect(() => {
    if (!ocrReview) return
    const { draft } = ocrReview
    const resolvedPaidTo = resolveOcrDraftPaidTo(draft)
    setOcrShowCustomPaidTo(
      Boolean(draft.custom_paid_to) ||
        Boolean(resolvedPaidTo && !paidToOptions.includes(resolvedPaidTo))
    )
    const resolvedPaidFor = resolveOcrDraftPaidFor(draft)
    setOcrShowCustomPaidFor(
      Boolean(draft.custom_paid_for) ||
        Boolean(
          resolvedPaidFor && !categories.some((category) => category.name === resolvedPaidFor)
        )
    )
    setOcrShowMoreCategories(false)
    setOcrPaymentMethodTab(
      draft.payment_method && guideCardPaymentMethodIds.has(draft.payment_method) ? 'own' : 'other'
    )
  }, [ocrReview, paidToOptions, categories, guideCardPaymentMethodIds])

  const resolveOcrDraftPaidTo = (draft: NonNullable<typeof ocrReview>['draft']) =>
    (draft.custom_paid_to || draft.paid_to || '').trim()
  const resolveOcrDraftPaidFor = (draft: NonNullable<typeof ocrReview>['draft']) =>
    (draft.custom_paid_for || draft.paid_for || '').trim()

  const getExpensePaidForLabel = (paidFor: string) =>
    paidFor === receiptOnlyPaidFor ? t('receiptOnlyPendingPaidFor') : paidFor

  const canRunReceiptOcr =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const findPaymentMethodCandidate = (candidates: ReceiptOcrParseCandidates) => {
    const forced = (candidates.payment_method_id ?? '').trim()
    if (forced) {
      const byId = paymentMethodOptions.find((option) => option.id === forced)
      if (byId) return byId.id
    }
    const last4 = candidates.card_last4.trim()
    const paymentText = candidates.payment_method_text.trim().toLowerCase()

    if (last4) {
      const byLast4 = paymentMethodOptions.find((option) => {
        const methodStr = String(option.method ?? '')
        return option.name.includes(last4) || methodStr.includes(last4)
      })
      if (byLast4) return byLast4.id
    }

    if (paymentText) {
      const byText = paymentMethodOptions.find((option) => {
        const methodLc = String(option.method ?? '').toLowerCase()
        return option.name.toLowerCase().includes(paymentText) || methodLc.includes(paymentText)
      })
      if (byText) return byText.id
    }

    return ''
  }

  const buildOcrStubExpense = useCallback(
    (imageUrl: string, filePath: string): TourExpense => ({
      id: '__ocr_draft__',
      tour_id: tourId,
      submit_on: new Date().toISOString(),
      paid_to: '',
      paid_for: '',
      amount: 0,
      payment_method: null,
      note: null,
      tour_date: tourDate,
      product_id: productId ?? null,
      submitted_by: submittedBy,
      image_url: imageUrl,
      file_path: filePath,
      audited_by: null,
      checked_by: null,
      checked_on: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [tourId, tourDate, productId, submittedBy]
  )

  const buildOcrReviewFromResult = useCallback(
    (expense: TourExpense, ocrResult: ReceiptOcrResult, applyTarget: 'edit_expense' | 'add_form') => {
      const categoryNames = categories.map((category) => category.name)
      const rawPaidFor = ocrResult.candidates.paid_for || expense.paid_for || ''
      const resolvedPaidFor = resolvePaidForFromOcrCandidate(rawPaidFor, categoryNames)
      const isPaidForInOptions = resolvedPaidFor != null
      const rawPaidTo = ocrResult.candidates.paid_to || expense.paid_to || ''
      const resolvedPaidTo = resolvePaidToFromOcrCandidate(rawPaidTo, vendorMatchEntries)
      const isPaidToInOptions = resolvedPaidTo != null
      const paymentMethodId = findPaymentMethodCandidate(ocrResult.candidates)
      const noteParts = [
        expense.note || '',
        ocrResult.candidates.date ? `${t('receiptOcrDateLabel')}: ${ocrResult.candidates.date}` : '',
      ].filter(Boolean)

      return {
        applyTarget,
        expense,
        result: ocrResult,
        draft: {
          paid_to: isPaidToInOptions ? resolvedPaidTo! : '',
          custom_paid_to: isPaidToInOptions ? '' : rawPaidTo,
          paid_for: isPaidForInOptions ? resolvedPaidFor! : '',
          custom_paid_for: isPaidForInOptions ? '' : rawPaidFor,
          amount:
            ocrResult.candidates.amount != null
              ? ocrResult.candidates.amount.toFixed(2)
              : expense.amount > 0
                ? expense.amount.toString()
                : '',
          payment_method: paymentMethodId || expense.payment_method || '',
          date: ocrResult.candidates.date || '',
          note: noteParts.join('\n'),
        },
      }
    },
    [categories, findPaymentMethodCandidate, vendorMatchEntries, t]
  )

  /** 브라우저에서 이미지 바이트 확보 → Tesseract는 브라우저에서 실행 (서버 worker 경로·500 방지) */
  const loadReceiptImageBytesForOcr = useCallback(
    async (expense: TourExpense, signal?: AbortSignal): Promise<{ buffer: ArrayBuffer; mime: string }> => {
      const url = expense.image_url?.trim()
      if (!url) throw new Error(t('receiptOcrNoImage'))

      try {
        const imgRes = await fetch(url, {
          mode: 'cors',
          cache: 'no-store',
          ...(signal ? { signal } : {}),
        })
        if (imgRes.ok) {
          const mime = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
          const buffer = await imgRes.arrayBuffer()
          if (buffer.byteLength > 0) return { buffer, mime }
        }
      } catch {
        /* Storage 폴백 */
      }

      const fp = expense.file_path?.trim()
      if (fp) {
        const { data, error } = await supabase.storage.from('tour-expenses').download(fp)
        if (!error && data && data.size > 0) {
          const mime =
            data.type && data.type !== 'application/octet-stream' ? data.type : 'image/jpeg'
          return { buffer: await data.arrayBuffer(), mime }
        }
      }

      throw new Error(t('receiptOcrCouldNotLoadImage'))
    },
    [supabase, t]
  )

  const runOcrAfterReceiptUpload = useCallback(
    async (imageUrl: string, filePath: string) => {
      if (!showAddFormRef.current) return
      try {
        setOcrLoadingExpenseId('__draft__')
        const stub = buildOcrStubExpense(imageUrl, filePath)
        const { buffer, mime } = await loadReceiptImageBytesForOcr(stub)
        const { text } = await runReceiptOcrFromImageBuffer(buffer, mime)
        const rt = await fetchReceiptOcrParseRuntime(supabase)
        const ocrResult: ReceiptOcrResult = {
          text,
          candidates: buildReceiptOcrCandidates(text, { runtime: rt }),
        }
        setFormInlineOcrOpen(true)
        setOcrReview(buildOcrReviewFromResult(stub, ocrResult, 'add_form'))
      } catch (e) {
        console.warn('Receipt OCR after upload failed:', e)
      } finally {
        setOcrLoadingExpenseId(null)
      }
    },
    [buildOcrReviewFromResult, buildOcrStubExpense, getExpensePaidForLabel, loadReceiptImageBytesForOcr, receiptOnlyPaidFor]
  )

  const handlePaymentMethodTabChange = (tab: 'own' | 'other') => {
    const nextOptions = tab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions
    setPaymentMethodTab(tab)
    if (formData.payment_method && !nextOptions.some((option) => option.id === formData.payment_method)) {
      setFormData((prev) => ({ ...prev, payment_method: '' }))
    }
  }

  const handleOcrPaymentMethodTabChange = (tab: 'own' | 'other') => {
    const nextOptions = tab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions
    setOcrPaymentMethodTab(tab)
    setOcrReview((prev) => {
      if (!prev) return prev
      const current = prev.draft.payment_method
      if (current && !nextOptions.some((option) => option.id === current)) {
        return { ...prev, draft: { ...prev.draft, payment_method: '' } }
      }
      return prev
    })
  }

  // 예약 데이터 로드 - reservationIds가 있으면 해당 예약들만, 없으면 빈 배열
  const loadReservations = useCallback(async () => {
    try {
      console.log('🔍 Loading reservations for tourId:', tourId, 'reservationIds:', reservationIds)
      
      let reservationsData: any[] = []
      
      if (reservationIds && reservationIds.length > 0) {
        // reservationIds가 있으면 해당 예약들만 가져오기 (배정된 예약만)
        console.log('📋 Loading assigned reservations:', reservationIds)
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant, status')
          .in('id', reservationIds)

        if (error) {
          console.error('❌ Assigned reservations error:', error)
          throw error
        }
        
        reservationsData = data || []
        console.log('✅ Assigned reservations data:', reservationsData)
      } else {
        // reservationIds가 없으면 빈 배열 (배정된 예약이 없음)
        console.log('📋 No reservationIds provided, loading empty array')
        reservationsData = []
      }
      
      if (!reservationsData || reservationsData.length === 0) {
        setReservations([])
        return
      }
      
      // 고객 ID들을 수집
      const customerIds = reservationsData
        .map(r => r.customer_id)
        .filter(id => id !== null)
      
      // 고객 정보를 별도로 가져옴
      let customersData: any[] = []
      if (customerIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        
        if (customersError) {
          console.error('❌ Customers error:', customersError)
        } else {
          customersData = customers || []
        }
      }
      
      // 데이터 변환 및 결합
      const transformedData = reservationsData.map(reservation => {
        const customer = customersData.find(c => c.id === reservation.customer_id)
        return {
          id: reservation.id,
          customer_name: customer?.name || 'Unknown',
          adults: reservation.adults || 0,
          children: reservation.child || 0,
          infants: reservation.infant || 0,
          status: reservation.status ?? undefined
        }
      })
      
      console.log('✅ Transformed data:', transformedData)
      setReservations(transformedData)
    } catch (error) {
      console.error('❌ Error loading reservations:', error)
      setReservations([])
    }
  }, [tourId, reservationIds])

  // 예약 가격 정보 로드
  const loadReservationPricing = useCallback(async () => {
    try {
      // reservationIds가 있으면 그것을 사용, 없으면 reservations 상태 사용
      const targetReservationIds = reservationIds && reservationIds.length > 0 
        ? reservationIds 
        : reservations.map(r => r.id)
      
      console.log('🔍 Loading reservation pricing for reservations:', targetReservationIds)
      
      if (targetReservationIds.length === 0) {
        setReservationPricing([])
        return
      }
      
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('id, reservation_id, total_price, adult_product_price, child_product_price, infant_product_price, commission_amount, commission_percent, coupon_discount, additional_discount, additional_cost, product_price_total, option_total, subtotal, card_fee, prepayment_tip, choices_total, operating_profit')
        .in('reservation_id', targetReservationIds)

      if (error) {
        console.error('❌ Reservation pricing error:', error)
        throw error
      }
      
      console.log('✅ Reservation pricing data:', data)
      setReservationPricing(
        (data || []).map((row) => ({
          id: row.id,
          reservation_id: row.reservation_id,
          total_price: row.total_price ?? 0,
          adult_product_price: row.adult_product_price ?? 0,
          child_product_price: row.child_product_price ?? 0,
          infant_product_price: row.infant_product_price ?? 0,
          ...(row.commission_amount != null ? { commission_amount: row.commission_amount } : {}),
          ...(row.commission_percent != null ? { commission_percent: row.commission_percent } : {}),
          ...(row.coupon_discount != null ? { coupon_discount: row.coupon_discount } : {}),
          ...(row.additional_discount != null ? { additional_discount: row.additional_discount } : {}),
          ...(row.additional_cost != null ? { additional_cost: row.additional_cost } : {}),
          ...(row.product_price_total != null ? { product_price_total: row.product_price_total } : {}),
          ...(row.option_total != null ? { option_total: row.option_total } : {}),
          ...(row.subtotal != null ? { subtotal: row.subtotal } : {}),
          ...(row.card_fee != null ? { card_fee: row.card_fee } : {}),
          ...(row.prepayment_tip != null ? { prepayment_tip: row.prepayment_tip } : {}),
          ...(row.choices_total != null ? { choices_total: row.choices_total } : {}),
          ...(row.operating_profit != null ? { operating_profit: row.operating_profit } : {}),
        }))
      )
      
      // 예약별 채널 정보 가져오기
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, channel_id')
        .in('id', targetReservationIds)
      
      if (!reservationsError && reservationsData) {
        const channelIds = reservationsData
          .map(r => r.channel_id)
          .filter(id => id !== null)
        
        if (channelIds.length > 0) {
          const { data: channelsData, error: channelsError } = await supabase
            .from('channels')
            .select('id, commission_base_price_only')
            .in('id', channelIds)
          
          if (!channelsError && channelsData) {
            const channelMap: Record<string, any> = {}
            reservationsData.forEach(reservation => {
              if (reservation.channel_id) {
                const channel = channelsData.find(c => c.id === reservation.channel_id)
                if (channel) {
                  channelMap[reservation.id] = channel
                }
              }
            })
            setReservationChannels(channelMap)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading reservation pricing:', error)
      setReservationPricing([])
    }
  }, [reservations, reservationIds])
  
  // 예약별 지출 정보 로드
  const loadReservationExpenses = useCallback(async () => {
    try {
      const targetReservationIds = reservationIds && reservationIds.length > 0 
        ? reservationIds 
        : reservations.map(r => r.id)
      
      if (targetReservationIds.length === 0) {
        setReservationExpenses({})
        return
      }
      
      const { data, error } = await supabase
        .from('reservation_expenses')
        .select('reservation_id, amount, status')
        .eq('operator_id', activeOperatorId)
        .in('reservation_id', targetReservationIds)
        .not('status', 'eq', 'rejected')
      
      if (error) {
        console.error('❌ Reservation expenses error:', error)
        setReservationExpenses({})
        return
      }
      
      // 예약별 지출 총합 계산
      const expensesMap: Record<string, number> = {}
      data?.forEach(expense => {
        const reservationId = expense.reservation_id
        if (!reservationId) return
        if (!expensesMap[reservationId]) {
          expensesMap[reservationId] = 0
        }
        expensesMap[reservationId] += expense.amount || 0
      })
      
      setReservationExpenses(expensesMap)
    } catch (error) {
      console.error('❌ Error loading reservation expenses:', error)
      setReservationExpenses({})
    }
  }, [reservations, reservationIds, activeOperatorId])

  // 팀 멤버 정보 로드
  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const memberMap: Record<string, string> = {}
      data?.forEach(member => {
        memberMap[member.email] = member.name_ko || member.email
      })
      setTeamMembers(memberMap)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  // 지출 목록 로드
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tour_expenses')
        .select('*')
        .eq('operator_id', activeOperatorId)
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('🔍 Raw expense data from database:', data?.length || 0, 'items')
      
      // file_path가 있지만 image_url이 없는 경우 공개 URL 생성
      const processedExpenses = await Promise.all((data || []).map(async (row) => {
        const expense = row as TourExpense
        // 원본 데이터 로그
        console.log(`📄 Expense "${expense.paid_for}" (ID: ${expense.id}):`, {
          original_image_url: expense.image_url,
          original_file_path: expense.file_path,
          has_original_url: !!(expense.image_url && expense.image_url.trim() !== '')
        })
        
        // image_url이 없고 file_path가 있는 경우
        if ((!expense.image_url || expense.image_url.trim() === '') && expense.file_path) {
          try {
            console.log(`  🔗 Generating public URL from file_path: ${expense.file_path}`)
            // Supabase Storage에서 공개 URL 생성
            const { data: urlData } = supabase.storage
              .from('tour-expenses')
              .getPublicUrl(expense.file_path)
            
            console.log(`  ✅ Generated URL: ${urlData.publicUrl}`)
            return {
              ...expense,
              image_url: urlData.publicUrl
            }
          } catch (urlError) {
            console.error('  ❌ Exception generating public URL:', urlError)
            return expense
          }
        }
        
        // 둘 다 없는 경우
        if (!expense.image_url && !expense.file_path) {
          console.log(`  ⚠️ No image_url and no file_path for expense ${expense.id}`)
        }
        
        return expense
      }))
      
      // 최종 결과 로그
      console.log('📋 Processed expenses:', processedExpenses.length)
      processedExpenses.forEach((expense, index) => {
        const hasImage = !!(expense.image_url && expense.image_url.trim() !== '')
        console.log(`  ${index + 1}. "${expense.paid_for}" - Image: ${hasImage ? '✅' : '❌'}`, {
          image_url: expense.image_url || 'NULL',
          file_path: expense.file_path || 'NULL'
        })
      })
      
      setExpenses(processedExpenses)
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [tourId, activeOperatorId])

  // 카테고리 목록 로드
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  // 벤더 목록 및 paid_to 옵션 로드 (선택지: 재사용 결제처만)
  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_vendors')
        .select('id, name, usage_type, match_aliases')
        .order('name')

      if (error) throw error
      const rows = (data || []) as ExpenseVendor[]
      setVendors(rows)
      setPaidToOptions(rows.filter((v) => v.usage_type !== 'one_time').map((v) => v.name))
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  // 영수증 이미지 업로드
  const handleImageUpload = async (file: File) => {
    try {
      await ensureFreshAuthSessionForUpload()

      // MIME 타입 체크
      if (!file.type.startsWith('image/')) {
        throw new Error(t('imageOnlyError'))
      }

      if (file.size > TOUR_RECEIPT_MAX_ORIGINAL_BYTES) {
        throw new Error('ORIGINAL_RECEIPT_TOO_LARGE')
      }

      const safeLimit = TOUR_RECEIPT_MAX_STORAGE_BYTES - 256 * 1024
      const prepared =
        file.size > safeLimit ? await ensureImageFitsMaxBytes(file, safeLimit) : file

      // 고유한 파일명 생성
      const fileExt = prepared.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `tour-expenses/${tourId}/${fileName}`

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('tour-expenses')
        .upload(filePath, prepared)

      if (uploadError) throw uploadError

      // 공개 URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from('tour-expenses')
        .getPublicUrl(filePath)

      return { filePath, imageUrl: publicUrl }
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  }

  // 지출 추가
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingExpense) {
      await handleUpdateExpense()
      return
    }
    
    if (!formData.paid_for || !formData.amount) {
      alert(t('fillRequiredFields'))
      return
    }

    if (!formData.payment_method?.trim()) {
      alert(t('paymentMethodRequired'))
      return
    }

    // 지급 대상 유효성 검사
    const finalPaidTo = formData.custom_paid_to || formData.paid_to || null
    if (!finalPaidTo) {
      alert('지급 대상을 선택하거나 입력해주세요.')
      return
    }

    try {
      setUploading(true)

      const effectiveSubmittedBy = await resolveSubmitterEmail()
      if (!effectiveSubmittedBy) {
        alert(t('submitterEmailRequired'))
        return
      }
      
      // 지급 대상 값 확인
      console.log('지급 대상 값 확인:', {
        custom_paid_to: formData.custom_paid_to,
        paid_to: formData.paid_to,
        finalPaidTo: finalPaidTo,
        showCustomPaidTo: showCustomPaidTo
      })
      
      // 사용자 정의 값이 있으면 새 카테고리/벤더 추가
      if (formData.custom_paid_for && !categories.find(c => c.name === formData.custom_paid_for)) {
        const { data: newCategory } = await supabase
          .from('expense_categories')
          .insert({ name: formData.custom_paid_for })
          .select()
          .single()
        if (newCategory) {
          setCategories(prev => [...prev, newCategory])
        }
      }

      if (formData.custom_paid_to && !vendors.find(v => v.name === formData.custom_paid_to)) {
        const { data: newVendor } = await supabase
          .from('expense_vendors')
          .insert({ name: formData.custom_paid_to, usage_type: 'one_time' })
          .select()
          .single()
        if (newVendor && (newVendor as ExpenseVendor).usage_type !== 'one_time') {
          setVendors(prev => [...prev, newVendor as ExpenseVendor])
        }
      }
      
      // product_id가 없으면 투어의 product_id 사용
      let finalProductId = productId
      if (!finalProductId && tourData?.product_id) {
        finalProductId = tourData.product_id
        console.log('투어의 product_id 사용:', finalProductId)
      }
      
      const expenseOperatorId = await lookupTourOperatorId(supabase, tourId, activeOperatorId)
      const { data, error } = await supabase
        .from('tour_expenses')
        .insert({
          tour_id: tourId,
          paid_to: finalPaidTo,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          tour_date: tourDate,
          product_id: finalProductId ?? null,
          submitted_by: effectiveSubmittedBy,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          status: 'pending',
          operator_id: expenseOperatorId,
        } as never)
        .select()
        .single()

      if (error) throw error

      setExpenses(prev => [data as TourExpense, ...prev])
      setShowAddForm(false)
      setFormData({
        paid_to: '',
        paid_for: '',
        amount: '',
        payment_method: '',
        note: '',
        image_url: '',
        file_path: '',
        custom_paid_to: '',
        custom_paid_for: '',
        reimbursed_amount: '',
        reimbursed_on: '',
        reimbursement_note: ''
      })
      setReimbursementSectionOpen(false)
      setShowCustomPaidFor(false)
      setShowCustomPaidTo(false)
      setShowMoreCategories(false)
      setPaymentMethodTab('own')
      onExpenseUpdated?.()
      alert(t('expenseRegistered'))
    } catch (error) {
      console.error('Error adding expense:', error)
      alert(t('expenseRegistrationError'))
    } finally {
      setUploading(false)
    }
  }

  const buildReceiptOnlyOcrNote = (candidates: ReceiptOcrParseCandidates): string => {
    const base = 'Receipt uploaded first; expense details pending.'
    const lines: string[] = [base]
    const pt = (candidates.paid_to || '').trim()
    if (pt) lines.push(`[OCR] Vendor: ${pt.slice(0, 200)}`)
    if (candidates.amount != null && candidates.amount > 0) {
      lines.push(`[OCR] Amount: ${candidates.amount.toFixed(2)}`)
    }
    if (candidates.date) lines.push(`[OCR] Date: ${candidates.date}`)
    const cat = (candidates.paid_for || '').trim()
    if (cat) lines.push(`[OCR] Category guess: ${cat}`)
    return lines.join('\n')
  }

  const receiptOcrHasUsableSignal = (text: string, candidates: ReceiptOcrParseCandidates): boolean => {
    if (text.trim().length >= 24) return true
    if ((candidates.paid_to || '').trim().length >= 3) return true
    if (candidates.amount != null && candidates.amount > 0) return true
    if (candidates.date) return true
    if ((candidates.paid_for || '').trim().length > 0) return true
    if ((candidates.payment_method_id || '').trim().length > 0) return true
    return false
  }

  /** 영수증만 첨부 후 브라우저 OCR로 금액·지급처 등을 자동 반영 (서버 Tesseract 경로 이슈 회피) */
  const applyClientReceiptOcrToExpense = async (
    expenseId: string,
    file: File,
    fallbackRow: TourExpense
  ): Promise<{ expense: TourExpense; applied: boolean }> => {
    try {
      const buffer = await file.arrayBuffer()
      const mime = file.type?.startsWith('image/') ? file.type : 'image/jpeg'
      const { text } = await runReceiptOcrFromImageBuffer(buffer, mime)
      const rt = await fetchReceiptOcrParseRuntime(supabase)
      const candidates = buildReceiptOcrCandidates(text, { runtime: rt })

      if (!receiptOcrHasUsableSignal(text, candidates)) {
        return { expense: fallbackRow, applied: false }
      }

      const paymentMethodId = findPaymentMethodCandidate(candidates)
      const rawPaidTo = (candidates.paid_to || '').trim()
      const resolvedPaidTo = resolvePaidToFromOcrCandidate(rawPaidTo, vendorMatchEntries)
      const amount =
        candidates.amount != null && Number.isFinite(candidates.amount) && candidates.amount > 0
          ? candidates.amount
          : 0
      const rawPaidFor = (candidates.paid_for || '').trim()
      const resolvedPaidFor =
        resolvePaidForFromOcrCandidate(
          rawPaidFor,
          categories.map((category) => category.name)
        ) ?? receiptOnlyPaidFor

      const { data, error } = await supabase
        .from('tour_expenses')
        .update({
          paid_to: resolvedPaidTo,
          amount,
          payment_method: paymentMethodId || null,
          paid_for: resolvedPaidFor,
          note: buildReceiptOnlyOcrNote(candidates),
        })
        .eq('id', expenseId)
        .select()
        .single()

      if (error) throw error
      return { expense: data as TourExpense, applied: true }
    } catch (ocrErr) {
      console.warn('Client receipt OCR apply failed:', ocrErr)
      return { expense: fallbackRow, applied: false }
    }
  }

  // 영수증만 첨부: 여러 장이면 각각 별도 tour_expenses 행으로 저장
  const processReceiptOnlyFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      alert(t('imageOnlyError'))
      return
    }

    try {
      setUploading(true)
      const effectiveSubmittedBy = await resolveSubmitterEmail()
      if (!effectiveSubmittedBy) {
        alert(t('submitterEmailRequired'))
        return
      }

      const finalProductId = productId || tourData?.product_id || null
      const inserted: TourExpense[] = []
      let failCount = 0
      let ocrAppliedCount = 0

      if (imageFiles.length === 1) {
        toast.info(t('receiptOcrAnalyzingAfterUpload'))
      }

      const expenseOperatorId = await lookupTourOperatorId(supabase, tourId, activeOperatorId)
      for (const file of imageFiles) {
        try {
          const { filePath, imageUrl } = await handleImageUpload(file)
          const { data, error } = await supabase
            .from('tour_expenses')
            .insert({
              tour_id: tourId,
              paid_to: null,
              paid_for: receiptOnlyPaidFor,
              amount: 0,
              payment_method: null,
              note: 'Receipt uploaded first; expense details pending.',
              tour_date: tourDate,
              product_id: finalProductId,
              submitted_by: effectiveSubmittedBy,
              image_url: imageUrl,
              file_path: filePath,
              status: 'pending',
              operator_id: expenseOperatorId,
            })
            .select()
            .single()

          if (error) throw error
          if (data) {
            const { expense: expenseRow, applied } = await applyClientReceiptOcrToExpense(
              data.id,
              file,
              data as TourExpense
            )
            if (applied) ocrAppliedCount += 1
            inserted.push(expenseRow)
          }
        } catch (itemErr) {
          console.error('Receipt-only batch item error:', itemErr)
          failCount += 1
        }
      }

      if (inserted.length > 0) {
        setExpenses((prev) => [...inserted, ...prev])
        onExpenseUpdated?.()
      }

      if (inserted.length === 0) {
        alert(t('expenseRegistrationError'))
      } else if (failCount === 0) {
        if (ocrAppliedCount > 0 && ocrAppliedCount === inserted.length) {
          alert(
            inserted.length === 1
              ? t('receiptOnlyUploadSuccessOcr')
              : t('receiptOnlyBatchSuccessOcr', { count: inserted.length })
          )
        } else if (ocrAppliedCount > 0) {
          alert(t('receiptOnlyBatchPartialOcr', { ocr: ocrAppliedCount, total: inserted.length }))
        } else {
          alert(
            inserted.length === 1
              ? t('receiptOnlyUploadSuccess')
              : t('receiptOnlyBatchSuccess', { count: inserted.length })
          )
        }
      } else {
        alert(t('receiptOnlyBatchPartialSuccess', { saved: inserted.length, failed: failCount }))
      }
    } catch (error) {
      console.error('Receipt-only batch error:', error)
      alert(error instanceof Error ? translateReceiptImageError(error) : t('expenseRegistrationError'))
    } finally {
      setUploading(false)
    }
  }

  const handleReceiptOnlyUpload = async (files: FileList | null) => {
    if (!files?.length) return
    await processReceiptOnlyFiles(Array.from(files))
  }

  const applyUploadedImageToForm = async (file: File) => {
    try {
      expenseModalBackdropSuppressedUntilRef.current = Date.now() + 2500
      setUploading(true)

      if (!file.type.startsWith('image/')) {
        throw new Error(t('imageOnlyError'))
      }

      const { filePath, imageUrl } = await handleImageUpload(file)

      setFormData((prev) => ({
        ...prev,
        file_path: filePath,
        image_url: imageUrl
      }))

      if (showAddFormRef.current) {
        void runOcrAfterReceiptUpload(imageUrl, filePath)
      }
    } catch (error) {
      console.error('File upload error:', error)
      alert(translateReceiptImageError(error))
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    if (files.length > 1 && editingExpense) {
      await applyUploadedImageToForm(files[0])
      alert(t('receiptEditSingleImageOnly'))
      return
    }

    if (files.length > 1 && !editingExpense) {
      if (typeof window !== 'undefined' && window.confirm(t('receiptBatchFromFormConfirm', { count: files.length }))) {
        await processReceiptOnlyFiles(Array.from(files))
      }
      return
    }

    await applyUploadedImageToForm(files[0])
  }

  const captureReceiptWebcamFrame = () => {
    const video = receiptWebcamVideoRef.current
    const target = webcamTarget
    if (!video || !target || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setWebcamTarget(null)
        if (target === 'toolbar') {
          void processReceiptOnlyFiles([file])
        } else {
          void applyUploadedImageToForm(file)
        }
      },
      'image/jpeg',
      0.88
    )
  }

  useEffect(() => {
    if (!webcamTarget) {
      if (receiptWebcamStreamRef.current) {
        receiptWebcamStreamRef.current.getTracks().forEach((tr) => tr.stop())
        receiptWebcamStreamRef.current = null
      }
      return
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert(t('webcamError'))
      setWebcamTarget(null)
      return
    }

    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        receiptWebcamStreamRef.current = stream
        const el = receiptWebcamVideoRef.current
        if (el) {
          el.srcObject = stream
          void el.play().catch(() => {})
        }
      })
      .catch(() => {
        alert(t('webcamError'))
        setWebcamTarget(null)
      })

    return () => {
      cancelled = true
      if (receiptWebcamStreamRef.current) {
        receiptWebcamStreamRef.current.getTracks().forEach((tr) => tr.stop())
        receiptWebcamStreamRef.current = null
      }
      const el = receiptWebcamVideoRef.current
      if (el) el.srcObject = null
    }
  }, [webcamTarget, t])

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length) {
      handleFileUpload(files)
    }
  }

  // 이미지 삭제 핸들러
  const handleImageRemove = async () => {
    if (!formData.image_url || !formData.file_path) {
      // 파일이 없으면 그냥 formData만 초기화
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
      return
    }

    try {
      // Storage에서 파일 삭제 시도 (실패해도 계속 진행)
      if (formData.file_path) {
        try {
          await supabase.storage
            .from('tour-expenses')
            .remove([formData.file_path])
        } catch (error) {
          console.warn('Storage 파일 삭제 실패 (무시):', error)
        }
      }

      // formData에서 이미지 정보 제거
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      // 오류가 발생해도 formData는 초기화
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
    }
  }

  // 지출 상태 업데이트
  const handleStatusUpdate = async (expenseId: string, status: TourExpense['status']) => {
    try {
      const effectiveSubmittedBy = await resolveSubmitterEmail()
      if (!effectiveSubmittedBy && status !== 'pending') {
        alert(t('submitterEmailRequired'))
        return
      }

      const checkedOn = status === 'pending' ? null : new Date().toISOString()
      const checkedBy = status === 'pending' ? null : effectiveSubmittedBy

      const { error } = await supabase
        .from('tour_expenses')
        .update({
          status,
          checked_by: checkedBy,
          checked_on: checkedOn,
        })
        .eq('id', expenseId)

      if (error) throw error

      setExpenses(prev => 
        prev.map(expense => 
          expense.id === expenseId 
            ? {
                ...expense,
                status,
                checked_by: checkedBy,
                checked_on: checkedOn,
              }
            : expense
        )
      )
      onExpenseUpdated?.()
      if (editingExpense?.id === expenseId) {
        onEmbedUpdated?.()
        setEditingExpense(null)
        setShowAddForm(false)
        setShowMoreCategories(false)
        setReimbursementSectionOpen(false)
        setPaymentMethodTab('own')
        if (embedSingleExpenseId) {
          onEmbedClose?.()
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 지출 수정 시작
  const handleEditExpense = (expense: TourExpense) => {
    setEditingExpense(expense)
    
    // 기존 paid_to 값이 paidToOptions 목록에 있는지 확인
    const isPaidToInOptions = paidToOptions.includes(expense.paid_to || '')
    const isPaidForInOptions = categories.some((category) => category.name === expense.paid_for)
    const isReceiptOnlyPending = expense.paid_for === receiptOnlyPaidFor
    
    console.log('지출 수정 시작:', {
      expensePaidTo: expense.paid_to,
      isPaidToInOptions: isPaidToInOptions,
      paidToOptionsCount: paidToOptions.length,
      paidToOptionsList: paidToOptions
    })
    
    setFormData({
      paid_to: isPaidToInOptions ? (expense.paid_to ?? '') : '',
      paid_for: isPaidForInOptions ? (expense.paid_for ?? '') : '',
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      note: expense.note || '',
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: isPaidToInOptions ? '' : (expense.paid_to ?? ''),
      custom_paid_for:
        !isPaidForInOptions && !isReceiptOnlyPending ? (expense.paid_for ?? '') : '',
      reimbursed_amount:
        expense.amount > 0 ? String(parseReimbursedAmount(expense.reimbursed_amount)) : '',
      reimbursed_on: expense.reimbursed_on ? expense.reimbursed_on.slice(0, 10) : '',
      reimbursement_note: expense.reimbursement_note || ''
    })
    setPaymentMethodTab(
      expense.payment_method && guideCardPaymentMethodIds.has(expense.payment_method) ? 'own' : 'other'
    )
    
    // 기존 값이 paidToOptions 목록에 없으면 직접 입력 모드로 전환
    setShowCustomPaidTo(!isPaidToInOptions)
    setShowCustomPaidFor(!isPaidForInOptions && !isReceiptOnlyPending)
    setReimbursementSectionOpen(
      parseReimbursedAmount(expense.reimbursed_amount) > 0.009 ||
        Boolean(String(expense.reimbursed_on ?? '').trim()) ||
        Boolean(String(expense.reimbursement_note ?? '').trim())
    )
    setFormReceiptZoom(1)
    setFormReceiptRotation(0)
    setFormInlineOcrOpen(false)
    setShowAddForm(true)
  }

  const buildExpenseFromFormData = useCallback((): TourExpense => {
    if (editingExpense) return editingExpense
    return buildOcrStubExpense(formData.image_url, formData.file_path)
  }, [editingExpense, formData.image_url, formData.file_path, buildOcrStubExpense])

  const executeReceiptOcr = async (
    expense: TourExpense,
    opts: {
      display: 'inline_form' | 'receipt_modal'
      applyTarget: 'edit_expense' | 'add_form'
      enhanced?: boolean
      rotationDegrees?: ReceiptOcrRotationDegrees
    }
  ) => {
    const imageUrl = expense.image_url?.trim()
    if (!imageUrl) {
      alert(t('receiptOcrNoImage'))
      return
    }

    const loadingId =
      opts.display === 'inline_form'
        ? '__draft__'
        : expense.id
    const controller = new AbortController()
    const ocrFetchMs = 150_000
    const timeoutId = window.setTimeout(() => controller.abort(), ocrFetchMs)

    try {
      setOcrLoadingExpenseId(loadingId)
      const { buffer, mime } = await loadReceiptImageBytesForOcr(expense, controller.signal)
      const { text, rotationUsed } = await runReceiptOcrFromImageBuffer(buffer, mime, {
        rotationDegrees: opts.rotationDegrees ?? formReceiptRotation,
        forceDualPass: Boolean(opts.enhanced),
        tryAlternateRotations: Boolean(opts.enhanced),
      })
      const rt = await fetchReceiptOcrParseRuntime(supabase)
      const ocrResult: ReceiptOcrResult = {
        text,
        candidates: buildReceiptOcrCandidates(text, { runtime: rt }),
      }

      let review: NonNullable<typeof ocrReview>
      try {
        review = buildOcrReviewFromResult(expense, ocrResult, opts.applyTarget)
      } catch (buildErr) {
        console.error('Receipt OCR build review error:', buildErr)
        throw new Error(buildErr instanceof Error ? buildErr.message : t('receiptOcrFailed'))
      }

      if (opts.display === 'inline_form') {
        if (rotationUsed !== formReceiptRotation) {
          setFormReceiptRotation(rotationUsed)
        }
        setFormInlineOcrOpen(true)
        setOcrReview(review)
        return
      }

      setViewingReceipt({
        imageUrl,
        expenseId: expense.id,
        paidFor: getExpensePaidForLabel(expense.paid_for || receiptOnlyPaidFor),
      })
      setOcrReview(review)
    } catch (error) {
      console.error('Receipt OCR error:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        alert(t('receiptOcrTimedOut', { seconds: Math.round(ocrFetchMs / 1000) }))
      } else {
        alert(error instanceof Error ? error.message : t('receiptOcrFailed'))
      }
    } finally {
      window.clearTimeout(timeoutId)
      setOcrLoadingExpenseId(null)
    }
  }

  const handleRunFormReceiptOcr = (enhanced = false) => {
    if (!formData.image_url?.trim()) {
      alert(t('receiptOcrNoImage'))
      return
    }
    const expense = buildExpenseFromFormData()
    void executeReceiptOcr(expense, {
      display: 'inline_form',
      applyTarget: editingExpense ? 'edit_expense' : 'add_form',
      enhanced,
      rotationDegrees: formReceiptRotation,
    })
  }

  const handleRunReceiptOcr = async (expense: TourExpense) => {
    await executeReceiptOcr(expense, {
      display: 'receipt_modal',
      applyTarget: 'edit_expense',
    })
  }

  const handleApplyOcrToForm = () => {
    if (!ocrReview) return

    if (ocrReview.applyTarget === 'add_form') {
      const { draft } = ocrReview
      const finalPaidTo = resolveOcrDraftPaidTo(draft)
      const finalPaidFor = resolveOcrDraftPaidFor(draft)
      const isPaidToInOptions = paidToOptions.includes(finalPaidTo)
      const isPaidForInOptions = categories.some((category) => category.name === finalPaidFor)
      const dateNote = draft.date ? `${t('receiptOcrDateLabel')}: ${draft.date}` : ''

      setFormData((prev) => {
        let noteOut = draft.note
        if (prev.note?.trim()) {
          const p = prev.note.trim()
          if (!noteOut.includes(p)) {
            noteOut = noteOut ? `${p}\n${noteOut}` : p
          }
        } else if (dateNote && noteOut && !noteOut.includes(dateNote)) {
          noteOut = [noteOut, dateNote].filter(Boolean).join('\n')
        }
        return {
          ...prev,
          paid_to: isPaidToInOptions ? finalPaidTo : '',
          paid_for: isPaidForInOptions ? finalPaidFor : '',
          amount: draft.amount,
          payment_method: draft.payment_method,
          note: noteOut,
          custom_paid_to: isPaidToInOptions ? '' : finalPaidTo,
          custom_paid_for: isPaidForInOptions ? '' : finalPaidFor,
          reimbursed_amount: '',
          reimbursed_on: '',
          reimbursement_note: '',
        }
      })
      setPaymentMethodTab(
        draft.payment_method && guideCardPaymentMethodIds.has(draft.payment_method) ? 'own' : 'other'
      )
      setShowCustomPaidTo(Boolean(finalPaidTo && !isPaidToInOptions))
      setShowCustomPaidFor(Boolean(finalPaidFor && !isPaidForInOptions))
      setShowMoreCategories(false)
      setReimbursementSectionOpen(false)
      setFormInlineOcrOpen(false)
      setOcrReview(null)
      setViewingReceipt(null)
      return
    }

    const { expense, draft } = ocrReview
    const finalPaidTo = resolveOcrDraftPaidTo(draft)
    const finalPaidFor = resolveOcrDraftPaidFor(draft)
    const isPaidToInOptions = paidToOptions.includes(finalPaidTo)
    const isPaidForInOptions = categories.some((category) => category.name === finalPaidFor)
    const dateNote = draft.date ? `${t('receiptOcrDateLabel')}: ${draft.date}` : ''
    const finalNote = dateNote && !draft.note.includes(dateNote)
      ? [draft.note, dateNote].filter(Boolean).join('\n')
      : draft.note

    setEditingExpense(expense)
    setFormData({
      paid_to: isPaidToInOptions ? finalPaidTo : '',
      paid_for: isPaidForInOptions ? finalPaidFor : '',
      amount: draft.amount,
      payment_method: draft.payment_method,
      note: finalNote,
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: isPaidToInOptions ? '' : finalPaidTo,
      custom_paid_for: isPaidForInOptions ? '' : finalPaidFor,
      reimbursed_amount:
        expense.amount > 0 ? String(parseReimbursedAmount(expense.reimbursed_amount)) : '',
      reimbursed_on: expense.reimbursed_on ? expense.reimbursed_on.slice(0, 10) : '',
      reimbursement_note: expense.reimbursement_note || ''
    })
    setPaymentMethodTab(
      draft.payment_method && guideCardPaymentMethodIds.has(draft.payment_method) ? 'own' : 'other'
    )
    setShowCustomPaidTo(Boolean(finalPaidTo && !isPaidToInOptions))
    setShowCustomPaidFor(Boolean(finalPaidFor && !isPaidForInOptions))
    setShowMoreCategories(false)
    setReimbursementSectionOpen(
      parseReimbursedAmount(expense.reimbursed_amount) > 0.009 ||
        Boolean(String(expense.reimbursed_on ?? '').trim()) ||
        Boolean(String(expense.reimbursement_note ?? '').trim())
    )
    setFormReceiptZoom(1)
    setShowAddForm(true)
    setFormInlineOcrOpen(false)
    setOcrReview(null)
    setViewingReceipt(null)
  }

  const handleSaveReceiptQuickBodyMatchRule = useCallback(async () => {
    if (!ocrReview) return
    setReceiptQuickRuleSaving(true)
    try {
      const res = await prependBodyMatchRuleToStoredSettings(supabase, {
        contains_phrase: receiptQuickRulePhrase,
        paid_to: resolveOcrDraftPaidTo(ocrReview.draft),
        paid_for: resolveOcrDraftPaidFor(ocrReview.draft),
        payment_method_id: ocrReview.draft.payment_method,
        payment_use_cc_label: receiptQuickRuleCcLabel,
      })
      if (!res.ok) {
        if (res.message === 'duplicate') {
          toast.error(t('receiptOcrQuickRuleDuplicate'))
        } else if (res.message === 'empty_phrase') {
          toast.error(t('receiptOcrQuickRulePhraseRequired'))
        } else if (res.message === 'empty_targets') {
          toast.error(t('receiptOcrQuickRuleTargetsRequired'))
        } else {
          toast.error(res.message)
        }
        return
      }
      toast.success(t('receiptOcrQuickRuleSaved'))
      await fetchReceiptOcrParseRuntime(supabase)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('unknownError'))
    } finally {
      setReceiptQuickRuleSaving(false)
    }
  }, [ocrReview, receiptQuickRulePhrase, receiptQuickRuleCcLabel, supabase, t])

  // 지출 수정 취소
  const handleCancelEdit = () => {
    setEditingExpense(null)
    setShowAddForm(false)
    setShowMoreCategories(false)
    setReimbursementSectionOpen(false)
    setFormReceiptRotation(0)
    setFormInlineOcrOpen(false)
    setOcrReview(null)
    setFormData({
      paid_to: '',
      paid_for: '',
      amount: '',
      payment_method: '',
      note: '',
      image_url: '',
      file_path: '',
      custom_paid_to: '',
      custom_paid_for: '',
      reimbursed_amount: '',
      reimbursed_on: '',
      reimbursement_note: ''
    })
    setPaymentMethodTab('own')
    if (embedSingleExpenseId) {
      onEmbedClose?.()
    }
  }

  // 지출 수정 저장
  const buildExpenseEditUpdatePayload = (): Record<string, unknown> | null => {
    if (!editingExpense) return null

    if (!formData.paid_for && !formData.custom_paid_for) {
      alert(t('fillRequiredFields'))
      return null
    }

    if (!formData.amount) {
      alert(t('fillRequiredFields'))
      return null
    }

    if (!formData.payment_method?.trim()) {
      alert(t('paymentMethodRequired'))
      return null
    }

    const amountNum = parseFloat(formData.amount)
    const reimbNum = reimbursementSectionOpen
      ? parseFloat(String(formData.reimbursed_amount ?? '').trim() || '0')
      : 0
    if (!Number.isFinite(reimbNum) || reimbNum < 0) {
      alert(t('reimbursementInvalidNonNegative'))
      return null
    }
    if (amountNum > 0 && reimbNum > amountNum + 0.001) {
      alert(t('reimbursementExceedsAmount'))
      return null
    }

    const finalPaidTo = formData.custom_paid_to || formData.paid_to || null
    const reimbursedOnVal = formData.reimbursed_on?.trim() || null
    const reimbPayload =
      amountNum > 0 && reimbursementSectionOpen
        ? {
            reimbursed_amount: reimbNum,
            reimbursed_on: reimbursedOnVal,
            reimbursement_note: formData.reimbursement_note?.trim() || null,
          }
        : {
            reimbursed_amount: 0,
            reimbursed_on: null,
            reimbursement_note: null,
          }

    return {
      paid_to: finalPaidTo,
      paid_for: formData.custom_paid_for || formData.paid_for,
      amount: amountNum,
      payment_method: formData.payment_method || null,
      note: formData.note || null,
      image_url: formData.image_url || null,
      file_path: formData.file_path || null,
      updated_at: new Date().toISOString(),
      ...reimbPayload,
    }
  }

  const handleUpdateExpense = async () => {
    if (!editingExpense) return

    const payload = buildExpenseEditUpdatePayload()
    if (!payload) return

    try {
      const { error } = await supabase
        .from('tour_expenses')
        .update(payload as never)
        .eq('id', editingExpense.id)

      if (error) throw error

      const amountNum = payload.amount as number
      const finalPaidTo = payload.paid_to as string | null
      const reimbPayload = {
        reimbursed_amount: payload.reimbursed_amount as number,
        reimbursed_on: payload.reimbursed_on as string | null,
        reimbursement_note: payload.reimbursement_note as string | null,
      }

      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === editingExpense.id
            ? {
                ...expense,
                paid_to: finalPaidTo ?? expense.paid_to,
                paid_for: payload.paid_for as string,
                amount: amountNum,
                payment_method: payload.payment_method as string | null,
                note: payload.note as string | null,
                ...reimbPayload,
              }
            : expense
        )
      )

      handleCancelEdit()
      onExpenseUpdated?.()
      onEmbedUpdated?.()
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('지출 수정 중 오류가 발생했습니다.')
    }
  }

  const handleSaveAndApproveExpense = async () => {
    if (!editingExpense) return

    const payload = buildExpenseEditUpdatePayload()
    if (!payload) return

    try {
      const effectiveSubmittedBy = await resolveSubmitterEmail()
      if (!effectiveSubmittedBy) {
        alert(t('submitterEmailRequired'))
        return
      }

      const { error } = await supabase
        .from('tour_expenses')
        .update({
          ...payload,
          status: 'approved',
          checked_by: effectiveSubmittedBy,
          checked_on: new Date().toISOString(),
        } as never)
        .eq('id', editingExpense.id)

      if (error) throw error

      onExpenseUpdated?.()
      onEmbedUpdated?.()
      handleCancelEdit()
    } catch (error) {
      console.error('Error saving and approving expense:', error)
      alert('지출 저장·승인 중 오류가 발생했습니다.')
    }
  }

  const handleRejectEditingExpense = async () => {
    if (!editingExpense) return
    await handleStatusUpdate(editingExpense.id, 'rejected')
  }

  const handleDeleteEditingExpense = async () => {
    if (!editingExpense) return
    await handleDeleteExpense(editingExpense.id)
  }

  // 지출 삭제
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const { error } = await supabase
        .from('tour_expenses')
        .delete()
        .eq('id', expenseId)

      if (error) throw error

      setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
      if (editingExpense?.id === expenseId) {
        handleCancelEdit()
      }
      onExpenseUpdated?.()
      onEmbedUpdated?.()
      if (embedSingleExpenseId) {
        onEmbedClose?.()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert(t('deleteError'))
    }
  }

  // 금액 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('status.approved')
      case 'rejected': return t('status.rejected')
      default: return t('status.pending')
    }
  }

  // 부킹 데이터 로드 (ticket_bookings.expense 합, tour_hotel_bookings.total_price 합 — @/lib/bookingSettlement)
  const loadBookings = useCallback(async () => {
    if (!tourId) return
    
    setIsLoadingBookings(true)
    try {
      // 티켓 부킹 로드
      const { data: ticketsRaw, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)

      if (ticketError) {
        console.error('티켓 부킹 로드 오류:', ticketError)
      } else {
        const tickets = (ticketsRaw || []).filter((b) => isTicketBookingIncludedInSettlement(b.status))
        setTicketBookings(tickets)
        console.log('티켓 부킹 로드됨:', tickets.length, '건 (정산 포함, 취소/크레딧 제외)')
      }

      // 호텔 부킹: tour_id로만 조회 후 취소만 제외 (status NULL·레거시 값 포함)
      const { data: hotelsRaw, error: hotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)

      if (hotelError) {
        console.error('호텔 부킹 로드 오류:', hotelError)
      } else {
        const hotels = (hotelsRaw || []).filter((b) => isHotelBookingIncludedInSettlement(b.status))
        setHotelBookings(hotels)
        console.log('호텔 부킹 로드됨:', hotels.length, '건 (정산 포함, 취소 제외)')
      }
    } catch (error) {
      console.error('부킹 데이터 로드 오류:', error)
    } finally {
      setIsLoadingBookings(false)
    }
  }, [tourId])

  // 투어 데이터 및 수수료 로드
  const loadTourData = useCallback(async () => {
    if (!tourId) return
    
    setIsLoadingTourData(true)
    try {
      // 투어 기본 정보 로드
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('id, product_id, team_type, guide_fee, assistant_fee, tour_status, tour_guide_id, assistant_id')
        .eq('id', tourId)
        .single()

      if (tourError) {
        console.error('투어 데이터 로드 오류:', tourError)
        return
      }

      setTourData(tour)

      if (isTourCancelled(tour.tour_status)) {
        setGuideFee(0)
        setAssistantFee(0)
        return
      }
      
      // 저장된 수수료가 있으면 사용
      if (tour.guide_fee !== null && tour.guide_fee !== undefined) {
        setGuideFee(tour.guide_fee)
        console.log('투어에서 가이드 수수료 로드됨:', tour.guide_fee)
      }
      if (tour.assistant_fee !== null && tour.assistant_fee !== undefined) {
        setAssistantFee(tour.assistant_fee)
        console.log('투어에서 어시스턴트 수수료 로드됨:', tour.assistant_fee)
      }

      // 저장된 수수료가 없으면 가이드비 관리에서 기본값 로드
      if ((tour.guide_fee === null || tour.guide_fee === undefined) && productId && tour.team_type) {
        try {
          const teamTypeMap: Record<string, string> = {
            '1guide': '1_guide',
            '2guide': '2_guides',
            'guide+driver': 'guide_driver'
          }

          const mappedTeamType = teamTypeMap[tour.team_type]
          if (mappedTeamType) {
            const response = await fetch(`/api/guide-costs?product_id=${productId}&team_type=${mappedTeamType}`)
            const data = await response.json()

            if (data.guideCost) {
              if (tour.guide_fee === null || tour.guide_fee === undefined) {
                setGuideFee(data.guideCost.guide_fee)
                console.log('가이드비 관리에서 가이드 기본 수수료 로드됨:', data.guideCost.guide_fee)
              }
              if (tour.assistant_fee === null || tour.assistant_fee === undefined) {
                setAssistantFee(data.guideCost.assistant_fee)
                console.log('가이드비 관리에서 어시스턴트 기본 수수료 로드됨:', data.guideCost.assistant_fee)
              }
            }
          }
        } catch (error) {
          console.error('가이드비 기본값 로드 오류:', error)
        }
      }
    } catch (error) {
      console.error('투어 데이터 로드 오류:', error)
    } finally {
      setIsLoadingTourData(false)
    }
  }, [tourId, productId, tourStatus])

  // 어코디언 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Operating Profit 계산 (DB 저장값 우선, 없으면 레거시 산식)
  const resolveOperatingProfit = (pricing: ReservationPricing, reservationId: string): number => {
    return resolveOperatingProfitForTourStats(
      pricing,
      reservationId,
      reservationExpenses,
      reservationChannels
    )
  }

  const assignedReservationIdSet = useMemo(
    () => new Set((reservationIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    [reservationIds]
  )

  /** 배정됐고 정산 대상인 예약만 (취소·환불·문의·노쇼 제외) */
  const settlementReservations = useMemo(
    () =>
      reservations.filter(
        (r) =>
          assignedReservationIdSet.has(r.id) &&
          !reservationExcludedFromTourSettlementAggregates(r.status)
      ),
    [reservations, assignedReservationIdSet]
  )

  // 통계 계산
  const calculateFinancialStats = () => {
    const settlementReservationIds = new Set(settlementReservations.map((r) => r.id))

    const pricingForSettlementTotals = reservationPricing.filter((p) =>
      settlementReservationIds.has(p.reservation_id)
    )

    const totalPayments = pricingForSettlementTotals.reduce((sum, pricing) => sum + pricing.total_price, 0)

    const totalOperatingProfit = pricingForSettlementTotals.reduce((sum, pricing) => {
      return sum + resolveOperatingProfit(pricing, pricing.reservation_id)
    }, 0)
    
    // 총 지출 계산 (기존 지출 + 가이드/드라이버 수수료 + 부킹 비용)
    // 팀 구성 & 차량 배정에서 전달된 수수료가 있으면 우선 사용 (저장 후 즉시 반영)
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const statusForCancelCheck = tourStatus ?? tourData?.tour_status
    const tourFeesCancelled = isTourCancelled(statusForCancelCheck)
    const effectiveGuideFee = tourFeesCancelled
      ? 0
      : (tourGuideFee !== undefined && tourGuideFee !== null ? tourGuideFee : guideFee)
    const effectiveAssistantFee = tourFeesCancelled
      ? 0
      : (tourAssistantFee !== undefined && tourAssistantFee !== null ? tourAssistantFee : assistantFee)
    const totalFees = effectiveGuideFee + effectiveAssistantFee
    
    // 부킹 비용 계산
    const totalTicketCosts = ticketBookings.reduce(
      (sum, booking) => sum + ticketExpenseForSettlement(booking),
      0
    )
    const totalHotelCosts = hotelBookings.reduce(
      (sum, booking) => sum + hotelAmountForSettlement(booking),
      0
    )
    const totalBookingCosts = totalTicketCosts + totalHotelCosts
    
    const totalExpensesWithFeesAndBookings = totalExpenses + totalFees + totalBookingCosts
    
    // 수익 계산 (Operating Profit 총합 - 투어 지출 - 수수료 - 부킹 비용)
    const profit = totalOperatingProfit - totalExpensesWithFeesAndBookings
    
    return {
      totalPayments,
      totalOperatingProfit,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      effectiveGuideFee,
      effectiveAssistantFee
    }
  }

  const expenseBreakdown = useMemo(() => {
    const breakdown: Record<string, { amount: number; count: number; expenses: TourExpense[] }> = {}
    expenses.forEach((expense) => {
      const category = expense.paid_for
      if (!breakdown[category]) {
        breakdown[category] = { amount: 0, count: 0, expenses: [] }
      }
      breakdown[category].amount += expense.amount
      breakdown[category].count += 1
      breakdown[category].expenses.push(expense)
    })
    return breakdown
  }, [expenses])

  const financialStats = calculateFinancialStats()

  const statsSectionClass = compact ? 'bg-gray-50 rounded-lg p-2.5 space-y-2' : 'bg-gray-50 rounded-lg p-4 space-y-4'
  const statsTitleClass = compact
    ? 'text-sm font-semibold text-gray-900'
    : 'text-lg font-semibold text-gray-900'
  const statsCardBtnClass = compact
    ? 'w-full flex items-center justify-between p-2.5 text-left hover:bg-gray-50'
    : 'w-full flex items-center justify-between p-4 text-left hover:bg-gray-50'
  const statsAmountClass = compact ? 'text-sm font-bold' : 'text-lg font-bold'
  const statsLabelClass = compact ? 'text-xs font-medium text-gray-900' : 'font-medium text-gray-900'
  const statsBodyClass = compact ? 'border-t p-2.5 bg-gray-50' : 'border-t p-4 bg-gray-50'
  const statsRowTextClass = compact ? 'text-xs' : 'text-sm'
  const statsChevronSize = compact ? 16 : 20
  const statsDotClass = compact ? 'w-2 h-2 rounded-full' : 'w-3 h-3 rounded-full'
  const pageTitleClass = compact ? 'text-sm font-semibold text-gray-900' : 'text-lg font-semibold text-gray-900'
  const expenseListItemClass = compact ? 'border rounded-lg p-2 hover:bg-gray-50' : 'border rounded-lg p-3 hover:bg-gray-50'
  const expenseListSubtitleClass = compact
    ? 'text-xs font-semibold text-gray-700 mb-1.5'
    : 'text-sm font-semibold text-gray-700 mb-2'

  useEffect(() => {
    loadExpenses()
    loadCategories()
    loadVendors()
    loadTeamMembers()
    loadReservations()
    loadTourData() // 투어 데이터 및 수수료 로드
    loadBookings() // 부킹 데이터 로드
  }, [tourId, tourStatus, loadExpenses, loadReservations, loadTourData, loadBookings])

  useEffect(() => {
    if (reservations.length > 0) {
      loadReservationPricing()
      loadReservationExpenses()
    }
  }, [reservations, loadReservationPricing, loadReservationExpenses])

  useEffect(() => {
    if (!embedSingleExpenseId || embedEditOpenedRef.current || loading) return
    const expense = expenses.find((row) => row.id === embedSingleExpenseId)
    if (!expense) return
    embedEditOpenedRef.current = true
    handleEditExpense(expense)
  }, [embedSingleExpenseId, expenses, loading])

  const openAddExpenseForm = useCallback(() => {
    setEditingExpense(null)
    setPaymentMethodTab('own')
    setReimbursementSectionOpen(false)
    setShowCustomPaidTo(false)
    setShowCustomPaidFor(false)
    setShowMoreCategories(false)
    setFormData({
      paid_to: '',
      paid_for: '',
      amount: '',
      payment_method: '',
      note: '',
      image_url: '',
      file_path: '',
      custom_paid_to: '',
      custom_paid_for: '',
      reimbursed_amount: '',
      reimbursed_on: '',
      reimbursement_note: '',
    })
    setFormReceiptZoom(1)
    setShowAddForm(true)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      openOptionManagement: () => setShowOptionManagement(true),
      openAddExpense: openAddExpenseForm,
      toggleDriveImporter: () => setShowDriveImporter((prev) => !prev),
    }),
    [openAddExpenseForm]
  )

  const toolbarIconBtnClass = compact
    ? 'inline-flex items-center justify-center w-7 h-7 rounded-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0'
    : 'inline-flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0'
  const toolbarIconSize = compact ? 14 : 16

  return (
    <div className="space-y-4">
      {!embedSingleExpenseId ? (
      <>
      {!hideTitle ? (
      <div className="flex items-center justify-between">
        <h3 className={pageTitleClass}>{t('title')}</h3>
        <div className="flex items-center space-x-1.5">
          {allowReceiptOnlyUpload && (
            <div className="flex items-center gap-1">
              <input
                ref={receiptOnlyCameraInputRef}
                type="file"
                accept="image/*"
                capture={
                  typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                    ? 'environment'
                    : undefined
                }
                onChange={(e) => {
                  void handleReceiptOnlyUpload(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />
              <input
                ref={receiptOnlyInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  void handleReceiptOnlyUpload(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                    receiptOnlyCameraInputRef.current?.click()
                  } else {
                    setWebcamTarget('toolbar')
                  }
                }}
                disabled={uploading}
                className={`${toolbarIconBtnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
                title={t('camera')}
              >
                <Camera size={toolbarIconSize} />
              </button>
              <button
                type="button"
                onClick={() => receiptOnlyInputRef.current?.click()}
                disabled={uploading}
                className={`${toolbarIconBtnClass} bg-emerald-600 text-white hover:bg-emerald-700`}
                title={t('receiptOnlyUpload')}
              >
                <Receipt size={toolbarIconSize} />
              </button>
            </div>
          )}
          <button
            onClick={() => setShowOptionManagement(true)}
            className={`${toolbarIconBtnClass} bg-gray-600 text-white hover:bg-gray-700`}
            title="선택지 관리"
          >
            <Settings size={toolbarIconSize} />
          </button>
          <button
            type="button"
            onClick={openAddExpenseForm}
            className={`${toolbarIconBtnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
            title={t('addExpense')}
          >
            <Plus size={toolbarIconSize} />
          </button>
          {userRole !== 'team_member' && (
            <button
              type="button"
              onClick={() => setShowDriveImporter((prev) => !prev)}
              className={`${toolbarIconBtnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
              title="구글 드라이브에서 영수증 가져오기"
            >
              <Folder size={toolbarIconSize} />
            </button>
          )}
        </div>
      </div>
      ) : null}

      {/* 정산 통계 섹션 */}
      <div className={statsSectionClass}>
        <h4 className={statsTitleClass}>{t('settlementStats')}</h4>
        
        {/* Operating Profit 총합 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('payments')}
            className={statsCardBtnClass}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className={`${statsDotClass} bg-green-500 shrink-0`}></div>
              <span className={statsLabelClass}>Operating Profit</span>
              <span className={`${statsAmountClass} text-green-600 shrink-0`}>
                {formatCurrency(financialStats.totalOperatingProfit)}
              </span>
            </div>
            {expandedSections.payments ? <ChevronDown size={statsChevronSize} /> : <ChevronRight size={statsChevronSize} />}
          </button>
          
          {expandedSections.payments && (
            <div className={statsBodyClass}>
              <div className={`mb-1.5 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
                배정·정산 대상 {settlementReservations.length}팀
              </div>
              <div className={compact ? 'space-y-1' : 'space-y-2'}>
                {settlementReservations.length > 0 ? (
                  settlementReservations.map((reservation) => {
                    const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                    const totalPeople = reservation.adults + reservation.children + reservation.infants
                    const operatingProfit = pricing
                      ? resolveOperatingProfit(pricing, reservation.id)
                      : 0
                    return (
                      <div key={reservation.id} className={`flex items-center justify-between ${statsRowTextClass}`}>
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="font-medium truncate">{reservation.customer_name}</span>
                          <span className="text-gray-500 shrink-0">({totalPeople}명)</span>
                        </div>
                        <span className="font-medium text-green-600 shrink-0 ml-2">
                          {formatCurrency(operatingProfit)}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className={`${statsRowTextClass} text-gray-500`}>정산 대상 배정 예약이 없습니다.</div>
                )}
              </div>
            </div>
          )}
          </div>
        )}

        {/* 지출 총합 */}
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('expenses')}
            className={statsCardBtnClass}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className={`${statsDotClass} bg-red-500 shrink-0`}></div>
              <span className={statsLabelClass}>{t('totalExpenses')}</span>
              <span className={`${statsAmountClass} text-red-600 shrink-0`}>
                {formatCurrency(financialStats.totalExpensesWithFeesAndBookings)}
              </span>
            </div>
            {expandedSections.expenses ? <ChevronDown size={statsChevronSize} /> : <ChevronRight size={statsChevronSize} />}
          </button>
          
          {expandedSections.expenses && (
            <div className={statsBodyClass}>
              <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {/* 가이드/드라이버 수수료 */}
                {(financialStats.effectiveGuideFee > 0 || financialStats.effectiveAssistantFee > 0) && (
                  <div className={`bg-white rounded ${compact ? 'p-2' : 'p-3'}`}>
                    <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
                      <span className={statsLabelClass}>{t('guideDriverFee')}</span>
                      <span className={`${statsAmountClass} text-red-600`}>
                        {formatCurrency(financialStats.totalFees)}
                      </span>
                    </div>
                    <div className={`space-y-0.5 ${statsRowTextClass} text-gray-600`}>
                      {financialStats.effectiveGuideFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('guideFee')}</span>
                          <span>{formatCurrency(financialStats.effectiveGuideFee)}</span>
                        </div>
                      )}
                      {financialStats.effectiveAssistantFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('assistantDriverFee')}</span>
                          <span>{formatCurrency(financialStats.effectiveAssistantFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 부킹 비용 */}
                {(financialStats.totalBookingCosts > 0) && (
                  <div className={`bg-white rounded ${compact ? 'p-2' : 'p-3'}`}>
                    <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
                      <span className={statsLabelClass}>{t('bookingCost')}</span>
                      <span className={`${statsAmountClass} text-red-600`}>
                        {formatCurrency(financialStats.totalBookingCosts)}
                      </span>
                    </div>
                    <div className={`space-y-0.5 ${statsRowTextClass} text-gray-600`}>
                      {financialStats.totalTicketCosts > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('ticketBooking')}</span>
                          <span>{formatCurrency(financialStats.totalTicketCosts)}</span>
                        </div>
                      )}
                      {financialStats.totalHotelCosts > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('hotelBooking')}</span>
                          <span>{formatCurrency(financialStats.totalHotelCosts)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 기존 지출 카테고리들 */}
                {Object.entries(expenseBreakdown).map(([category, data]) => (
                  <div key={category} className={`bg-white rounded ${compact ? 'p-2' : 'p-3'}`}>
                    <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
                      <span className={statsLabelClass}>{getExpensePaidForLabel(category)}</span>
                      <span className={`${statsAmountClass} text-red-600`}>
                        {formatCurrency(data.amount)} ({data.count} {t('items')})
                      </span>
                    </div>
                    <div className={`space-y-0.5 ${statsRowTextClass} text-gray-600`}>
                      {data.expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between">
                          <span>{expense.paid_to} - {expense.note || t('noMemo')}</span>
                          <span>{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 수익 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('profit')}
            className={statsCardBtnClass}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className={`${statsDotClass} rounded-full shrink-0 ${financialStats.profit >= 0 ? 'bg-primary/50' : 'bg-orange-500'}`}></div>
              <span className={statsLabelClass}>{t('profit')}</span>
              <span className={`${statsAmountClass} shrink-0 ${financialStats.profit >= 0 ? 'text-primary' : 'text-orange-600'}`}>
                {formatCurrency(financialStats.profit)}
              </span>
            </div>
            {expandedSections.profit ? <ChevronDown size={statsChevronSize} /> : <ChevronRight size={statsChevronSize} />}
          </button>
          
          {expandedSections.profit && (
            <div className={statsBodyClass}>
              <div className={`space-y-1.5 ${statsRowTextClass}`}>
                <div className="flex items-center justify-between">
                  <span>Operating Profit</span>
                  <span className="text-green-600 font-medium">{formatCurrency(financialStats.totalOperatingProfit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('totalExpensesWithFeesAndBookings')}</span>
                  <span className="text-red-600">{formatCurrency(financialStats.totalExpensesWithFeesAndBookings)}</span>
                </div>
                <hr className="my-1.5" />
                <div className="flex items-center justify-between font-semibold">
                  <span>{t('profit')}</span>
                  <span className={financialStats.profit >= 0 ? 'text-primary' : 'text-orange-600'}>
                    {formatCurrency(financialStats.profit)}
                  </span>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

        {/* 추가비용 합산 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('additionalCosts')}
            className={statsCardBtnClass}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className={`${statsDotClass} bg-purple-500 shrink-0`}></div>
              <span className={statsLabelClass}>추가비용 합산</span>
              <span className={`${statsAmountClass} text-purple-600 shrink-0`}>
                {formatCurrency((() => {
                  const totalAdditionalCost = settlementReservations.reduce((sum, reservation) => {
                    const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                    const additionalCost = pricing?.additional_cost || 0
                    return sum + Math.floor(additionalCost / 100) * 100
                  }, 0)
                  return totalAdditionalCost
                })())}
              </span>
            </div>
            {expandedSections.additionalCosts ? <ChevronDown size={statsChevronSize} /> : <ChevronRight size={statsChevronSize} />}
          </button>
          
          {expandedSections.additionalCosts && (
            <div className={statsBodyClass}>
              <div className={`mb-1.5 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
                배정·정산 대상 {settlementReservations.length}팀
              </div>
              <div className={compact ? 'space-y-1' : 'space-y-2'}>
                {settlementReservations.length > 0 ? (
                  settlementReservations.map((reservation) => {
                      const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                      const totalPeople = reservation.adults + reservation.children + reservation.infants
                      const additionalCost = pricing?.additional_cost || 0
                      const roundedAdditionalCost = Math.floor(additionalCost / 100) * 100
                      return (
                        <div key={reservation.id} className={`flex items-center justify-between ${statsRowTextClass}`}>
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="font-medium truncate">{reservation.customer_name}</span>
                            <span className="text-gray-500 shrink-0">({totalPeople}명)</span>
                          </div>
                          <span className="font-medium text-purple-600 shrink-0 ml-2">
                            {formatCurrency(roundedAdditionalCost)}
                          </span>
                        </div>
                      )
                    })
                ) : (
                  <div className={`${statsRowTextClass} text-gray-500`}>정산 대상 배정 예약이 없습니다.</div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* 구글 드라이브 영수증 가져오기 패널 - 가이드(team_member)는 숨김 */}
      {userRole !== 'team_member' && showDriveImporter && (
        <div className={compact ? 'mb-2' : 'mb-4'}>
          <GoogleDriveReceiptImporter
            onImportComplete={() => {
              setShowDriveImporter(false)
              loadExpenses()
            }}
          />
        </div>
      )}

      {/* 지출 목록 */}
      <h4 className={expenseListSubtitleClass}>{t('tourReceiptsSection')}</h4>
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading...</p>
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className={`${expenseListItemClass} cursor-pointer`}
              onClick={() => handleEditExpense(expense)}
            >
              {/* 1행: 지출명·금액·상태 | 액션 버튼 오른쪽 끝 */}
              <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1' : 'mb-2'}`}>
                <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
                  <Select
                    value={expense.status}
                    onValueChange={(value) => {
                      const next = value as TourExpense['status']
                      if (next !== expense.status) {
                        void handleStatusUpdate(expense.id, next)
                      }
                    }}
                  >
                    <SelectTrigger
                      onClick={(e) => e.stopPropagation()}
                      className={`h-auto w-auto shrink-0 gap-0.5 rounded-full border-0 px-2 py-0.5 shadow-none hover:opacity-90 focus:ring-1 focus:ring-ring [&>svg]:h-3 [&>svg]:w-3 ${compact ? 'text-[10px]' : 'text-xs'} ${getStatusColor(expense.status)}`}
                      aria-label={t('statusLabel')}
                    >
                      <SelectValue>{getStatusText(expense.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{getStatusText('pending')}</SelectItem>
                      <SelectItem value="approved">{getStatusText('approved')}</SelectItem>
                      <SelectItem value="rejected">{getStatusText('rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="font-medium text-gray-900 truncate">
                    {getExpensePaidForLabel(expense.paid_for)}
                  </span>
                  <span className="font-bold text-green-600 shrink-0">
                    ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 self-center" onClick={(e) => e.stopPropagation()}>
                  {canRunReceiptOcr && expense.image_url && expense.image_url.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => void handleRunReceiptOcr(expense)}
                      disabled={ocrLoadingExpenseId === expense.id}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-purple-600 hover:text-purple-800 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('receiptOcrAction')}
                    >
                      <span className="text-[10px] font-bold leading-none">
                        {ocrLoadingExpenseId === expense.id ? '...' : 'OCR'}
                      </span>
                    </button>
                  )}
                  {expense.image_url && expense.image_url.trim() !== '' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOcrReview((prev) => (prev && prev.expense.id !== expense.id ? null : prev))
                        setViewingReceipt({
                          imageUrl: expense.image_url!,
                          expenseId: expense.id,
                          paidFor: getExpensePaidForLabel(expense.paid_for),
                        })
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:text-primary/80 hover:bg-muted/50"
                      title="영수증 보기"
                    >
                      <Receipt size={14} />
                    </button>
                  ) : (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center text-gray-400 cursor-help"
                      title={`영수증 없음 - 이미지 URL: ${expense.image_url || 'null'}, 파일 경로: ${expense.file_path || 'null'}`}
                    >
                      <Receipt size={14} />
                    </span>
                  )}
                </div>
              </div>
              
              {/* 2행: 결제처, 제출자, 제출일, 결제방법 */}
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-600`}>
                {expense.paid_to ? <span>{expense.paid_to}</span> : null}
                {expense.paid_to ? <span className="text-gray-300">•</span> : null}
                <span>{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                <span className="text-gray-300">•</span>
                <span>{new Date(expense.submit_on).toLocaleDateString('ko-KR')}</span>
                {expense.payment_method ? (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                      {paymentMethodMap[expense.payment_method] || expense.payment_method}
                    </span>
                  </>
                ) : null}
              </div>
              {expense.amount > 0 && expenseHasReimbursementTracking(expense) && (
                  <div className="mt-1.5 text-[10px] text-gray-600 border-t border-gray-100 pt-1.5">
                    <span className="text-gray-500">{t('reimbursedShort')}:</span>{' '}
                    <span className="font-medium">{formatCurrency(parseReimbursedAmount(expense.reimbursed_amount))}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="text-gray-500">{t('outstandingShort')}:</span>{' '}
                    <span
                      className={
                        reimbursementOutstanding(expense.amount, expense.reimbursed_amount) > 0.009
                          ? 'font-semibold text-amber-700'
                          : 'font-medium text-green-700'
                      }
                    >
                      {formatCurrency(reimbursementOutstanding(expense.amount, expense.reimbursed_amount))}
                    </span>
                  </div>
                )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center text-gray-500 ${compact ? 'py-4' : 'py-8'}`}>
          <DollarSign size={compact ? 28 : 48} className={`mx-auto text-gray-300 ${compact ? 'mb-2' : 'mb-4'}`} />
          <p className={compact ? 'text-xs' : 'text-sm'}>{t('noExpenses')}</p>
        </div>
      )}

      </>
      ) : null}

      {/* 영수증 보기 + OCR 추출(오른쪽) — 단일 모달 */}
      {expenseModalPortalReady &&
        viewingReceipt &&
        createPortal(
          <div
            className={`fixed inset-0 bg-black/75 flex items-center justify-center p-2 sm:p-4 ${TOUR_EXPENSE_MODAL_PORTAL_Z} ${TOUR_EXPENSE_MODAL_PORTAL_INTERACTION}`}
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b shrink-0">
                <div className="flex items-start gap-2 min-w-0">
                  <Receipt className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('receiptViewerTitle', { label: viewingReceipt.paidFor })}
                    </h3>
                    {ocrReview && ocrReview.expense.id === viewingReceipt.expenseId ? (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {ocrReview.applyTarget === 'add_form'
                          ? t('receiptOcrReviewDescriptionAddForm')
                          : t('receiptOcrReviewDescription')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-0.5">{t('receiptViewerLayoutHint')}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewingReceipt(null)
                    setOcrReview(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
                {/* 왼쪽: 영수증 이미지 + 확대/축소 */}
                <div className="flex flex-col flex-1 min-w-0 min-h-[30vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-slate-50 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptViewerZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))
                      }
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                      title={t('receiptViewerZoomOut')}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-600 tabular-nums min-w-[3rem] text-center">
                      {Math.round(receiptViewerZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptViewerZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))
                      }
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                      title={t('receiptViewerZoomIn')}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptViewerZoom(1)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                    >
                      {t('receiptViewerZoomReset')}
                    </button>
                    <a
                      href={viewingReceipt.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      {t('openInNewWindow')}
                    </a>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto p-3 bg-slate-100/90">
                    <img
                      src={viewingReceipt.imageUrl}
                      alt={`${viewingReceipt.paidFor} receipt`}
                      style={{
                        width: `${100 * receiptViewerZoom}%`,
                        maxWidth: 'none',
                        height: 'auto',
                      }}
                      className="rounded-lg shadow-md block"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder-receipt.png'
                        target.alt = t('receiptImageLoadErrorAlt')
                      }}
                    />
                  </div>
                </div>

                {/* 오른쪽: OCR 미실행 안내 또는 추출 결과 편집 */}
                <div className="flex flex-col flex-1 min-w-0 min-h-[36vh] lg:max-h-[calc(92vh-5.5rem)] relative bg-white">
                  {(() => {
                    const ocrMatches =
                      ocrReview && ocrReview.expense.id === viewingReceipt.expenseId ? ocrReview : null
                    const ocrLoadingThis =
                      ocrLoadingExpenseId &&
                      (ocrLoadingExpenseId === viewingReceipt.expenseId ||
                        (viewingReceipt.expenseId === '__ocr_draft__' &&
                          ocrLoadingExpenseId === '__draft__'))

                    if (ocrLoadingThis && !ocrMatches) {
                      return (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-600">
                          <p className="text-sm">{t('receiptOcrAnalyzingAfterUpload')}</p>
                        </div>
                      )
                    }

                    if (ocrMatches) {
                      return (
                        <>
                          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0">
                            <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('paidTo')}
                                </label>
                                <div className="space-y-2">
                                  <select
                                    value={ocrMatches.draft.custom_paid_to || ocrMatches.draft.paid_to}
                                    onChange={(e) => {
                                      const selectedValue = e.target.value
                                      if (selectedValue === '__custom__') {
                                        setOcrReview((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: {
                                                  ...prev.draft,
                                                  paid_to: '',
                                                  custom_paid_to: '',
                                                },
                                              }
                                            : prev
                                        )
                                        setOcrShowCustomPaidTo(true)
                                      } else if (paidToOptions.includes(selectedValue)) {
                                        setOcrReview((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: {
                                                  ...prev.draft,
                                                  paid_to: selectedValue,
                                                  custom_paid_to: '',
                                                },
                                              }
                                            : prev
                                        )
                                        setOcrShowCustomPaidTo(false)
                                      } else {
                                        setOcrReview((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: {
                                                  ...prev.draft,
                                                  paid_to: '',
                                                  custom_paid_to: selectedValue,
                                                },
                                              }
                                            : prev
                                        )
                                        setOcrShowCustomPaidTo(true)
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                  >
                                    <option value="">{t('selectPaidTo')}</option>
                                    {paidToOptions.map((paidTo) => (
                                      <option key={paidTo} value={paidTo}>
                                        {paidTo}
                                      </option>
                                    ))}
                                    <option value="__custom__">{t('directInput')}</option>
                                  </select>
                                  {ocrShowCustomPaidTo && (
                                    <input
                                      type="text"
                                      value={ocrMatches.draft.custom_paid_to ?? ''}
                                      onChange={(e) =>
                                        setOcrReview((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: {
                                                  ...prev.draft,
                                                  custom_paid_to: e.target.value,
                                                },
                                              }
                                            : prev
                                        )
                                      }
                                      placeholder={t('enterNewPaidTo')}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('paidFor')}
                                </label>
                                <div className="mb-3">
                                  <div className="grid grid-cols-4 gap-2">
                                    {categories.find((c) => c.name === 'Entrance Fee') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next =
                                            ocrMatches.draft.paid_for === 'Entrance Fee' ? '' : 'Entrance Fee'
                                          setOcrReview((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  draft: {
                                                    ...prev.draft,
                                                    paid_for: next,
                                                    custom_paid_for: '',
                                                  },
                                                }
                                              : prev
                                          )
                                          setOcrShowCustomPaidFor(false)
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                          ocrMatches.draft.paid_for === 'Entrance Fee'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                      >
                                        <Ticket
                                          className={`w-6 h-6 mb-1 ${
                                            ocrMatches.draft.paid_for === 'Entrance Fee'
                                              ? 'text-primary'
                                              : 'text-gray-600'
                                          }`}
                                        />
                                        <span className="text-xs text-center text-gray-700">Entrance Fee</span>
                                      </button>
                                    )}
                                    {categories.find((c) => c.name === 'Gas') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = ocrMatches.draft.paid_for === 'Gas' ? '' : 'Gas'
                                          setOcrReview((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  draft: {
                                                    ...prev.draft,
                                                    paid_for: next,
                                                    custom_paid_for: '',
                                                  },
                                                }
                                              : prev
                                          )
                                          setOcrShowCustomPaidFor(false)
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                          ocrMatches.draft.paid_for === 'Gas'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                      >
                                        <Fuel
                                          className={`w-6 h-6 mb-1 ${
                                            ocrMatches.draft.paid_for === 'Gas'
                                              ? 'text-primary'
                                              : 'text-gray-600'
                                          }`}
                                        />
                                        <span className="text-xs text-center text-gray-700">Gas</span>
                                      </button>
                                    )}
                                    {categories.find((c) => c.name === 'Meals') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = ocrMatches.draft.paid_for === 'Meals' ? '' : 'Meals'
                                          setOcrReview((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  draft: {
                                                    ...prev.draft,
                                                    paid_for: next,
                                                    custom_paid_for: '',
                                                  },
                                                }
                                              : prev
                                          )
                                          setOcrShowCustomPaidFor(false)
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                          ocrMatches.draft.paid_for === 'Meals'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                      >
                                        <UtensilsCrossed
                                          className={`w-6 h-6 mb-1 ${
                                            ocrMatches.draft.paid_for === 'Meals'
                                              ? 'text-primary'
                                              : 'text-gray-600'
                                          }`}
                                        />
                                        <span className="text-xs text-center text-gray-700">Meals</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setOcrShowMoreCategories(!ocrShowMoreCategories)}
                                      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                        ocrShowMoreCategories
                                          ? 'border-primary bg-primary/5'
                                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                      }`}
                                    >
                                      <MoreHorizontal
                                        className={`w-6 h-6 mb-1 ${
                                          ocrShowMoreCategories ? 'text-primary' : 'text-gray-600'
                                        }`}
                                      />
                                      <span className="text-xs text-center text-gray-700">More</span>
                                    </button>
                                  </div>
                                  {ocrShowMoreCategories && (
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                      {categories
                                        .filter((c) => !['Entrance Fee', 'Gas', 'Meals'].includes(c.name))
                                        .map((category) => {
                                          const getCategoryIcon = (name: string) => {
                                            const iconMap: Record<string, LucideIcon> = {
                                              Meals: UtensilsCrossed,
                                              Bento: Package,
                                              'Guide Bento': Package,
                                              Hotel: Building2,
                                              Maintenance: Wrench,
                                              Rent: Car,
                                              'Rent (Personal Vehicle)': Car,
                                              Parking: MapPin,
                                              Antelope: MapPin,
                                              Lotto: Coins,
                                            }
                                            return iconMap[name] || MoreHorizontal
                                          }
                                          const IconComponent = getCategoryIcon(category.name)
                                          const isSelected = ocrMatches.draft.paid_for === category.name
                                          return (
                                            <button
                                              key={category.id}
                                              type="button"
                                              onClick={() => {
                                                const next = isSelected ? '' : category.name
                                                setOcrReview((prev) =>
                                                  prev
                                                    ? {
                                                        ...prev,
                                                        draft: {
                                                          ...prev.draft,
                                                          paid_for: next,
                                                          custom_paid_for: '',
                                                        },
                                                      }
                                                    : prev
                                                )
                                                setOcrShowCustomPaidFor(false)
                                              }}
                                              className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                                isSelected
                                                  ? 'border-primary bg-primary/5'
                                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                              }`}
                                            >
                                              <IconComponent
                                                className={`w-6 h-6 mb-1 ${
                                                  isSelected ? 'text-primary' : 'text-gray-600'
                                                }`}
                                              />
                                              <span className="text-xs text-center text-gray-700 break-words">
                                                {category.name}
                                              </span>
                                            </button>
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <select
                                    value={ocrMatches.draft.paid_for}
                                    onChange={(e) => {
                                      setOcrReview((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              draft: {
                                                ...prev.draft,
                                                paid_for: e.target.value,
                                                custom_paid_for: '',
                                              },
                                            }
                                          : prev
                                      )
                                      setOcrShowCustomPaidFor(false)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                  >
                                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                                    {categories.map((category) => (
                                      <option key={category.id} value={category.name}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setOcrShowCustomPaidFor(!ocrShowCustomPaidFor)}
                                    className="text-sm text-primary hover:text-primary/80"
                                  >
                                    {ocrShowCustomPaidFor
                                      ? t('selectFromExisting')
                                      : t('enterDirectly')}
                                  </button>
                                  {ocrShowCustomPaidFor && (
                                    <input
                                      type="text"
                                      value={ocrMatches.draft.custom_paid_for ?? ''}
                                      onChange={(e) =>
                                        setOcrReview((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: {
                                                  ...prev.draft,
                                                  custom_paid_for: e.target.value,
                                                },
                                              }
                                            : prev
                                        )
                                      }
                                      placeholder={t('newPaidForPlaceholder')}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('amount')} (USD)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  lang="en"
                                  value={ocrMatches.draft.amount}
                                  onChange={(e) =>
                                    setOcrReview((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: {
                                              ...prev.draft,
                                              amount: normalizeDecimalTyping(e.target.value),
                                            },
                                          }
                                        : prev
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('paymentMethod')}
                                </label>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOcrPaymentMethodTabChange('own')}
                                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        ocrPaymentMethodTab === 'own'
                                          ? 'bg-white text-primary shadow-sm'
                                          : 'text-gray-600 hover:text-gray-900'
                                      }`}
                                    >
                                      {t('ownCard')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOcrPaymentMethodTabChange('other')}
                                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        ocrPaymentMethodTab === 'other'
                                          ? 'bg-white text-primary shadow-sm'
                                          : 'text-gray-600 hover:text-gray-900'
                                      }`}
                                    >
                                      {t('otherPaymentMethods')}
                                    </button>
                                  </div>
                                  {ocrPaymentMethodTab === 'own' && tourGuideEmails.size === 0 && (
                                    <p className="text-xs text-amber-600">
                                      {t('noGuideAssignedForPaymentMethods')}
                                    </p>
                                  )}
                                  {ocrPaymentMethodTab === 'own' &&
                                    tourGuideEmails.size > 0 &&
                                    guideCardPaymentMethodOptions.length === 0 && (
                                      <p className="text-xs text-amber-600">
                                        {t('noGuideCardPaymentMethods')}
                                      </p>
                                    )}
                                  {ocrPaymentMethodTab === 'other' &&
                                    otherPaymentMethodOptions.length === 0 && (
                                      <p className="text-xs text-amber-600">
                                        {t('noOtherActivePaymentMethods')}
                                      </p>
                                    )}
                                  <PaymentMethodAutocomplete
                                    options={visibleOcrPaymentMethodOptions}
                                    valueId={ocrMatches.draft.payment_method || ''}
                                    onChange={(id) =>
                                      setOcrReview((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              draft: { ...prev.draft, payment_method: id },
                                            }
                                          : prev
                                      )
                                    }
                                    pleaseSelectLabel={t('selectOptions.pleaseSelect')}
                                  />
                                </div>
                              </div>
                            </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('receiptOcrDateLabel')}
                                </label>
                                <input
                                  type="date"
                                  value={ocrMatches.draft.date}
                                  onChange={(e) =>
                                    setOcrReview((prev) =>
                                      prev
                                        ? { ...prev, draft: { ...prev.draft, date: e.target.value } }
                                        : prev
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('memo')}
                                </label>
                                <textarea
                                  value={ocrMatches.draft.note}
                                  onChange={(e) =>
                                    setOcrReview((prev) =>
                                      prev
                                        ? { ...prev, draft: { ...prev.draft, note: e.target.value } }
                                        : prev
                                    )
                                  }
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <div className="mb-2 text-sm font-medium text-gray-700">
                                {t('receiptOcrRawText')}
                              </div>
                              <textarea
                                value={ocrMatches.result.text}
                                readOnly
                                rows={6}
                                className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-600 font-mono"
                              />
                            </div>
                            {canSaveReceiptOcrQuickRule ? (
                              <details className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 [&[open]_summary_.qr-chev]:rotate-90">
                                <summary className="cursor-pointer text-sm font-medium text-amber-950 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
                                  <ChevronRight className="qr-chev w-4 h-4 shrink-0 transition-transform" />
                                  {t('receiptOcrQuickRuleSummary')}
                                </summary>
                                <p className="text-xs text-amber-900/80 mt-2 mb-3 leading-relaxed">
                                  {t('receiptOcrQuickRuleHint')}
                                </p>
                                <div className="space-y-2">
                                  <div>
                                    <label
                                      htmlFor="receipt-quick-rule-phrase"
                                      className="block text-xs font-medium text-gray-700 mb-1"
                                    >
                                      {t('receiptOcrQuickRulePhraseLabel')}
                                    </label>
                                    <input
                                      id="receipt-quick-rule-phrase"
                                      type="text"
                                      maxLength={MAX_BODY_MATCH_PHRASE}
                                      value={receiptQuickRulePhrase}
                                      onChange={(e) => setReceiptQuickRulePhrase(e.target.value)}
                                      className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">
                                      {t('receiptOcrQuickRulePhraseNote', {
                                        max: MAX_BODY_MATCH_PHRASE,
                                      })}
                                    </p>
                                  </div>
                                  <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={receiptQuickRuleCcLabel}
                                      onChange={(e) => setReceiptQuickRuleCcLabel(e.target.checked)}
                                      className="mt-0.5 rounded border-gray-300"
                                    />
                                    <span>{t('receiptOcrQuickRuleCcLabel')}</span>
                                  </label>
                                  <p className="text-xs text-gray-600">{t('receiptOcrQuickRuleUsesDraft')}</p>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveReceiptQuickBodyMatchRule()}
                                    disabled={receiptQuickRuleSaving}
                                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {receiptQuickRuleSaving ? '…' : t('receiptOcrQuickRuleSave')}
                                  </button>
                                </div>
                              </details>
                            ) : null}
                          </div>
                          <div className="shrink-0 flex flex-col gap-3 p-4 border-t border-gray-200 bg-gray-50/80 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm min-h-[1.25rem]">
                              {canSeeReceiptOcrRulesLink ? (
                                <Link
                                  href={`/${locale}/admin/receipt-ocr-parse-rules`}
                                  className="text-primary hover:text-primary/80 underline"
                                >
                                  {t('receiptOcrManageParseRules')}
                                </Link>
                              ) : null}
                            </div>
                            <div className="flex gap-2 flex-1 sm:justify-end flex-wrap">
                              <button
                                type="button"
                                onClick={() => setOcrReview(null)}
                                className="flex-1 sm:flex-none min-w-[7rem] px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyOcrToForm}
                                className="flex-1 sm:flex-none min-w-[10rem] px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                              >
                                {t('receiptOcrApplyToForm')}
                              </button>
                            </div>
                          </div>
                        </>
                      )
                    }

                    return (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                        <p className="text-sm text-gray-600 max-w-sm">{t('receiptViewerOcrPrompt')}</p>
                        {canRunReceiptOcr && expenseForViewingReceipt?.image_url?.trim() ? (
                          <button
                            type="button"
                            onClick={() => void handleRunReceiptOcr(expenseForViewingReceipt)}
                            disabled={
                              ocrLoadingExpenseId === viewingReceipt.expenseId ||
                              (viewingReceipt.expenseId === '__ocr_draft__' &&
                                ocrLoadingExpenseId === '__draft__')
                            }
                            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            title={t('receiptOcrAction')}
                          >
                            {ocrLoadingExpenseId === viewingReceipt.expenseId ||
                            (viewingReceipt.expenseId === '__ocr_draft__' &&
                              ocrLoadingExpenseId === '__draft__')
                              ? '...'
                              : t('receiptOcrAction')}
                          </button>
                        ) : null}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 지출 추가/수정 폼 모달 — 왼쪽 영수증 · 오른쪽 입력 */}
      {expenseModalPortalReady &&
        showAddForm &&
        createPortal(
        <div 
          className={`fixed inset-0 bg-black/75 flex items-center justify-center p-2 sm:p-4 ${TOUR_EXPENSE_MODAL_PORTAL_Z} ${TOUR_EXPENSE_MODAL_PORTAL_INTERACTION}`}
          onClick={(e) => {
            // 모달 배경 클릭 시에만 닫기 (모달 내부 클릭은 무시)
            if (Date.now() < expenseModalBackdropSuppressedUntilRef.current) return
            if (e.target === e.currentTarget && !uploading) {
              if (editingExpense) {
                handleCancelEdit()
              } else {
                setShowAddForm(false)
                setShowMoreCategories(false)
                setPaymentMethodTab('own')
              }
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b shrink-0">
              <div className="flex items-start gap-2 min-w-0">
                <Receipt className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingExpense ? '지출 수정' : t('addExpense')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t('expenseFormLayoutHint')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (uploading) return
                  if (editingExpense) {
                    handleCancelEdit()
                  } else {
                    setShowAddForm(false)
                    setShowMoreCategories(false)
                    setPaymentMethodTab('own')
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                aria-label={t('cancel')}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="flex flex-1 min-h-0 flex-col">
              <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
                {/* 왼쪽: 영수증 크게 보기 + 업로드 */}
                <div className="flex flex-col flex-1 min-w-0 min-h-[30vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-slate-50 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setFormReceiptZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))
                      }
                      disabled={!formData.image_url}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                      title={t('receiptViewerZoomOut')}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-600 tabular-nums min-w-[3rem] text-center">
                      {Math.round(formReceiptZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormReceiptZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))
                      }
                      disabled={!formData.image_url}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                      title={t('receiptViewerZoomIn')}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormReceiptZoom(1)}
                      disabled={!formData.image_url}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40"
                    >
                      {t('receiptViewerZoomReset')}
                    </button>
                    {formData.image_url && canRunReceiptOcr ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setFormReceiptRotation(
                              (r) => ((r + 270) % 360) as ReceiptOcrRotationDegrees
                            )
                          }
                          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          title={t('receiptOcrRotateLeft')}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormReceiptRotation(
                              (r) => ((r + 90) % 360) as ReceiptOcrRotationDegrees
                            )
                          }
                          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          title={t('receiptOcrRotateRight')}
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunFormReceiptOcr(false)}
                          disabled={ocrLoadingExpenseId === '__draft__'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                          title={t('receiptOcrAction')}
                        >
                          {ocrLoadingExpenseId === '__draft__' ? '…' : t('receiptOcrFormRunAction')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunFormReceiptOcr(true)}
                          disabled={ocrLoadingExpenseId === '__draft__'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                          title={t('receiptOcrEnhancedAction')}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {t('receiptOcrEnhancedActionShort')}
                        </button>
                      </>
                    ) : null}
                    {formData.image_url ? (
                      <a
                        href={formData.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {t('openInNewWindow')}
                      </a>
                    ) : (
                      <span className="ml-auto text-xs text-gray-500">{t('receiptPhoto')}</span>
                    )}
                  </div>
                  <div
                    className={`flex-1 min-h-0 overflow-auto p-3 bg-slate-100/90 ${
                      dragOver ? 'ring-2 ring-inset ring-primary' : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDragOver(e)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDragLeave(e)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDrop(e)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formData.image_url ? (
                      <div className="relative flex items-center justify-center min-h-[180px]">
                        <img
                          src={formData.image_url}
                          alt={t('receipt')}
                          style={{
                            width: `${100 * formReceiptZoom}%`,
                            maxWidth: 'none',
                            height: 'auto',
                            transform: `rotate(${formReceiptRotation}deg)`,
                            transformOrigin: 'center center',
                          }}
                          className="rounded-lg shadow-md block"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = '/placeholder-receipt.png'
                            target.alt = t('receiptImageLoadErrorAlt')
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleImageRemove}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow"
                          title={t('removeImage') || '이미지 삭제'}
                        >
                          <X size={16} />
                        </button>
                        {ocrLoadingExpenseId === '__draft__' && (
                          <p className="mt-2 text-xs text-purple-600">{t('receiptOcrAnalyzingAfterUpload')}</p>
                        )}
                      </div>
                    ) : (
                      <div className="h-full min-h-[220px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-white/70 px-4 text-center">
                        <Upload size={36} className="text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">{t('dragOrClickReceipt')}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('mobileCameraInfo')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-center px-3 py-2 border-t border-gray-100 bg-white shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.files && e.target.files.length > 0) {
                          expenseModalBackdropSuppressedUntilRef.current = Date.now() + 2500
                          handleFileUpload(e.target.files)
                          setTimeout(() => {
                            if (e.target) {
                              (e.target as HTMLInputElement).value = ''
                            }
                          }, 100)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture={typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'environment' : undefined}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.files && e.target.files.length > 0) {
                          expenseModalBackdropSuppressedUntilRef.current = Date.now() + 2500
                          handleFileUpload(e.target.files)
                          setTimeout(() => {
                            if (e.target) {
                              (e.target as HTMLInputElement).value = ''
                            }
                          }, 100)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        expenseModalBackdropSuppressedUntilRef.current = Date.now() + 2500
                        if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                          cameraInputRef.current?.click()
                        } else {
                          setWebcamTarget('addForm')
                        }
                      }}
                      disabled={uploading}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImageIcon size={16} />
                      {t('camera')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        expenseModalBackdropSuppressedUntilRef.current = Date.now() + 2500
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} />
                      {t('file')}
                    </button>
                  </div>
                </div>

                {/* 오른쪽: 지출 입력 폼 */}
                <div className="flex flex-col flex-1 min-w-0 min-h-[36vh] lg:max-h-[calc(92vh-5.5rem)] bg-white">
                  <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0">
              {formInlineOcrOpen && ocrReview && showAddForm ? (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-purple-950">{t('receiptOcrReviewTitle')}</h4>
                      <p className="text-xs text-purple-900/80 mt-0.5 leading-relaxed">
                        {t('receiptOcrFormInlineHint')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormInlineOcrOpen(false)
                        setOcrReview(null)
                      }}
                      className="text-gray-500 hover:text-gray-700 shrink-0"
                      aria-label={t('cancel')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('paidTo')}</label>
                      <input
                        type="text"
                        value={ocrReview.draft.custom_paid_to || ocrReview.draft.paid_to}
                        onChange={(e) => {
                          const v = e.target.value
                          setOcrReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  draft: {
                                    ...prev.draft,
                                    paid_to: paidToOptions.includes(v) ? v : '',
                                    custom_paid_to: paidToOptions.includes(v) ? '' : v,
                                  },
                                }
                              : prev
                          )
                        }}
                        className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('paidFor')}</label>
                      <input
                        type="text"
                        value={ocrReview.draft.custom_paid_for || ocrReview.draft.paid_for}
                        onChange={(e) => {
                          const v = e.target.value
                          setOcrReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  draft: {
                                    ...prev.draft,
                                    paid_for: categories.some((c) => c.name === v) ? v : '',
                                    custom_paid_for: categories.some((c) => c.name === v) ? '' : v,
                                  },
                                }
                              : prev
                          )
                        }}
                        className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('amount')} (USD)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ocrReview.draft.amount}
                        onChange={(e) =>
                          setOcrReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  draft: {
                                    ...prev.draft,
                                    amount: normalizeDecimalTyping(e.target.value),
                                  },
                                }
                              : prev
                          )
                        }
                        className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('receiptOcrDateLabel')}</label>
                      <input
                        type="date"
                        value={ocrReview.draft.date}
                        onChange={(e) =>
                          setOcrReview((prev) =>
                            prev
                              ? { ...prev, draft: { ...prev.draft, date: e.target.value } }
                              : prev
                          )
                        }
                        className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <details className="rounded-lg border border-purple-100 bg-white/80 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-purple-900 px-1 py-1">
                      {t('receiptOcrRawText')}
                    </summary>
                    <textarea
                      value={ocrReview.result.text}
                      readOnly
                      rows={5}
                      className="mt-2 w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-600 font-mono"
                    />
                  </details>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRunFormReceiptOcr(true)}
                      disabled={ocrLoadingExpenseId === '__draft__'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-purple-300 bg-white text-purple-800 hover:bg-purple-50 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('receiptOcrEnhancedAction')}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyOcrToForm}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {t('receiptOcrApplyToForm')}
                    </button>
                  </div>
                </div>
              ) : null}
              {/* 결제처와 결제내용을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t('paidTo')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setVendorManagerOpen(true)}
                      className="inline-flex items-center gap-1 shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      title="결제처 목록 정리"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>결제처 정리</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {/* Payment recipient selection */}
                    <select
                      value={formData.custom_paid_to || formData.paid_to}
                      onChange={(e) => {
                        const selectedValue = e.target.value
                        if (selectedValue === '__custom__') {
                          // Direct input option selected
                          setFormData(prev => ({ ...prev, paid_to: '', custom_paid_to: '' }))
                          setShowCustomPaidTo(true)
                        } else if (paidToOptions.includes(selectedValue)) {
                          // Selected from existing list
                          setFormData(prev => ({ ...prev, paid_to: selectedValue, custom_paid_to: '' }))
                          setShowCustomPaidTo(false)
                        } else {
                          // Direct input case
                          setFormData(prev => ({ ...prev, paid_to: '', custom_paid_to: selectedValue }))
                          setShowCustomPaidTo(true)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">{t('selectPaidTo')}</option>
                      {paidToOptions.map((paidTo) => (
                        <option key={paidTo} value={paidTo}>
                          {paidTo}
                        </option>
                      ))}
                      {/* Direct input option */}
                      <option value="__custom__">{t('directInput')}</option>
                    </select>
                    
                    {/* Direct input field */}
                    {showCustomPaidTo && (
                      <input
                        type="text"
                        value={formData.custom_paid_to ?? ''}
                        onChange={(e) => {
                          const inputValue = e.target.value
                          setFormData(prev => ({ ...prev, custom_paid_to: inputValue }))
                        }}
                        placeholder={t('enterNewPaidTo')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paidFor')} <span className="text-red-500">*</span>
                  </label>
                  
                  {/* 지급 항목 아이콘 그리드 */}
                  <div className="mb-3">
                    <div className="grid grid-cols-4 gap-2">
                      {/* Entrance Fee */}
                      {categories.find(c => c.name === 'Entrance Fee') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Entrance Fee') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Entrance Fee' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Entrance Fee'
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Ticket className={`w-6 h-6 mb-1 ${formData.paid_for === 'Entrance Fee' ? 'text-primary' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Entrance Fee</span>
                        </button>
                      )}
                      
                      {/* Gas */}
                      {categories.find(c => c.name === 'Gas') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Gas') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Gas' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Gas'
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Fuel className={`w-6 h-6 mb-1 ${formData.paid_for === 'Gas' ? 'text-primary' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Gas</span>
                        </button>
                      )}
                      
                      {/* Meals */}
                      {categories.find(c => c.name === 'Meals') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Meals') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Meals' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Meals'
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <UtensilsCrossed className={`w-6 h-6 mb-1 ${formData.paid_for === 'Meals' ? 'text-primary' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Meals</span>
                        </button>
                      )}
                      
                      {/* More */}
                      <button
                        type="button"
                        onClick={() => setShowMoreCategories(!showMoreCategories)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                          showMoreCategories
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <MoreHorizontal className={`w-6 h-6 mb-1 ${showMoreCategories ? 'text-primary' : 'text-gray-600'}`} />
                        <span className="text-xs text-center text-gray-700">More</span>
                      </button>
                    </div>
                    
                    {/* 나머지 카테고리 아이콘 그리드 */}
                    {showMoreCategories && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {categories
                          .filter(c => !['Entrance Fee', 'Gas', 'Meals'].includes(c.name))
                          .map((category) => {
                            // 카테고리별 아이콘 매핑
                            const getCategoryIcon = (name: string) => {
                              const iconMap: Record<string, LucideIcon> = {
                                'Meals': UtensilsCrossed,
                                'Bento': Package,
                                'Guide Bento': Package,
                                'Hotel': Building2,
                                'Maintenance': Wrench,
                                'Rent': Car,
                                'Rent (Personal Vehicle)': Car,
                                'Parking': MapPin,
                                'Antelope': MapPin,
                                'Lotto': Coins,
                              }
                              return iconMap[name] || MoreHorizontal
                            }
                            
                            const IconComponent = getCategoryIcon(category.name)
                            const isSelected = formData.paid_for === category.name
                            
                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setFormData(prev => ({ ...prev, paid_for: '' }))
                                  } else {
                                    setFormData(prev => ({ ...prev, paid_for: category.name }))
                                  }
                                  setShowCustomPaidFor(false)
                                }}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <IconComponent className={`w-6 h-6 mb-1 ${isSelected ? 'text-primary' : 'text-gray-600'}`} />
                                <span className="text-xs text-center text-gray-700 break-words">{category.name}</span>
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <select
                      value={formData.paid_for}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, paid_for: e.target.value }))
                        setShowCustomPaidFor(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidFor(!showCustomPaidFor)}
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      {showCustomPaidFor ? t('selectFromExisting') : t('enterDirectly')}
                    </button>
                    {showCustomPaidFor && (
                      <input
                        type="text"
                        value={formData.custom_paid_for ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_for: e.target.value }))}
                        placeholder={t('newPaidForPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 금액과 결제방법을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('amount')} (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    lang="en"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        amount: normalizeDecimalTyping(e.target.value),
                      }))
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paymentMethod')} <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                      <button
                        type="button"
                        onClick={() => handlePaymentMethodTabChange('own')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          paymentMethodTab === 'own'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('ownCard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentMethodTabChange('other')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          paymentMethodTab === 'other'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('otherPaymentMethods')}
                      </button>
                    </div>
                    {paymentMethodTab === 'own' && tourGuideEmails.size === 0 && (
                      <p className="text-xs text-amber-600">{t('noGuideAssignedForPaymentMethods')}</p>
                    )}
                    {paymentMethodTab === 'own' && tourGuideEmails.size > 0 && guideCardPaymentMethodOptions.length === 0 && (
                      <p className="text-xs text-amber-600">{t('noGuideCardPaymentMethods')}</p>
                    )}
                    {paymentMethodTab === 'other' && otherPaymentMethodOptions.length === 0 && (
                      <p className="text-xs text-amber-600">{t('noOtherActivePaymentMethods')}</p>
                    )}
                    <PaymentMethodAutocomplete
                      options={visiblePaymentMethodOptions}
                      valueId={formData.payment_method || ''}
                      onChange={(id) => setFormData((prev) => ({ ...prev, payment_method: id }))}
                      disabled={uploading}
                      pleaseSelectLabel={t('selectOptions.pleaseSelect')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('memo')}
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder={t('memoPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {parseFloat(formData.amount || '0') > 0 && (
                <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-3 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-700 focus:ring-amber-500"
                      checked={reimbursementSectionOpen}
                      onChange={(e) => {
                        const on = e.target.checked
                        setReimbursementSectionOpen(on)
                        if (!on) {
                          setFormData((prev) => ({
                            ...prev,
                            reimbursed_amount: '',
                            reimbursed_on: '',
                            reimbursement_note: '',
                          }))
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-amber-950">{t('reimbursementToggleLabel')}</span>
                  </label>
                  {reimbursementSectionOpen && (
                    <>
                      <p className="text-xs font-medium text-amber-900">{t('reimbursementSectionTitle')}</p>
                      <p className="text-[11px] text-amber-800/90">{t('reimbursementSectionHint')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursedAmount')}</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            lang="en"
                            value={formData.reimbursed_amount}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                reimbursed_amount: normalizeDecimalTyping(e.target.value),
                              }))
                            }
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursedOn')}</label>
                          <input
                            type="date"
                            value={formData.reimbursed_on}
                            onChange={(e) => setFormData((prev) => ({ ...prev, reimbursed_on: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursementNote')}</label>
                        <input
                          type="text"
                          value={formData.reimbursement_note}
                          onChange={(e) => setFormData((prev) => ({ ...prev, reimbursement_note: e.target.value }))}
                          placeholder={t('reimbursementNotePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
                  </div>

                  <div className="flex flex-col gap-2 p-4 border-t border-gray-100 bg-white shrink-0 sm:flex-row sm:items-center sm:justify-between">
                    {editingExpense ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteEditingExpense()}
                        disabled={uploading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {locale === 'ko' ? '삭제' : 'Delete'}
                      </button>
                    ) : (
                      <span />
                    )}
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={editingExpense ? handleCancelEdit : () => {
                          setShowAddForm(false)
                          setShowMoreCategories(false)
                          setPaymentMethodTab('own')
                        }}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 sm:flex-none"
                      >
                        {t('cancel')}
                      </button>
                      {editingExpense && editingExpense.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void handleRejectEditingExpense()}
                          className="flex-1 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-50 sm:flex-none"
                        >
                          {locale === 'ko' ? '반려' : 'Reject'}
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 sm:flex-none"
                      >
                        {uploading
                          ? (editingExpense ? '수정 중...' : t('buttons.registering'))
                          : (editingExpense ? '수정' : t('buttons.register'))}
                      </button>
                      {editingExpense && editingExpense.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void handleSaveAndApproveExpense()}
                          className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 sm:flex-none"
                        >
                          {locale === 'ko' ? '저장 후 승인' : 'Save & approve'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}
      
      {expenseModalPortalReady &&
        webcamTarget &&
        createPortal(
        <div
          className={`fixed inset-0 flex items-center justify-center bg-black/70 p-4 ${TOUR_EXPENSE_MODAL_PORTAL_Z} ${TOUR_EXPENSE_MODAL_PORTAL_INTERACTION}`}
          onClick={() => setWebcamTarget(null)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('webcamTitle')}</h3>
            <video
              ref={receiptWebcamVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black aspect-video object-cover"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setWebcamTarget(null)}
                className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
              >
                {t('webcamCancel')}
              </button>
              <button
                type="button"
                onClick={captureReceiptWebcamFrame}
                disabled={uploading}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {t('webcamCapture')}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* 선택지 관리 모달 */}
      <OptionManagementModal
        isOpen={showOptionManagement}
        onClose={() => setShowOptionManagement(false)}
        onOptionsUpdated={() => {
          loadVendors() // 옵션 업데이트 후 데이터 새로고침
        }}
      />

      <ExpenseVendorManagerModal
        open={vendorManagerOpen}
        onOpenChange={setVendorManagerOpen}
        onUpdated={() => void loadVendors()}
        forceZIndex={13000}
      />
    </div>
  )
})

export default TourExpenseManager
