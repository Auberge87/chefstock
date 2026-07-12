import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { ProductWithSuppliers } from '../products/useProducts'
import { unitPrice } from '../../lib/pricing'

export interface CartLine {
  product: ProductWithSuppliers
  qty: number
  supplierId: string
}

export function useOrderMutations() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  const sendOrder = useMutation({
    mutationFn: async ({ supplierId, lines }: { supplierId: string; lines: CartLine[] }) => {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          organization_id: org!.id,
          supplier_id: supplierId,
          status: 'sent',
          delivery_date: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single()
      if (error) throw error

      const items = lines.map((l) => ({
        order_id: order.id,
        organization_id: org!.id,
        product_id: l.product.id,
        name_snapshot: l.product.name,
        qty: l.qty,
        unit: l.product.unit,
        packaging: l.product.packaging,
        price: unitPrice(l.product),
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) throw itemsError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', org?.id] })
      queryClient.invalidateQueries({ queryKey: ['history', org?.id] })
    },
  })

  return { sendOrder }
}
