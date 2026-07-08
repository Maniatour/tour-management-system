import { markdownToHtml } from '@/components/LightRichEditor'
import SopChecklistBlock from '@/components/sop/SopChecklistBlock'
import { sopCategoryAnchorId, sopSectionAnchorId } from '@/lib/sopDocumentToc'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  doc: SopDocument
  viewLang: SopEditLocale
  /** card: 섹션별 테두리 박스(기본). flat: 인쇄·PDF에 가까운 단순 구분선. */
  layout?: 'card' | 'flat'
  /** true면 섹션·카테고리에 scroll 앵커 id 부여 */
  anchors?: boolean
  /** 미리보기 편집: 섹션 카드 우상단 수정 */
  onEditSection?: (sectionId: string) => void
  /** 미리보기 편집: 카테고리 블록 우상단 수정 */
  onEditCategory?: (sectionId: string, categoryId: string) => void
  onAddSection?: () => void
  onDeleteSection?: (sectionId: string) => void
  onAddCategory?: (sectionId: string, afterCategoryId?: string) => void
  onDeleteCategory?: (sectionId: string, categoryId: string) => void
  onMoveSection?: (sectionId: string, direction: -1 | 1) => void
  onMoveCategory?: (sectionId: string, categoryId: string, direction: -1 | 1) => void
  onAddChecklistItem?: (sectionId: string, categoryId: string, afterItemId?: string) => void
  onEditChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onDeleteChecklistItem?: (sectionId: string, categoryId: string, itemId: string) => void
  onMoveChecklistItem?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    direction: -1 | 1
  ) => void
  onEditChecklistManual?: (sectionId: string, categoryId: string, itemId: string) => void
  onChangeRowDisplay?: (
    sectionId: string,
    categoryId: string,
    itemId: string,
    display: 'list' | 'text'
  ) => void
  onManageAttachments?: (sectionId: string, categoryId: string, itemId: string) => void
}

function RichLine({ text, flat }: { text: string; flat?: boolean }) {
  const t = (text || '').trim()
  if (!t) return null
  return (
    <div
      className={cn(
        'w-full min-w-0 break-words prose prose-sm max-w-none text-gray-800 [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_ul]:my-2 [&_p]:my-1',
        flat ? 'pl-0' : 'ml-1 border-l-2 border-gray-100 pl-6'
      )}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(t) }}
    />
  )
}

export default function SopDocumentReadonly({
  doc,
  viewLang,
  layout = 'card',
  anchors = false,
  onEditSection,
  onEditCategory,
  onAddSection,
  onDeleteSection,
  onAddCategory,
  onDeleteCategory,
  onMoveSection,
  onMoveCategory,
  onAddChecklistItem,
  onEditChecklistItem,
  onDeleteChecklistItem,
  onMoveChecklistItem,
  onEditChecklistManual,
  onChangeRowDisplay,
  onManageAttachments,
}: Props) {
  const flat = layout === 'flat'
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const docTitle = sopText(doc.title_ko, doc.title_en, viewLang)
  const previewEditable = Boolean(
    onEditSection ||
      onEditCategory ||
      onAddSection ||
      onDeleteSection ||
      onAddCategory ||
      onDeleteCategory ||
      onMoveSection ||
      onMoveCategory ||
      onAddChecklistItem ||
      onEditChecklistItem ||
      onDeleteChecklistItem ||
      onMoveChecklistItem ||
      onEditChecklistManual ||
      onChangeRowDisplay ||
      onManageAttachments
  )

  return (
    <div className={cn('w-full min-w-0 text-sm text-gray-900', flat ? 'space-y-8' : 'space-y-6')}>
      {docTitle ? (
        <div
          className={cn(
            'prose max-w-none font-bold',
            flat ? 'prose-xl text-black' : 'prose-lg text-indigo-950'
          )}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(docTitle) }}
        />
      ) : null}
      {sections.map((s, si) => {
        const st = sopText(s.title_ko, s.title_en, viewLang).trim()
        const heading = st || (viewLang === 'en' ? `Section ${si + 1}` : `섹션 ${si + 1}`)
        return (
          <section
            key={s.id}
            id={anchors ? sopSectionAnchorId(s.id) : undefined}
            className={cn(
              anchors && 'scroll-mt-20',
              previewEditable && !flat && 'relative max-sm:pt-0 sm:pt-0',
              flat
                ? 'border-b border-gray-300 pb-8 last:border-b-0 last:pb-0'
                : 'rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4'
            )}
          >
            {previewEditable && !flat ? (
              <div className="mb-3 flex flex-wrap justify-end gap-1 sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:mb-0 sm:max-w-[calc(100%-1rem)]">
                {onMoveSection && si > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 touch-manipulation bg-white/95 shadow-sm sm:h-8 sm:w-8"
                    title={viewLang === 'en' ? 'Move up' : '위로'}
                    onClick={() => onMoveSection(s.id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                ) : null}
                {onMoveSection && si < sections.length - 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 touch-manipulation bg-white/95 shadow-sm sm:h-8 sm:w-8"
                    title={viewLang === 'en' ? 'Move down' : '아래로'}
                    onClick={() => onMoveSection(s.id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                ) : null}
                {onEditSection ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 bg-white/95 px-2.5 text-xs shadow-sm touch-manipulation hover:bg-indigo-50 sm:h-8"
                    onClick={() => onEditSection(s.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {viewLang === 'en' ? 'Edit' : '수정'}
                  </Button>
                ) : null}
                {onDeleteSection && sections.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 bg-white/95 px-2.5 text-xs text-red-700 shadow-sm touch-manipulation hover:bg-red-50 sm:h-8"
                    onClick={() => onDeleteSection(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {viewLang === 'en' ? 'Delete' : '삭제'}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <h2
              className={cn(
                'font-bold prose prose-sm max-w-none',
                flat
                  ? 'text-base text-black border-b border-gray-400 pb-2 mb-4'
                  : 'text-base text-indigo-900 border-b border-indigo-100 pb-2 mb-3',
                previewEditable && !flat && 'sm:pr-36',
              )}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(heading) }}
            />
            <div className="w-full min-w-0 space-y-4">
              {[...s.categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((c, ci, sortedCats) => {
                  const ct = sopText(c.title_ko, c.title_en, viewLang).trim()
                  const body = sopText(c.content_ko, c.content_en, viewLang)
                  const catLabel = ct || (viewLang === 'en' ? '(Category)' : '(카테고리)')
                  const chk = c.checklist_items ?? []
                  return (
                    <div
                      key={c.id}
                      id={anchors ? sopCategoryAnchorId(c.id) : undefined}
                      className={cn('w-full min-w-0', anchors && 'scroll-mt-20')}
                    >
                      <div
                        className={cn(
                          'relative mb-2 w-full min-w-0 sm:mb-1',
                          (onEditCategory || onDeleteCategory || onMoveCategory) && 'sm:pr-28'
                        )}
                      >
                        {(onEditCategory || onDeleteCategory || onMoveCategory) ? (
                          <div className="mb-2 flex flex-wrap justify-end gap-0.5 sm:absolute sm:right-0 sm:top-0 sm:z-10 sm:mb-0">
                          {onMoveCategory && ci > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 touch-manipulation text-gray-600 hover:bg-gray-100 sm:h-7 sm:w-7"
                              title={viewLang === 'en' ? 'Move up' : '위로'}
                              onClick={() => onMoveCategory(s.id, c.id, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {onMoveCategory && ci < sortedCats.length - 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 touch-manipulation text-gray-600 hover:bg-gray-100 sm:h-7 sm:w-7"
                              title={viewLang === 'en' ? 'Move down' : '아래로'}
                              onClick={() => onMoveCategory(s.id, c.id, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {onEditCategory ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 gap-1 px-2.5 text-xs touch-manipulation text-indigo-700 hover:bg-indigo-50 sm:h-7 sm:px-2 sm:text-[11px]"
                              title={viewLang === 'en' ? 'Edit block title' : '영역 제목 수정'}
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditCategory(s.id, c.id)
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              {viewLang === 'en' ? 'Edit' : '수정'}
                            </Button>
                          ) : null}
                          {onDeleteCategory && s.categories.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 gap-1 px-2.5 text-xs touch-manipulation text-red-700 hover:bg-red-50 sm:h-7 sm:px-2 sm:text-[11px]"
                              onClick={() => onDeleteCategory(s.id, c.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              {viewLang === 'en' ? 'Delete' : '삭제'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                        <h3
                          className={cn(
                            'flex items-start gap-2 font-semibold text-gray-800 prose prose-sm max-w-none',
                            flat && 'text-gray-900'
                          )}
                        >
                          {!flat ? <span className="shrink-0 text-indigo-600">●</span> : null}
                          <span
                            className="min-w-0 flex-1 break-words"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(catLabel) }}
                          />
                        </h3>
                      </div>
                      {chk.length > 0 ? (
                        <SopChecklistBlock
                          sectionId={s.id}
                          categoryId={c.id}
                          items={chk}
                          viewLang={viewLang}
                          flat={flat}
                          anchors={anchors}
                          {...(onEditChecklistItem ? { onEditChecklistItem } : {})}
                          {...(onEditChecklistManual ? { onEditChecklistManual } : {})}
                          {...(onChangeRowDisplay ? { onChangeRowDisplay } : {})}
                          {...(onDeleteChecklistItem ? { onDeleteChecklistItem } : {})}
                          {...(onMoveChecklistItem ? { onMoveChecklistItem } : {})}
                          {...(onAddChecklistItem ? { onAddChecklistItem } : {})}
                          {...(onManageAttachments ? { onManageAttachments } : {})}
                        />
                      ) : null}
                      <RichLine text={body} flat={flat} />
                      {onAddChecklistItem || onAddCategory ? (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          {onAddChecklistItem ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 w-full gap-1 text-xs touch-manipulation sm:h-7 sm:w-auto"
                              onClick={() => onAddChecklistItem(s.id, c.id)}
                            >
                              <Plus className="h-3 w-3" />
                              {viewLang === 'en' ? 'Add row' : '줄 추가'}
                            </Button>
                          ) : null}
                          {onAddCategory ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-10 w-full gap-1 text-xs touch-manipulation sm:h-7 sm:w-auto"
                              onClick={() => onAddCategory(s.id, c.id)}
                            >
                              <Plus className="h-3 w-3" />
                              {viewLang === 'en' ? 'Add block' : '영역 추가'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          </section>
        )
      })}
      {onAddSection ? (
        <Button type="button" variant="outline" className="h-11 w-full gap-1 touch-manipulation sm:h-10 sm:w-auto" onClick={onAddSection}>
          <Plus className="h-4 w-4" />
          {viewLang === 'en' ? 'Add section' : '섹션 추가'}
        </Button>
      ) : null}
    </div>
  )
}
