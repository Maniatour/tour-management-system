from pathlib import Path
ROOT = Path('.')
p = ROOT / "src/hooks/useReservationData.ts"
text = p.read_text(encoding="utf-8")
old = """    return map
  }

  const TOUR_LIST_SELECT ="""
new = """    return map
  }

  const fetchReservationOptionsPresenceMap = async (reservationIds: string[]) => {
    const map = new Map<string, boolean>()
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
      const chunk = unique.slice(i, i + CHUNK_SIZE)
      for (const id of chunk) map.set(id, false)
      const { data, error } = await supabase
        .from('reservation_options')
        .select('reservation_id')
        .in('reservation_id', chunk)
      if (error) {
        console.warn('Error fetching reservation_options presence:', error)
        continue
      }
      const withRows = new Set(
        (data || []).map((r: { reservation_id: string }) => r.reservation_id).filter(Boolean)
      )
      for (const id of chunk) {
        map.set(id, withRows.has(id))
      }
    }
    return map
  }

  const TOUR_LIST_SELECT ="""
if old not in text:
    raise SystemExit("not found fetch insert")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("step2")
