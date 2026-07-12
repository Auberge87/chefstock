import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { InventoryRow } from '../../types/database'

export function useInventory() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['inventory', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<InventoryRow[]> => {
      const { data, error } = await supabase.from('inventory').select('*').eq('organization_id', org!.id)
      if (error) throw error
      return data as InventoryRow[]
    },
  })
}

export function useInventoryMutations() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', org?.id] })

  const upsert = useMutation({
    mutationFn: async (row: Omit<InventoryRow, 'organization_id' | 'updated_at'>) => {
      const { error } = await supabase
        .from('inventory')
        .upsert({ ...row, organization_id: org!.id }, { onConflict: 'organization_id,product_id' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('organization_id', org!.id)
        .eq('product_id', productId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}
