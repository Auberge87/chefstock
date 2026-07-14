import { useAlerts, useDismissAlert, type Alert } from './useAlerts'

const PRICE_UP_COLOR = '#ff3b30'
const PRICE_DOWN_COLOR = '#1a73e8'

function priceArrow(direction: 'up' | 'down') {
  const color = direction === 'up' ? PRICE_UP_COLOR : PRICE_DOWN_COLOR
  return (
    <span style={{ color, fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{direction === 'up' ? '↗' : '↘'}</span>
  )
}

function pct(a: Alert) {
  if (!a.oldPrice || a.change == null) return '0.0'
  const p = (a.change / a.oldPrice) * 100
  return (p > 0 ? '+' : '') + p.toFixed(1)
}

export function AlertCard({ a, onDismiss }: { a: Alert; onDismiss?: () => void }) {
  let inner: React.ReactNode = null
  let border = 'var(--g)'

  if (a.type === 'price-up') {
    border = PRICE_UP_COLOR
    inner = (
      <>
        <div style={{ fontWeight: 600, color: PRICE_UP_COLOR, display: 'flex', alignItems: 'center', gap: 6 }}>
          {priceArrow('up')} Prix en hausse : {a.product} <span style={{ fontWeight: 700 }}>({pct(a)}%)</span>
        </div>
        <div className="small">
          Augmentation : +{a.change?.toFixed(2)} € ({a.oldPrice?.toFixed(2)} € → {a.newPrice?.toFixed(2)} €)
        </div>
      </>
    )
  } else if (a.type === 'price-down') {
    border = PRICE_DOWN_COLOR
    inner = (
      <>
        <div style={{ fontWeight: 600, color: PRICE_DOWN_COLOR, display: 'flex', alignItems: 'center', gap: 6 }}>
          {priceArrow('down')} Prix en baisse : {a.product} <span style={{ fontWeight: 700 }}>({pct(a)}%)</span>
        </div>
        <div className="small">
          Baisse : {a.change?.toFixed(2)} € ({a.oldPrice?.toFixed(2)} € → {a.newPrice?.toFixed(2)} €)
        </div>
      </>
    )
  } else if (a.type === 'price-low') {
    inner = (
      <>
        <div style={{ fontWeight: 600, color: 'var(--g)' }}>✨ Prix au plus bas</div>
        <div className="small">
          {a.product} : {a.price?.toFixed(2)} € (meilleur prix du mois)
        </div>
      </>
    )
  } else if (a.type === 'min-order') {
    border = 'var(--warn)'
    inner = (
      <>
        <div style={{ fontWeight: 600, color: 'var(--warn)' }}>⚠️ Minimum non atteint</div>
        <div className="small">
          {a.supplier} : {a.current?.toFixed(2)} € / {((a.current ?? 0) + (a.needed ?? 0)).toFixed(2)} € manquants
        </div>
      </>
    )
  }

  return (
    <div
      className="box"
      style={{ borderLeft: `4px solid ${border}`, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}
    >
      <div style={{ minWidth: 0 }}>{inner}</div>
      {onDismiss && (
        <button type="button" className="icobtn d" title="Supprimer l'alerte" style={{ flex: 'none' }} onClick={onDismiss}>
          🗑
        </button>
      )}
    </div>
  )
}

export function AlertsPage() {
  const alerts = useAlerts()
  const dismiss = useDismissAlert()

  return (
    <div>
      <div className="top">
        <h2>🔔 Alertes</h2>
      </div>
      <div style={{ marginBottom: 14 }}>Alertes actives : {alerts.length}</div>
      {!alerts.length && (
        <div className="box" style={{ textAlign: 'center', padding: 20, background: '#f0fdf4' }}>
          <p style={{ margin: 0, color: '#166534' }}>✓ Aucune alerte</p>
        </div>
      )}
      {alerts.map((a) => (
        <AlertCard key={a.id} a={a} onDismiss={() => dismiss.mutate(a.id)} />
      ))}
    </div>
  )
}
