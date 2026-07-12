import type { Product } from '../types/database'

/** Ported from Chef_Stock_V7_3.html — price-per-unit given the product's price basis. */
export function unitPrice(p: Pick<Product, 'estimated_price' | 'price_basis' | 'unit_weight_kg' | 'pieces_per_unit'>): number {
  const price = Number(p.estimated_price) || 0
  const basis = p.price_basis || 'unit'
  if (basis === 'kg') {
    const w = Number(p.unit_weight_kg) || 0
    return w > 0 ? price * w : price
  }
  if (basis === 'piece') {
    const pc = Number(p.pieces_per_unit) || 0
    return pc > 0 ? price * pc : price
  }
  return price
}

export function pricePerKg(p: Pick<Product, 'estimated_price' | 'price_basis' | 'unit_weight_kg' | 'pieces_per_unit'>): number | null {
  const w = Number(p.unit_weight_kg) || 0
  if (w > 0) return unitPrice(p) / w
  return p.price_basis === 'kg' ? Number(p.estimated_price) || 0 : null
}

export function pricePerPiece(p: Pick<Product, 'estimated_price' | 'price_basis' | 'unit_weight_kg' | 'pieces_per_unit'>): number | null {
  const pc = Number(p.pieces_per_unit) || 0
  if (pc > 0) return unitPrice(p) / pc
  return p.price_basis === 'piece' ? Number(p.estimated_price) || 0 : null
}
