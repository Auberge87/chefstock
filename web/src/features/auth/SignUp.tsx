import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signUp(email, password)
    setBusy(false)
    if (error) setError(error)
    else setDone(true)
  }

  if (done) {
    return (
      <main style={{ maxWidth: 420 }}>
        <div className="obcard">
          <h2>Compte créé ✓</h2>
          <p className="lede">
            Si la confirmation par e-mail est activée sur ce projet, vérifiez votre boîte mail avant de
            vous connecter.
          </p>
          <div className="actionrow">
            <button className="btn primary" onClick={() => navigate('/login')}>
              Se connecter
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <div className="obcard">
        <h2>Créer un compte</h2>
        <p className="lede">Un nouveau restaurant sera créé automatiquement pour vous.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="notice">{error}</div>}
          <div className="actionrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Créer mon compte'}
            </button>
          </div>
        </form>
        <p className="small" style={{ marginTop: 16 }}>
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </main>
  )
}
