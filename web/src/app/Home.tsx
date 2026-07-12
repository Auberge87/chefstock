import { Link } from 'react-router-dom'
import { useOrganization } from '../features/auth/useOrganization'

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
      <div className="grid">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card" style={{ textDecoration: 'none', textAlign: 'center' }}>
            <span className="ico">{l.icon}</span>
            <strong>{l.label}</strong>
          </Link>
        ))}
      </div>
    </div>
  )
}
