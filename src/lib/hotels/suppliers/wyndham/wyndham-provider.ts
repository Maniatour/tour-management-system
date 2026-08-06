import {
  appendWyndhamLog,
  createWyndhamArtifactDir,
  saveWyndhamScreenshot,
} from '@/lib/hotels/suppliers/wyndham/artifacts'
import {
  closeWyndhamSession,
  ensureWyndhamLogin,
  openWyndhamSession,
  WyndhamAutomationError,
} from '@/lib/hotels/suppliers/wyndham/session'
import { WYNDHAM_SELECTORS, WYNDHAM_URLS } from '@/lib/hotels/suppliers/wyndham/selectors'
import { enumerateStayDates } from '@/lib/hotels/suppliers/dry-run-supplier'
import type { HotelSupplier } from '@/lib/hotels/suppliers/types'
import type {
  AvailabilityParams,
  AvailabilityResult,
  CancelReservationParams,
  CancelResult,
  CreateReservationParams,
  HotelRateQuote,
  HotelSearchParams,
  HotelSearchResult,
  RateQueryParams,
  ReservationStatusResult,
  StatusParams,
  SupplierReservationResult,
} from '@/lib/hotels/types'

/**
 * Wyndham hotel supplier via Playwright browser automation.
 * All Wyndham-specific logic stays in this folder — never leak into HotelManager.
 *
 * Live automation requires:
 * - playwright + chromium installed
 * - WYNDHAM_LOGIN_EMAIL / WYNDHAM_LOGIN_PASSWORD
 * - Prefer running on a worker/host that supports browsers (not typical Vercel serverless)
 *
 * When live is disabled or automation fails with CAPTCHA, returns needs_manual.
 */
export function createWyndhamProvider(opts?: {
  live?: boolean
}): HotelSupplier {
  const live =
    opts?.live === true ||
    process.env.HOTEL_WYNDHAM_LIVE === '1'

  return {
    code: 'wyndham',

    async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]> {
      if (!live) {
        return [
          {
            supplier: 'wyndham',
            supplierHotelId: params.query || 'wyndham-offline',
            name: params.query || 'Wyndham (offline mode)',
            city: params.city,
            country: 'US',
            raw: { live: false },
          },
        ]
      }

      const artifact = await createWyndhamArtifactDir('searchHotels')
      let session: Awaited<ReturnType<typeof openWyndhamSession>> | null = null
      try {
        session = await openWyndhamSession(artifact)
        await ensureWyndhamLogin(session, artifact)
        await session.page.goto(WYNDHAM_URLS.home, { waitUntil: 'domcontentloaded' })

        if (params.city || params.query) {
          const dest = params.query || params.city || ''
          await session.page.fill(WYNDHAM_SELECTORS.searchDestination, dest)
        }
        await session.page.fill(WYNDHAM_SELECTORS.checkIn, params.checkIn)
        await session.page.fill(WYNDHAM_SELECTORS.checkOut, params.checkOut)
        if (params.rooms != null) {
          await session.page
            .fill(WYNDHAM_SELECTORS.rooms, String(params.rooms))
            .catch(() => undefined)
        }
        if (params.guests != null) {
          await session.page
            .fill(WYNDHAM_SELECTORS.guests, String(params.guests))
            .catch(() => undefined)
        }
        await session.page.click(WYNDHAM_SELECTORS.searchSubmit)
        await session.page.waitForLoadState('networkidle').catch(() => undefined)

        if (await session.page.$(WYNDHAM_SELECTORS.captcha)) {
          throw new WyndhamAutomationError(
            'CAPTCHA during search — manual intervention required',
            'needs_manual'
          )
        }

        // Site-specific result parsing lives here; selectors may need updates over time.
        const results: HotelSearchResult[] = await session.page.evaluate(() => {
          const cards = Array.from(
            document.querySelectorAll('[data-hotel-id], .hotel-card, .property-card')
          )
          return cards.slice(0, 20).map((el, index) => {
            const id =
              el.getAttribute('data-hotel-id') ||
              el.getAttribute('data-property-id') ||
              `wyndham-result-${index}`
            const name =
              el.querySelector('h2, h3, .hotel-name, .property-name')?.textContent?.trim() ||
              'Wyndham property'
            return {
              supplier: 'wyndham' as const,
              supplierHotelId: id,
              name,
              raw: { scraped: true },
            }
          })
        })

        await appendWyndhamLog(artifact, `searchHotels found ${results.length} results`)
        return results
      } catch (error) {
        return handleSearchError(error, session, artifact)
      } finally {
        if (session) await closeWyndhamSession(session)
      }
    },

    async getRates(params: RateQueryParams): Promise<HotelRateQuote[]> {
      if (!live) {
        throw new WyndhamAutomationError(
          'Wyndham Live가 꺼져 있습니다. .env.local에 HOTEL_WYNDHAM_LIVE=1 과 WYNDHAM_LOGIN_EMAIL / WYNDHAM_LOGIN_PASSWORD를 설정하거나, 관리 화면에서 「멤버 요금 가져오기」로 강제 조회하세요.',
          'needs_manual'
        )
      }

      if (!process.env.WYNDHAM_LOGIN_EMAIL || !process.env.WYNDHAM_LOGIN_PASSWORD) {
        throw new WyndhamAutomationError(
          'WYNDHAM_LOGIN_EMAIL / WYNDHAM_LOGIN_PASSWORD가 없습니다. 멤버 요금을 보려면 Wyndham Rewards 계정으로 로그인해야 합니다.',
          'needs_manual'
        )
      }

      const artifact = await createWyndhamArtifactDir('getRates-member')
      let session: Awaited<ReturnType<typeof openWyndhamSession>> | null = null
      try {
        session = await openWyndhamSession(artifact)
        await appendWyndhamLog(artifact, 'Logging in for member rates…')
        await ensureWyndhamLogin(session, artifact)

        await session.page.goto(WYNDHAM_URLS.home, { waitUntil: 'domcontentloaded' })

        const destination =
          params.destination ||
          (params.supplierHotelId && !params.supplierHotelId.startsWith('wyndham-offline')
            ? params.supplierHotelId
            : '')

        if (destination) {
          await session.page
            .fill(WYNDHAM_SELECTORS.searchDestination, destination)
            .catch(() => undefined)
        }

        await session.page.fill(WYNDHAM_SELECTORS.checkIn, params.checkIn).catch(async () => {
          await session!.page.locator(WYNDHAM_SELECTORS.checkIn).fill(params.checkIn)
        })
        await session.page.fill(WYNDHAM_SELECTORS.checkOut, params.checkOut).catch(async () => {
          await session!.page.locator(WYNDHAM_SELECTORS.checkOut).fill(params.checkOut)
        })

        if (params.rooms != null) {
          await session.page
            .fill(WYNDHAM_SELECTORS.rooms, String(params.rooms))
            .catch(() => undefined)
        }
        if (params.guests != null) {
          await session.page
            .fill(WYNDHAM_SELECTORS.guests, String(params.guests))
            .catch(() => undefined)
        }

        await session.page.click(WYNDHAM_SELECTORS.searchSubmit)
        await session.page.waitForLoadState('networkidle').catch(() => undefined)
        await session.page.waitForTimeout(2_000).catch(() => undefined)

        if (await session.page.$(WYNDHAM_SELECTORS.captcha)) {
          throw new WyndhamAutomationError(
            'CAPTCHA 감지 — 브라우저에서 수동 로그인 후 auth-state를 저장하거나 다시 시도하세요.',
            'needs_manual'
          )
        }

        const scraped = await session.page.evaluate((sel: typeof WYNDHAM_SELECTORS) => {
          const textOf = (el: Element | null | undefined) =>
            el?.textContent?.replace(/\s+/g, ' ').trim() || ''

          const cards = Array.from(
            document.querySelectorAll(
              [
                sel.rateCard,
                '[data-testid*="rate"]',
                '.rate-card',
                '.room-rate',
                '.room-card',
                '[class*="RoomRate"]',
                '[class*="member-rate"]',
              ].join(', ')
            )
          )

          const rows = cards.slice(0, 20).map((card, index) => {
            const fullText = textOf(card)
            const isMember = /member|rewards|wyndham.?rewards|멤버/i.test(fullText)
            const priceMatch = fullText.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/)
            const priceFromSel =
              card.querySelector(sel.ratePrice)?.textContent?.replace(/[^0-9.]/g, '') || ''
            const price = Number(priceFromSel || priceMatch?.[1] || 0)
            const roomType =
              textOf(card.querySelector('.room-name, h3, h4, [class*="room-type"]')) ||
              (isMember ? 'Member rate' : 'Room')
            return {
              supplierRoomId: card.getAttribute('data-room-id') || `room-${index}`,
              roomType: isMember ? `Member · ${roomType}` : roomType,
              price,
              isMember,
            }
          })

          // Prefer member-priced rows; fall back to any priced row
          const memberRows = rows.filter((r) => r.isMember && r.price > 0)
          const priced = rows.filter((r) => r.price > 0)
          return (memberRows.length ? memberRows : priced).slice(0, 10)
        }, WYNDHAM_SELECTORS)

        await appendWyndhamLog(
          artifact,
          `Scraped ${scraped.length} rate row(s); member-preferred`
        )

        if (scraped.length === 0) {
          await saveWyndhamScreenshot(artifact, session.page, 'no-rates.png')
          throw new WyndhamAutomationError(
            '로그인 후 요금 카드를 찾지 못했습니다. 셀렉터/페이지 구조 변경 가능 — artifacts 스크린샷을 확인하세요.',
            'needs_manual'
          )
        }

        const nights = enumerateStayDates(params.checkIn, params.checkOut)
        const quotes: HotelRateQuote[] = []
        for (const night of nights) {
          for (const room of scraped) {
            quotes.push({
              supplier: 'wyndham',
              supplierHotelId: params.supplierHotelId,
              supplierRoomId: room.supplierRoomId,
              roomType: room.roomType,
              stayDate: night,
              price: room.price,
              currency: 'USD',
              cancellationPolicy: 'Member rate (logged-in scrape)',
              raw: { scraped: true, isMember: room.isMember, artifact: artifact.dir },
            })
          }
        }
        return quotes
      } catch (error) {
        await captureFailure(session, artifact, error)
        throw error
      } finally {
        if (session) await closeWyndhamSession(session)
      }
    },

    async checkAvailability(params: AvailabilityParams): Promise<AvailabilityResult> {
      try {
        const quotes = await this.getRates(params)
        const available = quotes.some((q) => q.price > 0)
        return {
          available,
          supplier: 'wyndham',
          supplierHotelId: params.supplierHotelId,
          quotes,
          message: available ? 'Member rates found' : 'No priced rooms found',
        }
      } catch (error) {
        if (error instanceof WyndhamAutomationError && error.kind === 'needs_manual') {
          return {
            available: false,
            supplier: 'wyndham',
            supplierHotelId: params.supplierHotelId,
            message: error.message,
          }
        }
        throw error
      }
    },

    async createReservation(
      params: CreateReservationParams
    ): Promise<SupplierReservationResult> {
      if (!live || params.dryRun) {
        return {
          ok: true,
          status: 'needs_manual',
          supplier: 'wyndham',
          message:
            'Wyndham live booking is gated. Set HOTEL_WYNDHAM_LIVE=1 and complete flow on a browser worker, or finish manually.',
          needsManualIntervention: true,
          raw: { params, live },
        }
      }

      const artifact = await createWyndhamArtifactDir('createReservation')
      let session: Awaited<ReturnType<typeof openWyndhamSession>> | null = null
      try {
        session = await openWyndhamSession(artifact)
        await ensureWyndhamLogin(session, artifact)
        // Full booking path is property-specific; keep confirmation capture here.
        await appendWyndhamLog(
          artifact,
          `Reservation flow started for ${params.supplierHotelId} ${params.checkIn}→${params.checkOut}`
        )

        if (await session.page.$(WYNDHAM_SELECTORS.captcha)) {
          throw new WyndhamAutomationError(
            'CAPTCHA during booking — manual intervention required',
            'needs_manual'
          )
        }

        const confirmation = await session.page
          .locator(WYNDHAM_SELECTORS.confirmationNumber)
          .first()
          .textContent({ timeout: 5_000 })
          .catch(() => null)

        if (!confirmation) {
          throw new WyndhamAutomationError(
            'Confirmation number not found — complete booking manually',
            'needs_manual'
          )
        }

        const confirmationNumber = confirmation.replace(/[^A-Z0-9-]/gi, '').trim()
        return {
          ok: true,
          status: 'confirmed',
          supplier: 'wyndham',
          confirmationNumber,
          artifactPath: artifact.dir,
          raw: { confirmation },
        }
      } catch (error) {
        const artifactPath = await captureFailure(session, artifact, error)
        if (error instanceof WyndhamAutomationError && error.kind === 'needs_manual') {
          return {
            ok: false,
            status: 'needs_manual',
            supplier: 'wyndham',
            message: error.message,
            artifactPath,
            needsManualIntervention: true,
          }
        }
        return {
          ok: false,
          status: 'failed',
          supplier: 'wyndham',
          message: error instanceof Error ? error.message : 'Wyndham booking failed',
          artifactPath,
        }
      } finally {
        if (session) await closeWyndhamSession(session)
      }
    },

    async cancelReservation(params: CancelReservationParams): Promise<CancelResult> {
      if (!live) {
        return {
          ok: false,
          status: 'needs_manual',
          message: `Cancel ${params.confirmationNumber} manually (Wyndham live off)`,
        }
      }
      return {
        ok: false,
        status: 'needs_manual',
        message: `Automated cancel not fully implemented — cancel ${params.confirmationNumber} on Wyndham and update status`,
      }
    },

    async getReservationStatus(params: StatusParams): Promise<ReservationStatusResult> {
      return {
        status: live ? 'pending' : 'needs_manual',
        confirmationNumber: params.confirmationNumber,
        supplier: 'wyndham',
        message: live
          ? 'Status scrape not fully implemented — verify on Wyndham'
          : 'Wyndham live mode disabled',
      }
    },
  }
}

async function handleSearchError(
  error: unknown,
  session: Awaited<ReturnType<typeof openWyndhamSession>> | null,
  artifact: Awaited<ReturnType<typeof createWyndhamArtifactDir>>
): Promise<HotelSearchResult[]> {
  await captureFailure(session, artifact, error)
  if (error instanceof WyndhamAutomationError && error.kind === 'needs_manual') {
    return []
  }
  throw error
}

async function captureFailure(
  session: Awaited<ReturnType<typeof openWyndhamSession>> | null,
  artifact: Awaited<ReturnType<typeof createWyndhamArtifactDir>>,
  error: unknown
): Promise<string> {
  const message = error instanceof Error ? error.message : String(error)
  await appendWyndhamLog(artifact, `ERROR: ${message}`)
  if (session?.page) {
    await saveWyndhamScreenshot(artifact, session.page).catch(() => undefined)
  }
  return artifact.dir
}
