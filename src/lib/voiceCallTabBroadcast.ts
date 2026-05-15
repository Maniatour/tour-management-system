/** 같은 브라우저 내 다른 탭으로 투어 음성 통화 수신 알림 */
export const VOICE_CALL_TAB_CHANNEL_NAME = 'tms-voice-call-tab'

export type VoiceCallTabBroadcastPayload =
  | {
      type: 'incoming'
      roomId: string
      tourId: string
      callerName: string
      /** 가이드 앱 내 통화·채팅으로 이동할 경로 (선행 /) */
      openPath: string
      /** Supabase 수신 탭은 이 ID와 같으면 UI·벨 중복 방지 */
      fromTabId: string
    }
  | { type: 'dismiss'; roomId: string }

let channelSingleton: BroadcastChannel | null = null

export function getVoiceCallTabBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channelSingleton) {
    channelSingleton = new BroadcastChannel(VOICE_CALL_TAB_CHANNEL_NAME)
  }
  return channelSingleton
}
