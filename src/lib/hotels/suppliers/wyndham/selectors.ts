/**
 * Wyndham site selectors — isolate DOM fragility here.
 * When Wyndham.com changes, update only this file (+ related flow modules).
 */
export const WYNDHAM_SELECTORS = {
  loginEmail: 'input[type="email"], input[name="email"], #email',
  loginPassword: 'input[type="password"], input[name="password"], #password',
  loginSubmit: 'button[type="submit"], button:has-text("Sign In")',
  searchDestination: 'input[name="destination"], input[placeholder*="Destination"]',
  checkIn: 'input[name="checkIn"], input[data-testid="check-in"]',
  checkOut: 'input[name="checkOut"], input[data-testid="check-out"]',
  rooms: 'select[name="rooms"], input[name="rooms"]',
  guests: 'select[name="adults"], input[name="adults"]',
  searchSubmit: 'button[type="submit"], button:has-text("Search")',
  rateCard: '[data-testid="rate-card"], .rate-card, .room-rate',
  ratePrice: '[data-testid="price"], .price, .rate-amount',
  confirmationNumber: '[data-testid="confirmation"], .confirmation-number, text=/Confirmation/i',
  captcha: 'iframe[src*="captcha"], .g-recaptcha, #captcha',
} as const

export const WYNDHAM_URLS = {
  home: process.env.WYNDHAM_HOME_URL || 'https://www.wyndhamhotels.com',
  login: process.env.WYNDHAM_LOGIN_URL || 'https://www.wyndhamhotels.com/login',
} as const
