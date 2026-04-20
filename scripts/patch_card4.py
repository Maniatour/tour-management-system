from pathlib import Path
p = Path("src/components/reservation/ReservationCardItem.tsx")
text = p.read_text(encoding="utf-8")
old = """              <span>{t('actions.price')}</span>

            </button>

            

            {/* ?? ?? ?? - Mania Tour/Service?? ??? ?? ?? ?? */}"""
new = """              <span>{t('actions.price')}</span>

            </button>



            <button

              type="button"

              onClick={(e) => {

                e.stopPropagation()

                setReservationOptionsModalOpen(true)

              }}

              className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center space-x-1 border ${

                hasReservationOptionsRows

                  ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'

                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'

              }`}

              title={t('card.reservationOptionsIconTitle')}

            >

              <ListChecks className="w-3 h-3" />

              <span>{t('card.reservationOptionsShort')}</span>

            </button>

            

            {/* ?? ?? ?? - Mania Tour/Service?? ??? ?? ?? ?? */}"""
assert old in text, "standard price"
text = text.replace(old, new, 1)
old2 = """      )}

    </div>

  )

}, (prevProps, nextProps) => {"""
new2 = """      )}



      <ReservationOptionsModal

        open={reservationOptionsModalOpen}

        onClose={() => setReservationOptionsModalOpen(false)}

        reservationId={reservation.id}

        onPersistedMutation={() => onReservationOptionsMutated?.(reservation.id)}

      />



    </div>

  )

}, (prevProps, nextProps) => {"""
assert old2 in text, "standard modal anchor"
text = text.replace(old2, new2, 1)
# memo compare
old3 = """    prevProps.reservationPricingMap.get(prevProps.reservation.id) === nextProps.reservationPricingMap.get(nextProps.reservation.id)

  )"""
new3 = """    prevProps.reservationPricingMap.get(prevProps.reservation.id) === nextProps.reservationPricingMap.get(nextProps.reservation.id) &&

    prevProps.reservationOptionsPresenceByReservationId?.get(prevProps.reservation.id) ===

      nextProps.reservationOptionsPresenceByReservationId?.get(nextProps.reservation.id)

  )"""
assert old3 in text, "memo"
text = text.replace(old3, new3, 1)
p.write_text(text, encoding="utf-8")
print("standard ok")
