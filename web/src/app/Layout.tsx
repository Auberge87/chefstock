import { Link, Outlet } from 'react-router-dom'
import { useOrganization } from '../features/auth/useOrganization'
import { useAuth } from '../features/auth/AuthProvider'

export function Layout() {
  const { data: org } = useOrganization()
  const { signOut } = useAuth()

  return (
    <>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={{ flex: 1, textDecoration: 'none', color: '#fff' }}>
            <h1>
              Chef Stock <small style={{ fontSize: 12, opacity: 0.8 }}>Web</small>
            </h1>
            <p>{org?.name ?? 'Configuration…'}</p>
          </Link>
          <Link
            to="/settings"
            className="btn secondary"
            style={{
              background: '#fff',
              color: '#245c49',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            title="Réglages"
          >
            ⚙️
          </Link>
          <button
            className="btn secondary"
            style={{ background: '#fff', color: '#245c49' }}
            onClick={() => signOut()}
          >
            Déconnexion
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
