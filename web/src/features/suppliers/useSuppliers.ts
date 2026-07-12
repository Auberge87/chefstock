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

  return { create, update, remove }
}
