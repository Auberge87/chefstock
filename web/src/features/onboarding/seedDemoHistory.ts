import { supabase } from '../../lib/supabaseClient'

interface SupplierRow {
  id: string
}
interface ProductRow {
  id: string
  name: string
  unit: string
  packaging: string | null
  estimated_price: number
  primary_supplier_id: string | null
}
interface ProductSupplierRow {
  product_id: string
  supplier_id: string
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(arr: T[], n: number, rnd: () => number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0])
  }
  return out
}

const WEEKS = 20

/** Seeds ~20 weeks of realistic-looking order history for the org's existing suppliers/products, so the Statistics page has something meaningful to show before real usage accumulates. */
export async function seedDemoHistory(organizationId: string) {
  const referenceNow = new Date()
  const [{ data: suppliers, error: sErr }, { data: products, error: pErr }, { data: links, error: lErr }] = await Promise.all([
    supabase.from('suppliers').select('id').eq('organization_id', organizationId),
    supabase.from('products').select('id, name, unit, packaging, estimated_price, primary_supplier_id').eq('organization_id', organizationId),
    supabase.from('product_suppliers').select('product_id, supplier_id').eq('organization_id', organizationId),
  ])
  if (sErr) throw sErr
  if (pErr) throw pErr
  if (lErr) throw lErr

  const supplierRows = (suppliers ?? []) as SupplierRow[]
  const productRows = (products ?? []) as ProductRow[]
  const linkRows = (links ?? []) as ProductSupplierRow[]

  if (!supplierRows.length || !productRows.length) {
    throw new Error("Ajoute d'abord des fournisseurs et des produits (ou charge l'exemple) avant de générer un historique.")
  }

  const productsBySupplier = new Map<string, ProductRow[]>()
  for (const link of linkRows) {
    const product = productRows.find((p) => p.id === link.product_id)
    if (!product) continue
    if (!productsBySupplier.has(link.supplier_id)) productsBySupplier.set(link.supplier_id, [])
    productsBySupplier.get(link.supplier_id)!.push(product)
  }
  for (const p of productRows) {
    if (!p.primary_supplier_id) continue
    const list = productsBySupplier.get(p.primary_supplier_id) ?? []
    if (!list.some((x) => x.id === p.id)) list.push(p)
    productsBySupplier.set(p.primary_supplier_id, list)
  }

  const rnd = mulberry32(20260714)

  // Each product drifts smoothly in price across the window so the "price movers" section has real signal.
  const driftByProduct = new Map<string, number>()
  for (const p of productRows) driftByProduct.set(p.id, (rnd() - 0.5) * 0.4) // -20% .. +20% total drift

  const orderRows: {
    organization_id: string
    supplier_id: string
    status: string
    received_via: string | null
    delivery_label: string | null
    delivery_date: string
    sent_at: string
    received_at: string | null
  }[] = []
  const orderItemGroups: { productId: string; name: string; qty: number; unit: string | null; packaging: string | null; price: number }[][] = []

  for (const sup of supplierRows) {
    const prods = productsBySupplier.get(sup.id) ?? []
    if (!prods.length) continue

    for (let weeksAgo = WEEKS; weeksAgo >= 1; weeksAgo--) {
      if (rnd() < 0.12) continue // skip some weeks for realism (not every supplier ordered every single week)
      const date = new Date(referenceNow.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000)
      const chosen = pick(prods, Math.min(prods.length, 2 + Math.floor(rnd() * 3)), rnd)
      if (!chosen.length) continue

      const progress = (WEEKS - weeksAgo) / WEEKS // 0 (oldest) -> 1 (newest)
      const items = chosen.map((pr) => {
        const drift = driftByProduct.get(pr.id) ?? 0
        const base = pr.estimated_price || 5
        const price = Math.max(0.1, base * (1 + drift * progress) * (0.96 + rnd() * 0.08))
        const qty = Math.round((2 + rnd() * 10) * 10) / 10
        return { productId: pr.id, name: pr.name, qty, unit: pr.unit, packaging: pr.packaging, price: Math.round(price * 100) / 100 }
      })

      const receivedDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)
      const isMostRecent = weeksAgo === 1 && rnd() < 0.5
      orderRows.push({
        organization_id: organizationId,
        supplier_id: sup.id,
        status: isMostRecent ? 'sent' : 'received',
        received_via: isMostRecent ? null : 'reconciled',
        delivery_label: 'Livraison',
        delivery_date: receivedDate.toISOString().slice(0, 10),
        sent_at: date.toISOString(),
        received_at: isMostRecent ? null : receivedDate.toISOString(),
      })
      orderItemGroups.push(items)
    }
  }

  if (!orderRows.length) return { orders: 0, items: 0 }

  const { data: insertedOrders, error } = await supabase.from('orders').insert(orderRows).select('id')
  if (error) throw error

  const itemRows = insertedOrders!.flatMap((order, i) =>
    orderItemGroups[i].map((item) => ({
      order_id: order.id,
      organization_id: organizationId,
      product_id: item.productId,
      name_snapshot: item.name,
      qty: item.qty,
      unit: item.unit,
      packaging: item.packaging,
      price: item.price,
    })),
  )

  const CHUNK = 500
  for (let i = 0; i < itemRows.length; i += CHUNK) {
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows.slice(i, i + CHUNK))
    if (itemsError) throw itemsError
  }

  return { orders: insertedOrders!.length, items: itemRows.length }
}
