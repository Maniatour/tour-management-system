import {
  coerceRentalConfirmationFields,
  parseBookingPriceValue,
  type RentalConfirmationOcrFields,
} from '@/lib/rentalConfirmationOcrParse'

function openaiApiKey(): string {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim() ||
    ''
  )
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

function parseVisionJson(raw: string): Partial<RentalConfirmationOcrFields> | null {
  const trimmed = raw.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null
  try {
    const row = JSON.parse(jsonText) as Record<string, unknown>
    return {
      confirmationNumber: asTrimmedString(row.confirmationNumber),
      agreementNumber: asTrimmedString(row.agreementNumber),
      driverName: asTrimmedString(row.driverName),
      rentalCompany: asTrimmedString(row.rentalCompany),
      vehicleType: asTrimmedString(row.vehicleType),
      pickupLocation: asTrimmedString(row.pickupLocation),
      pickupDate: asTrimmedString(row.pickupDate),
      pickupTime: asTrimmedString(row.pickupTime),
      returnLocation: asTrimmedString(row.returnLocation),
      returnDate: asTrimmedString(row.returnDate),
      returnTime: asTrimmedString(row.returnTime),
      bookingPrice: parseBookingPriceValue(row.bookingPrice),
    }
  } catch {
    return null
  }
}

export async function extractRentalConfirmationViaOpenAiVision(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<RentalConfirmationOcrFields | null> {
  const apiKey = openaiApiKey()
  if (!apiKey) return null

  const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
  const dataUrl = `data:${mime};base64,${imageBuffer.toString('base64')}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract rental-car reservation confirmation fields from the screenshot. Return JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'This is an Enterprise Rent-A-Car confirmation (Trip Mania / Kovegas). Sister brands Alamo/National use a similar layout — still treat these screenshots as Enterprise unless another brand logo is clearly visible.',
                'PICK-UP is a separate field from RETURN. They often sit side-by-side or stacked as PICK-UP then RETURN.',
                'Return JSON keys:',
                'confirmationNumber, agreementNumber, driverName, rentalCompany, vehicleType, pickupLocation, pickupDate, pickupTime, returnLocation, returnDate, returnTime, bookingPrice.',
                'pickupDate/returnDate must be YYYY-MM-DD from the PICK-UP and RETURN values — never the greeting "We look forward to seeing you on ...".',
                'pickupDate and returnDate are usually different. Do not copy the pickup date onto return.',
                'pickupTime/returnTime must be 24-hour HH:mm from those same PICK-UP/RETURN values.',
                'bookingPrice is Estimated Total Due at the Counter as a number such as 499.28, including the asterisk variant 499.28*. Never use the daily rate, Time & Distance subtotal, tax, or fee line items.',
                'vehicleType should include 15 Passenger Van or Ford Transit Wagon so it can map to Ford Transit 15 passenger.',
                'rentalCompany must be Enterprise for these confirmations. The word International in Harry Reid International Airport is NOT the National brand.',
                'pickupLocation should be a short name once, e.g. Harry Reid International Airport. Do not duplicate text.',
                'driverName is the Renter Details Driver Name, e.g. WOOYONG SHIM or CHULYONG SHIM. Keep the legal name from the screenshot.',
                'Use null for anything not visible. Do not invent values.',
              ].join(' '),
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`OpenAI vision failed (${response.status}): ${errText.slice(0, 240)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content || ''
  const parsed = parseVisionJson(content)
  if (!parsed) return null
  return coerceRentalConfirmationFields(parsed)
}
