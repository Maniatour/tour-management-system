import { fetchImageUploadApi } from '@/lib/uploadClient'
import type { SopDocument } from '@/types/sopStructure'

const DATA_URL_IN_MD =
  /(!?\[[^\]]*\]\()(data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+)(\))/g
const SOPIMG_DATA_URL =
  /(\[\[sopimg:[^\]]+\]\]!\[[^\]]*\]\()(data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+)(\))/g

function dataUrlToFile(dataUrl: string, index: number): File | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim())
  if (!match) return null
  const mime = match[1]
  const b64 = match[2].replace(/\s/g, '')
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const ext = mime.split('/')[1]?.replace('+xml', '') || 'png'
    return new File([bytes], `hub-manual-${Date.now()}-${index}.${ext}`, { type: mime })
  } catch {
    return null
  }
}

/** Operations Hub 메뉴얼 에디터 — /api/upload/image 로 Storage 공개 URL 확보 */
export async function uploadHubManualImageFile(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', 'hub-manuals')
  const response = await fetchImageUploadApi(formData)
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    detail?: string
    url?: string
    publicUrl?: string
    imageUrl?: string
  }
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'Image upload failed')
  }
  return payload.imageUrl || payload.url || payload.publicUrl || null
}

async function replaceDataUrlsInMarkdown(markdown: string): Promise<string> {
  if (!markdown || !markdown.includes('data:image')) return markdown

  let out = markdown
  const replacements: Array<{ from: string; to: string }> = []
  let index = 0

  const collect = (re: RegExp) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(markdown)) !== null) {
      const dataUrl = m[2]
      if (!dataUrl || replacements.some((r) => r.from === dataUrl)) continue
      replacements.push({ from: dataUrl, to: '' })
    }
  }

  collect(SOPIMG_DATA_URL)
  collect(DATA_URL_IN_MD)

  for (const item of replacements) {
    const file = dataUrlToFile(item.from, index++)
    if (!file) continue
    // API 5MB 제한 — 초과 시 원본 유지
    if (file.size > 5 * 1024 * 1024) continue
    try {
      const url = await uploadHubManualImageFile(file)
      if (url) item.to = url
    } catch (e) {
      console.warn('[hubManualImageUpload] migrate failed', e)
    }
  }

  for (const { from, to } of replacements) {
    if (!to) continue
    out = out.split(from).join(to)
  }
  return out
}

function mapDocStrings(doc: SopDocument, map: (s: string) => Promise<string>): Promise<SopDocument> {
  const walk = async (): Promise<SopDocument> => {
    const sections = await Promise.all(
      doc.sections.map(async (section) => {
        const categories = await Promise.all(
          section.categories.map(async (category) => {
            const items = category.checklist_items
              ? await Promise.all(
                  category.checklist_items.map(async (item) => ({
                    ...item,
                    title_ko: await map(item.title_ko || ''),
                    title_en: await map(item.title_en || ''),
                    ...(item.manual_ko != null ? { manual_ko: await map(item.manual_ko) } : {}),
                    ...(item.manual_en != null ? { manual_en: await map(item.manual_en) } : {}),
                  }))
                )
              : undefined
            return {
              ...category,
              title_ko: await map(category.title_ko || ''),
              title_en: await map(category.title_en || ''),
              content_ko: await map(category.content_ko || ''),
              content_en: await map(category.content_en || ''),
              ...(category.manual_ko != null ? { manual_ko: await map(category.manual_ko) } : {}),
              ...(category.manual_en != null ? { manual_en: await map(category.manual_en) } : {}),
              ...(items ? { checklist_items: items } : {}),
            }
          })
        )
        return {
          ...section,
          title_ko: await map(section.title_ko || ''),
          title_en: await map(section.title_en || ''),
          content_ko: await map(section.content_ko || ''),
          content_en: await map(section.content_en || ''),
          categories,
        }
      })
    )
    return {
      ...doc,
      title_ko: await map(doc.title_ko || ''),
      title_en: await map(doc.title_en || ''),
      sections,
      ...(doc.source_raw_ko != null
        ? { source_raw_ko: await map(doc.source_raw_ko) }
        : {}),
      ...(doc.source_raw_en != null
        ? { source_raw_en: await map(doc.source_raw_en) }
        : {}),
    }
  }
  return walk()
}

/** 문서 내 data:image 를 Storage URL로 치환 (용량·이력 부담 감소) */
export async function migrateHubDocDataImages(doc: SopDocument): Promise<SopDocument> {
  return mapDocStrings(doc, replaceDataUrlsInMarkdown)
}

export async function migrateMarkdownDataImages(markdown: string): Promise<string> {
  return replaceDataUrlsInMarkdown(markdown)
}
