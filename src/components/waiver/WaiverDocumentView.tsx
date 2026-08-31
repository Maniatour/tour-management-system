import type { WaiverDocumentContent } from '@/lib/waiver/types'

export default function WaiverDocumentView({
  content,
  languageNotice,
  showGoverningNotice,
}: {
  content: WaiverDocumentContent
  languageNotice: string
  showGoverningNotice: boolean
}) {
  return (
    <article className="space-y-6 text-foreground">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">{content.operatorName}</p>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{content.title}</h2>
        {content.subtitle ? <p className="text-base font-medium">{content.subtitle}</p> : null}
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          {content.warning}
        </p>
      </header>
      {showGoverningNotice ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {languageNotice}
        </p>
      ) : null}
      {content.intro.map((p) => (
        <p key={p.slice(0, 48)} className="text-base leading-7 text-muted-foreground">
          {p}
        </p>
      ))}
      {content.sections.map((section) => (
        <section key={section.number} className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">
            {section.number}. {section.title}
          </h3>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="text-base leading-7 text-muted-foreground">
              {p}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground">
              {section.bullets.map((b) => (
                <li key={b.slice(0, 40)}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {content.closing.map((p) => (
        <p key={p.slice(0, 40)} className="text-base font-medium leading-7">
          {p}
        </p>
      ))}
    </article>
  )
}
