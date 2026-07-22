'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { DollarSign } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { supabase } from '@/lib/supabase'

const PriceInventoryModal = dynamic(() => import('@/components/schedule/PriceInventoryModal'), {
  ssr: false,
  loading: () => null,
})

type ProductOption = {
  id: string
  name?: string | null
  name_ko?: string | null
}

type TeamMemberLite = {
  email: string
  nick_name?: string | null
  name_ko?: string | null
}

type PriceInventoryHeaderButtonProps = {
  className?: string
}

export default function PriceInventoryHeaderButton({ className }: PriceInventoryHeaderButtonProps) {
  const { user } = useAuth()
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpen = useCallback(async () => {
    setOpen(true)
    if (products.length > 0) return
    setLoading(true)
    try {
      const [productsRes, teamRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, name_ko')
          .eq('operator_id', activeOperatorId)
          .in('sub_category', ['Mania Tour', 'Mania Service'])
          .order('name', { ascending: true })
          .limit(2000),
        supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .eq('is_active', true)
          .order('name_ko'),
      ])

      if (productsRes.error) throw productsRes.error
      if (teamRes.error) throw teamRes.error

      setProducts((productsRes.data || []) as ProductOption[])
      setTeamMembers(
        ((teamRes.data || []) as Array<{ email?: string | null; name_ko?: string | null; nick_name?: string | null }>)
          .filter((member): member is TeamMemberLite => Boolean(member.email?.trim()))
          .map((member) => ({
            email: member.email!.trim(),
            name_ko: member.name_ko ?? null,
            nick_name: member.nick_name ?? null,
          }))
      )
    } catch (error) {
      console.error('Price & Inventory header preload failed:', error)
    } finally {
      setLoading(false)
    }
  }, [activeOperatorId, products.length])

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        disabled={loading}
        className={className}
        title="Price & Inventory"
        aria-label="Price & Inventory"
      >
        <DollarSign size={16} aria-hidden />
      </button>
      <PriceInventoryModal
        isOpen={open}
        onClose={() => setOpen(false)}
        products={products}
        userEmail={user?.email ?? null}
        teamMembers={teamMembers}
      />
    </>
  )
}
