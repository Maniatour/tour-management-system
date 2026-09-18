'use client'

import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import TourCourseStopCard from '@/components/tour-courses/TourCourseStopCard'
import {
  matchesTourCourseSearch,
  toDisplayTourCourse,
  toProductTourCourseBridge,
  type TourCourseAdminRow,
} from '@/lib/tourCourseAdmin'
import { getCourseDescription, getFullCoursePath } from '@/lib/productTourCourseDisplay'

type TourCoursePickerModalProps = {
  open: boolean
  locale: string
  courses: TourCourseAdminRow[]
  linkedIds: Set<string>
  onClose: () => void
  onAdd: (courseIds: string[]) => void
  onCreateNew: () => void
  title: string
  description: string
  searchPlaceholder: string
  alreadyLinkedLabel: string
  addSelectedLabel: string
  createNewLabel: string
  emptyLabel: string
}

export default function TourCoursePickerModal({
  open,
  locale,
  courses,
  linkedIds,
  onClose,
  onAdd,
  onCreateNew,
  title,
  description,
  searchPlaceholder,
  alreadyLinkedLabel,
  addSelectedLabel,
  createNewLabel,
  emptyLabel,
}: TourCoursePickerModalProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const displayCourses = useMemo(
    () => courses.map(toDisplayTourCourse),
    [courses]
  )
  const pathLookup = useMemo(
    () => toProductTourCourseBridge(displayCourses),
    [displayCourses]
  )

  const filtered = useMemo(() => {
    return courses.filter((course) => matchesTourCourseSearch(course, query))
  }, [courses, query])

  const toggle = (id: string) => {
    if (linkedIds.has(id)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleClose = () => {
    setSelected(new Set())
    setQuery('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        forceZIndex={10100}
        className="flex max-h-[85vh] max-w-3xl flex-col gap-4 overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            {...BROWSER_AUTOFILL_OFF_PROPS}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/70 bg-white px-2">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            filtered.map((row) => {
              const course = toDisplayTourCourse(row)
              const isLinked = linkedIds.has(row.id)
              const isSelected = selected.has(row.id)
              return (
                <div key={row.id} className="relative">
                  <TourCourseStopCard
                    course={course}
                    title={getFullCoursePath(course, pathLookup, locale) || course.name}
                    description={getCourseDescription(course, locale)}
                    variant="editor"
                    compact
                    selected={isSelected || isLinked}
                    onOpen={() => toggle(row.id)}
                    {...(isLinked ? { clickToEditLabel: alreadyLinkedLabel } : {})}
                    actions={
                      isLinked ? (
                        <span className="mr-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                          {alreadyLinkedLabel}
                        </span>
                      ) : (
                        <span
                          className={`mr-1 flex h-6 w-6 items-center justify-center rounded-md border ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-white'
                          }`}
                        >
                          {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                      )
                    }
                  />
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onCreateNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            {createNewLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onAdd(Array.from(selected))
              handleClose()
            }}
            disabled={selected.size === 0}
          >
            {addSelectedLabel}
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
