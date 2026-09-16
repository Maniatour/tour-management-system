import { LAS_VEGAS_MANIA_WAIVER_EN } from '@/lib/waiver/documents/lasVegasMania/en'
import {
  MANIA_WAIVER_ROWS_PER_PAGE,
  chunkPrintGuests,
  padPrintRows,
  type CanyonWaiverPrintGuest,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import PrintSignatureImage from '@/components/tour/print/PrintSignatureImage'

const MANIA_WAIVER_FRONT_THROUGH = 8

function ManiaWaiverSections({
  sections,
}: {
  sections: (typeof LAS_VEGAS_MANIA_WAIVER_EN.sections)[number][]
}) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.number}>
          <h3>
            {section.number}. {section.title}
          </h3>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          {section.bullets?.length ? (
            <ul>
              {section.bullets.map((b) => (
                <li key={b.slice(0, 40)}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  )
}

function ManiaWaiverFront({ date, guestCount }: { date: string; guestCount: number }) {
  const content = LAS_VEGAS_MANIA_WAIVER_EN
  return (
    <section
      className="mania-page mania-waiver-page"
      data-print-section="mania-waiver"
      aria-label="Las Vegas Mania Tour waiver front"
    >
      <p className="acx-sheet-side">Front · waiver</p>
      <article className="mania-doc">
        <p className="mania-op">{content.operatorName}</p>
        <h2>{content.title}</h2>
        {content.subtitle ? <p>{content.subtitle}</p> : null}
        <p className="mania-meta">
          Tour date: {date || '________'} · Participants: {guestCount}
        </p>
        <p className="mania-warn">{content.warning}</p>
        {content.intro.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
        <ManiaWaiverSections sections={content.sections.slice(0, MANIA_WAIVER_FRONT_THROUGH)} />
      </article>
      <div className="mania-page-num">1</div>
    </section>
  )
}

function ManiaWaiverBack() {
  const content = LAS_VEGAS_MANIA_WAIVER_EN
  return (
    <section
      className="mania-page mania-waiver-page"
      data-print-section="mania-waiver"
      aria-label="Las Vegas Mania Tour waiver back"
    >
      <p className="acx-sheet-side">Back · waiver</p>
      <article className="mania-doc">
        <p className="mania-op">{content.operatorName}</p>
        <h2>{content.title} — CONTINUED</h2>
        <ManiaWaiverSections sections={content.sections.slice(MANIA_WAIVER_FRONT_THROUGH)} />
        {content.closing.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </article>
      <div className="mania-page-num">2</div>
    </section>
  )
}

function ManiaSignaturePage({
  packet,
  guests,
  pageIndex,
  pageCount,
}: {
  packet: CanyonWaiverPrintPacket
  guests: CanyonWaiverPrintGuest[]
  pageIndex: number
  pageCount: number
}) {
  const rows = padPrintRows(guests, MANIA_WAIVER_ROWS_PER_PAGE)
  const start = pageIndex * MANIA_WAIVER_ROWS_PER_PAGE
  return (
    <section
      className="mania-page mania-sig-page"
      data-print-section="mania-signatures"
      aria-label="Mania tour waiver signatures"
    >
      <h2>LAS VEGAS MANIA TOUR — PARTICIPANT SIGNATURES</h2>
      <p className="mania-meta">
        Date: {packet.date || '________'}
        {packet.tourTime ? ` · Time: ${packet.tourTime}` : ''} · Page {pageIndex + 1} of {pageCount}
      </p>
      <p className="mania-meta">
        I have read the Acknowledgment of Risk, Release of Liability, Waiver &amp; Assumption of
        Risk Agreement and agree to its terms.
      </p>
      <table className="mania-sig-table">
        <thead>
          <tr>
            <th />
            <th>Print Name</th>
            <th>Signature</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((guest, i) => (
            <tr key={guest?.id ?? `empty-${start + i}`}>
              <td className="mania-num">{start + i + 1}</td>
              <td className="mania-name">{guest?.printName || ''}</td>
              <td className="mania-sig">
                {guest?.printName && guest.signatureUrl ? (
                  <PrintSignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName}`}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ManiaTourWaiverPrintPages({
  packet,
  includeWaiver,
  includeSignatures,
  isFirstPrintedBlock,
}: {
  packet: CanyonWaiverPrintPacket | null
  includeWaiver: boolean
  includeSignatures: boolean
  isFirstPrintedBlock: boolean
}) {
  if (!packet) return null
  if (!includeWaiver && !includeSignatures) return null
  const chunks = chunkPrintGuests(packet.guests, MANIA_WAIVER_ROWS_PER_PAGE)
  const guestCount = packet.guests.filter((g) => g.printName).length
  const waiverStartClass = isFirstPrintedBlock ? undefined : 'cwf-page-break mania-duplex-start'

  return (
    <>
      {includeWaiver ? (
        <>
          <div className={waiverStartClass}>
            <ManiaWaiverFront date={packet.date} guestCount={guestCount} />
          </div>
          <div className="cwf-page-break">
            <ManiaWaiverBack />
          </div>
        </>
      ) : null}
      {includeSignatures
        ? chunks.map((guests, pageIndex) => (
            <div
              key={`mania-sig-${pageIndex}`}
              className={includeWaiver || !isFirstPrintedBlock || pageIndex > 0 ? 'cwf-page-break' : undefined}
            >
              <ManiaSignaturePage
                packet={packet}
                guests={guests}
                pageIndex={pageIndex}
                pageCount={chunks.length}
              />
            </div>
          ))
        : null}
    </>
  )
}
