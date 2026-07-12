import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '../features/auth/useOrganization'
import { ImportInvoiceModal } from '../features/import/ImportInvoiceModal'

const QUICK_LINKS = [
  { to: '/products', icon: '🛒', label: 'Préparer' },
  { to: '/manage', icon: '📦', label: 'Produits' },
  { to: '/suppliers', icon: '🚚', label: 'Fournisseurs' },
  { to: '/analytics', icon: '📊', label: 'Analyses' },
  { to: '/alerts', icon: '🔔', label: 'Alertes' },
  { to: '/inventory', icon: '📋', label: 'Stocks' },
  { to: '/history', icon: '🕓', label: 'Historique' },
  { to: '/settings', icon: '⚙️', label: 'Réglages' },
]

export function Home() {
  const { data: org, isLoading, error } = useOrganization()
  const [showImport, setShowImport] = useState(false)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>
          Bonjour{org?.name ? `, ${org.name}` : ''}
        </h2>
        <p className="small">
          {isLoading && "Chargement de votre restaurant…"}
          {error && "Impossible de charger votre organisation."}
          {!isLoading && !error && 'Bienvenue sur la nouvelle version de Chef Stock.'}
        </p>
      </div>
      {org?.name === 'Nouveau restaurant' && (
        <div className="notice">
          Configurez votre restaurant pour commencer. <Link to="/onboarding">Configurer maintenant →</Link>
        </div>
      )}

      <button
        className="btn primary"
        style={{
          width: '100%', padding: 16, fontSize: 15, fontWeight: 600, marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onClick={() => setShowImport(true)}
      >
        📸 Importer une facture / fournisseur
      </button>

      <div className="grid">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card" style={{ textDecoration: 'none', textAlign: 'center' }}>
            <span className="ico">{l.icon}</span>
            <strong>{l.label}</strong>
          </Link>
        ))}
      </div>

      {showImport && <ImportInvoiceModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
