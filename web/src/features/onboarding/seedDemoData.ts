import { supabase } from '../../lib/supabaseClient'

const DEMO_SUPPLIERS = [
  { key: 'terreazur', name: 'TerreAzur', icon: '🥬', ordering_method: 'website', website: 'https://terreazur.fr', min_order_amount: 100, delivery_days: ['Tuesday', 'Thursday', 'Saturday'], order_deadline: '18:00' },
  { key: 'jardin', name: 'Jardin Frais', icon: '🧀', ordering_method: 'email', min_order_amount: 100, delivery_days: ['Monday', 'Wednesday', 'Friday'], order_deadline: '12:00' },
  { key: 'tsa', name: 'TSA Viandes', icon: '🥩', ordering_method: 'phone', email: 'comptaclients@tsaviandes.fr', min_order_amount: 150, delivery_days: ['Tuesday', 'Thursday'], order_deadline: '10:00', notes: 'Appeler avant 10h' },
  { key: 'mare', name: 'Mare Nova', icon: '🐟', ordering_method: 'email', email: 'compta.sarlmarenova@orange.fr', min_order_amount: 120, delivery_days: ['Wednesday', 'Friday'], order_deadline: '16:00' },
] as const

const DEMO_PRODUCTS: [name: string, category: string, supplierKey: string, unit: string, packaging: string, price: number][] = [
  ['Thym', 'Herbes', 'terreazur', 'sachet', '', 3.5],
  ['Basilic', 'Herbes', 'terreazur', 'sachet', 'Sachet 100 g', 4.0],
  ['Aubergines', 'Légumes', 'terreazur', 'kg', '', 2.8],
  ['Courgettes vertes', 'Légumes', 'terreazur', 'kg', '', 2.5],
  ['Tomates grappe', 'Légumes', 'terreazur', 'colis', 'Colis 5 kg', 12.5],
  ['Citrons jaunes', 'Fruits', 'terreazur', 'kg', '', 3.2],
  ['Fraises', 'Fruits', 'terreazur', 'barquette', 'Barquette 500 g', 4.8],
  ['Burratina 125 g', 'Fromages', 'jardin', 'pièce', 'Carton 12', 28.0],
  ['Parmesan râpé 500 g', 'Fromages', 'jardin', 'sachet', '', 8.5],
  ['Beurre', 'Crèmerie', 'jardin', 'kg', '', 7.5],
  ['Crème 35 %', 'Crèmerie', 'jardin', 'L', '', 5.2],
  ['Œufs', 'Crèmerie', 'jardin', 'plateau', 'Plateau 30', 4.5],
  ["Huile d'olive 5 L", 'Épicerie', 'jardin', 'bouteille', '', 18.0],
  ['Suprême de poulet', 'Viandes', 'tsa', 'pièce', '', 6.5],
  ['Paleron de bœuf', 'Viandes', 'tsa', 'kg', '', 12.0],
  ['Filet de dorade', 'Poissons', 'mare', 'kg', '', 16.0],
  ['Poulpe', 'Poissons', 'mare', 'kg', '', 14.0],
  ['Vin rouge', 'Boissons', 'jardin', 'bouteille', 'Carton 6', 42.0],
]

const QUICK_DEFAULTS: Record<string, number[]> = {
  'Burratina 125 g': [12, 24, 36],
  Œufs: [1, 2, 4],
  'Vin rouge': [6, 12],
  'Tomates grappe': [2, 4, 6],
}

export async function seedDemoData(organizationId: string) {
  await supabase
    .from('organizations')
    .update({ name: "L'Auberge Provençale", city: 'Le Lavandou', contact: 'Thomas', email: 'laubergepro@gmail.com' })
    .eq('id', organizationId)

  const supplierIdByKey: Record<string, string> = {}
  for (const s of DEMO_SUPPLIERS) {
    const { key, ...rest } = s
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...rest, organization_id: organizationId })
      .select('id')
      .single()
    if (error) throw error
    supplierIdByKey[key] = data.id
  }

  for (const [name, category, supplierKey, unit, packaging, price] of DEMO_PRODUCTS) {
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        organization_id: organizationId,
        name,
        category,
        unit,
        packaging: packaging || null,
        estimated_price: price,
        quick_quantities: QUICK_DEFAULTS[name] ?? [],
        primary_supplier_id: supplierIdByKey[supplierKey],
      })
      .select('id')
      .single()
    if (error) throw error

    await supabase.from('product_suppliers').insert({
      product_id: product.id,
      supplier_id: supplierIdByKey[supplierKey],
      organization_id: organizationId,
    })
    await supabase.from('price_history').insert({
      organization_id: organizationId,
      product_id: product.id,
      supplier_id: supplierIdByKey[supplierKey],
      price,
      source: 'manual',
    })
  }

  return { suppliers: DEMO_SUPPLIERS.length, products: DEMO_PRODUCTS.length }
}
