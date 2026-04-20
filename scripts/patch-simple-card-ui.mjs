import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const p = path.join(root, 'src/components/reservation/ReservationCardItem.tsx')
let s = fs.readFileSync(p, 'utf8')
const orig = s

s = s.replace(
  "import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, CheckCircle, XCircle, CircleCheck, User } from 'lucide-react'",
  "import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, CheckCircle, XCircle, CircleCheck, User, Flag, Receipt } from 'lucide-react'"
)

s = s.replace(
  `  getStatusColor, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'`,
  `  getStatusColor, 
  calculateTotalPrice,
  normalizeTourDateKey
} from '@/utils/reservationUtils'`
)

if (s === orig) {
  console.error('First block unchanged')
  process.exit(1)
}

fs.writeFileSync(p, s)
console.log('patched imports')
