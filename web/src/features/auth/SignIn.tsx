import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function SignIn() {
  const { signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) setError(error)
    else navigate('/')
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <div className="obcard">
        <h2>Connexion</h2>
        <p className="lede">Accédez à votre restaurant Chef Stock.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="notice">{error}</div>}
          <div className="actionrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Se connecter'}
            </button>
          </div>
        </form>
        <p className="small" style={{ marginTop: 16 }}>
          Pas encore de compte ? <Link to="/signup">Créer un compte</Link>
        </p>
      </div>
    </main>
  )
}
