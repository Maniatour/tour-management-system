import { emptyKnowledgeArticleForm, type KnowledgeArticleDraftForm } from '@/lib/knowledgeArticleForm'
import { sopPlainDisplayText } from '@/components/LightRichEditor'
import { newSopId, prefillSortOrders, type SopEditLocale } from '@/types/sopStructure'

/** 메뉴얼 직접 작성 내용을 운영 허브 문서 초안으로 변환 */
export function buildHubArticleFromManualNotes(opts: {
  title: string
  content: string
  lang: SopEditLocale
}): KnowledgeArticleDraftForm {
  const plainTitle =
    sopPlainDisplayText(opts.title).trim() ||
    (opts.lang === 'en' ? 'Manual notes' : '메뉴얼')
  const content = opts.content ?? ''
  const form = emptyKnowledgeArticleForm()

  form.title_ko = plainTitle
  form.title_en = plainTitle
  form.summary_ko = ''
  form.summary_en = ''
  form.hub_category = 'other'
  form.content_type = 'playbook'
  form.is_published = true
  form.slug = ''

  form.bodyDoc = prefillSortOrders({
    title_ko: plainTitle,
    title_en: plainTitle,
    sections: [
      {
        id: newSopId(),
        title_ko: opts.lang === 'ko' ? plainTitle : '',
        title_en: opts.lang === 'en' ? plainTitle : '',
        sort_order: 0,
        content_ko: opts.lang === 'ko' ? content : '',
        content_en: opts.lang === 'en' ? content : '',
        categories: [],
      },
    ],
  })

  return form
}
