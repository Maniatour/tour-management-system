import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { clearReviewProductsWithoutTourLink } = await import('../src/lib/googleReviewAdmin')
  const result = await clearReviewProductsWithoutTourLink()
  console.log('Cleared review products without tour link:', result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
