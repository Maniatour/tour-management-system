from pathlib import Path
p = Path("src/components/reservation/ReservationCardItem.tsx")
text = p.read_text(encoding="utf-8")
old = """          </div>

        )}

      </div>

    )

  }



  return ("""
new = """          </div>

        )}



        <ReservationOptionsModal

          open={reservationOptionsModalOpen}

          onClose={() => setReservationOptionsModalOpen(false)}

          reservationId={reservation.id}

          onPersistedMutation={() => onReservationOptionsMutated?.(reservation.id)}

        />



      </div>

    )

  }



  return ("""
assert old in text, "simple modal anchor"
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("simple modal ok")
