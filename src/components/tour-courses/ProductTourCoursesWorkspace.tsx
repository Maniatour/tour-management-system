'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react'
import Link from 'next/link'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { ChevronDown, ExternalLink, Loader2, MapPin, Plus, Save } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import TourCourseEditModal from '@/components/TourCourseEditModal'
import ProductTourCourseReportRoleToggle from '@/components/product/ProductTourCourseReportRoleToggle'
import TourCoursePickerModal from '@/components/tour-courses/TourCoursePickerModal'
import TourCourseStopCard from '@/components/tour-courses/TourCourseStopCard'
import { Button } from '@/components/ui/button'
import {
  emptyTourCourseDraft,
  moveIdAmongSubset,
  toDisplayTourCourse,
  toProductTourCourseBridge,
  type TourCourseAdminRow,
} from '@/lib/tourCourseAdmin'
import {
  getCourseDescription,
  getFullCoursePath,
  getValidTourCourses,
} from '@/lib/productTourCourseDisplay'
import { supabase } from '@/lib/supabase'
import { parseReportStopRole, type ReportStopRole } from '@/lib/tourReportStopRoles'

type ProductTourCoursesWorkspaceProps = {
  productId: string
  isNewProduct?: boolean
  locale?: string
  compact?: boolean
  onSaved?: () => void
}

export default function ProductTourCoursesWorkspace({
  productId,
  isNewProduct = false,
  locale: localeProp,
  compact = false,
  onSaved,
}: ProductTourCoursesWorkspaceProps) {
  const t = useTranslations('tourCourses')
  const siteLocale = useLocale()
  const locale = localeProp || siteLocale
  const [catalog, setCatalog] = useState<TourCourseAdminRow[]>([])
  const [selectedOrder, setSelectedOrder] = useState<string[]>([])
  const [roles, setRoles] = useState<Record<string, ReportStopRole>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showOperational, setShowOperational] = useState(false)
  const [modalCourse, setModalCourse] = useState<TourCourseAdminRow | null>(null)

  const displayCourses = useMemo(() => catalog.map(toDisplayTourCourse), [catalog])
  const courseById = useMemo(
    () => new Map(displayCourses.map((course) => [course.id, course])),
    [displayCourses]
  )
  const pathLookup = useMemo(
    () => toProductTourCourseBridge(displayCourses, { productId, roles }),
    [displayCourses, productId, roles]
  )

  const linkedCourses = useMemo(
    () =>
      selectedOrder
        .map((id) => courseById.get(id))
        .filter((course): course is NonNullable<typeof course> => Boolean(course)),
    [courseById, selectedOrder]
  )

  const visibleCourses = useMemo(() => {
    const visibleIds = new Set(
      getValidTourCourses(
        toProductTourCourseBridge(linkedCourses, { productId, roles }),
        locale
      ).map((course) => course.id)
    )
    return selectedOrder
      .map((id) => courseById.get(id))
      .filter((course): course is NonNullable<typeof course> => Boolean(course && visibleIds.has(course.id)))
  }, [courseById, linkedCourses, locale, productId, roles, selectedOrder])

  const operationalCourses = useMemo(() => {
    const visibleIds = new Set(visibleCourses.map((course) => course.id))
    return selectedOrder
      .map((id) => courseById.get(id))
      .filter((course): course is NonNullable<typeof course> => Boolean(course && !visibleIds.has(course.id)))
  }, [courseById, selectedOrder, visibleCourses])

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [{ data: courses, error: coursesError }, linksResult] = await Promise.all([
        supabase
          .from('tour_courses')
          .select('*, photos:tour_course_photos(*)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        isNewProduct
          ? Promise.resolve({ data: [] as { tour_course_id: string; order: number; report_stop_role?: unknown }[], error: null })
          : supabase
              .from('product_tour_courses')
              .select('tour_course_id, order, report_stop_role')
              .eq('product_id', productId)
              .order('order', { ascending: true }),
      ])

      let courseRows: TourCourseAdminRow[] = (courses || []) as TourCourseAdminRow[]
      if (coursesError) {
        const fallback = await supabase
          .from('tour_courses')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
        if (fallback.error) throw coursesError
        courseRows = (fallback.data || []) as TourCourseAdminRow[]
      }
      let links = linksResult.data
      if (linksResult.error) {
        const fallback = await supabase
          .from('product_tour_courses')
          .select('tour_course_id, order')
          .eq('product_id', productId)
          .order('order', { ascending: true })
        if (fallback.error) throw linksResult.error
        links = fallback.data as typeof links
      }

      setCatalog(courseRows)
      setSelectedOrder((links || []).map((item) => item.tour_course_id))
      const nextRoles: Record<string, ReportStopRole> = {}
      for (const item of links || []) {
        const role = parseReportStopRole(item.report_stop_role)
        if (role) nextRoles[item.tour_course_id] = role
      }
      setRoles(nextRoles)
    } catch (error) {
      console.error('투어 코스 로드 오류:', error)
      setMessage(t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }, [isNewProduct, productId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const persistLinks = async (order: string[], nextRoles: Record<string, ReportStopRole>) => {
    if (isNewProduct) {
      setMessage(t('saveAfterProduct'))
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const { error: deleteError } = await supabase
        .from('product_tour_courses')
        .delete()
        .eq('product_id', productId)
      if (deleteError) throw deleteError

      if (order.length > 0) {
        const { error: insertError } = await supabase.from('product_tour_courses').insert(
          order.map((courseId, index) => ({
            product_id: productId,
            tour_course_id: courseId,
            order: index,
            report_stop_role: nextRoles[courseId] ?? null,
          }))
        )
        if (insertError) throw insertError
      }
      setMessage(t('saved'))
      onSaved?.()
    } catch (error) {
      console.error('투어 코스 저장 오류:', error)
      setMessage(t('saveLinksError'))
    } finally {
      setSaving(false)
    }
  }

  const updateOrder = (next: string[]) => {
    setSelectedOrder(next)
    void persistLinks(next, roles)
  }

  const handleDragEnd = (result: DropResult, subsetIds: Set<string>) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return
    updateOrder(
      moveIdAmongSubset(selectedOrder, subsetIds, result.source.index, result.destination.index)
    )
  }

  const handleAdd = (courseIds: string[]) => {
    const next = [...selectedOrder]
    for (const id of courseIds) {
      if (!next.includes(id)) next.push(id)
    }
    updateOrder(next)
  }

  const handleUnlink = (courseId: string) => {
    const nextOrder = selectedOrder.filter((id) => id !== courseId)
    const nextRoles = { ...roles }
    delete nextRoles[courseId]
    setRoles(nextRoles)
    setSelectedOrder(nextOrder)
    void persistLinks(nextOrder, nextRoles)
  }

  const handleRoleChange = (courseId: string, role: ReportStopRole | null) => {
    const next = { ...roles }
    if (!role) delete next[courseId]
    else next[courseId] = role
    setRoles(next)
    void persistLinks(selectedOrder, next)
  }

  const renderEditorCard = (
    course: ReturnType<typeof toDisplayTourCourse>,
    index: number,
    options: { hidden?: boolean }
  ) => (
    <Draggable draggableId={course.id} index={index} key={course.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={provided.draggableProps.style as CSSProperties | undefined}
        >
          <TourCourseStopCard
            course={course}
            title={getFullCoursePath(course, pathLookup, locale) || course.name}
            description={getCourseDescription(course, locale)}
            variant="editor"
            hiddenFromCustomer={Boolean(options.hidden)}
            hiddenLabel={t('hiddenFromCustomer')}
            clickToEditLabel={t('clickToEdit')}
            removeLabel={t('unlink')}
            isDragging={snapshot.isDragging}
            {...(provided.dragHandleProps
              ? { dragHandleProps: provided.dragHandleProps as HTMLAttributes<HTMLButtonElement> }
              : {})}
            onOpen={() => {
              const row = catalog.find((item) => item.id === course.id)
              if (row) setModalCourse(row)
            }}
            onRemove={() => handleUnlink(course.id)}
            footer={
              <ProductTourCourseReportRoleToggle
                value={roles[course.id] ?? null}
                onChange={(role) => handleRoleChange(course.id, role)}
              />
            }
          />
        </div>
      )}
    </Draggable>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {compact ? null : (
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('customerPreviewTitle')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('workspaceHint')}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${siteLocale}/admin/tour-courses`}>
              {t('openLibrary')}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={isNewProduct}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('addCourse')}
          </Button>
        </div>
      </div>

      {isNewProduct ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('saveAfterProduct')}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
        {visibleCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{t('emptyProduct')}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('emptyProductHint')}</p>
            <Button
              className="mt-4"
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={isNewProduct}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('addCourse')}
            </Button>
          </div>
        ) : (
          <DragDropContext
            onDragEnd={(result) =>
              handleDragEnd(result, new Set(visibleCourses.map((course) => course.id)))
            }
          >
            <Droppable droppableId="customer-tour-courses">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="px-3 sm:px-4">
                  {visibleCourses.map((course, index) => renderEditorCard(course, index, {}))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        <div className="border-t border-dashed border-border/80 p-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={isNewProduct}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t('addCourse')}
          </button>
        </div>
      </div>

      {operationalCourses.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-muted/20">
          <button
            type="button"
            onClick={() => setShowOperational((current) => !current)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
          >
            <span>
              {t('operationalCourses')} ({operationalCourses.length})
            </span>
            <ChevronDown className={`h-4 w-4 transition ${showOperational ? 'rotate-180' : ''}`} />
          </button>
          {showOperational ? (
            <DragDropContext
              onDragEnd={(result) =>
                handleDragEnd(result, new Set(operationalCourses.map((course) => course.id)))
              }
            >
              <Droppable droppableId="operational-tour-courses">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="px-3 pb-3">
                    {operationalCourses.map((course, index) =>
                      renderEditorCard(course, index, { hidden: true })
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className={message?.includes('오류') || message === t('saveLinksError') ? 'text-red-600' : 'text-muted-foreground'}>
          {saving ? t('saving') : message}
        </p>
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Save className="h-4 w-4 text-muted-foreground" />}
      </div>

      <TourCoursePickerModal
        open={pickerOpen}
        locale={locale}
        courses={catalog}
        linkedIds={new Set(selectedOrder)}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAdd}
        onCreateNew={() => {
          setPickerOpen(false)
          setModalCourse(emptyTourCourseDraft())
        }}
        title={t('pickerTitle')}
        description={t('pickerDescription')}
        searchPlaceholder={t('searchPlaceholder')}
        alreadyLinkedLabel={t('alreadyLinked')}
        addSelectedLabel={t('addSelected')}
        createNewLabel={t('createNew')}
        emptyLabel={t('noCourses')}
      />

      <TourCourseEditModal
        isOpen={Boolean(modalCourse)}
        onClose={() => setModalCourse(null)}
        course={modalCourse as never}
        onSave={async (saved) => {
          const savedId = saved?.id
          if (savedId && !selectedOrder.includes(savedId)) {
            await persistLinks([...selectedOrder, savedId], roles)
          }
          await loadData(true)
          onSaved?.()
        }}
      />
    </div>
  )
}
