'use client'

import { Trash2 } from 'lucide-react'
import CustomerPageProductSearchSelect, {
  type CustomerPageProductOption,
} from '@/components/product/CustomerPageProductSearchSelect'

type Props = {
  tagQuery: string
  linkedIds: string[]
  productOptions: CustomerPageProductOption[]
  productsLoading?: boolean
  pickerValue: string | null
  onPickerChange: (productId: string | null) => void
  onLinkedIdsChange: (nextIds: string[]) => void
}

export default function HomeCategoryLinkedProductsField({
  tagQuery,
  linkedIds,
  productOptions,
  productsLoading = false,
  pickerValue,
  onPickerChange,
  onLinkedIdsChange,
}: Props) {
  const tag = tagQuery.trim()
  const optionMap = new Map(productOptions.map((option) => [option.id, option]))
  const linkedOptions = linkedIds
    .map((id) => optionMap.get(id))
    .filter((option): option is CustomerPageProductOption => option != null)

  const addProduct = (productId: string | null) => {
    if (!productId) return
    if (!tag) {
      alert('먼저 연결 태그를 입력하거나 선택하세요. 저장 시 선택한 상품에 이 태그가 추가됩니다.')
      return
    }
    if (linkedIds.includes(productId)) {
      onPickerChange(null)
      return
    }
    onLinkedIdsChange([...linkedIds, productId])
    onPickerChange(null)
  }

  return (
    <div className="space-y-2 rounded-lg border border-teal-100 bg-teal-50/40 p-3">
      <div>
        <p className="text-xs font-semibold text-teal-900">연결 상품</p>
        <p className="mt-0.5 text-[11px] text-teal-800/80">
          상품을 추가하면 저장 시 해당 상품의 태그에
          {tag ? (
            <>
              {' '}
              <span className="font-semibold">「{tag}」</span>
            </>
          ) : (
            ' 연결 태그'
          )}
          가 자동으로 붙습니다. 목록에서 제거하면 저장 시 태그가 빠집니다.
        </p>
      </div>

      <CustomerPageProductSearchSelect
        value={pickerValue}
        options={productOptions.filter((option) => !linkedIds.includes(option.id))}
        loading={productsLoading}
        placeholder="상품 검색 후 연결"
        emptyLabel={tag ? '상품 추가' : '연결 태그 먼저 설정'}
        onChange={addProduct}
      />

      {linkedOptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-[11px] text-teal-800/70">
          연결된 상품이 없습니다. 상품을 추가해 주세요.
        </p>
      ) : (
        <div className="space-y-1.5">
          {linkedOptions.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-2 rounded-lg border border-teal-100 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-900">{product.label}</p>
                {product.sublabel ? (
                  <p className="truncate text-[11px] text-gray-500">{product.sublabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onLinkedIdsChange(linkedIds.filter((id) => id !== product.id))}
                className="rounded p-1 text-red-500 hover:bg-red-50"
                aria-label="연결 해제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
