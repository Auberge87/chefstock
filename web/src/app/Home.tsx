import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '../features/auth/useOrganization'
import { ImportInvoiceModal } from '../features/import/ImportInvoiceModal'
import { useProducts } from '../features/products/useProducts'
import { useSuppliers } from '../features/suppliers/useSuppliers'
import { useCart } from '../features/cart/CartContext'
import { pickSupplierFor } from '../features/cart/pickSupplier'
import { unitPrice } from '../lib/pricing'
import { useOpenOrders } from '../features/orders/useOrdersHistory'
import { useSavedDrafts } from '../features/orders/useSavedDrafts'
import { useInventory } from '../features/inventory/useInventory'
import { usePurchasingStats } from '../features/analytics/useAnalytics'
import { useInsights } from '../features/analytics/useInsights'
import { InsightList } from '../features/analytics/InsightList'
import { useLastScan } from '../features/analytics/useLastScan'
import { useAlerts } from '../features/alerts/useAlerts'
import { AlertCard } from '../features/alerts/AlertsPage'

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

function todayISODate() {
  return new Date().toLocaleDateString('sv-SE')
}

export function Home() {
  const { data: org, isLoading, error } = useOrganization()
  const [showImport, setShowImport] = useState(false)

  const { data: products } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { quantities, supplierChoice, itemCount } = useCart()
  const { data: openOrders } = useOpenOrders()
  const { data: drafts } = useSavedDrafts()
  const { data: inventory } = useInventory()
  const stats = usePurchasingStats()
  const alerts = useAlerts()
  const { insights } = useInsights(4)
  const { data: lastScan } = useLastScan()

  const today = todayISODate()
  const deliveriesToday = (openOrders ?? []).filter((o) => o.delivery_date === today).length
  const lowStockCount = (inventory ?? []).filter((r) => r.current <= r.min_qty).length
  const pendingCount = (drafts?.length ?? 0) + (itemCount > 0 ? 1 : 0)
  const warnAlerts = alerts.filter((a) => a.severity === 'warn').length

  const cartBySupplier = useMemo(() => {
    if (!products || !suppliers) return []
    const totals = new Map<string, number>()
    for (const [productId, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      const product = products.find((p) => p.id === productId)
      if (!product) continue
      const supplierId = pickSupplierFor(product, supplierChoice)
      if (!supplierId) continue
      totals.set(supplierId, (totals.get(supplierId) ?? 0) + qty * unitPrice(product))
    }
    return [...totals.entries()]
      .map(([supplierId, total]) => ({ supplier: suppliers.find((s) => s.id === supplierId), total }))
      .filter((x): x is { supplier: NonNullable<typeof x.supplier>; total: number } => !!x.supplier)
  }, [products, suppliers, quantities, supplierChoice])

  const supplierLeaderboard = useMemo(
    () => [...stats.suppliers].filter((s) => s.spendThisMonth > 0).sort((a, b) => b.spendThisMonth - a.spendThisMonth).slice(0, 4),
    [stats.suppliers],
  )

  const recentAlerts = alerts.slice(0, 3)

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 4px' }}>
          Bonjour{org?.name && org.name !== 'Nouveau restaurant' ? `, ${org.name}` : ''}
        </h2>
        <p className="small">
          {isLoading && 'Chargement de votre restaurant…'}
          {error && 'Impossible de charger votre organisation.'}
          {!isLoading && !error && new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
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
          width: '100%', padding: 14, fontSize: 14, fontWeight: 600, marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onClick={() => setShowImport(true)}
      >
        📸 Importer une facture / fournisseur
      </button>

      <div className="kpi-grid">
        <Link to="/orders" className={`kpi ${pendingCount > 0 ? 'info' : 'neutral'}`}>
          <div className="kpi-top"><span className="kpi-ico">📝</span></div>
          <div className="kpi-val">{pendingCount}</div>
          <div className="kpi-label">Commande{pendingCount > 1 ? 's' : ''} en attente d'envoi</div>
        </Link>
        <Link to="/delivery" className={`kpi ${deliveriesToday > 0 ? 'info' : 'neutral'}`}>
          <div className="kpi-top"><span className="kpi-ico">🚚</span></div>
          <div className="kpi-val">{deliveriesToday}</div>
          <div className="kpi-label">Livraison{deliveriesToday > 1 ? 's' : ''} prévue{deliveriesToday > 1 ? 's' : ''} aujourd'hui</div>
        </Link>
        <Link to="/analytics" className="kpi success">
          <div className="kpi-top"><span className="kpi-ico">💶</span></div>
          <div className="kpi-val">{stats.totalSpendThisMonth.toFixed(0)} €</div>
          <div className="kpi-label">Achats ce mois-ci</div>
        </Link>
        <Link to="/inventory" className={`kpi ${lowStockCount > 0 ? 'warn' : 'neutral'}`}>
          <div className="kpi-top"><span className="kpi-ico">📦</span></div>
          <div className="kpi-val">{lowStockCount}</div>
          <div className="kpi-label">Produit{lowStockCount > 1 ? 's' : ''} en stock faible</div>
        </Link>
        <Link to="/alerts" className={`kpi ${warnAlerts > 0 ? 'danger' : alerts.length > 0 ? 'info' : 'neutral'}`}>
          <div className="kpi-top"><span className="kpi-ico">🔔</span></div>
          <div className="kpi-val">{alerts.length}</div>
          <div className="kpi-label">Alerte{alerts.length > 1 ? 's' : ''} active{alerts.length > 1 ? 's' : ''}</div>
        </Link>
      </div>

      {cartBySupplier.length > 0 && (
        <>
          <div className="section-title">🎯 Minimum de commande en cours</div>
          <div className="box">
            {cartBySupplier.map(({ supplier, total }) => {
              const min = supplier.min_order_amount
              const reached = min <= 0 || total >= min
              const pct = min > 0 ? Math.min(100, (total / min) * 100) : 100
              return (
                <div key={supplier.id} style={{ marginBottom: 10 }}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                    {reached ? '🟢' : '🟠'} {supplier.icon} {supplier.name} — {total.toFixed(2)} € / {min} €
                  </div>
                  <div className="progressbar">
                    <div style={{ background: reached ? 'var(--g)' : 'var(--warn)', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {insights.length > 0 && (
        <>
          <div className="section-title">
            💡 Analyse d'achat
            <Link to="/analytics">Voir tout →</Link>
          </div>
          <InsightList insights={insights} />
        </>
      )}

      {supplierLeaderboard.length > 0 && (
        <>
          <div className="section-title">
            🚚 Dépenses par fournisseur (ce mois-ci)
            <Link to="/analytics">Voir tout →</Link>
          </div>
          <div className="box">
            {supplierLeaderboard.map((s) => (
              <Link
                key={s.supplierId}
                to={`/analytics/supplier/${s.supplierId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0', textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>
                  {s.icon} {s.name}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{s.spendThisMonth.toFixed(2)} €</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {recentAlerts.length > 0 && (
        <>
          <div className="section-title">
            🔔 Alertes récentes
            <Link to="/alerts">Voir tout →</Link>
          </div>
          {recentAlerts.map((a) => (
            <AlertCard key={a.id} a={a} />
          ))}
        </>
      )}

      {lastScan && (
        <>
          <div className="section-title">📸 Dernier scan de facture</div>
          <div className="box">
            <div style={{ fontWeight: 600 }}>
              {lastScan.suppliers ? `${lastScan.suppliers.icon} ${lastScan.suppliers.name}` : lastScan.products?.name ?? 'Facture scannée'}
            </div>
            <div className="small">
              {new Date(lastScan.recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </>
      )}

      <div className="section-title">Accès rapide</div>
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
