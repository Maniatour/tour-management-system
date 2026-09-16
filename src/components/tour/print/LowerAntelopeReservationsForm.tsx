import type { CanyonWaiverPrintGuest, CanyonWaiverPrintPacket } from '@/lib/canyonWaiverPrintForms'
import { LOWER_ANTELOPE_ROWS_PER_PAGE, padPrintRows } from '@/lib/canyonWaiverPrintForms'

export const DIXIES_LOWER_ANTELOPE_LOGO_PATH = '/print/dixies-lower-antelope-logo.png'

function dixiesLogoSrc(): string {
  if (typeof window === 'undefined') return DIXIES_LOWER_ANTELOPE_LOGO_PATH
  return `${window.location.origin}${DIXIES_LOWER_ANTELOPE_LOGO_PATH}`
}

function SignatureImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <span className="cwf-sig-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={className || 'cwf-sig'} />
    </span>
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
    <section
      className="cwf-page lac-page"
      data-print-section="lower-overlay"
      aria-label="Lower Antelope Canyon reservations overlay"
    >
      <p className="lac-preview-note">
        Preview on yellow stock — print fills Print Name and Signature only
      </p>
      <div className="lac-chrome lac-top">
        <div className="lac-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dixiesLogoSrc()} alt="" />
        </div>
        <h1 className="lac-title">RESERVATIONS</h1>
        <div className="lac-meta">
          <div>Date: {packet.date || '________'}</div>
          <div>
            Page {pageIndex + 1} of {pageCount}
          </div>
        </div>
      </div>

      <div className="lac-chrome lac-company">
        Company Name: <span className="lac-fill">{packet.companyName}</span>
      </div>
      <p className="lac-chrome lac-waiver">
        I have read Lower Antelope Canyon Tour&apos;s Waiver of Liability and consent to the Waiver.
      </p>
      <div className="lac-chrome lac-ops">
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
          <tr className="lac-chrome">
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
              <td className="lac-num lac-chrome">{start + i + 1}</td>
              <td className="lac-rn" />
              <td className="lac-name lac-ink">{guest?.printName || ''}</td>
              <td className="lac-sig lac-ink">
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

      <div className="lac-chrome lac-foot">
        <span>Initials of Book Keeper ________</span>
        <span>W/O Permit Total ________</span>
      </div>
    </section>
  )
}
