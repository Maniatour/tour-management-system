import {
  appendWyndhamLog,
  createWyndhamArtifactDir,
  saveWyndhamScreenshot,
} from '@/lib/hotels/suppliers/wyndham/artifacts'
import {
  closeWyndhamSession,
  ensureWyndhamLogin,
  gotoWyndham,
  openWyndhamSession,
  WyndhamAutomationError,
} from '@/lib/hotels/suppliers/wyndham/session'
import { WYNDHAM_SELECTORS, WYNDHAM_URLS } from '@/lib/hotels/suppliers/wyndham/selectors'
import { fillWyndhamSearchForm } from '@/lib/hotels/suppliers/wyndham/search'
import { buildWyndhamResultsUrl } from '@/lib/hotels/suppliers/wyndham/search-url'
import {
  fetchRatesViaWyndhamWorker,
  shouldUseWyndhamWorker,
} from '@/lib/hotels/suppliers/wyndham/worker-client'
import { roundMoneyUsd, toWyndhamAllInPrice } from '@/lib/hotels/suppliers/wyndham/pricing'
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
 * - Prefer running on a worker/host that supports browsers (not typical Vercel serverless)
 *
 * Default: guest/public rates (no login). Rewards login currently hits Rate Support.
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
        await gotoWyndham(session.page, WYNDHAM_URLS.home, artifact)
        await session.page.waitForTimeout(2_000)

        await fillWyndhamSearchForm(
          session.page,
          {
            destination: params.query || params.city || undefined,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
          },
          artifact
        )
        await session.page.waitForLoadState('networkidle').catch(() => undefined)
        await session.page.waitForTimeout(2_000).catch(() => undefined)

        if (await session.page.$(WYNDHAM_SELECTORS.captcha)) {
          throw new WyndhamAutomationError(
            'CAPTCHA during search — manual intervention required',
            'needs_manual'
          )
        }

        // Site-specific result parsing lives here; selectors may need updates over time.
        const results: HotelSearchResult[] = await session.page.evaluate(() => {
          const cards = Array.from(
            document.querySelectorAll(
              '[data-hotel-id], .hotel-card, .property-card, .hotel-listing'
            )
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
          'Wyndham Live가 꺼져 있습니다. .env.local에 HOTEL_WYNDHAM_LIVE=1 을 넣거나, 관리 화면에서 「요금 가져오기」로 강제 조회하세요.',
          'needs_manual'
        )
      }

      // Vercel / serverless → remote Playwright worker
      if (shouldUseWyndhamWorker()) {
        return fetchRatesViaWyndhamWorker(params)
      }

      // Public / guest rates only — Rewards login currently redirects to
      // ratesupport.wyndhamhotels.com/?improper-route and is not usable for scraping.
      const artifact = await createWyndhamArtifactDir('getRates-public')
      const overallMs = Number(process.env.WYNDHAM_SCRAPE_TIMEOUT_MS || 75_000)

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          scrapePublicRates(params, artifact),
          new Promise<HotelRateQuote[]>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new WyndhamAutomationError(
                  `Wyndham 요금 조회가 ${Math.round(overallMs / 1000)}초를 초과했습니다. 네트워크·사이트 응답을 확인 후 다시 시도하세요.`,
                  'failed'
                )
              )
            }, overallMs)
          }),
        ])
      } catch (error) {
        if (error instanceof WyndhamAutomationError) throw error
        const message = error instanceof Error ? error.message : String(error)
        throw new WyndhamAutomationError(`Wyndham 공개 요금 조회 실패: ${message}`, 'failed')
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
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
          message: available ? 'Public rates found' : 'No priced rooms found',
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

async function scrapePublicRates(
  params: RateQueryParams,
  artifact: Awaited<ReturnType<typeof createWyndhamArtifactDir>>
): Promise<HotelRateQuote[]> {
  let session: Awaited<ReturnType<typeof openWyndhamSession>> | null = null
  try {
    session = await openWyndhamSession(artifact, { useAuthState: false })
    session.page.setDefaultTimeout(20_000)
    session.page.setDefaultNavigationTimeout(45_000)

    const destination =
      params.destination ||
      (params.supplierHotelId && !params.supplierHotelId.startsWith('wyndham-offline')
        ? params.supplierHotelId
        : '')

    await appendWyndhamLog(
      artifact,
      `Guest scrape destination="${destination}" ${params.checkIn}→${params.checkOut}`
    )

    const directUrl = buildWyndhamResultsUrl({
      destination,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.guests || 1,
      rooms: params.rooms || 1,
    })

    if (directUrl) {
      await appendWyndhamLog(artifact, `Direct results URL: ${directUrl}`)
      await gotoWyndham(session.page, directUrl, artifact, {
        attempts: 2,
        timeoutMs: 45_000,
      })
    } else {
      await appendWyndhamLog(artifact, 'No destination preset — using home search form')
      await gotoWyndham(session.page, WYNDHAM_URLS.home, artifact, {
        attempts: 2,
        timeoutMs: 45_000,
      })
      await session.page.waitForTimeout(1_000)
      await fillWyndhamSearchForm(
        session.page,
        {
          destination: destination || undefined,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
        },
        artifact
      )
      await session.page
        .waitForURL(/\/hotels/i, { timeout: 40_000 })
        .catch(() => undefined)
    }

    // Prices hydrate after first paint — wait for property cards / FROM $
    await session.page.waitForLoadState('domcontentloaded').catch(() => undefined)
    await session.page
      .locator('.cmp-property-card')
      .or(session.page.getByText(/FROM\s*\$/i))
      .first()
      .waitFor({ state: 'visible', timeout: 25_000 })
      .catch(() => undefined)
    await session.page.waitForTimeout(2_000)

    const pageUrl = session.page.url()
    await appendWyndhamLog(artifact, `Results URL: ${pageUrl}`)

    if (/ratesupport\.wyndhamhotels\.com/i.test(pageUrl)) {
      throw new WyndhamAutomationError(
        'Rate Support 페이지로 이동했습니다. 게스트(비로그인) 조회로 다시 시도하세요.',
        'needs_manual'
      )
    }
    if (/404|page not found/i.test(await session.page.title().catch(() => ''))) {
      throw new WyndhamAutomationError(
        'Wyndham 검색 결과 페이지를 찾지 못했습니다 (404).',
        'failed'
      )
    }
    if (await session.page.$(WYNDHAM_SELECTORS.captcha)) {
      throw new WyndhamAutomationError('CAPTCHA 감지 — 잠시 후 다시 시도하세요.', 'needs_manual')
    }

    const scraped = (await session.page.evaluate(`(() => {
      const textOf = (el) => (el && el.textContent ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
      const cards = Array.from(document.querySelectorAll('.cmp-property-card, .hotel-details-wrapper'));
      const fromCard = cards.slice(0, 25).map((card, index) => {
        const fullText = textOf(card);
        const nameEl = card.querySelector('.hotel-name, .property-name, h2, h3, a.hotel-url');
        let name = textOf(nameEl);
        if (!name) {
          const split = fullText.split(/FROM\\s*\\$/i)[0] || '';
          name = split.trim().slice(0, 120) || ('Hotel ' + (index + 1));
        }
        name = name
          .replace(/^Photos\\s*/i, '')
          .replace(/^\\+?1[-.\\s]?\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\s*/i, '')
          .replace(/\\s+\\d+(?:\\.\\d+)?\\s*Miles.*$/i, '')
          .replace(/\\s+Wyndham Green\\s+/i, ' ')
          .trim()
          .slice(0, 100);
        const priceMatch =
          fullText.match(/FROM\\s*\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i) ||
          fullText.match(/\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)/);
        const basePrice = Number((priceMatch && priceMatch[1]) || 0);
        const taxMatch =
          fullText.match(/Taxes?\\s*&\\s*Fees?\\s*[:+]?\\s*\\$?\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i) ||
          fullText.match(/\\+\\s*Taxes?\\s*&\\s*Fees?\\s*\\$?\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i);
        const taxesAndFees = taxMatch ? Number(taxMatch[1]) : null;
        const totalMatch =
          fullText.match(/Total\\s*(?:with\\s*taxes?)?\\s*[:+]?\\s*\\$?\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i) ||
          fullText.match(/Including\\s*taxes?\\s*[:+]?\\s*\\$?\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i);
        const totalFromPage = totalMatch ? Number(totalMatch[1]) : null;
        return {
          supplierRoomId:
            card.getAttribute('data-hotel-id') ||
            card.getAttribute('data-property-id') ||
            ('property-' + index),
          roomType: name,
          price: basePrice,
          taxesAndFees,
          totalFromPage,
          isMember: false,
        };
      });
      const priced = fromCard.filter((r) => r.price > 0);
      if (priced.length) return priced;
      const body = textOf(document.body);
      const prices = [];
      const re = /FROM\\s*\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)/gi;
      let m;
      while ((m = re.exec(body))) {
        const n = Number(m[1]);
        if (n > 20 && n < 5000) prices.push(n);
      }
      return Array.from(new Set(prices)).slice(0, 10).map((price, index) => ({
        supplierRoomId: 'page-price-' + index,
        roomType: 'Listed rate',
        price: price,
        taxesAndFees: null,
        totalFromPage: null,
        isMember: false,
      }));
    })()`)) as Array<{
      supplierRoomId: string
      roomType: string
      price: number
      taxesAndFees: number | null
      totalFromPage: number | null
      isMember: boolean
    }>

    await appendWyndhamLog(artifact, `Scraped ${scraped.length} public rate row(s)`)

    if (scraped.length === 0) {
      await saveWyndhamScreenshot(artifact, session.page, 'no-rates.png')
      throw new WyndhamAutomationError(
        '검색 결과에서 요금을 찾지 못했습니다. artifacts 스크린샷을 확인하세요.',
        'needs_manual'
      )
    }

    // Prefer matching hotel name when catalog name/supplier id is available
    const needle = (params.supplierHotelId || destination || '').toLowerCase()
    const brandHint = needle.includes('wingate')
      ? 'wingate'
      : needle.includes('super 8') || needle.includes('super8')
        ? 'super 8'
        : needle.includes('la quinta')
          ? 'la quinta'
          : needle.includes('travelodge')
            ? 'travelodge'
            : needle.split(/\s+/)[0] || ''
    const ordered = [...scraped].sort((a, b) => {
      const aHit = Boolean(brandHint && a.roomType.toLowerCase().includes(brandHint))
      const bHit = Boolean(brandHint && b.roomType.toLowerCase().includes(brandHint))
      if (aHit === bHit) return a.price - b.price
      return aHit ? -1 : 1
    })

    const nights = enumerateStayDates(params.checkIn, params.checkOut)
    const quotes: HotelRateQuote[] = []
    for (const night of nights) {
      for (const room of ordered) {
        let allIn = toWyndhamAllInPrice(room.price, room.taxesAndFees)
        if (
          room.totalFromPage != null &&
          Number.isFinite(room.totalFromPage) &&
          room.totalFromPage > room.price
        ) {
          allIn = {
            basePrice: allIn.basePrice,
            taxesAndFees: roundMoneyUsd(room.totalFromPage - room.price),
            totalPrice: roundMoneyUsd(room.totalFromPage),
            taxesFromPage: true,
          }
        }
        quotes.push({
          supplier: 'wyndham',
          supplierHotelId: params.supplierHotelId || destination || 'wyndham',
          supplierRoomId: room.supplierRoomId,
          roomType: room.roomType,
          stayDate: night,
          price: allIn.totalPrice,
          currency: 'USD',
          cancellationPolicy: 'Public rate (guest scrape, taxes & fees included)',
          raw: {
            source: 'public',
            isMember: room.isMember,
            url: pageUrl,
            artifact: artifact.dir,
            direct: Boolean(directUrl),
            basePrice: allIn.basePrice,
            taxesAndFees: allIn.taxesAndFees,
            taxesFromPage: allIn.taxesFromPage,
            taxFeePercent: Number(process.env.WYNDHAM_TAX_FEE_PERCENT ?? '16.89'),
          },
        })
      }
    }
    return quotes
  } catch (error) {
    if (session) await captureFailure(session, artifact, error)
    throw error
  } finally {
    if (session) await closeWyndhamSession(session)
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
