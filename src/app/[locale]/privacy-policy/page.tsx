import { createLegalPage } from '@/lib/legalPageServer'

const { LegalPage, generateMetadata } = createLegalPage('privacy-policy')

export default LegalPage
export { generateMetadata }
