import type { CanyonWaiverPrintGuest, CanyonWaiverPrintPacket } from '@/lib/canyonWaiverPrintForms'
import { ANTELOPE_X_ROWS_PER_PAGE, antelopeXPrintName, padPrintRows } from '@/lib/canyonWaiverPrintForms'

function UnderlineValue({ value, minWidth }: { value: string; minWidth?: string }) {
  return (
    <span className="acx-line" style={minWidth ? { minWidth } : undefined}>
      {value || '\u00a0'}
    </span>
  )
}

function SignatureImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="cwf-sig" />
  )
}

export default function AntelopeXCompanyInfoForm({
  packet,
  guests,
  pageIndex,
  pageCount: _pageCount,
}: {
  packet: CanyonWaiverPrintPacket
  guests: CanyonWaiverPrintGuest[]
  pageIndex: number
  pageCount: number
}) {
  const rows = padPrintRows(guests, ANTELOPE_X_ROWS_PER_PAGE)
  const start = pageIndex * ANTELOPE_X_ROWS_PER_PAGE
  const showCompanyBlock = pageIndex === 0

  return (
    <section className="cwf-page acx-page" aria-label="Antelope Canyon X tour company information">
      <h1 className="acx-title">
        TOUR COMPANY INFORMATION{pageIndex > 0 ? ' — CONTINUATION' : ''}
      </h1>

      {showCompanyBlock ? (
        <>
          <div className="acx-field">
            COMPANY NAME: <UnderlineValue value={packet.companyName} minWidth="78%" />
          </div>
          <div className="acx-row">
            <div className="acx-field">
              DATE: <UnderlineValue value={packet.date} minWidth="55%" />
            </div>
            <div className="acx-field">
              TOUR TIME: <UnderlineValue value={packet.tourTime} minWidth="55%" />
            </div>
          </div>
          <div className="acx-row">
            <div className="acx-field">
              TOTAL ADULT CUSTOMERS:{' '}
              <UnderlineValue value={String(packet.adultCount)} minWidth="40%" />
            </div>
            <div className="acx-field">
              TOTAL MINOR CUSTOMERS:{' '}
              <UnderlineValue value={String(packet.minorCount)} minWidth="40%" />
            </div>
          </div>
          <div className="acx-field">
            TOUR GUIDE NAME: <UnderlineValue value={packet.guideName} minWidth="72%" />
          </div>
          <div className="acx-field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <span>TOUR GUIDE SIGNATURE:</span>
            {packet.guideSignatureUrl ? (
              <SignatureImage src={packet.guideSignatureUrl} alt="Tour guide signature" />
            ) : (
              <UnderlineValue value="" minWidth="62%" />
            )}
          </div>
          <div className="acx-field">
            TOUR GUIDE PHONE: <UnderlineValue value={packet.guidePhone} minWidth="70%" />
          </div>
        </>
      ) : null}

      <p className="acx-note">
        All participants must print their name and sign the Release of Liability Waiver before
        participating in the tour. Guardians of minors must print the minor&apos;s name and
        minor&apos;s age, and the guardian is responsible for signing on behalf of the minor child.
      </p>

      <div className="acx-row">
        <div className="acx-field">
          DATE: <UnderlineValue value={packet.date} minWidth="55%" />
        </div>
        <div className="acx-field">
          TOUR TIME: <UnderlineValue value={packet.tourTime} minWidth="55%" />
        </div>
      </div>

      <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
        {rows.map((guest, i) => (
          <li key={guest?.id ?? `empty-${start + i}`} className="acx-guest">
            <span className="acx-idx">{start + i + 1}.</span>
            <span className="acx-name">
              PRINT NAME:
              <span className="acx-fill">{antelopeXPrintName(guest)}</span>
            </span>
            <span className="acx-sig">
              SIGNATURE:
              <span className="acx-fill">
                {guest?.signatureUrl ? (
                  <SignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName || 'guest'}`}
                  />
                ) : null}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="acx-page-num">{pageIndex + 2}</div>
    </section>
  )
}
