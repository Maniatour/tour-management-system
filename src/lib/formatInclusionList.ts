/** 포함/불포함 텍스트 각 줄 앞에 ✓/✗ 이모지를 붙입니다. */
export function formatInclusionList(text: string, isIncluded: boolean): string {
  if (!text) return ''

  const emoji = isIncluded ? '✓' : '✗'
  const lines = text.split('\n')
  const formattedLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      formattedLines.push(line)
      continue
    }

    if (
      trimmed.startsWith('✓') ||
      trimmed.startsWith('✗') ||
      trimmed.startsWith('✅') ||
      trimmed.startsWith('❌')
    ) {
      formattedLines.push(line)
      continue
    }

    const listItemMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
    if (listItemMatch) {
      const [, indent, marker, content] = listItemMatch
      formattedLines.push(`${indent}${marker} ${emoji} ${content}`)
      continue
    }

    formattedLines.push(`${emoji} ${line}`)
  }

  return formattedLines.join('\n')
}
