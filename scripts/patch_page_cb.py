from pathlib import Path
p = Path("src/app/[locale]/admin/reservations/page.tsx")
text = p.read_text(encoding="utf-8")
anchor = "  }, [hookToursMap])\n\n  // 상태 관리 (목록 필터"
insert = """  }, [hookToursMap])

  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void refreshReservationOptionsPresenceForIds([reservationId])
      void refreshReservationPricingForIds([reservationId])
    },
    [refreshReservationOptionsPresenceForIds, refreshReservationPricingForIds]
  )

  // 상태 관리 (목록 필터"""
if anchor not in text:
    raise SystemExit("anchor not found")
if "handleReservationOptionsMutated" in text:
    print("already has callback")
else:
    text = text.replace(anchor, insert, 1)
    p.write_text(text, encoding="utf-8")
    print("callback ok")
