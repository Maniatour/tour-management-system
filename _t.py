from pathlib import Path
p = Path("src/components/reservation/ReservationActionRequiredModal.tsx")
text = p.read_text(encoding="utf-8")
old = """  const [reservationOptionSumByReservationId, setReservationOptionSumByReservationId] = useState<
    Map<string, number>
  >(() => new Map())
  const [loadingPayments, setLoadingPayments] = useState(false)"""
new = """  const [reservationOptionSumByReservationId, setReservationOptionSumByReservationId] = useState<
    Map<string, number>
  >(() => new Map())
  const [reservationOptionsPresenceByReservationId, setReservationOptionsPresenceByReservationId] =
    useState<Map<string, boolean>>(() => new Map())
  const [loadingPayments, setLoadingPayments] = useState(false)"""
assert old in text
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("step1")
