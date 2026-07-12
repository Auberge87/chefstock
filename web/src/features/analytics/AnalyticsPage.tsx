import { useMemo, useState } from 'react'
import { Chart as ChartJS, ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Pie, Line } from 'react-chartjs-2'
import { useAnalyticsOrders } from './useAnalytics'
import { useSuppliers } from '../suppliers/useSuppliers'

ChartJS.register(ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const CHART_CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']

const RANGE_DAYS: Record<string, number> = { week: 7, month: 31, year: 366 }

export function AnalyticsPage() {
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month')
  const { data: orders, isLoading } = useAnalyticsOrders(RANGE_DAYS[range])
  const { data: suppliers } = useSuppliers()

  const { totalSpend, bySupplier, byProduct, priceHistoryByName } = useMemo(() => {
    let totalSpend = 0
    const bySupplier = new Map<string, number>()
    const byProduct = new Map<string, { qty: number; total: number; unit: string | null }>()
    const priceHistoryByName = new Map<string, { date: Date; price: number }[]>()

    for (const order of orders ?? []) {
      for (const item of order.order_items) {
        const lineTotal = (item.qty || 0) * (item.price || 0)
        totalSpend += lineTotal
        bySupplier.set(order.supplier_id, (bySupplier.get(order.supplier_id) ?? 0) + lineTotal)

        const prod = byProduct.get(item.name_snapshot) ?? { qty: 0, total: 0, unit: item.unit }
        prod.qty += item.qty || 0
        prod.total += lineTotal
        byProduct.set(item.name_snapshot, prod)

        if (item.price) {
          if (!priceHistoryByName.has(item.name_snapshot)) priceHistoryByName.set(item.name_snapshot, [])
          priceHistoryByName.get(item.name_snapshot)!.push({ date: new Date(order.sent_at), price: item.price })
        }
      }
    }
    return { totalSpend, bySupplier, byProduct, priceHistoryByName }
  }, [orders])

  const supplierEntries = useMemo(() => {
    let sorted = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])
    if (sorted.length > CHART_CATEGORICAL.length) {
      const head = sorted.slice(0, CHART_CATEGORICAL.length - 1)
      const rest = sorted.slice(CHART_CATEGORICAL.length - 1)
      const autresTotal = rest.reduce((s, [, v]) => s + v, 0)
      sorted = [...head, ['__autres', autresTotal]]
    }
    return sorted
  }, [bySupplier])

  const topProducts = useMemo(
    () => [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10),
    [byProduct],
  )

  const priceTrendTop5 = useMemo(
    () =>
      [...priceHistoryByName.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([name, hist]) => [name, [...hist].sort((a, b) => a.date.getTime() - b.date.getTime())] as const),
    [priceHistoryByName],
  )

  function supplierLabel(id: string) {
    if (id === '__autres') return 'Autres'
    return suppliers?.find((s) => s.id === id)?.name ?? id
  }

  return (
    <div>
      <div className="top">
        <h2>📊 Statistiques</h2>
      </div>
      <div className="toolbar" style={{ marginBottom: 14, gap: 6 }}>
        {(['week', 'month', 'year'] as const).map((r) => (
          <button
            key={r}
            className="btn secondary"
            style={range === r ? { background: 'var(--g)', color: '#fff', border: 'none' } : {}}
            onClick={() => setRange(r)}
          >
            {{ week: 'Semaine', month: 'Mois', year: 'Année' }[r]}
          </button>
        ))}
      </div>

      {isLoading && <div className="small">Chargement…</div>}

      <div className="box" style={{ marginBottom: 14, background: 'linear-gradient(135deg,rgba(36,92,73,0.08),rgba(36,92,73,0.02))' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--g)', margin: '8px 0' }}>≈ {totalSpend.toFixed(2)} €</div>
        <div className="small">Commandes : {orders?.length ?? 0}</div>
      </div>

      {supplierEntries.length > 0 && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Dépenses par fournisseur</h4>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px', minWidth: 180, maxHeight: 250 }}>
              <Pie
                data={{
                  labels: supplierEntries.map(([id]) => supplierLabel(id)),
                  datasets: [{ data: supplierEntries.map(([, v]) => v), backgroundColor: supplierEntries.map((_, i) => CHART_CATEGORICAL[i] ?? '#898781') }],
                }}
                options={{ plugins: { legend: { display: false } } }}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 150 }}>
              {supplierEntries.map(([id, v], i) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: CHART_CATEGORICAL[i] ?? '#898781', flex: 'none' }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{supplierLabel(id)}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{v.toFixed(2)} €</span>
                </div>
              ))}
              <div className="small" style={{ marginTop: 8 }}>
                Total : {totalSpend.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>
      )}

      {priceTrendTop5.length > 0 && (
        <div className="box" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Tendance des prix (Top 5 produits)</h4>
          <div style={{ maxHeight: 250 }}>
            <Line
              data={{
                datasets: priceTrendTop5.map(([name, hist], i) => ({
                  label: name,
                  data: hist.map((h) => ({ x: h.date.toLocaleDateString('fr-FR'), y: h.price })),
                  borderColor: CHART_CATEGORICAL[i] ?? '#898781',
                  fill: false,
                  tension: 0.3,
                })),
              }}
              options={{ plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }}
            />
          </div>
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="box">
          <h4 style={{ marginTop: 0 }}>Top 10 produits par quantité</h4>
          {topProducts.map(([name, v], i) => (
            <div
              key={name}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topProducts.length - 1 ? '1px solid #eee' : 'none' }}
            >
              <strong>{name}</strong>
              <span className="small">
                {v.qty.toFixed(1)} {v.unit} · {v.total.toFixed(2)} €
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
