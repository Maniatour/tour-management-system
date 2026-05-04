import {
  type GrandCanyonSunrisePickupEmailInfo,
  formatMinutesAmPmEn,
  formatMinutesKoreanClock,
  formatYmdLong,
} from '@/lib/goblinGrandCanyonSunrisePickup'

/** Goblin Grand Canyon sunrise tour: pickup window block (예약 확인 / 출발 확정 이메일 공통). */
export function renderGrandCanyonSunrisePickupNotice(
  gc: GrandCanyonSunrisePickupEmailInfo,
  isEnglish: boolean
): string {
  const tourLong = formatYmdLong(gc.tourYmd, isEnglish)
  const pickupLong = formatYmdLong(gc.pickupYmd, isEnglish)
  const endLong = formatYmdLong(gc.pickupEndYmd, isEnglish)
  const sun = isEnglish ? formatMinutesAmPmEn(gc.sunriseMinutes) : formatMinutesKoreanClock(gc.sunriseMinutes)
  const t1 = isEnglish
    ? formatMinutesAmPmEn(gc.pickupWindowStartMinutes)
    : formatMinutesKoreanClock(gc.pickupWindowStartMinutes)
  const t2 = isEnglish
    ? formatMinutesAmPmEn(gc.pickupWindowEndMinutes)
    : formatMinutesKoreanClock(gc.pickupWindowEndMinutes)
  const sameEndDay = gc.pickupYmd === gc.pickupEndYmd
  const windowLine = sameEndDay
    ? isEnglish
      ? `${pickupLong}: ${t1} – ${t2}`
      : `${pickupLong} ${t1} ~ ${t2}`
    : isEnglish
      ? `${pickupLong} ${t1} – ${endLong} ${t2}`
      : `${pickupLong} ${t1} ~ ${endLong} ${t2}`

  const sunriseTourContext = isEnglish
    ? 'This tour is timed around <strong>sunrise at the Grand Canyon South Rim</strong>. The <strong>tour date</strong> on your reservation is the calendar date of that sunrise—not the date when hotel pickup begins. Pickup often happens the <strong>previous calendar evening</strong> so we can reach the rim in time.'
    : '\uc774 \ud22c\uc5b4\ub294 <strong>\uadf8\ub79c\ub4dc\uce90\ub2c8\uc5b8 \uc0ac\uc6b0\uc2a4\ub9bc</strong>\uc758 \uc77c\ucd9c\uc5d0 \ub9de\ucdb0 \ucd9c\ubc1c\ud558\ub294 \uc77c\uc815\uc785\ub2c8\ub2e4. \uc608\uc57d\uc5d0 \ud45c\uc2dc\ub41c <strong>\ud22c\uc5b4 \ub0a0\uc9dc</strong>\ub294 \ud638\ud154 \ud53d\uc5c5\uc774 \uc774\ub8e8\uc5b4\uc9c0\ub294 \ub2ec\ub825\uc774 \uc544\ub2c8\ub77c, \uadf8\ub79c\ub4dc\uce90\ub2c8\uc5b8\uc5d0\uc11c \ud574\ub2f9 \uc77c\ucd9c\uc774 \uc788\ub294 <strong>\ub2ec\ub825</strong>\uc744 \uae30\uc900\uc73c\ub85c \ud569\ub2c8\ub2e4. \uc77c\ucd9c \uc804 \uc800\ub141 \uc2dc\uac04\ub300\uc5d0 \ud53d\uc5c5\ud558\ub294 \uacbd\uc6b0\uac00 \ub9ce\uc2b5\ub2c8\ub2e4.'

  const sunriseTimeSource = gc.usedApproxTable
    ? isEnglish
      ? 'The sunrise time below is approximate (monthly reference) until updated with live data.'
      : '\uc544\ub798 \uc77c\ucd9c\uc740 \uc2e4\uc2dc\uac04 \ub370\uc774\ud130\uac00 \uc5c5\ub370\ud2b8\ub418\uae30 \uc804\uae4c\uc9c0 \uc6d4\ubcc4 \ucc38\uace0\uac12\uc73c\ub85c \ub300\ub7b5 \uacc4\uc0b0\ub41c \uac12\uc785\ub2c8\ub2e4.'
    : isEnglish
      ? 'The sunrise time below is for the Grand Canyon South Rim on your tour date.'
      : '\uc544\ub798 \uc77c\ucd9c\uc740 \ud22c\uc5b4 \ub0a0\uc9dc \uae30\uc900 \uadf8\ub79c\ub4dc\uce90\ub2c8\uc5b8 \uc0ac\uc6b0\uc2a4\ub9bc\uc758 \uc2dc\uac01\uc785\ub2c8\ub2e4.'

  const differentDatesBanner = gc.showDifferentDatesWarning
    ? `
            <div style="margin-top: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; border: 2px solid #ef4444;">
              <p style="margin: 0; font-size: 15px; font-weight: 800; color: #b91c1c;">
                ${
                  isEnglish
                    ? '\u26a0\ufe0f Tour date and hotel pickup date are different'
                    : '\u26a0\ufe0f \ud22c\uc5b4\uc77c\uacfc \ud638\ud154 \ud53d\uc5c5\uc77c(\ub2ec\ub825)\uc774 \ub2e4\ub985\ub2c8\ub2e4'
                }
              </p>
              <p style="margin: 10px 0 0 0; font-size: 15px; color: #7f1d1d; line-height: 1.6;">
                ${
                  isEnglish
                    ? `<strong>Tour date:</strong> ${tourLong}<br/><strong>Hotel pickup date:</strong> ${pickupLong}`
                    : `<strong>\ud22c\uc5b4\uc77c:</strong> ${tourLong}<br/><strong>\ud638\ud154 \ud53d\uc5c5\uc77c:</strong> ${pickupLong}`
                }
              </p>
            </div>`
    : ''

  const titleKo = '\uc77c\ucd9c \ud22c\uc5b4 \xb7 \ud638\ud154 \ud53d\uc5c5 \uc2dc\uac04\ub300 \uc548\ub0b4'
  const pickupWindowLabelKo = '\ud53d\uc5c5 \uc608\uc815 \uc2dc\uac04\ub300 (\ub300\ub7b5)'

  return `
    <div style="background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%); border: 3px solid #ea580c; padding: 24px; margin-bottom: 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.15);">
      <h2 style="margin: 0 0 12px 0; color: #9a3412; font-size: 20px; font-weight: 800;">
        ${isEnglish ? 'Sunrise tour · hotel pickup window' : titleKo}
      </h2>
      <p style="margin: 0 0 8px 0; color: #431407; font-size: 14px; line-height: 1.65;">${sunriseTourContext}</p>
      <p style="margin: 0 0 8px 0; color: #431407; font-size: 14px; line-height: 1.65;">${sunriseTimeSource}</p>
      <p style="margin: 0 0 16px 0; color: #431407; font-size: 15px;">
        <strong>${isEnglish ? 'Approx. sunrise:' : '\uc608\uc0c1 \uc77c\ucd9c:'}</strong> ${sun}
      </p>
      <div style="padding: 16px; background: white; border-radius: 8px; border-left: 5px solid #ea580c;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #9a3412; text-transform: uppercase;">
          ${isEnglish ? 'Estimated pickup window (rough)' : pickupWindowLabelKo}
        </p>
        <p style="margin: 0; font-size: 18px; font-weight: 800; color: #c2410c; line-height: 1.5;">
          ${windowLine}
        </p>
      </div>
      ${differentDatesBanner}
      <p style="margin: 16px 0 0 0; font-size: 14px; color: #78350f; line-height: 1.65;">
        ${
          isEnglish
            ? 'Pickup order and exact times depend on how many hotels and where guests are staying. This window is only a rough guide.'
            : '\ucc38\uac00 \uc778\uc6d0\uc758 \ud638\ud154 \uc218\xb7\uc704\uce58\uc5d0 \ub530\ub77c \uc21c\uc11c\uc640 \uc2dc\uac01\uc774 \ub2ec\ub77c\uc9c8 \uc218 \uc788\uc5b4, \uc704 \uc2dc\uac04\uc740 \ucc38\uace0\uc6a9 \ub300\ub7b5 \uc548\ub0b4\uc785\ub2c8\ub2e4.'
        }
      </p>
      <p style="margin: 12px 0 0 0; font-size: 14px; color: #78350f; line-height: 1.65; font-weight: 600;">
        ${
          isEnglish
            ? 'We will send your exact pickup time again in a pickup notification email about 48 hours before the tour starts.'
            : '\uc815\ud655\ud55c \ud53d\uc5c5 \uc2dc\uac01\uc740 \ud22c\uc5b4 \uc2dc\uc791 48\uc2dc\uac04 \uc804\uc5d0 \ubc1c\uc1a1\ub4dc\ub9ac\ub294 \ud53d\uc5c5 \uc548\ub0b4(pickup notification) \uc774\uba54\uc77c\uc5d0\uc11c \ub2e4\uc2dc \uc548\ub0b4\ub4dc\ub9bd\ub2c8\ub2e4.'
        }
      </p>
    </div>`
}

/** Compact row for reservation card in email when tour vs pickup calendar differs. */
export function renderGrandCanyonSunriseDateHighlightRow(
  gc: GrandCanyonSunrisePickupEmailInfo,
  isEnglish: boolean
): string {
  const pickupLong = formatYmdLong(gc.pickupYmd, isEnglish)
  const border = gc.showDifferentDatesWarning ? '#ef4444' : '#f59e0b'
  const bg = gc.showDifferentDatesWarning ? '#fef2f2' : '#fffbeb'
  const color = gc.showDifferentDatesWarning ? '#b91c1c' : '#92400e'
  const label = isEnglish ? 'Hotel pickup date (calendar)' : '\ud638\ud154 \ud53d\uc5c5\uc77c(\ub2ec\ub825)'
  return `
          <div style="padding: 14px; border-radius: 8px; border: 2px solid ${border}; background: ${bg}; margin-top: 4px;">
            <div style="font-size: 12px; color: ${color}; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">
              ${label}
            </div>
            <div style="font-size: 17px; font-weight: 800; color: ${color};">
              ${pickupLong}
            </div>
          </div>`
}
