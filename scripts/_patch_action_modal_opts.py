from pathlib import Path
p = Path("src/components/reservation/ReservationActionRequiredModal.tsx")
print(p.read_text(encoding="utf-8")[:200])
