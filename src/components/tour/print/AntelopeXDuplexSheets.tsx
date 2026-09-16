import { ANTELOPE_CANYON_X_WAIVER_EN } from '@/lib/waiver/documents/antelopeCanyonX/en'
import {
  ANTELOPE_X_ROWS_PER_PAGE,
  antelopeXDuplexPageNumber,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import AntelopeXCompanyInfoForm from '@/components/tour/print/AntelopeXCompanyInfoForm'

function AntelopeXWaiverBack({
  date,
  tourTime,
  pageIndex,
}: {
  date: string
  tourTime: string
  pageIndex: number
}) {
  const content = ANTELOPE_CANYON_X_WAIVER_EN
  return (
    <section className="cwf-page acx-waiver-page" aria-label="Antelope Canyon X liability waiver">
      <article className="acx-waiver-doc">
        <p className="acx-waiver-op">{content.operatorName}</p>
        <h2>{content.title}</h2>
        {content.subtitle ? <p className="acx-waiver-sub">{content.subtitle}</p> : null}
        <p className="acx-waiver-meta">
          Date: {date || '________'}
          {tourTime ? ` · Tour time: ${tourTime}` : ''}
        </p>
        <p className="acx-waiver-warn">{content.warning}</p>
        {content.intro.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
        {content.sections.map((section) => (
          <section key={section.number}>
            <h3>
              {section.number}. {section.title}
            </h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet.slice(0, 40)}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        {content.closing.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </article>
      <div className="acx-page-num">{antelopeXDuplexPageNumber(pageIndex, 'waiver')}</div>
    </section>
  )
}

export default function AntelopeXDuplexSheets({
  packet,
  isFirstPrintedBlock,
}: {
  packet: CanyonWaiverPrintPacket
  isFirstPrintedBlock: boolean
}) {
  const chunks = chunkPrintGuests(packet.guests, ANTELOPE_X_ROWS_PER_PAGE)
  return (
    <>
      {chunks.map((guests, pageIndex) => {
        const formBreakClass =
          pageIndex === 0
            ? isFirstPrintedBlock
              ? undefined
              : 'cwf-page-break acx-duplex-start'
            : 'cwf-page-break'
        return (
          <div key={`x-sheet-${pageIndex}`}>
            <div className={formBreakClass}>
              <p className="acx-sheet-side">Front · signature form</p>
              <AntelopeXCompanyInfoForm
                packet={packet}
                guests={guests}
                pageIndex={pageIndex}
                pageCount={chunks.length}
              />
            </div>
            <div className="cwf-page-break">
              <p className="acx-sheet-side">Back · waiver</p>
              <AntelopeXWaiverBack date={packet.date} tourTime={packet.tourTime} pageIndex={pageIndex} />
            </div>
          </div>
        )
      })}
    </>
  )
}
