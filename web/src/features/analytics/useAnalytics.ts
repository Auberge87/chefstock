import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import { useProducts } from '../products/useProducts'
import { useSuppliers } from '../suppliers/useSuppliers'

export interface AnalyticsOrderItem {
  product_id: string | null
  name_snapshot: string
  qty: number
  unit: string | null
  price: number | null
}

export interface AnalyticsOrder {
  id: string
  sent_at: string
  supplier_id: string
  order_items: AnalyticsOrderItem[]
}

/** Fetches the organization's full order history once; all stats below are derived client-side from this. */
export function useAnalyticsOrders() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['analyticsOrders', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<AnalyticsOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, sent_at, supplier_id, order_items(product_id, name_snapshot, qty, unit, price)')
        .eq('organization_id', org!.id)
        .in('status', ['sent', 'received'])
        .order('sent_at', { ascending: true })
      if (error) throw error
      return data as AnalyticsOrder[]
    },
  })
}

export interface SupplierSlice {
  supplierId: string
  qty: number
  spend: number
}

export interface ProductStat {
  key: string
  productId: string | null
  name: string
  unit: string | null
  category: string | null
  active: boolean
  totalQty: number
  totalSpend: number
  ordersCount: number
  avgPricePerUnit: number | null
  minPrice: number | null
  maxPrice: number | null
  priceChangePct: number | null
  priceChangeSince: Date | null
  priceDirection: 'up' | 'down' | 'flat' | null
  avgWeekly: number
  avgMonthly: number
  spendThisWeek: number
  spendThisMonth: number
  spendThisYear: number
  qtyThisWeek: number
  qtyThisMonth: number
  qtyThisYear: number
  supplierBreakdown: SupplierSlice[]
  topSupplierId: string | null
  lastPurchaseDate: Date | null
  kgPerUnit: number | null
  priceHistory: { date: Date; price: number }[]
}

export interface SupplierProductSlice {
  key: string
  productId: string | null
  name: string
  unit: string | null
  qty: number
  spend: number
}

export interface SupplierStat {
  supplierId: string
  name: string
  icon: string
  spendThisWeek: number
  spendThisMonth: number
  spendThisYear: number
  spendAllTime: number
  ordersCount: number
  avgOrderValue: number
  lastOrderDate: Date | null
  topProducts: SupplierProductSlice[]
}

export interface PurchasingStats {
  isLoading: boolean
  totalSpendThisWeek: number
  totalSpendThisMonth: number
  totalSpendThisYear: number
  ordersThisWeek: number
  ordersThisMonth: number
  ordersThisYear: number
  products: ProductStat[]
  suppliers: SupplierStat[]
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // Monday = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}
function startOfMonth(d: Date) {
  const date = new Date(d)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}
function startOfYear(d: Date) {
  const date = new Date(d)
  date.setMonth(0, 1)
  date.setHours(0, 0, 0, 0)
  return date
}
function daysAgo(d: Date, days: number) {
  const date = new Date(d)
  date.setDate(date.getDate() - days)
  return date
}

interface PricePoint {
  date: Date
  price: number
  qty: number
}

/** Weighted-average price of points inside [from, to). Returns null if no priced points fall in range. */
function weightedAvgPrice(points: PricePoint[], from: Date, to: Date): number | null {
  let spend = 0
  let qty = 0
  for (const p of points) {
    if (p.date >= from && p.date < to && p.price > 0 && p.qty > 0) {
      spend += p.price * p.qty
      qty += p.qty
    }
  }
  return qty > 0 ? spend / qty : null
}

export function usePurchasingStats(): PurchasingStats {
  const { data: orders, isLoading: ordersLoading } = useAnalyticsOrders()
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers()

  const stats = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now)
    const monthStart = startOfMonth(now)
    const yearStart = startOfYear(now)
    const twelveWeeksAgo = daysAgo(now, 84)
    const sixMonthsAgo = daysAgo(now, 182)
    const thirtyDaysAgo = daysAgo(now, 30)
    const sixtyDaysAgo = daysAgo(now, 60)

    interface ProductAcc {
      key: string
      productId: string | null
      name: string
      unit: string | null
      totalQty: number
      totalSpend: number
      ordersCount: number
      qtyThisWeek: number
      qtyThisMonth: number
      qtyThisYear: number
      spendThisWeek: number
      spendThisMonth: number
      spendThisYear: number
      qty12w: number
      qty6m: number
      pricePoints: PricePoint[]
      supplierBreakdown: Map<string, SupplierSlice>
      lastPurchaseDate: Date | null
    }
    interface SupplierAcc {
      supplierId: string
      spendThisWeek: number
      spendThisMonth: number
      spendThisYear: number
      spendAllTime: number
      orderIds: Set<string>
      lastOrderDate: Date | null
      products: Map<string, SupplierProductSlice>
    }

    const productAcc = new Map<string, ProductAcc>()
    const supplierAcc = new Map<string, SupplierAcc>()

    let totalSpendThisWeek = 0
    let totalSpendThisMonth = 0
    let totalSpendThisYear = 0
    const ordersThisWeekIds = new Set<string>()
    const ordersThisMonthIds = new Set<string>()
    const ordersThisYearIds = new Set<string>()

    for (const order of orders ?? []) {
      const date = new Date(order.sent_at)
      const inWeek = date >= weekStart
      const inMonth = date >= monthStart
      const inYear = date >= yearStart

      let sAcc = supplierAcc.get(order.supplier_id)
      if (!sAcc) {
        sAcc = {
          supplierId: order.supplier_id,
          spendThisWeek: 0,
          spendThisMonth: 0,
          spendThisYear: 0,
          spendAllTime: 0,
          orderIds: new Set(),
          lastOrderDate: null,
          products: new Map(),
        }
        supplierAcc.set(order.supplier_id, sAcc)
      }
      sAcc.orderIds.add(order.id)
      if (!sAcc.lastOrderDate || date > sAcc.lastOrderDate) sAcc.lastOrderDate = date

      for (const item of order.order_items) {
        const qty = item.qty || 0
        const price = item.price || 0
        const lineTotal = qty * price
        const key = item.product_id ?? `name:${item.name_snapshot}`

        let pAcc = productAcc.get(key)
        if (!pAcc) {
          pAcc = {
            key,
            productId: item.product_id,
            name: item.name_snapshot,
            unit: item.unit,
            totalQty: 0,
            totalSpend: 0,
            ordersCount: 0,
            qtyThisWeek: 0,
            qtyThisMonth: 0,
            qtyThisYear: 0,
            spendThisWeek: 0,
            spendThisMonth: 0,
            spendThisYear: 0,
            qty12w: 0,
            qty6m: 0,
            pricePoints: [],
            supplierBreakdown: new Map(),
            lastPurchaseDate: null,
          }
          productAcc.set(key, pAcc)
        }
        pAcc.totalQty += qty
        pAcc.totalSpend += lineTotal
        pAcc.ordersCount += 1
        pAcc.name = item.name_snapshot
        pAcc.unit = item.unit ?? pAcc.unit
        if (!pAcc.lastPurchaseDate || date > pAcc.lastPurchaseDate) pAcc.lastPurchaseDate = date
        if (date >= twelveWeeksAgo) pAcc.qty12w += qty
        if (date >= sixMonthsAgo) pAcc.qty6m += qty
        if (inWeek) {
          pAcc.qtyThisWeek += qty
          pAcc.spendThisWeek += lineTotal
        }
        if (inMonth) {
          pAcc.qtyThisMonth += qty
          pAcc.spendThisMonth += lineTotal
        }
        if (inYear) {
          pAcc.qtyThisYear += qty
          pAcc.spendThisYear += lineTotal
        }
        if (price > 0) pAcc.pricePoints.push({ date, price, qty })

        const slice = pAcc.supplierBreakdown.get(order.supplier_id) ?? { supplierId: order.supplier_id, qty: 0, spend: 0 }
        slice.qty += qty
        slice.spend += lineTotal
        pAcc.supplierBreakdown.set(order.supplier_id, slice)

        const supProd = sAcc.products.get(key) ?? { key, productId: item.product_id, name: item.name_snapshot, unit: item.unit, qty: 0, spend: 0 }
        supProd.qty += qty
        supProd.spend += lineTotal
        sAcc.products.set(key, supProd)

        totalSpendThisWeek += inWeek ? lineTotal : 0
        totalSpendThisMonth += inMonth ? lineTotal : 0
        totalSpendThisYear += inYear ? lineTotal : 0
      }

      if (inWeek) ordersThisWeekIds.add(order.id)
      if (inMonth) ordersThisMonthIds.add(order.id)
      if (inYear) ordersThisYearIds.add(order.id)

      sAcc.spendThisWeek += inWeek ? order.order_items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0) : 0
      sAcc.spendThisMonth += inMonth ? order.order_items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0) : 0
      sAcc.spendThisYear += inYear ? order.order_items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0) : 0
      sAcc.spendAllTime += order.order_items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0)
    }

    const productsByKey = new Map((products ?? []).map((p) => [p.id, p]))

    const productStats: ProductStat[] = [...productAcc.values()].map((acc) => {
      const daysSinceFirst = acc.pricePoints.length
        ? Math.max(1, (now.getTime() - Math.min(...acc.pricePoints.map((p) => p.date.getTime()))) / 86400000)
        : 84
      const weeksElapsed = Math.max(1, Math.min(12, daysSinceFirst / 7))
      const monthsElapsed = Math.max(1, Math.min(6, daysSinceFirst / 30))
      const avgWeekly = acc.qty12w / weeksElapsed
      const avgMonthly = acc.qty6m / monthsElapsed

      const recentAvg = weightedAvgPrice(acc.pricePoints, thirtyDaysAgo, now)
      const priorAvg = weightedAvgPrice(acc.pricePoints, sixtyDaysAgo, thirtyDaysAgo)
      let priceChangePct: number | null = null
      let priceDirection: 'up' | 'down' | 'flat' | null = null
      let priceChangeSince: Date | null = null
      if (recentAvg != null && priorAvg != null && priorAvg > 0) {
        priceChangePct = ((recentAvg - priorAvg) / priorAvg) * 100
        priceChangeSince = sixtyDaysAgo
      } else if (acc.pricePoints.length >= 2) {
        const sorted = [...acc.pricePoints].sort((a, b) => a.date.getTime() - b.date.getTime())
        const first = sorted[0].price
        const last = sorted[sorted.length - 1].price
        if (first > 0) priceChangePct = ((last - first) / first) * 100
        priceChangeSince = sorted[0].date
      }
      if (priceChangePct != null) {
        priceDirection = priceChangePct > 1 ? 'up' : priceChangePct < -1 ? 'down' : 'flat'
      }

      const avgPricePerUnit =
        weightedAvgPrice(acc.pricePoints, sixMonthsAgo, now) ??
        (acc.pricePoints.length ? acc.pricePoints.reduce((s, p) => s + p.price * p.qty, 0) / acc.pricePoints.reduce((s, p) => s + p.qty, 0) : null)
      const minPrice = acc.pricePoints.length ? Math.min(...acc.pricePoints.map((p) => p.price)) : null
      const maxPrice = acc.pricePoints.length ? Math.max(...acc.pricePoints.map((p) => p.price)) : null

      const supplierBreakdown = [...acc.supplierBreakdown.values()].sort((a, b) => b.spend - a.spend)
      const product = acc.productId ? productsByKey.get(acc.productId) : undefined

      return {
        key: acc.key,
        productId: acc.productId,
        name: product?.name ?? acc.name,
        unit: product?.unit ?? acc.unit,
        category: product?.category ?? null,
        active: product?.active ?? true,
        totalQty: acc.totalQty,
        totalSpend: acc.totalSpend,
        ordersCount: acc.ordersCount,
        avgPricePerUnit,
        minPrice,
        maxPrice,
        priceChangePct,
        priceChangeSince,
        priceDirection,
        avgWeekly,
        avgMonthly,
        spendThisWeek: acc.spendThisWeek,
        spendThisMonth: acc.spendThisMonth,
        spendThisYear: acc.spendThisYear,
        qtyThisWeek: acc.qtyThisWeek,
        qtyThisMonth: acc.qtyThisMonth,
        qtyThisYear: acc.qtyThisYear,
        supplierBreakdown,
        topSupplierId: supplierBreakdown[0]?.supplierId ?? null,
        lastPurchaseDate: acc.lastPurchaseDate,
        kgPerUnit: product?.unit_weight_kg && product.unit_weight_kg > 0 ? product.unit_weight_kg : null,
        priceHistory: [...acc.pricePoints].sort((a, b) => a.date.getTime() - b.date.getTime()).map((p) => ({ date: p.date, price: p.price })),
      }
    })

    const suppliersByKey = new Map((suppliers ?? []).map((s) => [s.id, s]))
    const supplierStats: SupplierStat[] = [...supplierAcc.values()].map((acc) => {
      const info = suppliersByKey.get(acc.supplierId)
      return {
        supplierId: acc.supplierId,
        name: info?.name ?? 'Fournisseur',
        icon: info?.icon ?? '🚚',
        spendThisWeek: acc.spendThisWeek,
        spendThisMonth: acc.spendThisMonth,
        spendThisYear: acc.spendThisYear,
        spendAllTime: acc.spendAllTime,
        ordersCount: acc.orderIds.size,
        avgOrderValue: acc.orderIds.size ? acc.spendAllTime / acc.orderIds.size : 0,
        lastOrderDate: acc.lastOrderDate,
        topProducts: [...acc.products.values()].sort((a, b) => b.spend - a.spend).slice(0, 8),
      }
    })

    return {
      totalSpendThisWeek,
      totalSpendThisMonth,
      totalSpendThisYear,
      ordersThisWeek: ordersThisWeekIds.size,
      ordersThisMonth: ordersThisMonthIds.size,
      ordersThisYear: ordersThisYearIds.size,
      products: productStats,
      suppliers: supplierStats,
    }
  }, [orders, products, suppliers])

  return { isLoading: ordersLoading || productsLoading || suppliersLoading, ...stats }
}
