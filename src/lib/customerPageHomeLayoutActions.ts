import {
  normalizeHomePageLayout,
  type HomePageLayout,
} from '@/lib/customerPageHomeLayout'
import {
  loadCustomerPageHomeLayout,
  persistCustomerPageHomeLayout,
} from '@/lib/customerPageLayoutPersistence'
import { clearCustomerPageTemplateTracking } from '@/lib/customerPageTemplatePersistence'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'

export async function applyCustomerPageHomeLayoutUpdate(
  updater: (layout: HomePageLayout) => HomePageLayout
): Promise<HomePageLayout> {
  const current = loadCustomerPageHomeLayout()
  const next = normalizeHomePageLayout(updater(current))
  await persistCustomerPageHomeLayout(next)
  await clearCustomerPageTemplateTracking()
  emitCustomerPageBindingsUpdate()
  return next
}
