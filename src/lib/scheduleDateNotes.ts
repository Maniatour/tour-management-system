export type ScheduleDateNoteEntry = {
  note: string
  created_by?: string
  /** false일 때만 가이드 스케줄 노란색 강조 비활성 (미설정·true = 강조) */
  highlight_guide_schedule?: boolean
}

export function mapScheduleDateNoteRow(row: {
  note_date: string
  note: string | null
  created_by?: string | null
  highlight_guide_schedule?: boolean | null
}): [string, ScheduleDateNoteEntry] {
  return [
    row.note_date,
    {
      note: row.note || '',
      ...(row.created_by ? { created_by: row.created_by } : {}),
      highlight_guide_schedule: row.highlight_guide_schedule !== false,
    },
  ]
}

export function shouldHighlightGuideScheduleDateNote(
  entry: ScheduleDateNoteEntry | undefined,
): boolean {
  if (!entry?.note?.trim()) return false
  return entry.highlight_guide_schedule !== false
}
