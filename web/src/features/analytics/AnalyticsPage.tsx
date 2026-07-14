import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'
import { usePurchasingStats } from './useAnalytics'

ChartJS.register(ArcElement, Tooltip, Legend)

const CHART_CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']

function priceArrow(direction: 'up' | 'down' | 'flat' | null) {
  if (direction === 'up') return <span style={{ color: 'var(--danger)' }}>▲</span>
  if (direction === 'down') return <span style={{ color: '#2a78d6' }}>▼</span>
  return null
}

export function AnalyticsPage() {
  const stats = usePurchasingStats()
  const [search, setSearch] = useState('')

  const supplierLeaderboard = useMemo(() => [...stats.suppliers].sort((a, b) => b.spendThisMonth - a.spendThisMonth), [stats.suppliers])

  const supplierPie = useMemo(() => {
    let sorted = supplierLeaderboard.filter((s) => s.spendThisMonth > 0)
    if (sorted.length > CHART_CATEGORICAL.length) {
      const head = sorted.slice(0, CHART_CATEGORICAL.length - 1)
      const rest = sorted.slice(CHART_CATEGORICAL.length - 1)
      const autres = rest.reduce((s, x) => s + x.spendThisMonth, 0)
      return [...head, { supplierId: '__autres', name: 'Autres', icon: '', spendThisMonth: autres } as (typeof sorted)[number]]
    }
    return sorted
  }, [supplierLeaderboard])

  const topProductsByQtyThisMonth = useMemo(
    () => [...stats.products].filter((p) => p.qtyThisMonth > 0).sort((a, b) => b.qtyThisMonth - a.qtyThisMonth).slice(0, 10),
    [stats.products],
  )

  const priceMovers = useMemo(() => {
    const withChange = stats.products.filter((p) => p.priceChangePct != null && p.priceDirection !== 'flat')
    const up = [...withChange].filter((p) => p.priceDirection === 'up').sort((a, b) => (b.priceChangePct ?? 0) - (a.priceChangePct ?? 0)).slice(0, 5)
    const down = [...withChange].filter((p) => p.priceDirection === 'down').sort((a, b) => (a.priceChangePct ?? 0) - (b.priceChangePct ?? 0)).slice(0, 5)
    return { up, down }
  }, [stats.products])

  const allProducts = useMemo(() => {
    const term = search.toLowerCase()
    return [...stats.products]
      .filter((p) => p.name.toLowerCase().includes(term))
      .sort((a, b) => b.totalSpend - a.totalSpend)
  }, [stats.products, search])

  return (
    <div>
      <div className="top">
        <h2>📊 Statistiques</h2>
      </div>

      {stats.isLoading && <div className="small">Chargement…</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {(
          [
            ['Cette semaine', stats.totalSpendThisWeek, stats.ordersThisWeek],
            ['Ce mois-ci', stats.totalSpendThisMonth, stats.ordersThisMonth],
            ['Cette année', stats.totalSpendThisYear, stats.ordersThisYear],
          ] as const
        ).map(([label, spend, count]) => (
          <div
            key={label}
            className="box"
            style={{ flex: '1 1 150px', background: 'linear-gradient(135deg,rgba(36,92,73,0.08),rgba(36,92,73,0.02))' }}
          >
            <div className="small">{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--g)', margin: '4px 0' }}>{spend.toFixed(2)} €</div>
            <div className="small">{count} commande{count > 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {supplierLeaderboard.length > 0 && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Dépenses par fournisseur (ce mois-ci)</h4>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {supplierPie.length > 0 && (
              <div style={{ flex: '1 1 200px', minWidth: 180, maxHeight: 250 }}>
                <Pie
                  data={{
                    labels: supplierPie.map((s) => s.name),
                    datasets: [{ data: supplierPie.map((s) => s.spendThisMonth), backgroundColor: supplierPie.map((_, i) => CHART_CATEGORICAL[i] ?? '#898781') }],
                  }}
                  options={{ plugins: { legend: { display: false } } }}
                />
              </div>
            )}
            <div style={{ flex: '2 1 260px', minWidth: 220 }}>
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
                  <span className="small">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {(priceMovers.up.length > 0 || priceMovers.down.length > 0) && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Évolution des prix</h4>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>▲ En hausse</div>
              {priceMovers.up.length === 0 && <div className="small">Aucune hausse récente.</div>}
              {priceMovers.up.map((p) => (
                <Link
                  key={p.key}
                  to={`/analytics/product/${encodeURIComponent(p.key)}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>+{(p.priceChangePct ?? 0).toFixed(0)}%</span>
                </Link>
              ))}
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>▼ En baisse</div>
              {priceMovers.down.length === 0 && <div className="small">Aucune baisse récente.</div>}
              {priceMovers.down.map((p) => (
                <Link
                  key={p.key}
                  to={`/analytics/product/${encodeURIComponent(p.key)}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2a78d6' }}>{(p.priceChangePct ?? 0).toFixed(0)}%</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {topProductsByQtyThisMonth.length > 0 && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Top produits achetés (ce mois-ci)</h4>
          {topProductsByQtyThisMonth.map((p, i) => (
            <Link
              key={p.key}
              to={`/analytics/product/${encodeURIComponent(p.key)}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < topProductsByQtyThisMonth.length - 1 ? '1px solid #eee' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <strong>{p.name}</strong>
              <span className="small">
                {p.qtyThisMonth.toFixed(1)} {p.unit} · {p.spendThisMonth.toFixed(2)} €
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="box">
        <h4 style={{ marginTop: 0 }}>Tous les produits</h4>
        <input className="search" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
        {allProducts.length === 0 && <div className="small">Aucun produit trouvé.</div>}
        {allProducts.map((p, i) => (
          <Link
            key={p.key}
            to={`/analytics/product/${encodeURIComponent(p.key)}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: i < allProducts.length - 1 ? '1px solid #eee' : 'none',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="small">
                {p.avgWeekly.toFixed(1)} {p.unit}/sem · {p.avgMonthly.toFixed(1)} {p.unit}/mois
                {p.avgPricePerUnit != null && (
                  <>
                    {' '}
                    · {p.avgPricePerUnit.toFixed(2)} €/{p.unit} {priceArrow(p.priceDirection)}
                  </>
                )}
              </div>
            </div>
            <span className="small" style={{ flex: 'none' }}>
              {p.totalSpend.toFixed(2)} € ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
