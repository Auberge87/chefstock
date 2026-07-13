import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { Supplier } from '../../types/database'

export function useSuppliers() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['suppliers', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', org!.id)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Supplier[]
    },
  })
}

export type SupplierInput = Pick<
  Supplier,
  'name' | 'icon' | 'ordering_method' | 'email' | 'phone' | 'website' | 'min_order_amount' | 'delivery_days' | 'order_deadline' | 'notes'
>

export function useSupplierMutations() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['suppliers', org?.id] })

  const create = useMutation({
    mutationFn: async (input: Partial<SupplierInput>): Promise<string> => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...input, organization_id: org!.id })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SupplierInput> & { id: string }) => {
      const { error } = await supabase.from('suppliers').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const merge = useMutation({
    mutationFn: async ({ keepId, loserIds }: { keepId: string; loserIds: string[] }) => {
      for (const loserId of loserIds) {
        if (loserId === keepId) continue

        // Reassign product<->supplier links, dropping any that would duplicate an existing one.
        const { data: links, error: linksErr } = await supabase
          .from('product_suppliers')
          .select('product_id')
          .eq('supplier_id', loserId)
        if (linksErr) throw linksErr
        for (const link of links ?? []) {
          await supabase
            .from('product_suppliers')
            .insert({ product_id: link.product_id, supplier_id: keepId, organization_id: org!.id })
            .then(() => {}, () => {}) // ignore unique-constraint conflicts (already linked to keeper)
        }
        await supabase.from('product_suppliers').delete().eq('supplier_id', loserId)

        // Point historical/open orders and each product's primary supplier at the keeper.
        const { error: ordersErr } = await supabase.from('orders').update({ supplier_id: keepId }).eq('supplier_id', loserId)
        if (ordersErr) throw ordersErr
        const { error: productsErr } = await supabase
          .from('products')
          .update({ primary_supplier_id: keepId })
          .eq('primary_supplier_id', loserId)
        if (productsErr) throw productsErr

        const { error: deactivateErr } = await supabase.from('suppliers').update({ active: false }).eq('id', loserId)
        if (deactivateErr) throw deactivateErr
      }
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['products', org?.id] })
      queryClient.invalidateQueries({ queryKey: ['history', org?.id] })
    },
  })

  return { create, update, remove, merge }
}
