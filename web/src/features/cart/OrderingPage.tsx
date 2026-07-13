import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts, type ProductWithSuppliers } from '../products/useProducts'
import { useSuppliers } from '../suppliers/useSuppliers'
import { useCart } from './CartContext'
import { pickSupplierFor } from './pickSupplier'
import { unitPrice, pricePerKg, pricePerPiece } from '../../lib/pricing'
import { ProductForm } from '../products/ProductForm'
import type { Supplier } from '../../types/database'

type BrowseMode = 'category' | 'supplier'

export function OrderingPage() {
  const { data: products, isLoading } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { quantities, supplierChoice, setQty, incrementQty, setSupplierChoice, itemCount } = useCart()

  const [browseMode, setBrowseMode] = useState<BrowseMode>('supplier')
  const [category, setCategory] = useState('Tous')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithSuppliers | null>(null)

  const term = search.toLowerCase()

  const categories = useMemo(
    () => ['Tous', ...new Set((products ?? []).map((p) => p.category))],
    [products],
  )

  const visible = useMemo(() => {
    return (products ?? []).filter((p) => {
      const byCat = browseMode === 'category' ? category === 'Tous' || p.category === category : true
      const bySup = browseMode === 'supplier' ? !supplierFilter || p.supplierIds.includes(supplierFilter) : true
      const bySearch = p.name.toLowerCase().includes(term)
      const bySelected = !selectedOnly || (quantities[p.id] ?? 0) > 0
      return byCat && bySup && bySearch && bySelected
    })
  }, [products, browseMode, category, supplierFilter, term, selectedOnly, quantities])

  function supplierName(id: string | undefined, all: Supplier[] | undefined) {
    return all?.find((s) => s.id === id)
  }

  const activeSupplier = supplierFilter ? suppliers?.find((s) => s.id === supplierFilter) : undefined

  const minOrderStatus = useMemo(() => {
    if (!activeSupplier || !products) return null
    const total = Object.entries(quantities).reduce((sum, [productId, qty]) => {
      if (qty <= 0) return sum
      const product = products.find((p) => p.id === productId)
      if (!product) return sum
      const supplierId = pickSupplierFor(product, supplierChoice)
      if (supplierId !== activeSupplier.id) return sum
      return sum + qty * unitPrice(product)
    }, 0)
    const min = activeSupplier.min_order_amount
    const reached = min <= 0 || total >= min
    const pct = min > 0 ? Math.min(100, (total / min) * 100) : 100
    return { total, min, reached, pct, diff: Math.max(0, min - total) }
  }, [activeSupplier, products, quantities, supplierChoice])

  return (
    <div>
      <div className="top">
        <h2>Produits</h2>
      </div>

      <div className="segmented">
        <button className={browseMode === 'category' ? 'active' : ''} onClick={() => setBrowseMode('category')}>
          Par rayon
        </button>
        <button className={browseMode === 'supplier' ? 'active' : ''} onClick={() => setBrowseMode('supplier')}>
          Par fournisseur
        </button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn secondary" onClick={() => setSelectedOnly((v) => !v)}>
          {selectedOnly ? 'Tout afficher' : 'Sélectionnés'}
        </button>
      </div>

      {browseMode === 'category' && (
        <div className="tabs">
          {categories.map((c) => (
            <button key={c} className={`tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {browseMode === 'supplier' && suppliers && (
        <div className="tabs">
          <button className={`tab ${supplierFilter === '' ? 'active' : ''}`} onClick={() => setSupplierFilter('')}>
            Tous
          </button>
          {suppliers.map((s) => (
            <button
              key={s.id}
              className={`tab ${supplierFilter === s.id ? 'active' : ''}`}
              onClick={() => setSupplierFilter(s.id)}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="small">Chargement…</div>}

      {activeSupplier && minOrderStatus && (
        <div className="box" style={{ marginBottom: 14, borderLeft: `4px solid ${minOrderStatus.reached ? 'var(--g)' : 'var(--danger)'}` }}>
          <div style={{ marginBottom: 8 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
              {activeSupplier.icon} {activeSupplier.name}
            </h3>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
              {minOrderStatus.reached ? '🟢' : '🔴'} {minOrderStatus.total.toFixed(2)} € / {minOrderStatus.min} €
            </div>
            <div style={{ background: '#eef2ef', borderRadius: 12, height: 8, overflow: 'hidden' }}>
              <div
                style={{
                  background: minOrderStatus.reached ? 'var(--g)' : 'var(--warn)',
                  height: '100%',
                  width: `${minOrderStatus.pct}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <div className="small" style={{ color: minOrderStatus.reached ? 'var(--g)' : 'var(--warn)' }}>
            {minOrderStatus.reached
              ? '✅ Minimum atteint'
              : `Il manque environ ${minOrderStatus.diff.toFixed(2)} € pour atteindre le minimum.`}
          </div>
        </div>
      )}

      <div className="list">
        {visible.map((p) => {
          const qty = quantities[p.id] ?? 0
          const activeSupplierId = pickSupplierFor(p, supplierChoice)
          const uPrice = unitPrice(p)
          const ppKg = pricePerKg(p)
          const ppPiece = pricePerPiece(p)
          const lineTotal = qty * uPrice
          const meta = [p.category, p.packaging].filter(Boolean).join(' · ')

          return (
            <div className="item" key={p.id}>
              <div className="itemrow">
                <div style={{ minWidth: 0 }}>
                  <div className="name">{p.name}</div>
                  <div className="meta">{meta}</div>
                  <div className="small" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--g)' }}>
                      {uPrice.toFixed(2)}€/{p.unit}
                    </span>
                    {ppKg != null && p.unit.toLowerCase() !== 'kg' && <span>{ppKg.toFixed(2)}€/kg</span>}
                    {ppPiece != null && !['pièce', 'piece'].includes(p.unit.toLowerCase()) && (
                      <span>{ppPiece.toFixed(2)}€/pc</span>
                    )}
                  </div>
                </div>
                <div className="qtyline">
                  <input
                    className="qty"
                    inputMode="decimal"
                    value={qty || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(',', '.'))
                      setQty(p.id, isNaN(v) ? 0 : v)
                      if (p.supplierIds.length > 1 && browseMode === 'supplier' && supplierFilter) {
                        setSupplierChoice(p.id, supplierFilter)
                      }
                    }}
                  />
                  <span className="pill">{p.unit}</span>
                </div>
              </div>
              {qty > 0 && (
                <div className="small" style={{ marginTop: 4, padding: 8, background: '#eaf3ef', borderRadius: 10, fontWeight: 600 }}>
                  Ligne : {lineTotal.toFixed(2)} €
                </div>
              )}
              <div className="quickrow">
                {(p.quick_quantities.length ? p.quick_quantities : [1]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="qbtn"
                    onClick={() => {
                      incrementQty(p.id, n)
                      if (p.supplierIds.length > 1 && browseMode === 'supplier' && supplierFilter) {
                        setSupplierChoice(p.id, supplierFilter)
                      }
                    }}
                  >
                    +{n}
                  </button>
                ))}
                <button type="button" className="qedit" onClick={() => setEditingProduct(p)}>
                  ✏️ Modifier
                </button>
              </div>
              {p.supplierIds.length > 1 && (
                <select
                  className="fullsel"
                  value={activeSupplierId}
                  onChange={(e) => setSupplierChoice(p.id, e.target.value)}
                >
                  {p.supplierIds.map((id) => {
                    const s = supplierName(id, suppliers)
                    return (
                      <option key={id} value={id}>
                        {s ? `${s.icon} ${s.name}` : id}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
          )
        })}
        {!visible.length && !isLoading && <div className="box">Aucun produit trouvé.</div>}
      </div>

      {itemCount > 0 && (
        <div className="bottom">
          <div className="bottomin">
            <Link to="/orders" className="btn primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Préparer ➜ ({itemCount})
            </Link>
          </div>
        </div>
      )}

      {editingProduct && (
        <ProductForm product={editingProduct} suppliers={suppliers ?? []} onClose={() => setEditingProduct(null)} />
      )}
    </div>
  )
}
