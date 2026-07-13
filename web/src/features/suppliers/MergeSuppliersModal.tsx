import { useState } from 'react'
import type { Supplier } from '../../types/database'
import { useSupplierMutations } from './useSuppliers'

const DAY_LABELS: Record<string, string> = {
  Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi', Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche',
}

export function MergeSuppliersModal({ group, onClose }: { group: Supplier[]; onClose: () => void }) {
  const { merge } = useSupplierMutations()
  const [keepId, setKeepId] = useState(group[0].id)
  const [saving, setSaving] = useState(false)

  async function handleMerge() {
    setSaving(true)
    try {
      const loserIds = group.filter((s) => s.id !== keepId).map((s) => s.id)
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
        <h3>Fusionner ces fournisseurs</h3>
        <p className="small">
          Choisissez la fiche à conserver. Les produits, l'historique de commandes et les livraisons des autres
          seront automatiquement rattachés à celle-ci, puis les doublons seront supprimés.
        </p>
        <div className="list" style={{ gap: 8 }}>
          {group.map((s) => (
            <label
              key={s.id}
              className="box"
              style={{ display: 'block', cursor: 'pointer', borderColor: keepId === s.id ? 'var(--g)' : undefined, borderWidth: keepId === s.id ? 2 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="radio" name="keep" checked={keepId === s.id} onChange={() => setKeepId(s.id)} />
                <strong>
                  {s.icon} {s.name}
                </strong>
                {keepId === s.id && <span className="pill okp">Conserver</span>}
              </div>
              <div className="small">
                <div>
                  <b>Méthode :</b> {{ email: 'E-mail', phone: 'Téléphone', website: 'Site internet' }[s.ordering_method] ?? s.ordering_method}
                </div>
                {s.email && <div><b>Email :</b> {s.email}</div>}
                {s.phone && <div><b>Téléphone :</b> {s.phone}</div>}
                {s.website && <div><b>Site :</b> {s.website}</div>}
                <div><b>Minimum commande :</b> {s.min_order_amount.toFixed(2)} €</div>
                {s.delivery_days.length > 0 && (
                  <div><b>Livraison :</b> {s.delivery_days.map((d) => DAY_LABELS[d] ?? d).join(', ')}</div>
                )}
                {s.notes && <div><b>Notes :</b> {s.notes}</div>}
              </div>
            </label>
          ))}
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
