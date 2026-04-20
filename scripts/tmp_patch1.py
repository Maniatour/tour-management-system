from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src/hooks/useReservationData.ts"
text = p.read_text(encoding="utf-8")
old = "  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())\n  type TourMapRow = {"
new = "  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())\n  const [reservationOptionsPresenceByReservationId, setReservationOptionsPresenceByReservationId] =\n    useState<Map<string, boolean>>(new Map())\n  type TourMapRow = {"
if old not in text:
    raise SystemExit("not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("step1")
