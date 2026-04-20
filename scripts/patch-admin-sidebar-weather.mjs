import fs from 'fs'

const p = 'src/components/AdminSidebarAndHeader.tsx'
let t = fs.readFileSync(p, 'utf8')
t = t.replace(
  "  TrendingUp\n} from 'lucide-react'",
  "  TrendingUp,\n  Cloud\n} from 'lucide-react'"
)
t = t.replace(
  "import AdminTourChatNotificationListener from './admin/AdminTourChatNotificationListener'",
  "import AdminTourChatNotificationListener from './admin/AdminTourChatNotificationListener'\nimport AdminWeatherReminderModal from './admin/AdminWeatherReminderModal'"
)
t = t.replace(
  "    { name: tSidebar('dataSync'), href: `/${locale}/admin/data-sync`, icon: FileSpreadsheet },\n    { name: tSidebar('dataReview'),",
  "    { name: tSidebar('dataSync'), href: `/${locale}/admin/data-sync`, icon: FileSpreadsheet },\n    { name: tSidebar('weatherRecords'), href: `/${locale}/admin/weather-records`, icon: Cloud },\n    { name: tSidebar('dataReview'),"
)
t = t.replace(
  '      <AdminTourChatNotificationListener locale={locale} />',
  '      <AdminWeatherReminderModal locale={locale} />\n\n      <AdminTourChatNotificationListener locale={locale} />'
)
fs.writeFileSync(p, t)
console.log('patched', p)
