import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'

export function useReconcileOrder() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderId,
      deliveredByItemId,
      via,
    }: {
      orderId: string
      deliveredByItemId: Record<string, number>
      via: 'quick' | 'reconciled'
    }) => {
      await Promise.all(
        Object.entries(deliveredByItemId).map(([itemId, qty]) =>
          supabase.from('order_items').update({ delivered_qty: qty }).eq('id', itemId),
        ),
      )
      const { error } = await supabase
        .from('orders')
        .update({ status: 'received', received_via: via, received_at: new Date().toISOString() })
        .eq('id', orderId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openOrders', org?.id] })
      queryClient.invalidateQueries({ queryKey: ['history', org?.id] })
    },
  })
}
