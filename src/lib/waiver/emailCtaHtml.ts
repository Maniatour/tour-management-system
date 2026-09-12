export type WaiverEmailCtaMode = 'request' | 'reminder'

export type WaiverEmailCta = {
  url: string
  mode: WaiverEmailCtaMode
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
}): string {
  const url = escapeHtml(input.url)
  const isReminder = input.mode === 'reminder'
  const title = input.isEnglish
    ? isReminder
      ? 'Your waiver is still unsigned'
      : 'Please sign the required tour waiver'
    : isReminder
      ? '면책 동의가 아직 완료되지 않았습니다'
      : '투어 출발 전 면책 동의서에 서명해 주세요'
  const body = input.isEnglish
    ? isReminder
      ? 'Please complete the waiver for every guest before pickup. A parent or guardian must sign for minors.'
      : 'Every guest must sign before the tour. A parent or guardian must sign for minors.'
    : isReminder
      ? '픽업 전까지 모든 참가자가 면책 동의서에 서명해 주세요. 미성년자는 보호자가 서명합니다.'
      : '모든 참가자가 투어 전에 서명해야 합니다. 미성년자는 보호자가 서명합니다.'
  const cta = input.isEnglish ? 'Sign the waiver' : '면책 동의서 작성하기'
  const border = isReminder ? '#f59e0b' : '#0B5FFF'
  const bg = isReminder ? '#fffbeb' : '#eff6ff'
  const titleColor = isReminder ? '#92400e' : '#1e3a8a'
  const bodyColor = isReminder ? '#78350f' : '#1e40af'
  const button = isReminder ? '#d97706' : '#0B5FFF'

  return `
    <div style="background:${bg};border:1px solid ${border};border-left:4px solid ${border};border-radius:8px;padding:20px 20px 18px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${titleColor};">${title}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${bodyColor};">${body}</p>
      <a href="${url}" style="display:inline-block;background:${button};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:15px;">${cta}</a>
    </div>`
}
