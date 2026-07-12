import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import { useCart } from '../cart/CartContext'
import { useProducts } from '../products/useProducts'
import { useSuppliers } from '../suppliers/useSuppliers'
import { pickSupplierFor } from '../cart/pickSupplier'
import { unitPrice } from '../../lib/pricing'

export type AlertType = 'price-up' | 'price-down' | 'price-low' | 'min-order'

export interface Alert {
  id: string
  type: AlertType
  severity: 'warn' | 'info' | 'success'
  product?: string
  supplier?: string
  change?: number
  oldPrice?: number
  newPrice?: number
  price?: number
  current?: number
  needed?: number
}

interface Purchase {
  date: Date
  price: number
  qty: number
}

function useMonthPurchases() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['monthPurchases', org?.id],
    enabled: !!org,
    queryFn: async () => {
      const from = new Date()
      from.setDate(1)
      from.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('orders')
        .select('sent_at, order_items(name_snapshot, price, qty)')
        .eq('organization_id', org!.id)
        .in('status', ['sent', 'received'])
        .gte('sent_at', from.toISOString())
      if (error) throw error

      const byName = new Map<string, Purchase[]>()
      for (const order of data as { sent_at: string; order_items: { name_snapshot: string; price: number | null; qty: number }[] }[]) {
        for (const item of order.order_items) {
          if (!item.price) continue
          if (!byName.has(item.name_snapshot)) byName.set(item.name_snapshot, [])
          byName.get(item.name_snapshot)!.push({ date: new Date(order.sent_at), price: item.price, qty: item.qty })
        }
      }
      for (const list of byName.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime())
      return byName
    },
  })
}

export function useAlerts() {
  const { data: purchasesByName } = useMonthPurchases()
  const { data: products } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { quantities, supplierChoice } = useCart()
  const { data: dismissed } = useDismissedAlerts()

  return useMemo(() => {
    const alerts: Alert[] = []

    if (purchasesByName) {
      for (const [name, purchases] of purchasesByName) {
        if (!purchases.length) continue
        const first = purchases[0].price
        const last = purchases[purchases.length - 1].price
        const change = last - first
        const min = Math.min(...purchases.map((p) => p.price))
        const max = Math.max(...purchases.map((p) => p.price))
        if (change > 0.1) {
          alerts.push({ id: `price-up:${name}`, type: 'price-up', severity: 'warn', product: name, change, oldPrice: min, newPrice: max })
        } else if (change < -0.1) {
          alerts.push({ id: `price-down:${name}`, type: 'price-down', severity: 'info', product: name, change, oldPrice: max, newPrice: min })
        }
        if (last === min) {
          alerts.push({ id: `price-low:${name}`, type: 'price-low', severity: 'success', product: name, price: min })
        }
      }
    }

    if (products && suppliers) {
      const totalsBySupplier = new Map<string, number>()
      for (const [productId, qty] of Object.entries(quantities)) {
        if (qty <= 0) continue
        const product = products.find((p) => p.id === productId)
        if (!product) continue
        const supplierId = pickSupplierFor(product, supplierChoice)
        if (!supplierId) continue
        totalsBySupplier.set(supplierId, (totalsBySupplier.get(supplierId) ?? 0) + qty * unitPrice(product))
      }
      for (const [supplierId, total] of totalsBySupplier) {
        const supplier = suppliers.find((s) => s.id === supplierId)
        if (!supplier || total >= supplier.min_order_amount) continue
        alerts.push({
          id: `min-order:${supplierId}`,
          type: 'min-order',
          severity: 'warn',
          supplier: supplier.name,
          current: total,
          needed: supplier.min_order_amount - total,
        })
      }
    }

    const dismissedIds = new Set((dismissed ?? []).map((d) => d.alert_id))
    return alerts
      .filter((a) => !dismissedIds.has(a.id))
      .sort((a, b) => ({ success: 3, info: 2, warn: 1 }[b.severity] - { success: 3, info: 2, warn: 1 }[a.severity]))
  }, [purchasesByName, products, suppliers, quantities, supplierChoice, dismissed])
}

function useDismissedAlerts() {
  const { data: org } = useOrganization()
  return useQuery({
    queryKey: ['dismissedAlerts', org?.id],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await supabase.from('dismissed_alerts').select('alert_id').eq('organization_id', org!.id)
      if (error) throw error
      return data as { alert_id: string }[]
    },
  })
}

export function useDismissAlert() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from('dismissed_alerts').insert({ organization_id: org!.id, alert_id: alertId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dismissedAlerts', org?.id] }),
  })
}
