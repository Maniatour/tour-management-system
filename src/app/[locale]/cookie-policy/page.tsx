import { createLegalPage } from '@/lib/legalPageServer'

const { LegalPage, generateMetadata } = createLegalPage('cookie-policy')

export default LegalPage
export { generateMetadata }
