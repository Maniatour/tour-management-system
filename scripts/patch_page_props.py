from pathlib import Path
p = Path("src/app/[locale]/admin/reservations/page.tsx")
text = p.read_text(encoding="utf-8")
b1 = """                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                      />"""
b2 = """                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                  />"""
add1 = """                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                      />"""
add2 = """                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                  />"""
if b1 not in text:
    raise SystemExit("b1 missing")
text = text.replace(b1, add1, 1)
if b2 not in text:
    raise SystemExit("b2 missing")
text = text.replace(b2, add2, 1)
p.write_text(text, encoding="utf-8")
print("props ok")
