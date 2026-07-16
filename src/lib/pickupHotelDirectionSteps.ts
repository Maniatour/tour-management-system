/**
 * Direction text is stored as plain TEXT (newline / numbered-list compatible).
 * UI edits it as ordered steps.
 */

export function parseDirectionSteps(text: string | null | undefined): string[] {
  if (!text?.trim()) return []

  const normalized = text.replace(/\r\n/g, '\n').trim()

  // Split on newlines first
  let parts = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  // If a single blob with "1. 2. 3." numbering, split by number markers
  if (parts.length === 1) {
    const numbered = normalized.split(/(?:^|\s)(?=\d+[\.\)]\s+)/).map((s) => s.trim()).filter(Boolean)
    if (numbered.length > 1) parts = numbered
  }

  return parts.map((step) => step.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean)
}

export function serializeDirectionSteps(steps: string[]): string {
  return steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n')
}

export function updateDirectionStep(steps: string[], index: number, value: string): string[] {
  const next = [...steps]
  next[index] = value
  return next
}

export function addDirectionStep(steps: string[], value = ''): string[] {
  return [...steps, value]
}

export function removeDirectionStep(steps: string[], index: number): string[] {
  return steps.filter((_, i) => i !== index)
}
