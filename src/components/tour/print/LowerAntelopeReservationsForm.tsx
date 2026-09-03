import type { CanyonWaiverPrintGuest, CanyonWaiverPrintPacket } from '@/lib/canyonWaiverPrintForms'
import { LOWER_ANTELOPE_ROWS_PER_PAGE, padPrintRows } from '@/lib/canyonWaiverPrintForms'

export const DIXIES_LOWER_ANTELOPE_LOGO_PATH = '/print/dixies-lower-antelope-logo.png'

function dixiesLogoSrc(): string {
  if (typeof window === 'undefined') return DIXIES_LOWER_ANTELOPE_LOGO_PATH
  return `${window.location.origin}${DIXIES_LOWER_ANTELOPE_LOGO_PATH}`
}

function SignatureImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className || 'cwf-sig'} />
  )
}

export default function LowerAntelopeReservationsForm({
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
  const rows = padPrintRows(guests, LOWER_ANTELOPE_ROWS_PER_PAGE)
  const start = pageIndex * LOWER_ANTELOPE_ROWS_PER_PAGE

  return (
    <section className="cwf-page lac-page" aria-label="Lower Antelope Canyon reservations form">
      <div className="lac-top">
        <div className="lac-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dixiesLogoSrc()} alt="Dixie's Lower Antelope Canyon Tours" />
        </div>
        <h1 className="lac-title">RESERVATIONS</h1>
        <div className="lac-meta">
          <div>Date: {packet.date || '________'}</div>
          <div>
            Page {pageIndex + 1} of {pageCount}
          </div>
        </div>
      </div>

      <div className="lac-company">
        Company Name: <span className="lac-fill">{packet.companyName}</span>
      </div>
      <p className="lac-waiver">
        I have read Lower Antelope Canyon Tour&apos;s Waiver of Liability and consent to the Waiver.
      </p>
      <div className="lac-ops">
        <div>
          <div className="lac-sign-line">Leilah Young</div>
          <div className="lac-sign-label">Signature of Operator</div>
        </div>
        <div>
          <div className="lac-sign-line">Cyrus Ellis</div>
          <div className="lac-sign-label">Signature of Witness</div>
        </div>
      </div>

      <table className="lac-table">
        <thead>
          <tr>
            <th />
            <th>Receipt #</th>
            <th>Print Name</th>
            <th>Signature</th>
            <th>Country</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((guest, i) => (
            <tr key={guest?.id ?? `empty-${start + i}`}>
              <td className="lac-num">{start + i + 1}</td>
              <td className="lac-rn" />
              <td className="lac-name">{guest?.printName || ''}</td>
              <td className="lac-sig">
                {guest?.printName && guest.signatureUrl ? (
                  <SignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName}`}
                    className="cwf-sig lac-sig-img"
                  />
                ) : null}
              </td>
              <td className="lac-country" />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="lac-foot">
        <span>Initials of Book Keeper ________</span>
        <span>W/O Permit Total ________</span>
      </div>
    </section>
  )
}
