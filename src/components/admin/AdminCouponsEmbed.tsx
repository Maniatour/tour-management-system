'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Plus, Search, Ticket, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AdminCouponFormModal, { type AdminCoupon } from '@/components/admin/AdminCouponFormModal'

type AdminCouponsEmbedProps = {
  productId?: string | null
  onMutated?: () => void
  onOpenFullAdmin?: () => void
}

type ProductFilter = 'all' | 'product' | 'global'

function couponAppliesToProduct(coupon: AdminCoupon, productId: string): boolean {
  if (!coupon.product_id?.trim()) return true
  return coupon.product_id.split(',').map((id) => id.trim()).includes(productId)
}

function formatDiscount(coupon: AdminCoupon): string {
  if (coupon.discount_type === 'percentage' && coupon.percentage_value != null) {
    return `${coupon.percentage_value}%`
  }
  if (coupon.discount_type === 'fixed' && coupon.fixed_value != null) {
    return `$${coupon.fixed_value}`
  }
  return '-'
}

export default function AdminCouponsEmbed({
  productId,
  onMutated,
  onOpenFullAdmin,
}: AdminCouponsEmbedProps) {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [productFilter, setProductFilter] = useState<ProductFilter>(productId ? 'product' : 'all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null)

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoupons((data || []) as AdminCoupon[])
    } catch (error) {
      console.error('쿠폰 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 목록 조회 오류:', error)
    }
  }, [])

  useEffect(() => {
    void fetchCoupons()
    void fetchProducts()
  }, [fetchCoupons, fetchProducts])

  const getProductLabel = (productIds: string | null) => {
    if (!productIds?.trim()) return '전체 상품'
    const ids = productIds.split(',').map((id) => id.trim()).filter(Boolean)
    const names = ids.map((id) => products.find((p) => p.id === id)?.name ?? id)
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}개`
  }

  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const code = coupon.coupon_code?.toLowerCase() ?? ''
      const desc = coupon.description?.toLowerCase() ?? ''
      const matchesSearch =
        !searchTerm ||
        code.includes(searchTerm.toLowerCase()) ||
        desc.includes(searchTerm.toLowerCase())

      let matchesProduct = true
      if (productId && productFilter === 'product') {
        matchesProduct = couponAppliesToProduct(coupon, productId)
      } else if (productFilter === 'global') {
        matchesProduct = !coupon.product_id?.trim()
      }

      return matchesSearch && matchesProduct
    })
  }, [coupons, productFilter, productId, searchTerm])

  const handleAddCoupon = async (couponData: Omit<AdminCoupon, 'id' | 'created_at'>) => {
    try {
      const cleanData = {
        coupon_code: couponData.coupon_code || null,
        discount_type: couponData.discount_type || null,
        percentage_value: couponData.percentage_value || null,
        fixed_value: couponData.fixed_value || null,
        status: couponData.status || 'active',
        description: couponData.description || null,
        start_date: couponData.start_date || null,
        end_date: couponData.end_date || null,
        channel_id: couponData.channel_id || null,
        product_id: couponData.product_id || null,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('coupons').insert([cleanData])

      if (error) throw error
      setShowAddModal(false)
      await fetchCoupons()
      onMutated?.()
    } catch (error) {
      console.error('쿠폰 추가 오류:', error)
    }
  }

  const handleEditCoupon = async (
    id: string,
    couponData: Partial<Omit<AdminCoupon, 'id' | 'created_at'>>
  ) => {
    try {
      const cleanData = {
        coupon_code: couponData.coupon_code || null,
        discount_type: couponData.discount_type || null,
        percentage_value: couponData.percentage_value || null,
        fixed_value: couponData.fixed_value || null,
        status: couponData.status || 'active',
        description: couponData.description || null,
        start_date: couponData.start_date || null,
        end_date: couponData.end_date || null,
        channel_id: couponData.channel_id || null,
        product_id: couponData.product_id || null,
        updated_at: new Date().toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('coupons')
        .update(cleanData)
        .eq('id', id)

      if (error) throw error
      setEditingCoupon(null)
      await fetchCoupons()
      onMutated?.()
    } catch (error) {
      console.error('쿠폰 수정 오류:', error)
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('정말로 이 쿠폰을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id)
      if (error) throw error
      await fetchCoupons()
      onMutated?.()
    } catch (error) {
      console.error('쿠폰 삭제 오류:', error)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          고객이 상품 상세에서 입력·적용하는 실제 쿠폰입니다.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenFullAdmin ? (
            <button
              type="button"
              onClick={onOpenFullAdmin}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              쿠폰 관리 전체 화면
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            쿠폰 추가
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all' as const, label: '전체' },
            ...(productId ? [{ id: 'product' as const, label: '이 상품 적용' }] : []),
            { id: 'global' as const, label: '전체 상품용' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setProductFilter(tab.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              productFilter === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="쿠폰 코드·설명 검색"
          className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          쿠폰을 불러오는 중...
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {searchTerm ? '검색 결과가 없습니다.' : '등록된 쿠폰이 없습니다.'}
        </div>
      ) : (
        <div className="max-h-[min(42vh,360px)] space-y-2 overflow-y-auto pr-1">
          {filteredCoupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Ticket className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {coupon.coupon_code || '코드 없음'}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      coupon.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {coupon.status === 'active' ? '활성' : '비활성'}
                  </span>
                  <span className="text-xs font-medium text-primary">{formatDiscount(coupon)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {coupon.description || '설명 없음'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  적용: {getProductLabel(coupon.product_id)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingCoupon(coupon)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  title="쿠폰 편집"
                >
                  <Edit className="h-3.5 w-3.5" />
                  편집
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteCoupon(coupon.id)}
                  className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  title="쿠폰 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddModal || editingCoupon) && (
        <AdminCouponFormModal
          coupon={editingCoupon}
          stackLevel="nested"
          {...(productId ? { defaultProductId: productId } : {})}
          onClose={() => {
            setShowAddModal(false)
            setEditingCoupon(null)
          }}
          onSave={
            editingCoupon
              ? (id, data) => void handleEditCoupon(id, data)
              : (_id, data) => void handleAddCoupon(data)
          }
        />
      )}
    </div>
  )
}
