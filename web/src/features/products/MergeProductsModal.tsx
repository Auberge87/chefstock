import { useState } from 'react'
import type { Supplier } from '../../types/database'
import { useProductMutations, type ProductWithSuppliers } from './useProducts'

export function MergeProductsModal({
  group,
  suppliers,
  onClose,
}: {
  group: ProductWithSuppliers[]
  suppliers: Supplier[]
  onClose: () => void
}) {
  const { merge } = useProductMutations()
  const [keepId, setKeepId] = useState(group[0].id)
  const [saving, setSaving] = useState(false)

  async function handleMerge() {
    setSaving(true)
    try {
      const loserIds = group.filter((p) => p.id !== keepId).map((p) => p.id)
      await merge.mutateAsync({ keepId, loserIds })
      onClose()
    } catch (err) {
      alert('Erreur lors de la fusion : ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Fusionner ces produits</h3>
        <p className="small">
          Choisissez la fiche à conserver. Les fournisseurs, l'historique de commandes et le suivi de stock des
          autres seront automatiquement rattachés à celle-ci, puis les doublons seront supprimés.
        </p>
        <div className="list" style={{ gap: 8 }}>
          {group.map((p) => {
            const supNames = p.supplierIds.map((id) => suppliers.find((s) => s.id === id)).filter(Boolean)
            return (
              <label
                key={p.id}
                className="box"
                style={{ display: 'block', cursor: 'pointer', borderColor: keepId === p.id ? 'var(--g)' : undefined, borderWidth: keepId === p.id ? 2 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input type="radio" name="keep" checked={keepId === p.id} onChange={() => setKeepId(p.id)} />
                  <strong>{p.name}</strong>
                  {keepId === p.id && <span className="pill okp">Conserver</span>}
                </div>
                <div className="small">
                  <div>
                    <b>Catégorie :</b> {p.category} · <b>Unité :</b> {p.unit}
                    {p.packaging ? ` · ${p.packaging}` : ''}
                  </div>
                  <div>
                    <b>Prix estimé :</b> {p.estimated_price.toFixed(2)} €
                  </div>
                  {!!supNames.length && (
                    <div>
                      <b>Fournisseurs :</b> {supNames.map((s) => `${s!.icon} ${s!.name}`).join(', ')}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
        <div className="actionrow">
          <button className="btn primary" onClick={handleMerge} disabled={saving}>
            {saving ? '…' : '🔗 Fusionner'}
          </button>
          <button className="btn secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
