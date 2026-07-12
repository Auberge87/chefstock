import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import { seedDemoData } from './seedDemoData'

export function OnboardingPage() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [name, setName] = useState(org?.name ?? '')
  const [city, setCity] = useState(org?.city ?? '')
  const [contact, setContact] = useState(org?.contact ?? '')
  const [email, setEmail] = useState(org?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!org) return
    setBusy(true)
    await supabase
      .from('organizations')
      .update({ name: name.trim() || 'Nouveau restaurant', city, contact, email })
      .eq('id', org.id)
    await queryClient.invalidateQueries({ queryKey: ['organization', org.id] })
    setBusy(false)
    navigate('/')
  }

  async function handleSeedDemo() {
    if (!org) return
    if (!confirm('Charger des fournisseurs et produits de démonstration ?')) return
    setSeeding(true)
    try {
      const result = await seedDemoData(org.id)
      await queryClient.invalidateQueries()
      alert(`Chargé : ${result.suppliers} fournisseurs, ${result.products} produits.`)
      navigate('/')
    } catch (err) {
      alert('Erreur lors du chargement : ' + (err as Error).message)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="obcard">
        <h2>Votre restaurant</h2>
        <p className="lede">Juste l'essentiel. Vous pourrez tout modifier plus tard dans Réglages.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom du restaurant</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. L'Auberge Provençale" />
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
          <div className="actionrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Continuer →'}
            </button>
          </div>
        </form>
        <div className="actionrow" style={{ marginTop: 16 }}>
          <button className="btn secondary" onClick={handleSeedDemo} disabled={seeding}>
            {seeding ? '…' : 'Ou charger l’exemple L’Auberge Provençale'}
          </button>
        </div>
      </div>
    </div>
  )
}
