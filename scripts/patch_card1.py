from pathlib import Path
p = Path("src/components/reservation/ReservationCardItem.tsx")
text = p.read_text(encoding="utf-8")
old = "import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, CheckCircle, XCircle, CircleCheck, User, Flag, Receipt } from 'lucide-react'"
new = "import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, CheckCircle, XCircle, CircleCheck, User, Flag, Receipt, ListChecks } from 'lucide-react'"
assert old in text
text = text.replace(old, new, 1)
old = "import ReservationFollowUpSection from '@/components/reservation/ReservationFollowUpSection'"
new = old + "\n\nimport ReservationOptionsModal from '@/components/reservation/ReservationOptionsModal'"
assert old in text
text = text.replace(old, new, 1)
old = "  onOpenTourDetailModal?: (tourId: string) => void\n\n}\n"
new = "  onOpenTourDetailModal?: (tourId: string) => void\n\n  reservationOptionsPresenceByReservationId?: Map<string, boolean>\n\n  onReservationOptionsMutated?: (reservationId: string) => void\n\n}\n"
assert old in text
text = text.replace(old, new, 1)
old = "  onOpenTourDetailModal\n\n}: ReservationCardItemProps) {"
new = "  onOpenTourDetailModal,\n\n  reservationOptionsPresenceByReservationId,\n\n  onReservationOptionsMutated\n\n}: ReservationCardItemProps) {"
assert old in text
text = text.replace(old, new, 1)
old = "  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)\n\n  const statusDropdownRef"
new = "  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)\n\n  const [reservationOptionsModalOpen, setReservationOptionsModalOpen] = useState(false)\n\n  const statusDropdownRef"
assert old in text
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("ok")
