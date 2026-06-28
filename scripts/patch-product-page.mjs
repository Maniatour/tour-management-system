import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(root, 'src/app/[locale]/products/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('                {/* 일정 탭 */}')
const end = s.indexOf('                {/* FAQ 탭 */}')
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}
const replacement = `                {/* 일정 탭 */}
                {activeTab === 'itinerary' && (
                  <ProductDetailItineraryTab
                    tourCourses={tourCourses}
                    tourCoursePhotos={tourCoursePhotos}
                    isEnglish={isEnglish}
                  />
                )}

                {/* 투어 스케줄 탭 */}
                {activeTab === 'tour-schedule' && product && (
                  <TourScheduleSection 
                    productId={productId} 
                    teamType={null}
                    locale={locale}
                  />
                )}

                {/* 상세정보 탭 */}
                {activeTab === 'details' && (
                  <ProductDetailDetailsTab
                    product={product}
                    productDetails={productDetails}
                    isEnglish={isEnglish}
                    categoryLabel={getCategoryLabel(product.category || '')}
                    durationLabel={formatDuration(product.duration)}
                  />
                )}

`
s = s.slice(0, start) + replacement + s.slice(end)
fs.writeFileSync(p, s)
console.log('ok', end - start)
