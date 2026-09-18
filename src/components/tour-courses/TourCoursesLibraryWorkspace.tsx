'use client'

import { useMemo, useState } from 'react'
import { Copy, Loader2, MapPin, Plus, Search, Settings, Star, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import TourCourseEditModal from '@/components/TourCourseEditModal'
import CategoryManagementModal from '@/components/CategoryManagementModal'
import TourCourseStopCard from '@/components/tour-courses/TourCourseStopCard'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'
import {
  copyTourCourseDraft,
  emptyTourCourseDraft,
  matchesTourCourseSearch,
  toDisplayTourCourse,
  toProductTourCourseBridge,
  type TourCourseAdminRow,
} from '@/lib/tourCourseAdmin'
import {
  getCourseDescription,
  getFullCoursePath,
} from '@/lib/productTourCourseDisplay'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { useOptimizedData } from '@/hooks/useOptimizedData'

type TourCoursesLibraryWorkspaceProps = {
  compact?: boolean
  locale?: string
  onSaved?: () => void
}

export default function TourCoursesLibraryWorkspace({
  compact = false,
  locale: localeProp,
  onSaved,
}: TourCoursesLibraryWorkspaceProps) {
  const t = useTranslations('tourCourses')
  const tCommon = useTranslations('common')
  const siteLocale = useLocale()
  const locale = localeProp || siteLocale
  const [searchTerm, setSearchTerm] = useState('')
  const [modalCourse, setModalCourse] = useState<TourCourseAdminRow | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TourCourseAdminRow | null>(null)

  const {
    data: tourCourses,
    loading,
    error,
    refetch: refetchCourses,
    invalidateCache: invalidateCoursesCache,
  } = useOptimizedData<TourCourseAdminRow[]>({
    fetchFn: async () => {
      const { data, error: fetchError } = await supabase
        .from('tour_courses')
        .select('*, photos:tour_course_photos(*)')
        .order('created_at', { ascending: false })
      if (fetchError) {
        const fallback = await supabase
          .from('tour_courses')
          .select('*')
          .order('created_at', { ascending: false })
        if (fallback.error) throw fetchError
        return (fallback.data || []) as TourCourseAdminRow[]
      }
      return (data || []) as TourCourseAdminRow[]
    },
    cacheKey: 'tour_courses',
    defaultToEmptyArray: true,
  })

  const displayCourses = useMemo(
    () => (tourCourses || []).map(toDisplayTourCourse),
    [tourCourses]
  )
  const pathLookup = useMemo(
    () => toProductTourCourseBridge(displayCourses),
    [displayCourses]
  )
  const filtered = useMemo(
    () => (tourCourses || []).filter((course) => matchesTourCourseSearch(course, searchTerm)),
    [searchTerm, tourCourses]
  )

  const refresh = () => {
    invalidateCoursesCache()
    refetchCourses()
    onSaved?.()
  }

  const toggleFavorite = async (course: TourCourseAdminRow) => {
    const nextFavorite = !(course.is_favorite || false)
    try {
      let favoriteOrder: number | null = null
      if (nextFavorite) {
        const { data: favorites } = await fromUntypedTable(supabase, 'tour_courses')
          .select('favorite_order')
          .eq('is_favorite', true)
          .not('favorite_order', 'is', null)
          .order('favorite_order', { ascending: false })
          .limit(1)
        favoriteOrder =
          favorites && favorites.length > 0
            ? Number((favorites[0] as { favorite_order?: number })?.favorite_order || 0) + 1
            : 0
      }
      const { error: updateError } = await supabase
        .from('tour_courses')
        .update({ is_favorite: nextFavorite, favorite_order: favoriteOrder } as never)
        .eq('id', course.id)
      if (updateError) throw updateError
      refresh()
    } catch (err) {
      console.error('Favorite toggle error:', err)
      alert(t('favoriteError'))
    }
  }

  const deleteCourse = async () => {
    if (!pendingDelete) return
    try {
      const { error: deleteError } = await supabase
        .from('tour_courses')
        .delete()
        .eq('id', pendingDelete.id)
      if (deleteError) throw deleteError
      setPendingDelete(null)
      refresh()
    } catch (err) {
      console.error('Tour course delete error:', err)
      alert(t('deleteError'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-red-600">{t('errorOccurred')}</p>
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={compact ? 'text-lg font-semibold' : 'text-2xl font-semibold tracking-tight'}>
            {t('title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('libraryHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowCategoryModal(true)}>
            <Settings className="mr-1.5 h-4 w-4" />
            {t('categoryManagement')}
          </Button>
          <Button type="button" onClick={() => setModalCourse(emptyTourCourseDraft())}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('createNew')}
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...BROWSER_AUTOFILL_OFF_PROPS}
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t('noCourses')}</p>
            <Button className="mt-4" type="button" onClick={() => setModalCourse(emptyTourCourseDraft())}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('createNew')}
            </Button>
          </div>
        ) : (
          <div className="px-3 sm:px-4">
            {filtered.map((row) => {
              const course = toDisplayTourCourse(row)
              return (
                <TourCourseStopCard
                  key={row.id}
                  course={course}
                  title={getFullCoursePath(course, pathLookup, locale) || course.name}
                  description={getCourseDescription(course, locale)}
                  variant="editor"
                  clickToEditLabel={t('clickToEdit')}
                  removeLabel={t('delete')}
                  onOpen={() => setModalCourse(row)}
                  onRemove={() => setPendingDelete(row)}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(row)}
                        className={`rounded-md p-1.5 hover:bg-yellow-50 ${
                          row.is_favorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
                        }`}
                        aria-label={row.is_favorite ? t('favoriteRemove') : t('favoriteAdd')}
                      >
                        <Star className={`h-4 w-4 ${row.is_favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalCourse(copyTourCourseDraft(row, t('copySuffix')))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t('copy')}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </>
                  }
                />
              )
            })}
          </div>
        )}
      </div>

      <TourCourseEditModal
        isOpen={Boolean(modalCourse)}
        onClose={() => setModalCourse(null)}
        course={modalCourse as never}
        onSave={() => {
          setModalCourse(null)
          refresh()
        }}
      />

      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategorySelect={() => undefined}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', {
                name:
                  pendingDelete?.customer_name_ko ||
                  pendingDelete?.team_name_ko ||
                  pendingDelete?.name_ko ||
                  '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteCourse()}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
