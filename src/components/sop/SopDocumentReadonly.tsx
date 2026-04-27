import { markdownToHtml } from '@/components/LightRichEditor'
import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { checklistItemDepth, orderedChecklistItems, sopText } from '@/types/sopStructure'
import { cn } from '@/lib/utils'

type Props = {
  doc: SopDocument
  viewLang: SopEditLocale
  /** card: 섹션별 테두리 박스(기본). flat: 인쇄·PDF에 가까운 단순 구분선. */
  layout?: 'card' | 'flat'
}

function RichLine({ text, flat }: { text: string; flat?: boolean }) {
  const t = (text || '').trim()
  if (!t) return null
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-gray-800 [&_ul]:my-2 [&_p]:my-1',
        flat ? 'pl-0' : 'pl-6 border-l-2 border-gray-100 ml-1'
      )}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(t) }}
    />
  )
}

export default function SopDocumentReadonly({ doc, viewLang, layout = 'card' }: Props) {
  const flat = layout === 'flat'
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const docTitle = sopText(doc.title_ko, doc.title_en, viewLang)

  return (
    <div className={cn('text-sm text-gray-900', flat ? 'space-y-8' : 'space-y-6')}>
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
            className={cn(
              flat
                ? 'border-b border-gray-300 pb-8 last:border-b-0 last:pb-0'
                : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
            )}
          >
            <h2
              className={cn(
                'font-bold prose prose-sm max-w-none',
                flat
                  ? 'text-base text-black border-b border-gray-400 pb-2 mb-4'
                  : 'text-base text-indigo-900 border-b border-indigo-100 pb-2 mb-3'
              )}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(heading) }}
            />
            <div className="space-y-4">
              {[...s.categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((c) => {
                  const ct = sopText(c.title_ko, c.title_en, viewLang).trim()
                  const body = sopText(c.content_ko, c.content_en, viewLang)
                  const catLabel = ct || (viewLang === 'en' ? '(Category)' : '(카테고리)')
                  const chk = c.checklist_items
                  const chkOrdered = orderedChecklistItems(chk)
                  const byId = chk?.length ? new Map(chk.map((x) => [x.id, x])) : null
                  return (
                    <div key={c.id}>
                      <h3
                        className={cn(
                          'font-semibold text-gray-800 mb-1 flex gap-2 items-start prose prose-sm max-w-none',
                          flat && 'text-gray-900'
                        )}
                      >
                        {!flat ? <span className="text-indigo-600 shrink-0">●</span> : null}
                        <span dangerouslySetInnerHTML={{ __html: markdownToHtml(catLabel) }} />
                      </h3>
                      {chkOrdered.length > 0 && byId ? (
                        <ul className={cn('mb-2 list-none space-y-0.5 text-gray-800', flat ? 'text-sm' : 'text-sm')}>
                          {chkOrdered.map((it) => {
                            const line = sopText(it.title_ko, it.title_en, viewLang).trim()
                            if (!line) return null
                            const depth = checklistItemDepth(it, byId)
                            return (
                              <li
                                key={it.id}
                                className="flex gap-2"
                                style={{ paddingLeft: depth * 12 }}
                                data-sop-section-id={s.id}
                                data-sop-category-id={c.id}
                                data-sop-check-item-id={it.id}
                              >
                                <span className="text-gray-500 shrink-0">-</span>
                                <span
                                  className="prose prose-sm max-w-none [&_p]:my-0"
                                  dangerouslySetInnerHTML={{ __html: markdownToHtml(line) }}
                                />
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                      <RichLine text={body} flat={flat} />
                    </div>
                  )
                })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
