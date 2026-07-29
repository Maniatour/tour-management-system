export const CANCEL_REBOOKING_FOLLOW_UP_REFRESH_EVENT = 'cancel-rebooking-follow-up-refresh'

export function dispatchCancelRebookingFollowUpRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CANCEL_REBOOKING_FOLLOW_UP_REFRESH_EVENT))
}
