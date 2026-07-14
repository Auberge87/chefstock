import { useMemo, useState } from 'react'
import { useSuppliers } from '../suppliers/useSuppliers'
import { useProductMutations, useProducts, type ProductWithSuppliers } from './useProducts'
import { ProductForm } from './ProductForm'
import { MergeProductsModal } from './MergeProductsModal'
import { similarity, SIM_KNOWN } from '../../lib/similarity'
import { categoryIcon } from '../../lib/categoryIcons'

type SortMode = 'name' | 'supplier'

function findDuplicateGroups(products: ProductWithSuppliers[]) {
  const parent = new Map<string, string>()
  products.forEach((p) => parent.set(p.id, p.id))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      if (similarity(products[i].name, products[j].name) >= SIM_KNOWN) union(products[i].id, products[j].id)
    }
  }
  const groups = new Map<string, ProductWithSuppliers[]>()
  products.forEach((p) => {
    const root = find(p.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(p)
  })
  return [...groups.values()].filter((g) => g.length > 1)
}

export function ProductsManagePage() {
  const { data: products, isLoading } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { remove } = useProductMutations()
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [supplierFilter, setSupplierFilter] = useState<string>('')
  const [editing, setEditing] = useState<ProductWithSuppliers | null | 'new'>(null)
  const [showDupes, setShowDupes] = useState(false)
  const [mergingGroup, setMergingGroup] = useState<ProductWithSuppliers[] | null>(null)

  const term = search.toLowerCase()
  const filtered = useMemo(
    () => (products ?? []).filter((p) => p.name.toLowerCase().includes(term)),
    [products, term],
  )

  const groups = useMemo(() => {
    if (sortMode !== 'supplier' || !suppliers) return null
    const withSupplier = suppliers
      .map((s) => ({ s, prods: filtered.filter((p) => p.supplierIds.includes(s.id)) }))
      .filter((g) => g.prods.length)
    const none = filtered.filter((p) => !p.supplierIds.length)
    return none.length
      ? [...withSupplier, { s: { id: '__none', name: 'Sans fournisseur', icon: '❔' }, prods: none }]
      : withSupplier
  }, [sortMode, suppliers, filtered])

  const duplicateGroups = useMemo(() => (products ? findDuplicateGroups(products) : []), [products])

  function renderRow(p: ProductWithSuppliers) {
    const supNames = p.supplierIds
      .map((id) => suppliers?.find((s) => s.id === id)?.icon)
      .filter(Boolean)
      .join('')
    const meta = [p.category, p.unit, p.packaging].filter(Boolean).join(' · ')
    return (
      <div className="item" key={p.id}>
        <div className="mrow">
          <div style={{ minWidth: 0, display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 20, flex: 'none' }}>{categoryIcon(p.category)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="name">{p.name}</div>
              <div className="meta">
                {meta}
                {supNames ? ` · ${supNames}` : ''}
              </div>
            </div>
          </div>
          <div className="acts">
            <button className="icobtn" onClick={() => setEditing(p)}>
              ✏️
            </button>
            <button
              className="icobtn d"
              onClick={() => {
                if (confirm(`Supprimer définitivement « ${p.name} » ?`)) remove.mutate(p.id)
              }}
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="top">
        <h2>Gérer les produits</h2>
        <button className="btn primary sm" onClick={() => setEditing('new')}>
          ＋ Nouveau
        </button>
      </div>

      <div className="segmented">
        <button className={sortMode === 'name' ? 'active' : ''} onClick={() => setSortMode('name')}>
          Par nom
        </button>
        <button
          className={sortMode === 'supplier' ? 'active' : ''}
          onClick={() => {
            setSortMode('supplier')
            setSupplierFilter('')
          }}
        >
          Par fournisseur
        </button>
      </div>

      {sortMode === 'supplier' && groups && (
        <div className="tabs">
          <button className={`tab ${supplierFilter === '' ? 'active' : ''}`} onClick={() => setSupplierFilter('')}>
            Tous ({filtered.length})
          </button>
          {groups.map((g) => (
            <button
              key={g.s.id}
              className={`tab ${supplierFilter === g.s.id ? 'active' : ''}`}
              onClick={() => setSupplierFilter(g.s.id)}
            >
              {g.s.icon} {g.s.name} ({g.prods.length})
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn secondary" onClick={() => setShowDupes((v) => !v)}>
          🔎 Doublons {duplicateGroups.length ? `(${duplicateGroups.length})` : ''}
        </button>
      </div>

      {showDupes && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Doublons potentiels</h4>
          {!duplicateGroups.length && <div className="small">Aucun doublon détecté.</div>}
          {duplicateGroups.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '8px 0' }}>
              <span className="small">{g.map((p) => p.name).join('  ≈  ')}</span>
              <button className="btn secondary sm" onClick={() => setMergingGroup(g)}>
                🔗 Fusionner
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="small">Chargement…</div>}

      {sortMode === 'name' && (
        <div className="list">
          {filtered.map(renderRow)}
          {!filtered.length && !isLoading && <div className="box">Aucun produit. Touchez « ＋ Nouveau ».</div>}
        </div>
      )}

      {sortMode === 'supplier' && groups && !supplierFilter && (
        <>
          {groups.map((g) => (
            <div key={g.s.id} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--g)' }}>
                {g.s.icon} {g.s.name} <span className="small" style={{ display: 'inline', color: 'var(--muted)' }}>({g.prods.length})</span>
              </h4>
              <div className="list" style={{ gap: 8 }}>
                {g.prods.map(renderRow)}
              </div>
            </div>
          ))}
        </>
      )}

      {sortMode === 'supplier' && groups && supplierFilter && (
        <div className="list">
          {groups.find((g) => g.s.id === supplierFilter)?.prods.map(renderRow)}
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          suppliers={suppliers ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {mergingGroup && (
        <MergeProductsModal group={mergingGroup} suppliers={suppliers ?? []} onClose={() => setMergingGroup(null)} />
      )}
    </div>
  )
}
