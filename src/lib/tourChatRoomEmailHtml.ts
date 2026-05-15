export const TOUR_CHAT_ROOM_BASE_URL = 'https://www.kovegas.com/chat'

export function buildTourChatRoomUrl(chatRoomCode: string): string {
  return `${TOUR_CHAT_ROOM_BASE_URL}/${encodeURIComponent(chatRoomCode.trim())}`
}

/** 픽업 노티피케이션 이메일 본문에 삽입되는 Tour Chat Room 섹션 */
export function renderTourChatRoomEmailSectionHtml(
  chatRoomCode: string,
  isEnglish: boolean
): string {
  const chatUrl = buildTourChatRoomUrl(chatRoomCode)
  const mailSubject = isEnglish ? 'Tour chat room link' : '투어 채팅방 링크'
  const mailBody = isEnglish
    ? `Open the tour chat here:\n${chatUrl}`
    : `투어 채팅방 링크입니다.\n${chatUrl}`
  const mailtoShare = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`
  const waShare = `https://wa.me/?text=${encodeURIComponent(mailBody)}`
  const smsShare = `sms:?body=${encodeURIComponent(mailBody)}`

  const shareEmailLabel = isEnglish ? 'Share by email' : '이메일로 공유'
  const shareWaLabel = isEnglish ? 'Share via WhatsApp' : 'WhatsApp으로 공유'
  const shareSmsLabel = isEnglish ? 'Share via SMS' : '문자로 공유'
  const linkBlockTitle = isEnglish ? 'Chat room link' : '채팅방 주소'
  const copyHint = isEnglish
    ? 'To copy the address: on a phone, press and hold the text above; on a computer, select the line and copy (Ctrl+C / ⌘+C).'
    : '링크 복사: 모바일에서는 위 주소를 길게 눌러 복사하세요. PC에서는 위 한 줄을 드래그해 선택한 뒤 복사(Ctrl+C / ⌘+C)하세요.'
  const shareRowHint = isEnglish
    ? 'You can also open one of the options below to share this link.'
    : '아래 버튼으로 다른 앱에서 이 링크를 공유할 수 있습니다.'

  const shareBtnStyle =
    'display: inline-block; padding: 10px 14px; margin: 4px 8px 4px 0; background: #ecfdf5; color: #047857; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #6ee7b7;'

  return `
          <div class="info-box" style="background: #f0fdf4; border-left: 4px solid #10b981; margin-top: 30px; padding: 20px 22px 22px 22px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #065f46; margin: 0 0 15px 0; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
              ${isEnglish ? '💬 Tour Chat Room' : '💬 투어 채팅방'}
            </h2>
            <div style="margin-bottom: 18px;">
              <p style="color: #1e293b; line-height: 1.8; margin: 0 0 15px 0;">
                ${isEnglish
                  ? 'Join the tour chat room to communicate with your guide during pickup and view tour photos after the tour ends.'
                  : '투어 채팅방에 참여하시면 픽업 시 가이드와 연락할 수 있으며, 투어가 끝난 후 투어 사진을 이곳에서 볼 수 있습니다.'}
              </p>
              <a href="${chatUrl}" target="_blank" rel="noopener noreferrer" class="button" style="background: #10b981; display: inline-block; padding: 12px 24px; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ${isEnglish ? 'Open Tour Chat Room' : '투어 채팅방 열기'}
              </a>
            </div>
            <div style="margin-top: 4px; padding-top: 16px; border-top: 1px solid #bbf7d0;">
              <p style="font-size: 13px; font-weight: 700; color: #065f46; margin: 0 0 8px 0;">
                ${linkBlockTitle}
              </p>
              <p style="font-size: 12px; color: #0f172a; word-break: break-all; margin: 0 0 10px 0; line-height: 1.5; font-family: ui-monospace, Consolas, 'Courier New', monospace;">
                <a href="${chatUrl}" target="_blank" rel="noopener noreferrer" style="color: #047857; text-decoration: underline;">${chatUrl}</a>
              </p>
              <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0; line-height: 1.55;">
                ${copyHint}
              </p>
              <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0; line-height: 1.55;">
                ${shareRowHint}
              </p>
              <div style="margin-top: 4px;">
                <a href="${mailtoShare}" style="${shareBtnStyle}">${shareEmailLabel}</a>
                <a href="${waShare}" target="_blank" rel="noopener noreferrer" style="${shareBtnStyle}">${shareWaLabel}</a>
                <a href="${smsShare}" style="${shareBtnStyle}">${shareSmsLabel}</a>
              </div>
            </div>
            <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #d1d5db;">
              <p style="font-size: 13px; color: #6b7280; margin: 0; line-height: 1.6;">
                ${isEnglish
                  ? '📱 You can access the chat room anytime using the green button or the link above. The guide will be available to assist you during pickup, and tour photos will be shared here after the tour.'
                  : '📱 위 초록색 버튼이나 링크로 언제든지 채팅방에 접속할 수 있습니다. 픽업 시 가이드가 도움을 드리며, 투어가 끝난 후 투어 사진이 이곳에 공유됩니다.'}
              </p>
            </div>
          </div>
        `.trim()
}

export function renderTourChatRoomEmailPreviewDocument(
  chatRoomCode: string,
  isEnglish: boolean
): { subject: string; html: string; chatUrl: string } {
  const section = renderTourChatRoomEmailSectionHtml(chatRoomCode, isEnglish)
  const chatUrl = buildTourChatRoomUrl(chatRoomCode)
  const subject = isEnglish ? 'Tour Chat Room' : '투어 채팅방'
  const html = `<!DOCTYPE html>
<html lang="${isEnglish ? 'en' : 'ko'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${section}
</body>
</html>`

  return { subject, html, chatUrl }
}
