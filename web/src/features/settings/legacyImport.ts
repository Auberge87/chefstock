import { supabase } from '../../lib/supabaseClient'
import { normName } from '../../lib/similarity'
import type { Supplier, Product } from '../../types/database'

interface LegacySupplier {
  id: string
  name: string
  icon?: string
  orderingMethod?: string
  method?: string
  email?: string
  phone?: string
  website?: string
  minimumOrderAmount?: number
  deliveryDays?: string[]
  orderDeadline?: string
  notes?: string
  active?: boolean
}

interface LegacyProduct {
  id: string
  name: string
  category?: string
  unit?: string
  packaging?: string
  suppliers?: string[]
  supplier?: string
  quick?: number[]
  estimatedPrice?: number
  priceBasis?: string
  unitWeightKg?: number
  piecesPerUnit?: number
  priceHistory?: { price: number; date: string; source?: string }[]
}

interface LegacyOrderItem {
  name: string
  qty: number
  unit?: string
  packaging?: string
  price?: number
  delivered?: number
}

interface LegacyOrder {
  id: string
  date: string
  supplierId: string
  delivery?: string
  deliveryISO?: string
  status: string
  receivedAt?: string
  items: LegacyOrderItem[]
}

interface LegacyDraft {
  id: string
  name: string
  createdAt: string
  q?: Record<string, number>
  supplier?: Record<string, string>
}

interface LegacyInventoryEntry {
  current?: number
  minQty?: number
  maxQty?: number
  unit?: string
}

export interface LegacyExport {
  exportedAt?: string
  config: {
    restaurant?: { name?: string; city?: string; contact?: string; email?: string; signature?: string }
    suppliers?: LegacySupplier[]
    products?: LegacyProduct[]
  }
  state: {
    history?: LegacyOrder[]
    savedDrafts?: LegacyDraft[]
    inventory?: Record<string, LegacyInventoryEntry>
  }
}

export function parseLegacyExport(text: string): LegacyExport {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || !data.config) {
    throw new Error("Ce fichier ne ressemble pas à un export Chef Stock valide.")
  }
  return data as LegacyExport
}

export function summarizeLegacyExport(data: LegacyExport) {
  return {
    suppliers: data.config.suppliers?.length ?? 0,
    products: data.config.products?.length ?? 0,
    orders: data.state.history?.length ?? 0,
    drafts: data.state.savedDrafts?.length ?? 0,
    inventoryRows: data.state.inventory ? Object.keys(data.state.inventory).length : 0,
  }
}

const RECEIVED_STATUSES = new Set(['Reçue', 'Réceptionnée', 'Completada', 'Livraison contrôlée'])

export interface ImportResult {
  suppliersCreated: number
  suppliersMatched: number
  productsCreated: number
  productsMatched: number
  ordersImported: number
  orderItemsImported: number
  draftsImported: number
  inventoryRowsImported: number
}

export async function importLegacyData(
  organizationId: string,
  data: LegacyExport,
  existingSuppliers: Supplier[],
  existingProducts: Product[],
): Promise<ImportResult> {
  const legacySuppliers = data.config.suppliers ?? []
  const legacyProducts = data.config.products ?? []
  const legacyOrders = data.state.history ?? []
  const legacyDrafts = data.state.savedDrafts ?? []
  const legacyInventory = data.state.inventory ?? {}

  // ---- suppliers: reuse an existing supplier with the same normalized name, else create ----
  const supplierByNormName = new Map(existingSuppliers.map((s) => [normName(s.name), s]))
  const supplierIdMap = new Map<string, string>() // legacy id -> new/existing supplier uuid
  let suppliersCreated = 0
  let suppliersMatched = 0

  const suppliersToCreate = legacySuppliers.filter((s) => !supplierByNormName.has(normName(s.name)))
  if (suppliersToCreate.length) {
    const rows = suppliersToCreate.map((s) => ({
      organization_id: organizationId,
      name: s.name,
      icon: s.icon || '📦',
      ordering_method: s.orderingMethod || (s.method ? s.method.toLowerCase() : 'email'),
      email: s.email || null,
      phone: s.phone || null,
      website: s.website || null,
      min_order_amount: s.minimumOrderAmount ?? 100,
      delivery_days: s.deliveryDays ?? [],
      order_deadline: s.orderDeadline || null,
      notes: s.notes || null,
      active: s.active !== false,
    }))
    const { data: inserted, error } = await supabase.from('suppliers').insert(rows).select('id')
    if (error) throw error
    suppliersToCreate.forEach((s, i) => supplierIdMap.set(s.id, inserted![i].id))
    suppliersCreated = suppliersToCreate.length
  }
  for (const s of legacySuppliers) {
    if (supplierIdMap.has(s.id)) continue
    const match = supplierByNormName.get(normName(s.name))
    if (match) {
      supplierIdMap.set(s.id, match.id)
      suppliersMatched++
    }
  }

  // ---- products: same dedup strategy ----
  const productByNormName = new Map(existingProducts.map((p) => [normName(p.name), p]))
  const productIdMap = new Map<string, string>() // legacy id -> new/existing product uuid
  const productNameToId = new Map<string, string>() // normalized name -> product uuid, for matching order items
  for (const p of existingProducts) productNameToId.set(normName(p.name), p.id)
  let productsCreated = 0
  let productsMatched = 0

  const productsToCreate = legacyProducts.filter((p) => !productByNormName.has(normName(p.name)))
  if (productsToCreate.length) {
    const rows = productsToCreate.map((p) => {
      const primarySupplierLegacyId = p.suppliers?.[0] || p.supplier
      const primarySupplierId = primarySupplierLegacyId ? supplierIdMap.get(primarySupplierLegacyId) ?? null : null
      return {
        organization_id: organizationId,
        name: p.name,
        category: p.category || 'Divers',
        unit: p.unit || 'pièce',
        packaging: p.packaging || '',
        primary_supplier_id: primarySupplierId,
        quick_quantities: p.quick ?? [],
        estimated_price: p.estimatedPrice ?? 0,
        price_basis: p.priceBasis || 'unit',
        unit_weight_kg: p.unitWeightKg ?? 0,
        pieces_per_unit: p.piecesPerUnit ?? 0,
      }
    })
    const { data: inserted, error } = await supabase.from('products').insert(rows).select('id')
    if (error) throw error
    productsToCreate.forEach((p, i) => {
      productIdMap.set(p.id, inserted![i].id)
      productNameToId.set(normName(p.name), inserted![i].id)
    })
    productsCreated = productsToCreate.length
  }
  for (const p of legacyProducts) {
    if (productIdMap.has(p.id)) continue
    const match = productByNormName.get(normName(p.name))
    if (match) {
      productIdMap.set(p.id, match.id)
      productsMatched++
    }
  }

  // ---- product <-> supplier links ----
  const productSupplierRows: { product_id: string; supplier_id: string; organization_id: string }[] = []
  for (const p of legacyProducts) {
    const newProductId = productIdMap.get(p.id)
    if (!newProductId) continue
    const supplierLegacyIds = p.suppliers?.length ? p.suppliers : p.supplier ? [p.supplier] : []
    for (const legacySupplierId of supplierLegacyIds) {
      const newSupplierId = supplierIdMap.get(legacySupplierId)
      if (newSupplierId) productSupplierRows.push({ product_id: newProductId, supplier_id: newSupplierId, organization_id: organizationId })
    }
  }
  if (productSupplierRows.length) {
    const { error } = await supabase.from('product_suppliers').upsert(productSupplierRows, { onConflict: 'product_id,supplier_id', ignoreDuplicates: true })
    if (error) throw error
  }

  // ---- price history (best-effort, non-blocking for the rest of the import) ----
  const priceHistoryRows: { organization_id: string; product_id: string; supplier_id: string | null; price: number; recorded_at: string; source: string }[] = []
  for (const p of legacyProducts) {
    const newProductId = productIdMap.get(p.id)
    if (!newProductId || !p.priceHistory?.length) continue
    const primarySupplierId = p.suppliers?.[0] ? supplierIdMap.get(p.suppliers[0]) ?? null : null
    for (const entry of p.priceHistory) {
      if (!entry.price) continue
      priceHistoryRows.push({
        organization_id: organizationId,
        product_id: newProductId,
        supplier_id: primarySupplierId,
        price: entry.price,
        recorded_at: entry.date || new Date().toISOString(),
        source: entry.source || 'legacy',
      })
    }
  }
  if (priceHistoryRows.length) {
    const { error } = await supabase.from('price_history').insert(priceHistoryRows)
    if (error) throw error
  }

  // ---- orders + order items ----
  let ordersImported = 0
  let orderItemsImported = 0
  const ordersWithSupplier = legacyOrders.filter((o) => supplierIdMap.get(o.supplierId))
  if (ordersWithSupplier.length) {
    const orderRows = ordersWithSupplier.map((o) => {
      const received = RECEIVED_STATUSES.has(o.status)
      return {
        organization_id: organizationId,
        supplier_id: supplierIdMap.get(o.supplierId)!,
        status: received ? 'received' : 'sent',
        received_via: received ? 'reconciled' : null,
        delivery_label: o.delivery || null,
        delivery_date: o.deliveryISO || o.date.slice(0, 10),
        sent_at: o.date,
        received_at: o.receivedAt || null,
      }
    })
    const { data: insertedOrders, error } = await supabase.from('orders').insert(orderRows).select('id')
    if (error) throw error
    ordersImported = insertedOrders!.length

    const itemRows: {
      order_id: string
      organization_id: string
      product_id: string | null
      name_snapshot: string
      qty: number
      unit: string | null
      packaging: string | null
      price: number | null
      delivered_qty: number | null
    }[] = []
    ordersWithSupplier.forEach((o, i) => {
      const orderId = insertedOrders![i].id
      for (const item of o.items) {
        itemRows.push({
          order_id: orderId,
          organization_id: organizationId,
          product_id: productNameToId.get(normName(item.name)) ?? null,
          name_snapshot: item.name,
          qty: item.qty || 0,
          unit: item.unit || null,
          packaging: item.packaging || null,
          price: item.price ?? null,
          delivered_qty: item.delivered ?? null,
        })
      }
    })

    const CHUNK = 500
    for (let i = 0; i < itemRows.length; i += CHUNK) {
      const chunk = itemRows.slice(i, i + CHUNK)
      const { error: itemsError } = await supabase.from('order_items').insert(chunk)
      if (itemsError) throw itemsError
      orderItemsImported += chunk.length
    }
  }

  // ---- saved drafts ----
  let draftsImported = 0
  if (legacyDrafts.length) {
    const draftRows = legacyDrafts
      .map((d) => {
        const q: Record<string, number> = {}
        for (const [legacyProductId, qty] of Object.entries(d.q ?? {})) {
          const newId = productIdMap.get(legacyProductId)
          if (newId && qty > 0) q[newId] = qty
        }
        if (!Object.keys(q).length) return null
        const supplier: Record<string, string> = {}
        for (const [legacyProductId, legacySupplierId] of Object.entries(d.supplier ?? {})) {
          const newProductId = productIdMap.get(legacyProductId)
          const newSupplierId = supplierIdMap.get(legacySupplierId)
          if (newProductId && newSupplierId) supplier[newProductId] = newSupplierId
        }
        return {
          organization_id: organizationId,
          name: d.name,
          cart: { q, supplier },
          created_at: d.createdAt || new Date().toISOString(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (draftRows.length) {
      const { error } = await supabase.from('saved_drafts').insert(draftRows)
      if (error) throw error
      draftsImported = draftRows.length
    }
  }

  // ---- inventory ----
  let inventoryRowsImported = 0
  const inventoryRows = Object.entries(legacyInventory)
    .map(([legacyProductId, entry]) => {
      const newProductId = productIdMap.get(legacyProductId)
      if (!newProductId) return null
      return {
        organization_id: organizationId,
        product_id: newProductId,
        current: entry.current ?? 0,
        min_qty: entry.minQty ?? 0,
        max_qty: entry.maxQty ?? 0,
        unit: entry.unit || null,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (inventoryRows.length) {
    const { error } = await supabase.from('inventory').upsert(inventoryRows, { onConflict: 'organization_id,product_id' })
    if (error) throw error
    inventoryRowsImported = inventoryRows.length
  }

  return {
    suppliersCreated,
    suppliersMatched,
    productsCreated,
    productsMatched,
    ordersImported,
    orderItemsImported,
    draftsImported,
    inventoryRowsImported,
  }
}
