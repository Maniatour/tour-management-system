import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { importOtaReviews } from '@/lib/otaReviewImport'
import {
  parseOtaReviewCsv,
  parseOtaReviewText,
  validateParsedOtaRows,
  type ParsedOtaReviewRow,
} from '@/lib/otaReviewParse'
import { isOtaReviewSource } from '@/lib/reviewSources'

type ImportBody = {
  source?: string
  mode?: 'paste' | 'csv' | 'rows'
  text?: string
  rows?: ParsedOtaReviewRow[]
  ratingOnly?: boolean
}

/**
 * POST /api/admin/google-business/reviews/ota-import
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: ImportBody
  try {
    body = (await request.json()) as ImportBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const source = body.source?.trim().toLowerCase() ?? ''
  if (!isOtaReviewSource(source)) {
    return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 })
  }

  let parsedRows: ParsedOtaReviewRow[] = []
  if (body.mode === 'rows' && Array.isArray(body.rows)) {
    parsedRows = body.rows
  } else if (body.mode === 'csv' && body.text) {
    parsedRows = parseOtaReviewCsv(body.text)
  } else if (body.text) {
    parsedRows = parseOtaReviewText(body.text, isOtaReviewSource(source) ? source : null)
  } else {
    return NextResponse.json({ ok: false, error: 'missing_content' }, { status: 400 })
  }

  const { valid, invalid } = validateParsedOtaRows(parsedRows, {
    ratingOnly: body.ratingOnly === true,
  })
  if (valid.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_valid_rows',
        invalidCount: invalid.length,
        invalid,
      },
      { status: 400 }
    )
  }

  try {
    const result = await importOtaReviews({
      operatorId: auth.operatorId,
      source,
      rows: valid,
      importedByEmail: auth.userEmail,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      parsedCount: parsedRows.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      invalid: invalid.slice(0, 20),
    })
  } catch (error) {
    console.error('[google-business/reviews/ota-import]', error)
    const message = error instanceof Error ? error.message : 'import_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
