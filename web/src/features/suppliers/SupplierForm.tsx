import { useState, type FormEvent } from 'react'
import type { Supplier } from '../../types/database'
import { useSupplierMutations, useSuppliers } from './useSuppliers'
import { similarity, SIM_MAYBE } from '../../lib/similarity'

const DAYS = [
  { key: 'Monday', label: 'Lundi' },
  { key: 'Tuesday', label: 'Mardi' },
  { key: 'Wednesday', label: 'Mercredi' },
  { key: 'Thursday', label: 'Jeudi' },
  { key: 'Friday', label: 'Vendredi' },
  { key: 'Saturday', label: 'Samedi' },
  { key: 'Sunday', label: 'Dimanche' },
]

const COMMON_ICONS = ['📦', '🥬', '🧀', '🥩', '🐟', '🍞', '🍷', '🧊']

interface Props {
  supplier?: Supplier | null
  onClose: () => void
}

export function SupplierForm({ supplier, onClose }: Props) {
  const { create, update } = useSupplierMutations()
  const { data: suppliers } = useSuppliers()
  const [name, setName] = useState(supplier?.name ?? '')
  const [icon, setIcon] = useState(supplier?.icon ?? '📦')
  const [orderingMethod, setOrderingMethod] = useState(supplier?.ordering_method ?? 'email')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [website, setWebsite] = useState(supplier?.website ?? '')
  const [minOrder, setMinOrder] = useState(String(supplier?.min_order_amount ?? 100))
  const [days, setDays] = useState<string[]>(supplier?.delivery_days ?? [])
  const [deadline, setDeadline] = useState(supplier?.order_deadline ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const busy = create.isPending || update.isPending

  function toggleDay(day: string) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = {
      name: name.trim(),
      icon,
      ordering_method: orderingMethod,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      min_order_amount: Number(minOrder) || 0,
      delivery_days: days,
      order_deadline: deadline.trim() || null,
      notes: notes.trim() || null,
    }
    if (supplier) {
      await update.mutateAsync({ id: supplier.id, ...input })
    } else {
      const bestMatch = suppliers
        ?.map((s) => ({ s, sim: similarity(input.name, s.name) }))
        .sort((a, b) => b.sim - a.sim)[0]
      if (bestMatch && bestMatch.sim >= SIM_MAYBE) {
        const proceed = confirm(
          `Un fournisseur similaire existe déjà : « ${bestMatch.s.name} ».\n\nCréer quand même un nouveau fournisseur ?`,
        )
        if (!proceed) return
      }
      await create.mutateAsync(input)
    }
    onClose()
  }

  return (
    <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Icône</label>
            <div className="choices">
              {COMMON_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={icon === ic ? 'active' : ''}
                  onClick={() => setIcon(ic)}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Nom *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Méthode de commande</label>
            <select value={orderingMethod} onChange={(e) => setOrderingMethod(e.target.value)}>
              <option value="email">E-mail</option>
              <option value="phone">Téléphone</option>
              <option value="website">Site internet</option>
            </select>
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Téléphone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Site web</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div className="field">
            <label>Minimum de commande (€)</label>
            <input type="number" step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </div>
          <div className="field">
            <label>Jours de livraison</label>
            <div className="supcheck">
              {DAYS.map((d) => (
                <label key={d.key}>
                  <input type="checkbox" checked={days.includes(d.key)} onChange={() => toggleDay(d.key)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Commande avant (heure)</label>
            <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="18:00" />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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
