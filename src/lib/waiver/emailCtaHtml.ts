export type WaiverEmailCtaMode = 'request' | 'reminder'

export type WaiverEmailCta = {
  url: string
  mode: WaiverEmailCtaMode
  signingClosed?: boolean
}

export function isSampleReservationId(reservationId: string | null | undefined): boolean {
  const id = (reservationId || '').trim()
  return !id || id.startsWith('00000000')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildWaiverEmailCtaHtml(input: {
  isEnglish: boolean
  url: string
  mode: WaiverEmailCtaMode
  signingClosed?: boolean
}): string {
  const url = escapeHtml(input.url)
  const isReminder = input.mode === 'reminder'
  const closed = input.signingClosed === true
  const title = input.isEnglish
    ? closed
      ? 'Online waiver signing is closed'
      : isReminder
        ? 'Your waiver is still unsigned'
        : 'Please sign the required tour waiver'
    : closed
      ? '온라인 면책 동의서 작성이 마감되었습니다'
      : isReminder
        ? '면책 동의가 아직 완료되지 않았습니다'
        : '투어 출발 전 면책 동의서에 서명해 주세요'
  const body = input.isEnglish
    ? closed
      ? 'Online signing closed at 6:00 PM Las Vegas time the day before your tour. Please sign the printed waiver our guide will bring on the tour day.'
      : isReminder
        ? 'Please complete the waiver for every guest by 6:00 PM Las Vegas time the day before your tour. Write each guest name in English letters only (example: Kim Minjun). A parent or guardian must sign for minors. If you cannot sign online, our guide will bring a printed form.'
        : 'Every guest must sign by 6:00 PM Las Vegas time the day before the tour. Please write each guest name in English letters only (example: Kim Minjun). A parent or guardian must sign for minors. If you cannot sign online, our guide will bring a printed form.'
    : closed
      ? '온라인 면책 동의서는 투어 전날 라스베이거스 시간 오후 6시에 마감됩니다. 가이드가 인쇄한 면책 동의서를 가져가니 투어 당일 인쇄물에 서명해 주세요.'
      : isReminder
        ? '투어 전날 라스베이거스 시간 오후 6시까지 모든 참가자가 면책 동의서에 서명해 주세요. 성명은 영문으로만 작성해 주세요. 예: Kim Minjun. 미성년자는 보호자가 서명합니다. 온라인 서명을 못 하신 경우 가이드가 인쇄물을 가져가니 인쇄물에 서명하시면 됩니다.'
        : '모든 참가자가 투어 전날 라스베이거스 시간 오후 6시까지 서명해야 합니다. 성명은 영문으로만 작성해 주세요. 예: Kim Minjun. 미성년자는 보호자가 서명합니다. 온라인 서명을 못 하신 경우 가이드가 인쇄물을 가져가니 인쇄물에 서명하시면 됩니다.'
  const cta = input.isEnglish ? 'Sign the waiver' : '면책 동의서 작성하기'
  const border = closed || isReminder ? '#f59e0b' : '#0B5FFF'
  const bg = closed || isReminder ? '#fffbeb' : '#eff6ff'
  const titleColor = closed || isReminder ? '#92400e' : '#1e3a8a'
  const bodyColor = closed || isReminder ? '#78350f' : '#1e40af'
  const button = isReminder ? '#d97706' : '#0B5FFF'

  return `
    <div style="background:${bg};border:1px solid ${border};border-left:4px solid ${border};border-radius:8px;padding:20px 20px 18px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${titleColor};">${title}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${bodyColor};">${body}</p>
      ${
        closed
          ? ''
          : `<a href="${url}" style="display:inline-block;background:${button};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:15px;">${cta}</a>`
      }
    </div>`
}
