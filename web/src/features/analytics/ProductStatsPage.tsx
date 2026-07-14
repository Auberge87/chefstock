import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { usePurchasingStats, type ProductStat } from './useAnalytics'
import { useSuppliers } from '../suppliers/useSuppliers'
import { categoryIcon } from '../../lib/categoryIcons'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

function priceArrow(direction: 'up' | 'down' | 'flat' | null) {
  if (direction === 'up') return <span style={{ color: 'var(--danger)' }}>▲ hausse</span>
  if (direction === 'down') return <span style={{ color: '#2a78d6' }}>▼ baisse</span>
  return <span>→ stable</span>
}

function PromoCalculator({ product }: { product: ProductStat }) {
  const [promoPrice, setPromoPrice] = useState('')
  const [months, setMonths] = useState(2)
  const refPrice = product.avgPricePerUnit

  if (refPrice == null || product.avgMonthly <= 0) return null

  const promo = Number(promoPrice.replace(',', '.'))
  const valid = promoPrice !== '' && !isNaN(promo) && promo > 0
  const qty = product.avgMonthly * months
  const normalCost = qty * refPrice
  const promoCost = qty * promo
  const savings = normalCost - promoCost

  return (
    <div className="box" style={{ marginTop: 14 }}>
      <h4 style={{ marginTop: 0 }}>🏷️ Calculateur de promotion</h4>
      <p className="small">
        Vérifiez si une promotion vaut le coup selon votre consommation habituelle ({product.avgMonthly.toFixed(1)} {product.unit}/mois).
      </p>
      <div className="rowline">
        <div className="field" style={{ flex: 1 }}>
          <label>Prix promo (€/{product.unit})</label>
          <input inputMode="decimal" placeholder={refPrice.toFixed(2)} value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Acheter pour</label>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={1}>1 mois</option>
            <option value={2}>2 mois</option>
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
          </select>
        </div>
      </div>
      {valid && (
        <div className="small" style={{ marginTop: 8, padding: 10, background: savings > 0 ? '#eaf3ef' : '#fbe9e9', borderRadius: 10 }}>
          Pour {qty.toFixed(0)} {product.unit} ({months} mois de consommation) : {promoCost.toFixed(2)} € au prix promo contre{' '}
          {normalCost.toFixed(2)} € au prix habituel ({refPrice.toFixed(2)} €/{product.unit}).
          <br />
          <strong style={{ color: savings > 0 ? 'var(--g)' : 'var(--danger)' }}>
            {savings > 0 ? `Économie estimée : ${savings.toFixed(2)} €` : `Surcoût estimé : ${Math.abs(savings).toFixed(2)} €`}
          </strong>
        </div>
      )}
    </div>
  )
}

export function ProductStatsPage() {
  const { key } = useParams<{ key: string }>()
  const stats = usePurchasingStats()
  const { data: suppliers } = useSuppliers()

  const product = useMemo(() => {
    const decoded = key ? decodeURIComponent(key) : ''
    return stats.products.find((p) => p.key === decoded)
  }, [stats.products, key])

  function supplierName(id: string) {
    const s = suppliers?.find((x) => x.id === id)
    return s ? `${s.icon} ${s.name}` : 'Fournisseur'
  }

  if (stats.isLoading) return <div className="small">Chargement…</div>
  if (!product) {
    return (
      <div>
        <Link to="/analytics" className="small">← Retour aux statistiques</Link>
        <div className="box" style={{ marginTop: 14 }}>Produit introuvable.</div>
      </div>
    )
  }

  const kgWeekly = product.kgPerUnit ? product.avgWeekly * product.kgPerUnit : null
  const kgMonthly = product.kgPerUnit ? product.avgMonthly * product.kgPerUnit : null

  return (
    <div>
      <Link to="/analytics" className="small">← Retour aux statistiques</Link>
      <div className="top" style={{ marginTop: 8 }}>
        <h2>
          {categoryIcon(product.category)} {product.name}
        </h2>
      </div>
      {product.category && <div className="small" style={{ marginBottom: 14 }}>{product.category}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Consommation moyenne</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--g)', margin: '4px 0' }}>
            {product.avgWeekly.toFixed(1)} {product.unit}/semaine
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {product.avgMonthly.toFixed(1)} {product.unit}/mois
          </div>
          {kgWeekly != null && kgMonthly != null && (
            <div className="small" style={{ marginTop: 4 }}>
              ≈ {kgWeekly.toFixed(1)} kg/sem · {kgMonthly.toFixed(1)} kg/mois
            </div>
          )}
        </div>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Prix moyen</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--g)', margin: '4px 0' }}>
            {product.avgPricePerUnit != null ? `${product.avgPricePerUnit.toFixed(2)} €/${product.unit}` : '—'}
          </div>
          {product.priceChangePct != null && (
            <div className="small">
              {priceArrow(product.priceDirection)} {Math.abs(product.priceChangePct).toFixed(0)}%
              {product.priceChangeSince && ` depuis ${product.priceChangeSince.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`}
            </div>
          )}
          {(product.minPrice != null || product.maxPrice != null) && (
            <div className="small" style={{ marginTop: 4 }}>
              Min {product.minPrice?.toFixed(2)} € · Max {product.maxPrice?.toFixed(2)} €
            </div>
          )}
        </div>
        <div className="box" style={{ flex: '1 1 160px' }}>
          <div className="small">Fournisseur principal</div>
          <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>
            {product.topSupplierId ? (
              <Link to={`/analytics/supplier/${product.topSupplierId}`} style={{ color: 'inherit' }}>
                {supplierName(product.topSupplierId)}
              </Link>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {(
          [
            ['Cette semaine', product.spendThisWeek, product.qtyThisWeek],
            ['Ce mois-ci', product.spendThisMonth, product.qtyThisMonth],
            ['Cette année', product.spendThisYear, product.qtyThisYear],
          ] as const
        ).map(([label, spend, qty]) => (
          <div key={label} className="box" style={{ flex: '1 1 140px' }}>
            <div className="small">{label}</div>
            <div style={{ fontWeight: 600 }}>{spend.toFixed(2)} €</div>
            <div className="small">
              {qty.toFixed(1)} {product.unit}
            </div>
          </div>
        ))}
      </div>

      {product.priceHistory.length > 1 && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Historique des prix</h4>
          <div style={{ maxHeight: 250 }}>
            <Line
              data={{
                datasets: [
                  {
                    label: product.name,
                    data: product.priceHistory.map((h) => ({ x: h.date.toLocaleDateString('fr-FR'), y: h.price })),
                    borderColor: '#2a78d6',
                    fill: false,
                    tension: 0.3,
                  },
                ],
              }}
              options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }}
            />
          </div>
        </div>
      )}

      {product.supplierBreakdown.length > 0 && (
        <div className="box">
          <h4 style={{ marginTop: 0 }}>Répartition par fournisseur</h4>
          {product.supplierBreakdown.map((s, i) => (
            <Link
              key={s.supplierId}
              to={`/analytics/supplier/${s.supplierId}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < product.supplierBreakdown.length - 1 ? '1px solid #eee' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span>{supplierName(s.supplierId)}</span>
              <span className="small">
                {s.qty.toFixed(1)} {product.unit} · {s.spend.toFixed(2)} €
              </span>
            </Link>
          ))}
        </div>
      )}

      <PromoCalculator product={product} />
    </div>
  )
}
