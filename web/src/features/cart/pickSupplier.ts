import type { ProductWithSuppliers } from '../products/useProducts'

export function pickSupplierFor(p: ProductWithSuppliers, choice: Record<string, string>): string | undefined {
  const chosen = choice[p.id]
  if (chosen && p.supplierIds.includes(chosen)) return chosen
  return p.supplierIds[0]
}
