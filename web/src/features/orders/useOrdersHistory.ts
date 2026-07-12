import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { Order, OrderItem } from '../../types/database'

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

export function useOrdersHistory() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['history', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('organization_id', org!.id)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as OrderWithItems[]
    },
  })
}

export function useOpenOrders() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['openOrders', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('organization_id', org!.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as OrderWithItems[]
    },
  })
}

export function useDeleteOrder() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', orderId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history', org?.id] })
      queryClient.invalidateQueries({ queryKey: ['openOrders', org?.id] })
    },
  })
}
