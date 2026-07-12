// Hand-written types matching web/supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` output once the Supabase CLI is set up locally.

export type OrgRole = 'owner' | 'staff'
export type OrderStatus = 'sent' | 'received'
export type ReceivedVia = 'quick' | 'reconciled' | null

export interface Organization {
  id: string
  name: string
  city: string | null
  contact: string | null
  email: string | null
  signature: string | null
  units: string[]
  anthropic_model: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  organization_id: string
  user_id: string
  role: OrgRole
  created_at: string
}

export interface Supplier {
  id: string
  organization_id: string
  name: string
  icon: string
  ordering_method: string
  email: string | null
  phone: string | null
  website: string | null
  min_order_amount: number
  delivery_days: string[]
  order_deadline: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  organization_id: string
  name: string
  category: string
  unit: string
  packaging: string | null
  primary_supplier_id: string | null
  quick_quantities: number[]
  estimated_price: number
  price_basis: string
  unit_weight_kg: number
  pieces_per_unit: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductSupplier {
  product_id: string
  supplier_id: string
  organization_id: string
}

export interface PriceHistoryEntry {
  id: string
  organization_id: string
  product_id: string
  supplier_id: string | null
  price: number
  recorded_at: string
  source: string | null
}

export interface Order {
  id: string
  organization_id: string
  supplier_id: string
  status: OrderStatus
  received_via: ReceivedVia
  delivery_label: string | null
  delivery_date: string
  note: string | null
  sent_at: string
  received_at: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  organization_id: string
  product_id: string | null
  name_snapshot: string
  qty: number
  unit: string | null
  packaging: string | null
  price: number | null
  delivered_qty: number | null
}

export interface SavedDraft {
  id: string
  organization_id: string
  name: string
  cart: { q?: Record<string, number>; supplier?: Record<string, string> }
  created_at: string
}

export interface InventoryRow {
  organization_id: string
  product_id: string
  current: number
  min_qty: number
  max_qty: number
  unit: string | null
  updated_at: string
}

export interface DismissedAlert {
  organization_id: string
  alert_id: string
  dismissed_by: string | null
  dismissed_at: string
}

// Minimal Database shape so supabase-js's generic client typing doesn't complain.
// This is intentionally loose (not the full generated schema) — safe because we
// still type every query result via the interfaces above at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
