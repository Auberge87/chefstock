import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePurchasingStats } from './useAnalytics'

export function SupplierStatsPage() {
  const { id } = useParams<{ id: string }>()
  const stats = usePurchasingStats()

  const supplier = useMemo(() => stats.suppliers.find((s) => s.supplierId === id), [stats.suppliers, id])

  if (stats.isLoading) return <div className="small">Chargement…</div>
  if (!supplier) {
    return (
      <div>
        <Link to="/analytics" className="small">← Retour aux statistiques</Link>
        <div className="box" style={{ marginTop: 14 }}>Fournisseur introuvable.</div>
      </div>
    )
  }

  return (
    <div>
      <Link to="/analytics" className="small">← Retour aux statistiques</Link>
      <div className="top" style={{ marginTop: 8 }}>
        <h2>
          {supplier.icon} {supplier.name}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {(
          [
            ['Ce mois-ci', supplier.spendThisMonth],
            ['Cette année', supplier.spendThisYear],
            ['Total', supplier.spendAllTime],
          ] as const
        ).map(([label, spend]) => (
          <div key={label} className="box" style={{ flex: '1 1 140px' }}>
            <div className="small">{label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--g)' }}>{spend.toFixed(2)} €</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Nombre de commandes</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{supplier.ordersCount}</div>
        </div>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Panier moyen</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{supplier.avgOrderValue.toFixed(2)} €</div>
        </div>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Dernière commande</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {supplier.lastOrderDate ? supplier.lastOrderDate.toLocaleDateString('fr-FR') : '—'}
          </div>
        </div>
      </div>

      {supplier.topProducts.length > 0 && (
        <div className="box">
          <h4 style={{ marginTop: 0 }}>Produits les plus achetés</h4>
          {supplier.topProducts.map((p, i) => (
            <Link
              key={p.key}
              to={`/analytics/product/${encodeURIComponent(p.key)}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < supplier.topProducts.length - 1 ? '1px solid #eee' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <strong>{p.name}</strong>
              <span className="small">
                {p.qty.toFixed(1)} {p.unit} · {p.spend.toFixed(2)} €
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
