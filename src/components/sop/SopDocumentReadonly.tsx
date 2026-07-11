import { markdownToHtml, markdownToHeadingHtml } from '@/components/LightRichEditor'
import SopCategoryToolbar from '@/components/sop/SopCategoryToolbar'
import SopSectionToolbar from '@/components/sop/SopSectionToolbar'
import SopSectionBodyToolbar from '@/components/sop/SopSectionBodyToolbar'
import SopChecklistBlock from '@/components/sop/SopChecklistBlock'
import SopManualContentPanel from '@/components/sop/SopManualContentPanel'
import SopManualDocIcon from '@/components/sop/SopManualDocIcon'
import { hasCategoryManualSource } from '@/lib/sopQuickEdit'
import { sopCategoryAnchorId, sopSectionAnchorId } from '@/lib/sopDocumentToc'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
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
  /** 미리보기 편집: 섹션 제목 아래 본문(카테고리 없이) */
  onEditSectionContent?: (sectionId: string) => void
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
  onConvertCategoryToRow?: (sectionId: string, categoryId: string) => void
  onConvertRowToCategory?: (sectionId: string, categoryId: string, itemId: string) => void
  onEditCategoryManual?: (sectionId: string, categoryId: string) => void
  /** 검색 결과 이동 시 해당 ROW 아코디언 펼침 */
  searchFocusRowId?: string | null
}

function RichLine({
  text,
  flat,
  bordered = true,
}: {
  text: string
  flat?: boolean
  /** false면 왼쪽 세로 라인 없음 (섹션 본문·카테고리 없음 등) */
  bordered?: boolean
}) {
  const t = (text || '').trim()
  if (!t) return null
  return (
    <div
      className={cn(
        'w-full min-w-0 break-words prose prose-sm max-w-none text-gray-800 [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_ul]:my-2 [&_p]:my-1 [&_table]:my-3 [&_th]:text-left [&_td]:align-top [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold',
        flat || !bordered ? 'pl-0' : 'ml-1 border-l-2 border-gray-100 pl-6'
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
  onEditSectionContent,
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
  searchFocusRowId = null,
  onConvertCategoryToRow,
  onConvertRowToCategory,
  onEditCategoryManual,
}: Props) {
  const flat = layout === 'flat'
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const docTitle = sopText(doc.title_ko, doc.title_en, viewLang)
  const previewEditable = Boolean(
    onEditSection ||
      onEditSectionContent ||
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
      onManageAttachments ||
      onConvertCategoryToRow ||
      onConvertRowToCategory ||
      onEditCategoryManual
  )

  return (
    <div className={cn('w-full min-w-0 text-sm text-gray-900', flat ? 'space-y-8' : 'space-y-6')}>
      {docTitle ? (
        <div
          id={anchors ? 'sop-doc-top' : undefined}
          className={cn(
            'prose max-w-none font-bold',
            anchors && 'scroll-mt-20',
            flat ? 'prose-xl text-black' : 'prose-lg text-indigo-950'
          )}
          dangerouslySetInnerHTML={{ __html: markdownToHeadingHtml(docTitle) }}
        />
      ) : null}
      {sections.map((s, si) => {
        const st = sopText(s.title_ko, s.title_en, viewLang).trim()
        const heading = st || (viewLang === 'en' ? `Section ${si + 1}` : `섹션 ${si + 1}`)
        const sectionBody = sopText(s.content_ko ?? '', s.content_en ?? '', viewLang)
        const sortedCats = [...s.categories].sort((a, b) => a.sort_order - b.sort_order)
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
              <div className="mb-3 flex justify-end sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:mb-0">
                <SopSectionToolbar
                  sectionId={s.id}
                  sectionIndex={si}
                  sectionCount={sections.length}
                  viewLang={viewLang}
                  {...(sortedCats.length > 0
                    ? { lastCategoryId: sortedCats[sortedCats.length - 1]?.id }
                    : {})}
                  {...(onEditSection ? { onEditSection } : {})}
                  {...(onEditSectionContent ? { onEditSectionContent } : {})}
                  {...(onAddCategory ? { onAddCategory } : {})}
                  {...(onDeleteSection ? { onDeleteSection } : {})}
                  {...(onMoveSection ? { onMoveSection } : {})}
                />
              </div>
            ) : null}
            <h2
              className={cn(
                'text-lg font-bold prose max-w-none sm:text-xl',
                flat
                  ? 'text-black border-b border-gray-400 pb-2 mb-4'
                  : 'text-indigo-900 border-b border-indigo-100 pb-2 mb-3',
                previewEditable && !flat && 'sm:pr-12',
              )}
              dangerouslySetInnerHTML={{ __html: markdownToHeadingHtml(heading) }}
            />
            <div className="w-full min-w-0 space-y-4">
              {sectionBody.trim() ? (
                <div
                  className={cn(
                    'relative flex w-full min-w-0 items-start gap-2',
                    previewEditable && onEditSectionContent && 'sm:pr-2'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <RichLine text={sectionBody} flat={flat} bordered={sortedCats.length > 0} />
                  </div>
                  {previewEditable && onEditSectionContent ? (
                    <SopSectionBodyToolbar
                      sectionId={s.id}
                      viewLang={viewLang}
                      onEditSectionContent={onEditSectionContent}
                    />
                  ) : null}
                </div>
              ) : null}

              {sortedCats.map((c, ci) => {
                  const ct = sopText(c.title_ko, c.title_en, viewLang).trim()
                  const body = sopText(c.content_ko, c.content_en, viewLang)
                  const catLabel = ct || (viewLang === 'en' ? '(Category)' : '(카테고리)')
                  const chk = c.checklist_items ?? []
                  const showCategoryManual = hasCategoryManualSource(c, viewLang)
                  const openCategoryManual = onEditCategoryManual
                    ? () => onEditCategoryManual(s.id, c.id)
                    : undefined
                  return (
                    <div
                      key={c.id}
                      id={anchors ? sopCategoryAnchorId(c.id) : undefined}
                      className={cn('w-full min-w-0', anchors && 'scroll-mt-20')}
                    >
                      <div
                        className={cn(
                          'relative mb-2 flex w-full min-w-0 items-start gap-2 sm:mb-1',
                          (onEditCategory ||
                            onDeleteCategory ||
                            onMoveCategory ||
                            onAddChecklistItem ||
                            onAddCategory) &&
                            'sm:pr-2'
                        )}
                      >
                        <h3
                          className={cn(
                            'min-w-0 flex-1 flex items-start gap-2 text-base font-semibold text-gray-800 prose max-w-none sm:text-lg',
                            flat && 'text-gray-900'
                          )}
                        >
                          {!flat ? <span className="shrink-0 text-indigo-600">●</span> : null}
                          <span
                            className="min-w-0 flex-1 break-words"
                            dangerouslySetInnerHTML={{ __html: markdownToHeadingHtml(catLabel) }}
                          />
                        </h3>
                        <SopManualDocIcon
                          source={c}
                          viewLang={viewLang}
                          isEn={viewLang === 'en'}
                          {...(openCategoryManual ? { onClick: openCategoryManual } : {})}
                        />
                        <SopCategoryToolbar
                          sectionId={s.id}
                          categoryId={c.id}
                          categoryIndex={ci}
                          categoryCount={sortedCats.length}
                          sectionCategoryCount={s.categories.length}
                          viewLang={viewLang}
                          {...(onEditCategory ? { onEditCategory } : {})}
                          {...(onDeleteCategory ? { onDeleteCategory } : {})}
                          {...(onMoveCategory ? { onMoveCategory } : {})}
                          {...(onAddChecklistItem ? { onAddChecklistItem } : {})}
                          {...(onAddCategory ? { onAddCategory } : {})}
                          {...(onConvertCategoryToRow ? { onConvertCategoryToRow } : {})}
                        />
                      </div>
                      {showCategoryManual ? (
                        <div className="mb-3">
                          <SopManualContentPanel
                            source={c}
                            viewLang={viewLang}
                            isEn={viewLang === 'en'}
                          />
                        </div>
                      ) : null}
                      {chk.length > 0 ? (
                        <SopChecklistBlock
                          sectionId={s.id}
                          categoryId={c.id}
                          items={chk}
                          viewLang={viewLang}
                          flat={flat}
                          anchors={anchors}
                          searchFocusRowId={searchFocusRowId}
                          {...(onEditChecklistItem ? { onEditChecklistItem } : {})}
                          {...(onEditChecklistManual ? { onEditChecklistManual } : {})}
                          {...(onChangeRowDisplay ? { onChangeRowDisplay } : {})}
                          {...(onDeleteChecklistItem ? { onDeleteChecklistItem } : {})}
                          {...(onMoveChecklistItem ? { onMoveChecklistItem } : {})}
                          {...(onAddChecklistItem ? { onAddChecklistItem } : {})}
                          {...(onManageAttachments ? { onManageAttachments } : {})}
                          {...(onConvertRowToCategory ? { onConvertRowToCategory } : {})}
                        />
                      ) : null}
                      <RichLine text={body} flat={flat} />
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
