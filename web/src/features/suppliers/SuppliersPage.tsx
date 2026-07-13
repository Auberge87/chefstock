import { useMemo, useState } from 'react'
import { useSuppliers, useSupplierMutations } from './useSuppliers'
import { SupplierForm } from './SupplierForm'
import { MergeSuppliersModal } from './MergeSuppliersModal'
import { similarity, SIM_KNOWN } from '../../lib/similarity'
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

function findDuplicateGroups(suppliers: Supplier[]): Supplier[][] {
  const parent = new Map<string, string>()
  suppliers.forEach((s) => parent.set(s.id, s.id))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))

  for (let i = 0; i < suppliers.length; i++) {
    for (let j = i + 1; j < suppliers.length; j++) {
      if (similarity(suppliers[i].name, suppliers[j].name) >= SIM_KNOWN) union(suppliers[i].id, suppliers[j].id)
    }
  }
  const groups = new Map<string, Supplier[]>()
  suppliers.forEach((s) => {
    const root = find(s.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(s)
  })
  return [...groups.values()].filter((g) => g.length > 1)
}

export function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers()
  const { remove } = useSupplierMutations()
  const [editing, setEditing] = useState<Supplier | null | 'new'>(null)
  const [mergingGroup, setMergingGroup] = useState<Supplier[] | null>(null)

  const duplicateGroups = useMemo(() => (suppliers ? findDuplicateGroups(suppliers) : []), [suppliers])

  return (
    <div>
      <div className="top">
        <h2>🚚 Fournisseurs</h2>
        <button className="btn primary sm" onClick={() => setEditing('new')}>
          ＋ Nouveau
        </button>
      </div>

      {!!duplicateGroups.length && (
        <div className="notice">
          <b>⚠ Doublons potentiels détectés :</b>
          {duplicateGroups.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
              <span>{g.map((s) => `${s.icon} ${s.name}`).join('  ≈  ')}</span>
              <button className="btn secondary sm" onClick={() => setMergingGroup(g)}>
                🔗 Fusionner
              </button>
            </div>
          ))}
        </div>
      )}

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
      {mergingGroup && <MergeSuppliersModal group={mergingGroup} onClose={() => setMergingGroup(null)} />}
    </div>
  )
}
