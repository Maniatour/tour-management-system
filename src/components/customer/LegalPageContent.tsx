import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { markdownToHtml } from '@/lib/markdownToHtml'
import type { LegalPageContent as LegalPageContentType } from '@/lib/legalContent'
import {
  LEGAL_PAGE_SLUGS,
  buildLegalPageHref,
  type LegalPageSlug,
} from '@/lib/customerSiteRoutes'
import { LEGAL_LABEL_KEYS, type LegalPageLabels } from '@/lib/legalPageLabels'

type LegalPageContentProps = {
  locale: string
  slug: LegalPageSlug
  content: LegalPageContentType
  labels: LegalPageLabels
}

export default function LegalPageContent({
  locale,
  slug,
  content,
  labels,
}: LegalPageContentProps) {
  const relatedSlugs = LEGAL_PAGE_SLUGS.filter((item) => item !== slug)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <Link
        href={`/${locale}`}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-booking"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {labels.backToHome}
      </Link>

      <article
        className="prose prose-slate max-w-none text-base leading-relaxed prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-booking prose-strong:text-foreground [&_img]:rounded-xl"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(content.body) }}
      />

      <aside className="mt-12 rounded-feature border border-border/60 bg-muted/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.relatedPolicies}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {relatedSlugs.map((relatedSlug) => (
            <li key={relatedSlug}>
              <Link
                href={buildLegalPageHref(locale, relatedSlug)}
                className="inline-flex rounded-btn border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-booking/30 hover:text-booking"
              >
                {labels[LEGAL_LABEL_KEYS[relatedSlug]]}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
