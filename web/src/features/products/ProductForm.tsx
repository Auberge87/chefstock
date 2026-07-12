import { useState, type FormEvent } from 'react'
import type { Supplier } from '../../types/database'
import {
  DEFAULT_CATEGORIES,
  allUnits,
  useProductMutations,
  useProducts,
  useRememberUnit,
  type ProductWithSuppliers,
} from './useProducts'
import { useOrganization } from '../auth/useOrganization'

interface Props {
  product?: ProductWithSuppliers | null
  suppliers: Supplier[]
  onClose: () => void
}

export function ProductForm({ product, suppliers, onClose }: Props) {
  const { data: org } = useOrganization()
  const { data: products } = useProducts()
  const { create, update } = useProductMutations()
  const rememberUnit = useRememberUnit()

  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [unit, setUnit] = useState(product?.unit ?? 'pièce')
  const [newUnit, setNewUnit] = useState('')
  const [packaging, setPackaging] = useState(product?.packaging ?? '')
  const [supplierIds, setSupplierIds] = useState<string[]>(product?.supplierIds ?? [])
  const [price, setPrice] = useState(String(product?.estimated_price ?? ''))
  const [priceBasis, setPriceBasis] = useState(product?.price_basis ?? 'unit')
  const [unitWeightKg, setUnitWeightKg] = useState(String(product?.unit_weight_kg ?? ''))
  const [piecesPerUnit, setPiecesPerUnit] = useState(String(product?.pieces_per_unit ?? ''))
  const [quick, setQuick] = useState((product?.quick_quantities ?? []).join(', '))
  const [error, setError] = useState<string | null>(null)

  const busy = create.isPending || update.isPending
  const units = allUnits(products, org?.units)
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...(products ?? []).map((p) => p.category)])].filter(Boolean)

  function toggleSupplier(id: string) {
    setSupplierIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supplierIds.length) {
      setError('Choisissez au moins un fournisseur.')
      return
    }
    const finalUnit = unit === '__new' ? newUnit.trim() : unit
    if (!finalUnit) {
      setError("Choisissez ou créez une unité.")
      return
    }
    if (unit === '__new') await rememberUnit.mutateAsync(finalUnit)

    const quickQuantities = quick
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)

    const input = {
      name: name.trim(),
      category: category.trim() || 'Divers',
      unit: finalUnit,
      packaging: packaging.trim() || null,
      quick_quantities: quickQuantities,
      estimated_price: Number(price) || 0,
      price_basis: priceBasis,
      unit_weight_kg: Number(unitWeightKg) || 0,
      pieces_per_unit: Number(piecesPerUnit) || 0,
      supplierIds,
    }

    if (product) await update.mutateAsync({ id: product.id, ...input })
    else await create.mutateAsync(input)
    onClose()
  }

  return (
    <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{product ? 'Modifier le produit' : 'Nouveau produit'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>Catégorie</label>
              <input list="catlist" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="catlist">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Conditionnement</label>
              <input value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="Carton 12…" />
            </div>
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>Unité</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="__new">＋ Créer une unité…</option>
              </select>
            </div>
            {unit === '__new' && (
              <div className="field" style={{ flex: 1 }}>
                <label>Nouvelle unité</label>
                <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </div>
            )}
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>Prix estimé (€)</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Le prix s'entend par</label>
              <select value={priceBasis} onChange={(e) => setPriceBasis(e.target.value)}>
                <option value="unit">unité</option>
                <option value="kg">kg</option>
                <option value="piece">pièce</option>
              </select>
            </div>
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>Poids unitaire (kg)</label>
              <input type="number" step="0.001" value={unitWeightKg} onChange={(e) => setUnitWeightKg(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Pièces par unité</label>
              <input type="number" step="0.01" value={piecesPerUnit} onChange={(e) => setPiecesPerUnit(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Quantités rapides (séparées par des virgules)</label>
            <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="1, 2, 5" />
          </div>
          <div className="field">
            <label>Fournisseurs *</label>
            <div className="supcheck">
              {suppliers.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={supplierIds.includes(s.id)}
                    onChange={() => toggleSupplier(s.id)}
                  />
                  {s.icon} {s.name}
                </label>
              ))}
              {!suppliers.length && <div className="small">Aucun fournisseur. Ajoutez-en un d'abord.</div>}
            </div>
          </div>
          {error && <div className="notice">{error}</div>}
          <div className="actionrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Enregistrer'}
            </button>
            <button className="btn secondary" type="button" onClick={onClose}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
