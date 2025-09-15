type TemplateContext = Record<string, unknown>

// Very small {{path.to.value}} renderer supporting dot paths
export function renderTemplateString(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_m, key) => {
    const parts = String(key).split('.')
    let value: unknown = context
    for (const p of parts) {
      if (value && typeof value === 'object' && p in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[p]
      } else {
        value = ''
        break
      }
    }
    return value == null ? '' : String(value)
  })
}


