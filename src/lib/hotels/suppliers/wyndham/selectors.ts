/**
 * Wyndham site selectors — isolate DOM fragility here.
 * Primary site: https://www.wyndhamhotels.com/en-uk
 * Auth host: https://login.wyndhamhotels.com/u/login
 *
 * Booking widget (en-uk home):
 * - destination: input[name=destination]
 * - check-in / check-out: calendar BUTTONS (not inputs)
 * - search: button.search-btn
 */
export const WYNDHAM_SELECTORS = {
  signInLink:
    'a[href$="#login"]:has-text("Sign In"), a:has-text("Sign In"), button:has-text("Sign In")',

  loginUsername: 'input#username[name="username"], input#username, input[name="username"]',
  loginPassword: 'input#password[name="password"], input#password, input[name="password"]',
  loginSubmit:
    'button:has-text("CONTINUE"), button:has-text("Continue"), button[type="submit"]',

  /**
   * Classic en-uk booking bar only.
   * After focus, Wyndham clears the placeholder attribute — do NOT require placeholder
   * in the locator used for fill. Exclude the aria-hidden duplicate.
   */
  searchDestination:
    'input.destination.ui-autocomplete-input:not([aria-hidden="true"])',
  destinationSuggestion:
    'ul.ui-autocomplete:not([style*="display: none"]) li.ui-menu-item, ul.ui-autocomplete li.ui-menu-item, .ui-autocomplete li',

  checkInButton: 'button.check-in-button.check-in.calendar-button, button.check-in-button',
  checkOutButton: 'button.check-out-button.check-out.calendar-button, button.check-out-button',
  calendarDay: 'td[aria-label]',
  calendarNext: '.ui-datepicker-next, a.ui-datepicker-next, button.ui-datepicker-next',
  calendarPrev: '.ui-datepicker-prev, a.ui-datepicker-prev, button.ui-datepicker-prev',
  calendarTitle: '.ui-datepicker-title',

  roomsGuestsButton: 'button.rooms-and-guests-button, button.rooms-and-guests',
  searchSubmit: 'button.search-btn.btn-primary, button.search-btn',

  rateCard: '[data-testid="rate-card"], .rate-card, .room-rate, [class*="RoomRate"], .hotel-listing, .property-card',
  ratePrice: '[data-testid="price"], .price, .rate-amount, .rate, [class*="price"]',
  confirmationNumber:
    '[data-testid="confirmation"], .confirmation-number, text=/Confirmation/i',
  captcha: 'iframe[src*="captcha"], .g-recaptcha, #captcha',
} as const

export const WYNDHAM_URLS = {
  home: process.env.WYNDHAM_HOME_URL || 'https://www.wyndhamhotels.com/en-uk',
  login: process.env.WYNDHAM_LOGIN_URL || 'https://www.wyndhamhotels.com/en-uk',
} as const
