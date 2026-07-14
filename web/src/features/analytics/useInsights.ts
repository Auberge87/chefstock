import { useMemo } from 'react'
import { usePurchasingStats, type ProductStat, type SupplierStat } from './useAnalytics'

export type InsightSeverity = 'success' | 'warn' | 'danger' | 'info'

export interface InsightSegment {
  text: string
  bold?: boolean
}

export interface Insight {
  id: string
  severity: InsightSeverity
  icon: string
  segments: InsightSegment[]
  link?: string
  weight: number
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { danger: 3, warn: 2, success: 1, info: 0 }

function monthYear(d: Date) {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function consumptionInsights(products: ProductStat[]): Insight[] {
  return [...products]
    .filter((p) => p.ordersCount >= 2 && p.avgMonthly > 0.1)
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 4)
    .map((p) => ({
      id: `consumption:${p.key}`,
      severity: 'info' as const,
      icon: '📊',
      segments: [
        { text: 'Vous achetez en moyenne ' },
        { text: `${p.avgMonthly.toFixed(0)} ${p.unit}`, bold: true },
        { text: ' de ' },
        { text: p.name, bold: true },
        { text: ' par mois' },
        { text: p.topSupplierId ? ` (${p.avgWeekly.toFixed(1)} ${p.unit}/semaine).` : '.' },
      ],
      link: `/analytics/product/${encodeURIComponent(p.key)}`,
      weight: p.totalSpend,
    }))
}

function priceMoveInsights(products: ProductStat[]): Insight[] {
  const out: Insight[] = []
  for (const p of products) {
    if (p.priceChangePct == null || p.priceDirection === 'flat') continue
    if (Math.abs(p.priceChangePct) < 8) continue
    const up = p.priceDirection === 'up'
    out.push({
      id: `price-move:${p.key}`,
      severity: up ? 'warn' : 'success',
      icon: up ? '📈' : '📉',
      segments: [
        { text: 'Le prix de ' },
        { text: p.name, bold: true },
        { text: up ? ' a augmenté de ' : ' a baissé de ' },
        { text: `${Math.abs(p.priceChangePct).toFixed(0)}%`, bold: true },
        { text: p.priceChangeSince ? ` depuis ${monthYear(p.priceChangeSince)}.` : '.' },
      ],
      link: `/analytics/product/${encodeURIComponent(p.key)}`,
      weight: Math.abs(p.priceChangePct) * Math.max(1, p.totalSpend / 10),
    })
  }
  return out
}

function belowAverageInsights(products: ProductStat[]): Insight[] {
  const out: Insight[] = []
  for (const p of products) {
    if (p.priceHistory.length < 3 || p.avgPricePerUnit == null) continue
    const last = p.priceHistory[p.priceHistory.length - 1].price
    if (last <= 0 || p.avgPricePerUnit <= 0) continue
    const ratio = last / p.avgPricePerUnit
    if (ratio > 0.93) continue
    out.push({
      id: `below-avg:${p.key}`,
      severity: 'success',
      icon: '💡',
      segments: [
        { text: p.name, bold: true },
        { text: ' est actuellement moins cher que votre moyenne habituelle : ' },
        { text: `${last.toFixed(2)} €`, bold: true },
        { text: ` contre ${p.avgPricePerUnit.toFixed(2)} € en moyenne.` },
      ],
      link: `/analytics/product/${encodeURIComponent(p.key)}`,
      weight: (1 - ratio) * 100,
    })
  }
  return out
}

function cheaperSupplierInsights(products: ProductStat[], suppliers: SupplierStat[]): Insight[] {
  const supplierName = (id: string) => suppliers.find((s) => s.supplierId === id)?.name ?? 'ce fournisseur'
  const out: Insight[] = []
  for (const p of products) {
    const withPrice = p.supplierBreakdown.filter((s) => s.qty > 0).map((s) => ({ ...s, avgPrice: s.spend / s.qty }))
    if (withPrice.length < 2) continue
    const cheapest = [...withPrice].sort((a, b) => a.avgPrice - b.avgPrice)[0]
    const priciest = [...withPrice].sort((a, b) => b.avgPrice - a.avgPrice)[0]
    if (cheapest.supplierId === priciest.supplierId || cheapest.avgPrice <= 0) continue
    const ratio = priciest.avgPrice / cheapest.avgPrice
    if (ratio < 1.08) continue
    out.push({
      id: `cheaper-supplier:${p.key}`,
      severity: 'info',
      icon: '💡',
      segments: [
        { text: 'Vous payez ' },
        { text: p.name, bold: true },
        { text: ' moins cher chez ' },
        { text: `${supplierName(cheapest.supplierId)} (${cheapest.avgPrice.toFixed(2)} €)`, bold: true },
        { text: ' que chez ' },
        { text: `${supplierName(priciest.supplierId)} (${priciest.avgPrice.toFixed(2)} €)`, bold: true },
        { text: '.' },
      ],
      link: `/analytics/product/${encodeURIComponent(p.key)}`,
      weight: (ratio - 1) * 100,
    })
  }
  return out
}

export function useInsights(limit = 20) {
  const stats = usePurchasingStats()

  const insights = useMemo(() => {
    if (stats.isLoading) return []
    const all = [
      ...priceMoveInsights(stats.products),
      ...belowAverageInsights(stats.products),
      ...cheaperSupplierInsights(stats.products, stats.suppliers),
      ...consumptionInsights(stats.products),
    ]
    return all
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.weight - a.weight)
      .slice(0, limit)
  }, [stats, limit])

  return { insights, isLoading: stats.isLoading }
}
