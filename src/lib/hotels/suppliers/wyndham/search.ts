import { appendWyndhamLog, type WyndhamArtifactMeta } from '@/lib/hotels/suppliers/wyndham/artifacts'
import { WYNDHAM_SELECTORS } from '@/lib/hotels/suppliers/wyndham/selectors'

/**
 * Format YYYY-MM-DD → aria-label used by Wyndham jQuery UI datepicker
 * e.g. "19 August 2026"
 */
export function toWyndhamAriaDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Invalid date: ${isoDate}`)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Fill destination + check-in/out via calendar buttons, then SEARCH.
 * en-uk does not use <input type=date> for stay dates.
 *
 * Important: after the destination field is focused, Wyndham clears the
 * `placeholder` attribute — never require placeholder in post-click locators.
 */
export async function fillWyndhamSearchForm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  params: {
    destination?: string | undefined
    checkIn: string
    checkOut: string
  },
  artifact?: WyndhamArtifactMeta
): Promise<void> {
  const debug = process.env.WYNDHAM_DEBUG === '1'
  const log = (msg: string) => {
    if (debug) console.log(`[wyndham-search] ${msg}`)
  }

  // Only dismiss obvious cookie banners — avoid generic "OK"/"Accept" which match
  // unrelated buttons and can stall the booking bar.
  log('cookies…')
  for (const label of ['Accept All Cookies', 'Accept All', 'Accept Cookies']) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click({ timeout: 3_000 }).catch(() => undefined)
      await page.waitForTimeout(300)
    }
  }

  if (params.destination?.trim()) {
    log(`destination: ${params.destination}`)
    await fillDestination(page, params.destination.trim(), artifact)
    log('destination done')
  }

  log(`checkIn: ${params.checkIn}`)
  await selectWyndhamCalendarDate(page, 'checkIn', params.checkIn, artifact)
  log(`checkOut: ${params.checkOut}`)
  await selectWyndhamCalendarDate(page, 'checkOut', params.checkOut, artifact)

  log('SEARCH click')
  const searchBtn = page.locator(WYNDHAM_SELECTORS.searchSubmit).locator('visible=true').first()
  await searchBtn.click({ force: true, timeout: 15_000 })
  if (artifact) await appendWyndhamLog(artifact, 'Clicked SEARCH')
  log('done')
}

async function fillDestination(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  destination: string,
  artifact?: WyndhamArtifactMeta
): Promise<void> {
  const dest = page.locator(WYNDHAM_SELECTORS.searchDestination).first()
  await dest.waitFor({ state: 'visible', timeout: 20_000 })
  await dest.scrollIntoViewIfNeeded().catch(() => undefined)
  await dest.click({ timeout: 10_000 })

  // Placeholder is cleared on focus — same selector without placeholder still matches
  const active = page.locator(WYNDHAM_SELECTORS.searchDestination).first()
  await active.waitFor({ state: 'visible', timeout: 5_000 })
  await active.fill('', { force: true })
  await active.focus().catch(() => undefined)
  await page.keyboard.type(destination, { delay: 35 })

  const current = await active.inputValue().catch(() => '')
  if (!current || current.length < Math.min(3, destination.length)) {
    await active.fill(destination, { force: true })
  }

  await page.waitForTimeout(1_200)

  const suggestion = page.locator(WYNDHAM_SELECTORS.destinationSuggestion).first()
  if (await suggestion.isVisible().catch(() => false)) {
    await suggestion.click({ force: true })
  } else {
    await page.keyboard.press('Enter').catch(() => undefined)
  }

  if (artifact) {
    await appendWyndhamLog(artifact, `Destination set: ${destination}`)
  }
}

async function selectWyndhamCalendarDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  which: 'checkIn' | 'checkOut',
  isoDate: string,
  artifact?: WyndhamArtifactMeta
): Promise<void> {
  const buttonSel =
    which === 'checkIn' ? 'button.check-in-button' : 'button.check-out-button'
  const aria = toWyndhamAriaDate(isoDate)
  const target = parseIso(isoDate)

  const dayLocator = () => page.locator(`td[aria-label="${aria}"]`).first()

  // Checkout often auto-opens after check-in — don't toggle it closed
  if (!(await dayLocator().isVisible().catch(() => false))) {
    const button = page.locator(buttonSel).locator('visible=true').first()
    await button.click({ force: true, timeout: 10_000 })
    await page.waitForTimeout(500)
  }

  for (let i = 0; i < 18; i++) {
    const day = dayLocator()
    if (await day.isVisible().catch(() => false)) {
      const link = day.locator('a').first()
      if ((await link.count()) > 0) await link.click({ force: true, timeout: 5_000 })
      else await day.click({ force: true, timeout: 5_000 })
      if (artifact) {
        await appendWyndhamLog(artifact, `${which} selected: ${isoDate} (${aria})`)
      }
      await page.waitForTimeout(350)
      return
    }

    const titleText =
      (await page.locator(WYNDHAM_SELECTORS.calendarTitle).first().innerText().catch(() => '')) ||
      ''
    const shown = parseMonthTitle(titleText)
    const navSel = shown && isMonthAfter(shown, target)
      ? WYNDHAM_SELECTORS.calendarPrev
      : WYNDHAM_SELECTORS.calendarNext
    // Short timeout — missing nav must not burn the default 45–60s per month step
    await page
      .locator(navSel)
      .locator('visible=true')
      .first()
      .click({ force: true, timeout: 1_500 })
      .catch(() => undefined)
    await page.waitForTimeout(300)
  }

  throw new Error(
    `Wyndham 캘린더에서 ${which} 날짜를 찾지 못했습니다: ${isoDate} (aria-label="${aria}")`
  )
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** "August 2026" / "August\u00a02026" */
function parseMonthTitle(title: string): { y: number; m: number } | null {
  const cleaned = title.replace(/\u00a0/g, ' ').trim()
  const match = cleaned.match(/([A-Za-z]+)\s+(\d{4})/)
  if (!match) return null
  const monthName = match[1]
  const y = Number(match[2])
  const m = new Date(`${monthName} 1, ${y} UTC`).getUTCMonth() + 1
  if (!y || !m) return null
  return { y, m }
}

function isMonthAfter(
  shown: { y: number; m: number },
  target: { y: number; m: number }
): boolean {
  return shown.y > target.y || (shown.y === target.y && shown.m > target.m)
}
