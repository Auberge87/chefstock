import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'

export interface AnalyticsOrder {
  sent_at: string
  supplier_id: string
  order_items: { name_snapshot: string; price: number | null; qty: number; unit: string | null }[]
}

export function useAnalyticsOrders(rangeDays: number) {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['analyticsOrders', org?.id, rangeDays],
    enabled: !!org,
    queryFn: async (): Promise<AnalyticsOrder[]> => {
      const from = new Date()
      from.setDate(from.getDate() - rangeDays)
      const { data, error } = await supabase
        .from('orders')
        .select('sent_at, supplier_id, order_items(name_snapshot, price, qty, unit)')
        .eq('organization_id', org!.id)
        .in('status', ['sent', 'received'])
        .gte('sent_at', from.toISOString())
      if (error) throw error
      return data as AnalyticsOrder[]
    },
  })
}
