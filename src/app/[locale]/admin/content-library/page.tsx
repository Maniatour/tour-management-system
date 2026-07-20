'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HelpCircle,
  Library,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { supabase } from '@/lib/supabase'
import {
  REUSABLE_DETAIL_KIND_LABELS,
  REUSABLE_DETAIL_KINDS,
  REUSABLE_OPERATION_KINDS,
  REUSABLE_POLICY_KINDS,
  detailContentLegacyColumns,
  fetchDetailContentLibrary,
  fetchFaqLibrary,
  getDetailContentExactText,
  getFaqLocalizedText,
  mergeDetailContentI18n,
  mergeFaqI18n,
  type DetailContentLibraryItem,
  type FaqLibraryItem,
  type ReusableDetailKind,
} from '@/lib/reusableContentLibrary'

type TabId = 'faq' | 'operation' | 'policy'

const OPERATION_KINDS: ReusableDetailKind[] = [...REUSABLE_OPERATION_KINDS]
const POLICY_KINDS: ReusableDetailKind[] = [...REUSABLE_POLICY_KINDS]

export default function AdminContentLibraryPage() {
  const [tab, setTab] = useState<TabId>('faq')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [faqs, setFaqs] = useState<FaqLibraryItem[]>([])
  const [details, setDetails] = useState<DetailContentLibraryItem[]>([])
  const [selectedFaqId, setSelectedFaqId] = useState<string | null>(null)
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)

  const [faqDraft, setFaqDraft] = useState({
    name: '',
    question: '',
    answer: '',
  })
  const [detailDraft, setDetailDraft] = useState({
    name: '',
    kind: 'tour_operation_info' as ReusableDetailKind,
    body: '',
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [faqRows, detailRows] = await Promise.all([
        fetchFaqLibrary(supabase as never, { activeOnly: false }),
        fetchDetailContentLibrary(supabase as never, { activeOnly: false }),
      ])
      setFaqs(faqRows)
      setDetails(detailRows)
    } catch (error) {
      console.error(error)
      setMessage('라이브러리를 불러오지 못했습니다. 마이그레이션 적용 여부를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return faqs.filter((f) => f.is_active !== false)
    return faqs.filter((f) => {
      if (f.is_active === false) return false
      return `${f.name} ${f.question} ${f.answer}`.toLowerCase().includes(q)
    })
  }, [faqs, search])

  const kindFilter = tab === 'operation' ? OPERATION_KINDS : POLICY_KINDS
  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase()
    return details.filter((row) => {
      if (row.is_active === false) return false
      if (!kindFilter.includes(row.kind)) return false
      if (!q) return true
      return `${row.name} ${row.body}`.toLowerCase().includes(q)
    })
  }, [details, kindFilter, search])

  const selectFaq = (item: FaqLibraryItem) => {
    setSelectedFaqId(item.id)
    setFaqDraft({
      name: item.name || '',
      question: getFaqLocalizedText(item, 'question', 'ko') || item.question || '',
      answer: getFaqLocalizedText(item, 'answer', 'ko') || item.answer || '',
    })
  }

  const selectDetail = (item: DetailContentLibraryItem) => {
    setSelectedDetailId(item.id)
    setDetailDraft({
      name: item.name || '',
      kind: item.kind,
      body: getDetailContentExactText(item, 'ko') || item.body || '',
    })
  }

  const startNewFaq = () => {
    setSelectedFaqId(null)
    setFaqDraft({ name: '', question: '', answer: '' })
  }

  const startNewDetail = (kind: ReusableDetailKind) => {
    setSelectedDetailId(null)
    setDetailDraft({
      name: '',
      kind,
      body: '',
    })
  }

  const saveFaq = async () => {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) {
      setMessage('질문과 답변을 입력해 주세요.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const merged = mergeFaqI18n(
        selectedFaqId
          ? faqs.find((f) => f.id === selectedFaqId) || {}
          : {},
        'ko',
        faqDraft.question,
        faqDraft.answer
      )
      const name =
        faqDraft.name.trim() || faqDraft.question.trim().slice(0, 120) || 'FAQ'
      const payload = {
        name,
        question: merged.question,
        answer: merged.answer,
        question_en: merged.question_en,
        answer_en: merged.answer_en,
        content_i18n: merged.content_i18n || {},
        is_active: true,
        updated_at: new Date().toISOString(),
      }
      if (selectedFaqId) {
        const { error } = await supabase
          .from('faq_library')
          .update(payload as never)
          .eq('id', selectedFaqId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('faq_library')
          .insert([payload] as never)
          .select('*')
          .single()
        if (error) throw error
        setSelectedFaqId(String((data as { id: string }).id))
      }
      setMessage('FAQ 라이브러리에 저장했습니다.')
      await loadAll()
    } catch (error) {
      console.error(error)
      setMessage('FAQ 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const saveDetail = async () => {
    if (!detailDraft.body.trim()) {
      setMessage('내용을 입력해 주세요.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const existing = selectedDetailId
        ? details.find((d) => d.id === selectedDetailId)
        : null
      const content_i18n = mergeDetailContentI18n(
        existing?.content_i18n || null,
        'ko',
        detailDraft.body
      )
      const legacy = detailContentLegacyColumns('ko', detailDraft.body, existing || {})
      const name =
        detailDraft.name.trim() ||
        REUSABLE_DETAIL_KIND_LABELS[detailDraft.kind]
      const payload = {
        kind: detailDraft.kind,
        name,
        body: legacy.body ?? detailDraft.body,
        body_en: legacy.body_en ?? existing?.body_en ?? null,
        content_i18n,
        is_active: true,
        updated_at: new Date().toISOString(),
      }
      if (selectedDetailId) {
        const { error } = await supabase
          .from('detail_content_library')
          .update(payload as never)
          .eq('id', selectedDetailId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('detail_content_library')
          .insert([payload] as never)
          .select('*')
          .single()
        if (error) throw error
        setSelectedDetailId(String((data as { id: string }).id))
      }
      setMessage('상세 콘텐츠 라이브러리에 저장했습니다.')
      await loadAll()
    } catch (error) {
      console.error(error)
      setMessage('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deactivateFaq = async (id: string) => {
    if (!confirm('이 FAQ를 라이브러리에서 비활성화할까요? (상품 연결은 유지될 수 있습니다)')) return
    await supabase
      .from('faq_library')
      .update({ is_active: false } as never)
      .eq('id', id)
    if (selectedFaqId === id) startNewFaq()
    await loadAll()
  }

  const deactivateDetail = async (id: string) => {
    if (!confirm('이 항목을 라이브러리에서 비활성화할까요?')) return
    await supabase
      .from('detail_content_library')
      .update({ is_active: false } as never)
      .eq('id', id)
    if (selectedDetailId === id) startNewDetail(detailDraft.kind)
    await loadAll()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Library className="h-6 w-6 text-primary" />
          재사용 콘텐츠 라이브러리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          FAQ · 투어 운영 안내 · 정책을 한곳에서 관리하고, 상품 편집에서 연결해 재사용합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'faq' as const, label: 'FAQ', icon: HelpCircle },
            { id: 'operation' as const, label: '운영 안내', icon: Library },
            { id: 'policy' as const, label: '정책', icon: Library },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setSearch('')
              setMessage(null)
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름·내용 검색…"
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          로딩 중…
        </div>
      ) : tab === 'faq' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">FAQ 목록</h2>
              <button
                type="button"
                onClick={startNewFaq}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                새로 만들기
              </button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {filteredFaqs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectFaq(item)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedFaqId === item.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{item.name || item.question.slice(0, 60)}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {item.question}
                  </div>
                </button>
              ))}
              {filteredFaqs.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">항목이 없습니다.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold">
              {selectedFaqId ? 'FAQ 편집' : '새 FAQ'}
            </h2>
            <label className="block space-y-1">
              <span className="text-xs font-medium">관리용 이름</span>
              <input
                value={faqDraft.name}
                onChange={(e) => setFaqDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="예: 픽업 시간 FAQ"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">질문 (한국어)</span>
              <textarea
                value={faqDraft.question}
                onChange={(e) => setFaqDraft((p) => ({ ...p, question: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">답변 (한국어)</span>
              <textarea
                value={faqDraft.answer}
                onChange={(e) => setFaqDraft((p) => ({ ...p, answer: e.target.value }))}
                rows={6}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveFaq()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                저장
              </button>
              {selectedFaqId ? (
                <button
                  type="button"
                  onClick={() => void deactivateFaq(selectedFaqId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                  비활성화
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {tab === 'operation' ? '운영 안내' : '정책'} 목록
              </h2>
              <button
                type="button"
                onClick={() =>
                  startNewDetail(
                    tab === 'operation' ? 'pickup_drop_info' : 'cancellation_policy'
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                새로 만들기
              </button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {filteredDetails.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDetail(item)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedDetailId === item.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {REUSABLE_DETAIL_KIND_LABELS[item.kind]}
                  </div>
                  <div className="font-medium">{item.name}</div>
                </button>
              ))}
              {filteredDetails.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">항목이 없습니다.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold">
              {selectedDetailId ? '항목 편집' : '새 항목'}
            </h2>
            <label className="block space-y-1">
              <span className="text-xs font-medium">종류</span>
              <select
                value={detailDraft.kind}
                onChange={(e) =>
                  setDetailDraft((p) => ({
                    ...p,
                    kind: e.target.value as ReusableDetailKind,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                {(tab === 'operation' ? OPERATION_KINDS : POLICY_KINDS).map((kind) => (
                  <option key={kind} value={kind}>
                    {REUSABLE_DETAIL_KIND_LABELS[kind]}
                  </option>
                ))}
                {selectedDetailId &&
                !kindFilter.includes(detailDraft.kind) &&
                REUSABLE_DETAIL_KINDS.includes(detailDraft.kind) ? (
                  <option value={detailDraft.kind}>
                    {REUSABLE_DETAIL_KIND_LABELS[detailDraft.kind]}
                  </option>
                ) : null}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">관리용 이름</span>
              <input
                value={detailDraft.name}
                onChange={(e) => setDetailDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="예: 그랜드캐년 공통 취소정책"
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium">내용 (한국어)</span>
              <LightRichEditor
                value={detailDraft.body}
                onChange={(value) =>
                  setDetailDraft((p) => ({ ...p, body: value ?? '' }))
                }
                height={280}
                enableResize
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDetail()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                저장
              </button>
              {selectedDetailId ? (
                <button
                  type="button"
                  onClick={() => void deactivateDetail(selectedDetailId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                  비활성화
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
