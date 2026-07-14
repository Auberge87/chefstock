import { useState } from 'react'
import { useProducts } from '../products/useProducts'
import { useInventory, useInventoryMutations } from './useInventory'
import { categoryIcon } from '../../lib/categoryIcons'

export function InventoryPage() {
  const { data: products } = useProducts()
  const { data: inventory, isLoading } = useInventory()
  const { upsert, remove } = useInventoryMutations()
  const [addingProductId, setAddingProductId] = useState('')
  const [edits, setEdits] = useState<Record<string, { current: string; min: string; max: string }>>({})

  const trackedIds = new Set((inventory ?? []).map((r) => r.product_id))
  const untracked = (products ?? []).filter((p) => !trackedIds.has(p.id))

  function startEdit(productId: string, row?: { current: number; min_qty: number; max_qty: number }) {
    setEdits((e) => ({
      ...e,
      [productId]: {
        current: String(row?.current ?? 0),
        min: String(row?.min_qty ?? 10),
        max: String(row?.max_qty ?? 100),
      },
    }))
  }

  function saveEdit(productId: string, unit: string) {
    const e = edits[productId]
    if (!e) return
    upsert.mutate({
      product_id: productId,
      current: Number(e.current) || 0,
      min_qty: Number(e.min) || 0,
      max_qty: Number(e.max) || 0,
      unit,
    })
    setEdits((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  return (
    <div>
      <div className="top">
        <h2>📦 Stocks</h2>
      </div>

      <div className="box" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Suivre un nouveau produit</label>
          <select
            value={addingProductId}
            onChange={(e) => {
              setAddingProductId('')
              if (e.target.value) startEdit(e.target.value)
            }}
          >
            <option value="">Choisir un produit…</option>
            {untracked.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="small" style={{ marginBottom: 14 }}>
        Produits suivis en stock : {inventory?.length ?? 0}
      </div>

      {isLoading && <div className="small">Chargement…</div>}

      {(inventory ?? []).map((row) => {
        const product = products?.find((p) => p.id === row.product_id)
        const editing = edits[row.product_id]
        const status = row.current <= row.min_qty ? '🔴 Faible' : row.current >= row.max_qty ? '🟢 Plein' : '🟡 OK'
        return (
          <div className="box" key={row.product_id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 6 }}>
              <strong>
                {categoryIcon(product?.category)} {product?.name ?? row.product_id}
              </strong>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{status}</span>
                <button
                  className="icobtn d"
                  onClick={() => {
                    if (confirm(`Arrêter de suivre « ${product?.name} » ?`)) remove.mutate(row.product_id)
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
            {editing ? (
              <div className="rowline">
                <div className="field" style={{ flex: 1 }}>
                  <label>Actuel</label>
                  <input
                    type="number"
                    value={editing.current}
                    onChange={(e) => setEdits((s) => ({ ...s, [row.product_id]: { ...editing, current: e.target.value } }))}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Min</label>
                  <input
                    type="number"
                    value={editing.min}
                    onChange={(e) => setEdits((s) => ({ ...s, [row.product_id]: { ...editing, min: e.target.value } }))}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Max</label>
                  <input
                    type="number"
                    value={editing.max}
                    onChange={(e) => setEdits((s) => ({ ...s, [row.product_id]: { ...editing, max: e.target.value } }))}
                  />
                </div>
                <button className="btn primary sm" onClick={() => saveEdit(row.product_id, product?.unit ?? row.unit ?? '')}>
                  OK
                </button>
              </div>
            ) : (
              <>
                <div className="small">
                  Stock : {row.current} {row.unit} / Min {row.min_qty} / Max {row.max_qty}
                </div>
                <button
                  className="btn secondary sm"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={() => startEdit(row.product_id, row)}
                >
                  Mettre à jour
                </button>
              </>
            )}
          </div>
        )
      })}

      {addingProductId === '' &&
        Object.keys(edits)
          .filter((id) => !inventory?.some((r) => r.product_id === id))
          .map((productId) => {
            const product = products?.find((p) => p.id === productId)
            const editing = edits[productId]
            return (
              <div className="box" key={productId} style={{ marginBottom: 10 }}>
                <strong>{product?.name}</strong>
                <div className="rowline" style={{ marginTop: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Actuel</label>
                    <input
                      type="number"
                      value={editing.current}
                      onChange={(e) => setEdits((s) => ({ ...s, [productId]: { ...editing, current: e.target.value } }))}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Min</label>
                    <input
                      type="number"
                      value={editing.min}
                      onChange={(e) => setEdits((s) => ({ ...s, [productId]: { ...editing, min: e.target.value } }))}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Max</label>
                    <input
                      type="number"
                      value={editing.max}
                      onChange={(e) => setEdits((s) => ({ ...s, [productId]: { ...editing, max: e.target.value } }))}
                    />
                  </div>
                  <button className="btn primary sm" onClick={() => saveEdit(productId, product?.unit ?? '')}>
                    Ajouter
                  </button>
                </div>
              </div>
            )
          })}

      {!isLoading && !inventory?.length && !Object.keys(edits).length && (
        <div className="box">Aucun produit en stock. Choisissez un produit ci-dessus.</div>
      )}
    </div>
  )
}
