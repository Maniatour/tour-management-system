import { ANTELOPE_CANYON_X_WAIVER_PRINT } from '@/lib/waiver/documents/antelopeCanyonX/printEn'
import {
  ANTELOPE_X_ROWS_PER_PAGE,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import AntelopeXCompanyInfoForm from '@/components/tour/print/AntelopeXCompanyInfoForm'

function AntelopeXWaiverBack() {
  const content = ANTELOPE_CANYON_X_WAIVER_PRINT
  return (
    <section className="cwf-page acx-waiver-page" aria-label="Antelope Canyon X liability waiver">
      <article className="acx-waiver-doc acx-waiver-official">
        <h2>{content.title}</h2>
        <p className="acx-waiver-sub">
          HIKING AND PHOTOGRAPHY TOUR RELEASE OF LIABILITY, WAIVER OF
          <br />
          LEGAL RIGHTS AND ASSUMPTION OF RISK
        </p>
        <p>{content.intro}</p>
        <ol className="acx-waiver-clauses">
          {content.clauses.map((clause, index) => (
            <li key={clause.slice(0, 48)}>
              <span className="acx-waiver-num">{index + 1}.</span>
              <span className="acx-waiver-clause">{clause}</span>
            </li>
          ))}
        </ol>
        <p className="acx-waiver-closing">{content.closing}</p>
      </article>
      <div className="acx-page-num">1</div>
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
              <AntelopeXWaiverBack />
            </div>
          </div>
        )
      })}
    </>
  )
}
