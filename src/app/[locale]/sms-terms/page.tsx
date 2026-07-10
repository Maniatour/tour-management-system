import { createLegalPage } from '@/lib/legalPageServer'

const { LegalPage, generateMetadata } = createLegalPage('sms-terms')

export default LegalPage
export { generateMetadata }
