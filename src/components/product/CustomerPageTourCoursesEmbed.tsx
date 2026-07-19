'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, MapPin, Pencil, Save } from 'lucide-react'
import LightRichEditor, { markdownToHtml } from '@/components/LightRichEditor'
import TourCourseEditModal from '@/components/TourCourseEditModal'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import type { ProductTourCourse } from '@/components/product/productDetailTypes'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  getCourseDescription,
  getFullCoursePath,
  getValidTourCourses,
} from '@/lib/productTourCourseDisplay'
import {
  getTourCourseLocalizedText,
  mergeTourCourseI18n,
  type TourCourseContentI18n,
} from '@/lib/productTourCourseLocales'
import { supabase } from '@/lib/supabase'

type CourseForm = {
  nameDraft: string
  descriptionDraft: string
  customer_name_ko: string
  customer_name_en: string
  customer_description_ko: string
  customer_description_en: string
  content_i18n: TourCourseContentI18n
}

type CustomerPageTourCoursesEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onOpenFullAdmin?: (tabId: string) => void
}

function emptyForm(): CourseForm {
  return {
    nameDraft: '',
    descriptionDraft: '',
    customer_name_ko: '',
    customer_name_en: '',
    customer_description_ko: '',
    customer_description_en: '',
    content_i18n: {},
  }
}

function courseToForm(
  course: {
    customer_name_ko?: string | null
    customer_name_en?: string | null
    customer_description_ko?: string | null
    customer_description_en?: string | null
    content_i18n?: TourCourseContentI18n | null
  },
  locale: AdminEditLocale
): CourseForm {
  const source = {
    customer_name_ko: course.customer_name_ko ?? '',
    customer_name_en: course.customer_name_en ?? '',
    customer_description_ko: course.customer_description_ko ?? '',
    customer_description_en: course.customer_description_en ?? '',
    content_i18n: course.content_i18n || {},
  }
  return {
    nameDraft: getTourCourseLocalizedText(source, 'name', locale),
    descriptionDraft: getTourCourseLocalizedText(source, 'description', locale),
    customer_name_ko: source.customer_name_ko,
    customer_name_en: source.customer_name_en,
    customer_description_ko: source.customer_description_ko,
    customer_description_en: source.customer_description_en,
    content_i18n: source.content_i18n,
  }
}

function mapTourCourseRow(item: Record<string, unknown>): ProductTourCourse | null {
  let tourCourse: Record<string, unknown> | null = null
  const joined = item.tour_courses
  if (Array.isArray(joined)) {
    tourCourse = (joined[0] as Record<string, unknown>) ?? null
  } else if (joined && typeof joined === 'object') {
    tourCourse = joined as Record<string, unknown>
  }
  if (!tourCourse) return null
  return {
    id: String(item.id ?? ''),
    product_id: String(item.product_id ?? ''),
    tour_course_id: String(item.tour_course_id ?? tourCourse.id ?? ''),
    tour_course: tourCourse as ProductTourCourse['tour_course'],
  }
}

export default function CustomerPageTourCoursesEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
  onOpenFullAdmin,
}: CustomerPageTourCoursesEmbedProps) {
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [form, setForm] = useState<CourseForm>(emptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)
  const [modalCourse, setModalCourse] = useState<Record<string, unknown> | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const displayCourses = useMemo(
    () => getValidTourCourses(tourCourses, editLocale),
    [editLocale, tourCourses]
  )

  const activeCourse = useMemo(
    () => displayCourses.find((course) => course.id === activeCourseId) ?? null,
    [activeCourseId, displayCourses]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from('product_tour_courses')
        .select(
          `
          *,
          tour_courses(
            *,
            photos:tour_course_photos(*)
          )
        `
        )
        .eq('product_id', productId)
        .order('order', { ascending: true })

      if (error) throw error

      const mapped = (data ?? [])
        .map((item) => mapTourCourseRow(item as Record<string, unknown>))
        .filter((item): item is ProductTourCourse => item != null)

      setTourCourses(mapped)

      const firstValid = getValidTourCourses(mapped, editLocale)[0]
      const nextCourseId = firstValid?.id ?? null
      setActiveCourseId(nextCourseId)

      if (firstValid) {
        const nextForm = courseToForm(firstValid, editLocale)
        setForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({ courseId: nextCourseId, form: nextForm, locale: editLocale })
        )
      } else {
        setForm(emptyForm())
        setInitialSnapshot(
          JSON.stringify({ courseId: null, form: {}, locale: editLocale })
        )
      }
    } catch (error) {
      console.error('투어 코스 로드 오류:', error)
      setMessage('투어 코스 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!activeCourse) return
    const nextForm = courseToForm(activeCourse, editLocale)
    setForm(nextForm)
    setInitialSnapshot(
      JSON.stringify({ courseId: activeCourse.id, form: nextForm, locale: editLocale })
    )
  }, [activeCourse?.id])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot || !activeCourseId) return
    const dirty =
      JSON.stringify({ courseId: activeCourseId, form, locale: editLocale }) !==
      initialSnapshot
    onDirtyChange(dirty)
  }, [activeCourseId, editLocale, form, initialSnapshot, onDirtyChange])

  const switchLocale = (next: AdminEditLocale) => {
    const merged = mergeTourCourseI18n(
      form,
      editLocale,
      form.nameDraft,
      form.descriptionDraft
    )
    const source = { ...form, ...merged }
    setForm({
      nameDraft: getTourCourseLocalizedText(source, 'name', next),
      descriptionDraft: getTourCourseLocalizedText(source, 'description', next),
      customer_name_ko: merged.customer_name_ko ?? '',
      customer_name_en: merged.customer_name_en ?? '',
      customer_description_ko: merged.customer_description_ko ?? '',
      customer_description_en: merged.customer_description_en ?? '',
      content_i18n: merged.content_i18n,
    })
    setEditLocale(next)
  }

  const handleSave = async () => {
    if (!activeCourseId) return
    setSaving(true)
    setMessage(null)
    try {
      const merged = mergeTourCourseI18n(
        form,
        editLocale,
        form.nameDraft,
        form.descriptionDraft
      )
      const { error } = await supabase
        .from('tour_courses')
        .update({
          customer_name_ko: merged.customer_name_ko,
          customer_name_en: merged.customer_name_en,
          customer_description_ko: merged.customer_description_ko,
          customer_description_en: merged.customer_description_en,
          content_i18n: merged.content_i18n,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', activeCourseId)

      if (error) throw error

      setTourCourses((prev) =>
        prev.map((item) => {
          if (item.tour_course?.id !== activeCourseId) return item
          return {
            ...item,
            tour_course: {
              ...item.tour_course,
              customer_name_ko: merged.customer_name_ko,
              customer_name_en: merged.customer_name_en,
              customer_description_ko: merged.customer_description_ko,
              customer_description_en: merged.customer_description_en,
              content_i18n: merged.content_i18n,
            },
          }
        })
      )

      const nextForm = courseToForm(
        {
          customer_name_ko: merged.customer_name_ko,
          customer_name_en: merged.customer_name_en,
          customer_description_ko: merged.customer_description_ko,
          customer_description_en: merged.customer_description_en,
          content_i18n: merged.content_i18n,
        },
        editLocale
      )
      setForm(nextForm)
      setInitialSnapshot(
        JSON.stringify({ courseId: activeCourseId, form: nextForm, locale: editLocale })
      )
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('투어 코스 저장 오류:', error)
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenModal = async () => {
    if (!activeCourseId) return
    try {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('*')
        .eq('id', activeCourseId)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setModalCourse(data as Record<string, unknown>)
        setShowEditModal(true)
      }
    } catch (error) {
      console.error('코스 상세 로드 오류:', error)
      setMessage('코스 상세 정보를 불러오지 못했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        투어 코스 불러오는 중…
      </div>
    )
  }

  if (displayCourses.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p>이 상품에 연결된 투어 코스가 없거나, 고객용 이름·설명이 비어 있습니다.</p>
        {onOpenFullAdmin ? (
          <button
            type="button"
            onClick={() => onOpenFullAdmin('tour-courses')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
          >
            투어 코스 연결 관리
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">tour_courses</code> · 연결{' '}
          <code className="rounded bg-muted px-1">product_tour_courses</code>
        </p>
        <AdminEditLocaleToggle
          value={editLocale}
          onChange={switchLocale}
          groupLabel="코스 편집 언어"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          고객 페이지에 표시되는 코스 ({displayCourses.length}개)
        </p>
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
          {displayCourses.map((course) => {
            const label = getFullCoursePath(course, tourCourses, editLocale)
            const description = getCourseDescription(course, editLocale)
            const isActive = course.id === activeCourseId
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => setActiveCourseId(course.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent bg-white hover:border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-booking" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {label || '(이름 없음)'}
                    </p>
                    {description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {description.replace(/<[^>]*>/g, '').slice(0, 120)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {activeCourse ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                코스 내용 편집 ({getAdminEditLocaleLabel(editLocale)})
              </h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                코스 ID: <code className="rounded bg-muted px-1">{activeCourse.id}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleOpenModal()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
              사진·위치 등 상세 편집
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">
              고객용 이름 ({getAdminEditLocaleLabel(editLocale)})
            </span>
            <input
              type="text"
              value={form.nameDraft}
              onChange={(e) => setForm((prev) => ({ ...prev, nameDraft: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">
              고객용 설명 ({getAdminEditLocaleLabel(editLocale)})
            </span>
            <LightRichEditor
              value={form.descriptionDraft}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, descriptionDraft: value ?? '' }))
              }
              height={180}
              placeholder="코스 설명을 입력하세요"
              enableResize
            />
          </label>

          {form.descriptionDraft ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                고객 페이지 미리보기
              </p>
              <div
                className="prose prose-sm mt-1 max-w-none text-foreground"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(form.descriptionDraft),
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !activeCourseId}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>

      {onOpenFullAdmin ? (
        <button
          type="button"
          onClick={() => onOpenFullAdmin('tour-courses')}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          코스 연결·순서 관리 (전체 화면)
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <TourCourseEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setModalCourse(null)
        }}
        course={modalCourse as never}
        onSave={() => {
          void loadData()
          onSaved?.()
        }}
      />
    </div>
  )
}
