import { createLegalPage } from '@/lib/legalPageServer'

const { LegalPage, generateMetadata } = createLegalPage('terms')

export default LegalPage
export { generateMetadata }
