import { createLegalPage } from '@/lib/legalPageServer'

const { LegalPage, generateMetadata } = createLegalPage('cancellation-refund-policy')

export default LegalPage
export { generateMetadata }
