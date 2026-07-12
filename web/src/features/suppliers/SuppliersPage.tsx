import { useState } from 'react'
import { useSuppliers, useSupplierMutations } from './useSuppliers'
import { SupplierForm } from './SupplierForm'
import type { Supplier } from '../../types/database'

const DAY_LABELS: Record<string, string> = {
  Monday: 'Lundi',
  Tuesday: 'Mardi',
  Wednesday: 'Mercredi',
  Thursday: 'Jeudi',
  Friday: 'Vendredi',
  Saturday: 'Samedi',
  Sunday: 'Dimanche',
}

export function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers()
  const { remove } = useSupplierMutations()
  const [editing, setEditing] = useState<Supplier | null | 'new'>(null)

  return (
    <div>
      <div className="top">
        <h2>🚚 Fournisseurs</h2>
        <button className="btn primary sm" onClick={() => setEditing('new')}>
          ＋ Nouveau
        </button>
      </div>

      {isLoading && <div className="small">Chargement…</div>}
      {!isLoading && !suppliers?.length && <div className="box">Aucun fournisseur actif.</div>}

      <div className="list">
        {suppliers?.map((s) => (
          <div className="box" key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {s.icon} {s.name}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn primary sm" onClick={() => setEditing(s)}>
                  ✏️ Éditer
                </button>
                <button
                  className="icobtn d"
                  title="Supprimer"
                  onClick={() => {
                    if (confirm(`Supprimer le fournisseur « ${s.name} » ?`)) remove.mutate(s.id)
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
            <div className="small">
              <div>
                <b>Méthode :</b>{' '}
                {{ email: 'E-mail', phone: 'Téléphone', website: 'Site internet' }[s.ordering_method] ?? s.ordering_method}
              </div>
              {s.email && (
                <div>
                  <b>Email :</b> {s.email}
                </div>
              )}
              {s.phone && (
                <div>
                  <b>Téléphone :</b> {s.phone}
                </div>
              )}
              {s.website && (
                <div>
                  <b>Site :</b> {s.website}
                </div>
              )}
              <div>
                <b>Minimum commande :</b> {s.min_order_amount.toFixed(2)} €
              </div>
              {s.delivery_days.length > 0 && (
                <div>
                  <b>Livraison :</b> {s.delivery_days.map((d) => DAY_LABELS[d] ?? d).join(', ')}
                </div>
              )}
              {s.order_deadline && (
                <div>
                  <b>Commande avant :</b> {s.order_deadline}
                </div>
              )}
              {s.notes && (
                <div>
                  <b>Notes :</b> {s.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <SupplierForm supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
