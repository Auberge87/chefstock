import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import { seedDemoData } from '../onboarding/seedDemoData'

export function SettingsPage() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()
  const [name, setName] = useState(org?.name ?? '')
  const [city, setCity] = useState(org?.city ?? '')
  const [contact, setContact] = useState(org?.contact ?? '')
  const [email, setEmail] = useState(org?.email ?? '')
  const [signature, setSignature] = useState(org?.signature ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!org) return
    setName(org.name ?? '')
    setCity(org.city ?? '')
    setContact(org.contact ?? '')
    setEmail(org.email ?? '')
    setSignature(org.signature ?? '')
  }, [org])
  const [seeding, setSeeding] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!org) return
    setBusy(true)
    await supabase.from('organizations').update({ name, city, contact, email, signature }).eq('id', org.id)
    await queryClient.invalidateQueries({ queryKey: ['organization', org.id] })
    setBusy(false)
  }

  async function handleSeedDemo() {
    if (!org) return
    if (!confirm('Ajouter des fournisseurs et produits de démonstration ?')) return
    setSeeding(true)
    try {
      const result = await seedDemoData(org.id)
      await queryClient.invalidateQueries()
      alert(`Ajouté : ${result.suppliers} fournisseurs, ${result.products} produits.`)
    } catch (err) {
      alert('Erreur : ' + (err as Error).message)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="top">
        <h2>⚙️ Réglages</h2>
      </div>
      <div className="box">
        <h3 style={{ marginTop: 0 }}>Restaurant</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom du restaurant</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="rowline">
            <div className="field" style={{ flex: 1 }}>
              <label>Ville</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Contact</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>E-mail d'envoi des commandes</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Signature des commandes (optionnel)</label>
            <textarea rows={3} value={signature ?? ''} onChange={(e) => setSignature(e.target.value)} />
          </div>
          <div className="actionrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      <div className="box" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Données de démonstration</h3>
        <p className="small">Ajoute les fournisseurs et produits de l'exemple L'Auberge Provençale.</p>
        <div className="actionrow">
          <button className="btn secondary" onClick={handleSeedDemo} disabled={seeding}>
            {seeding ? '…' : '📋 Charger l’exemple'}
          </button>
        </div>
      </div>
    </div>
  )
}
