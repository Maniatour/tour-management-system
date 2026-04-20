from pathlib import Path
p = Path("src/components/reservation/ReservationCardItem.tsx")
text = p.read_text(encoding="utf-8")
old = "  }\n\n\n\n  if (cardLayout === 'simple') {"
new = "  }\n\n\n\n  const hasReservationOptionsRows =\n\n    reservationOptionsPresenceByReservationId?.get(reservation.id) === true\n\n\n\n  if (cardLayout === 'simple') {"
assert old in text, "before simple"
text = text.replace(old, new, 1)
# simple toolbar: after receipt button
old = """              <Receipt className="w-4 h-4" aria-hidden />

            </button>



            {isManiaTourSimple && !reservation.hasExistingTour ? ("""
new = """              <Receipt className="w-4 h-4" aria-hidden />

            </button>



            <button

              type="button"

              onClick={(e) => {

                e.stopPropagation()

                setReservationOptionsModalOpen(true)

              }}

              className={`p-2 rounded-md border border-transparent ${

                hasReservationOptionsRows

                  ? 'text-teal-600 hover:bg-teal-50 hover:border-teal-200'

                  : 'text-gray-400 hover:bg-gray-50 hover:border-gray-200'

              }`}

              title={t('card.reservationOptionsIconTitle')}

            >

              <ListChecks className="w-4 h-4" aria-hidden />

            </button>



            {isManiaTourSimple && !reservation.hasExistingTour ? ("""
assert old in text, "receipt simple"
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("simple btn ok")
