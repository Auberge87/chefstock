import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <main className="small">Chargement…</main>
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
