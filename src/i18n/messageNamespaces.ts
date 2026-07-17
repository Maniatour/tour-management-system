/** 모든 페이지에 필요한 최소 네임스페이스 */
export const I18N_CORE_NAMESPACES = ['common', 'auth', 'awayChanges'] as const

/** Admin 셸(사이드바·헤더) */
const I18N_ADMIN_SHELL_NAMESPACES = ['sidebar', 'admin', 'siteDirectory'] as const

/** Admin 화면 간 공유(대조·지출 모달 등) */
const I18N_ADMIN_SHARED_NAMESPACES = ['expenses'] as const

const ALL_LOCALE_NAMESPACE_KEYS = [
  'sidebar',
  'adminWeatherReminder',
  'adminWeatherRecords',
  'siteDirectory',
  'common',
  'products',
  'admin',
  'awayChanges',
  'attendancePage',
  'tourCourses',
  'expenses',
  'tourCostCalculator',
  'customers',
  'reservations',
  'weather',
  'booking',
  'tours',
  'reservationExpense',
  'companyExpense',
  'adminReceiptOcrParseRules',
  'adminPaidForLabels',
  'adminMaintenanceCatalog',
  'expensePaymentMethodNormalize',
  'tagTranslations',
  'channels',
  'options',
  'guide',
  'guideTour',
  'team',
  'paymentMethod',
  'vehicleMaintenance',
  'auth',
  'passUpload',
  'customerDashboard',
  'productDetail',
  'customTour',
  'reservationCheck',
  'bookingConfirmation',
  'residentCheck',
  'publicChat',
  'reservationEvidence',
  'teamBoard',
  'customerSiteFooter',
  'legalPages',
] as const

type LocaleNamespace = (typeof ALL_LOCALE_NAMESPACE_KEYS)[number]

type RouteNamespaceRule = {
  test: (pathname: string) => boolean
  namespaces: readonly LocaleNamespace[]
}

/** 긴 경로·구체적 규칙을 먼저 두고, `/admin` 등 넓은 규칙은 뒤에 둔다. */
const ROUTE_NAMESPACE_RULES: RouteNamespaceRule[] = [
  {
    test: (p) =>
      /^\/(ko|en)\/?$/.test(p) ||
      /\/products/.test(p) ||
      /\/reservation-check/.test(p) ||
      /\/booking\/confirmation/.test(p) ||
      /\/(terms|privacy-policy|sms-terms|cancellation-refund-policy)(\/|$)/.test(p),
    namespaces: [
      'customerSiteFooter',
      'legalPages',
      'products',
      'booking',
      'weather',
      'productDetail',
      'customTour',
      'reservationCheck',
      'bookingConfirmation',
    ],
  },
  {
    test: (p) => /\/admin\/(expenses|company-expenses|reservation-expenses|statement-reconciliation|partner-funds|payment-methods|expense-payment-method-normalize|receipt-ocr-parse-rules|company-expense-paid-for-labels)/.test(p),
    namespaces: [
      'expenses',
      'companyExpense',
      'reservationExpense',
      'paymentMethod',
      'expensePaymentMethodNormalize',
      'adminPaidForLabels',
      'adminReceiptOcrParseRules',
      'tours',
      'reservations',
      'booking',
      'vehicleMaintenance',
      'adminMaintenanceCatalog',
    ],
  },
  {
    test: (p) => /\/admin\/reservations/.test(p),
    namespaces: ['reservations', 'booking', 'tours', 'customers', 'products'],
  },
  {
    test: (p) => /\/admin\/(tours|tour-reports|tour-photo-buckets|tour-materials)/.test(p),
    namespaces: ['tours', 'reservations', 'guideTour', 'weather'],
  },
  {
    test: (p) => /\/admin\/booking/.test(p),
    namespaces: ['booking', 'reservations', 'tours', 'products'],
  },
  {
    test: (p) => /\/admin\/(products|coupons)/.test(p),
    namespaces: ['products', 'tagTranslations', 'options', 'channels'],
  },
  {
    test: (p) => /\/admin\/(tour-courses|tour-cost-calculator)/.test(p),
    namespaces: ['tourCourses', 'tourCostCalculator', 'tours'],
  },
  {
    test: (p) => /\/admin\/customers/.test(p),
    namespaces: ['customers', 'reservations'],
  },
  {
    test: (p) => /\/admin\/(channels|tag-translations|options)/.test(p),
    namespaces: ['channels', 'tagTranslations', 'options', 'products'],
  },
  {
    test: (p) => /\/admin\/(attendance|team(?!-)|team-chat)/.test(p),
    namespaces: ['attendancePage', 'team'],
  },
  {
    test: (p) => /\/admin\/team-board/.test(p),
    namespaces: ['teamBoard'],
  },
  {
    test: (p) => /\/admin\/(weather-records|guide-costs)/.test(p),
    namespaces: ['adminWeatherRecords', 'adminWeatherReminder', 'weather', 'guideTour'],
  },
  {
    test: (p) => /\/admin\/(vehicle-maintenance|vehicle-maintenance-catalog|vehicles|vehicle-types)/.test(p),
    namespaces: ['vehicleMaintenance', 'adminMaintenanceCatalog', 'companyExpense'],
  },
  {
    test: (p) => /\/admin\/(consultation|chat-management|data-sync|data-review|reports|suppliers|documents|sop|audit-logs|reservation-imports)/.test(p),
    namespaces: ['reservations', 'tours', 'booking', 'customers', 'companyExpense'],
  },
  {
    test: (p) => /\/admin(\/|$)/.test(p),
    namespaces: ['reservations', 'tours', 'products'],
  },
  {
    test: (p) => /\/guide/.test(p),
    namespaces: ['guide', 'guideTour', 'tours', 'weather', 'teamBoard', 'team'],
  },
  {
    test: (p) => /\/products/.test(p),
    namespaces: ['products', 'booking', 'weather', 'productDetail', 'customTour'],
  },
  {
    test: (p) => /\/resident-check/.test(p),
    namespaces: ['residentCheck', 'customerSiteFooter', 'legalPages'],
  },
  {
    test: (p) => /\/dashboard/.test(p),
    namespaces: ['passUpload', 'reservationEvidence', 'reservations', 'customerDashboard', 'residentCheck'],
  },
  {
    test: (p) => /\/(reservation-check|off-schedule|employee-contract|sop)/.test(p),
    namespaces: ['reservations', 'guide', 'reservationCheck'],
  },
]

function addNamespaces(target: Set<string>, namespaces: readonly string[]) {
  for (const ns of namespaces) {
    target.add(ns)
  }
}

/** 요청 경로에 필요한 top-level i18n 네임스페이스 목록 */
export function resolveMessageNamespaces(pathname: string): string[] {
  const set = new Set<string>(I18N_CORE_NAMESPACES)

  if (!pathname) {
    return [...ALL_LOCALE_NAMESPACE_KEYS]
  }

  if (pathname.includes('/admin')) {
    addNamespaces(set, I18N_ADMIN_SHELL_NAMESPACES)
    addNamespaces(set, I18N_ADMIN_SHARED_NAMESPACES)
  }

  for (const rule of ROUTE_NAMESPACE_RULES) {
    if (rule.test(pathname)) {
      addNamespaces(set, rule.namespaces)
    }
  }

  return [...set]
}

export function shouldLoadFullLocaleMessages(): boolean {
  return (
    process.env.I18N_LOAD_FULL_MESSAGES === '1' ||
    process.env.I18N_LOAD_FULL_MESSAGES === 'true'
  )
}
