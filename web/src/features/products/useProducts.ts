import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { Product } from '../../types/database'

export interface ProductWithSuppliers extends Product {
  supplierIds: string[]
}

export function useProducts() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['products', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<ProductWithSuppliers[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_suppliers(supplier_id)')
        .eq('organization_id', org!.id)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data as (Product & { product_suppliers: { supplier_id: string }[] })[]).map((p) => ({
        ...p,
        supplierIds: p.product_suppliers.map((ps) => ps.supplier_id),
      }))
    },
  })
}

export interface ProductInput {
  name: string
  category: string
  unit: string
  packaging: string | null
  quick_quantities: number[]
  estimated_price: number
  price_basis: string
  unit_weight_kg: number
  pieces_per_unit: number
  supplierIds: string[]
}

export function useProductMutations() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products', org?.id] })

  async function syncSuppliers(productId: string, supplierIds: string[]) {
    await supabase.from('product_suppliers').delete().eq('product_id', productId)
    if (supplierIds.length) {
      const rows = supplierIds.map((supplier_id) => ({
        product_id: productId,
        supplier_id,
        organization_id: org!.id,
      }))
      const { error } = await supabase.from('product_suppliers').insert(rows)
      if (error) throw error
    }
  }

  const create = useMutation({
    mutationFn: async (input: ProductInput) => {
      const { supplierIds, ...rest } = input
      const { data, error } = await supabase
        .from('products')
        .insert({ ...rest, organization_id: org!.id, primary_supplier_id: supplierIds[0] ?? null })
        .select('id')
        .single()
      if (error) throw error
      await syncSuppliers(data.id, supplierIds)
      if (rest.estimated_price > 0) {
        await supabase.from('price_history').insert({
          organization_id: org!.id,
          product_id: data.id,
          supplier_id: supplierIds[0] ?? null,
          price: rest.estimated_price,
          source: 'manual',
        })
      }
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ProductInput & { id: string }) => {
      const { supplierIds, ...rest } = input
      const { error } = await supabase
        .from('products')
        .update({ ...rest, primary_supplier_id: supplierIds[0] ?? null })
        .eq('id', id)
      if (error) throw error
      await syncSuppliers(id, supplierIds)
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

const DEFAULT_UNITS = [
  'kg', 'g', 'L', 'ml', 'pièce', 'sachet', 'colis', 'carton', 'boîte', 'pot', 'bouteille', 'barquette', 'plateau', 'pack',
]

export function allUnits(products: ProductWithSuppliers[] | undefined, orgUnits: string[] | undefined) {
  const used = (products ?? []).map((p) => p.unit).filter(Boolean)
  const custom = orgUnits ?? []
  const seen = new Map<string, string>()
  for (const u of [...DEFAULT_UNITS, ...custom, ...used]) seen.set(u.toLowerCase(), u)
  return [...seen.values()]
}

export function useRememberUnit() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (unit: string) => {
      const trimmed = unit.trim()
      if (!trimmed || !org) return
      const existing = org.units ?? []
      if (existing.some((u) => u.toLowerCase() === trimmed.toLowerCase())) return
      const { error } = await supabase
        .from('organizations')
        .update({ units: [...existing, trimmed] })
        .eq('id', org.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization', org?.id] }),
  })
}

export const DEFAULT_CATEGORIES = [
  'Légumes', 'Fruits', 'Herbes', 'Fromages', 'Crèmerie', 'Épicerie', 'Viandes', 'Poissons', 'Boissons', 'Boulangerie', 'Divers',
]
