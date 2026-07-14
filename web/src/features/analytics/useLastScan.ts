import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'

interface LastScanRow {
  recorded_at: string
  price: number
  products: { name: string } | null
  suppliers: { name: string; icon: string } | null
}

export function useLastScan() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['lastScan', org?.id],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_history')
        .select('recorded_at, price, products(name), suppliers(name, icon)')
        .eq('organization_id', org!.id)
        .eq('source', 'import')
        .order('recorded_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return (data as unknown as LastScanRow[])[0] ?? null
    },
  })
}
